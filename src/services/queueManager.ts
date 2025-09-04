import type { RetryObject } from '../types/baltichub';
import type {
    IQueueManager,
    IAuthService,
    ProcessRequestFunction,
    ProcessingOptions,
    QueueProcessingState,
    QueueStatistics,
    QueueEvents,
    QueueConfig,
} from '../types/queue';
import { updateBadge, clearBadge } from '../utils/badge';
import {
    consoleLog,
    consoleError,
    setStorage,
    generateUniqueId,
    getStorage,
    consoleLogWithoutSave,
} from '../utils/index';

export class QueueManager implements IQueueManager {
    private authService: IAuthService;
    private config: QueueConfig;
    private events: QueueEvents;
    private processingState: QueueProcessingState;
    private processingTimeoutId: NodeJS.Timeout | null = null;

    constructor(
        authService: IAuthService,
        config: Partial<QueueConfig> = {},
        events: QueueEvents = {},
    ) {
        this.authService = authService;
        this.events = events;

        this.config = {
            storageKey: 'retryQueue',
            retryDelay: 1000,
            batchSize: 10,
            enableLogging: true,
            ...config,
        };

        this.processingState = {
            isProcessing: false,
            currentInterval: 0,
            lastProcessedAt: 0,
            processedCount: 0,
            errorCount: 0,
        };
    }

    async addToQueue(newItem: RetryObject): Promise<RetryObject[]> {
        return this.withMutex(async () => {
            const queue = await this.getQueue();

            // Validate item
            if (!this.isValidItem(newItem)) {
                consoleLog('Invalid item provided to queue', newItem);
                return queue;
            }

            // Check for duplicates
            if (this.isDuplicate(newItem, queue)) {
                consoleLog(
                    `Duplicate item with tvAppId ${newItem.tvAppId} and startSlot ${newItem.startSlot} not added to ${this.config.storageKey}`,
                );
                return queue;
            }

            // Handle success status items
            if (newItem.status === 'success' && !this.hasSameTvAppId(newItem.tvAppId, queue)) {
                consoleLog(
                    `Item with status 'success' and new tvAppId ${newItem.tvAppId} not added to ${this.config.storageKey}`,
                );
                return queue;
            }

            // Add unique identifier if not present
            if (!newItem.id) {
                newItem.id = generateUniqueId();
            }

            queue.push(newItem);
            await setStorage({ [this.config.storageKey]: queue });

            consoleLog(`Item added to ${this.config.storageKey}:`, newItem);
            this.events.onItemAdded?.(newItem);

            return queue;
        });
    }

    async removeFromQueue(id: string): Promise<RetryObject[]> {
        return this.withMutex(async () => {
            const queue = await this.getQueue();
            const filteredQueue = queue.filter(item => item.id !== id);

            await setStorage({ [this.config.storageKey]: filteredQueue });

            consoleLog(`Item removed from ${this.config.storageKey}. ID:`, id);
            this.events.onItemRemoved?.(id);

            return filteredQueue;
        });
    }

    async removeMultipleFromQueue(ids: string[]): Promise<RetryObject[]> {
        return this.withMutex(async () => {
            const queue = await this.getQueue();
            const filteredQueue = queue.filter(item => !ids.includes(item.id));

            await setStorage({ [this.config.storageKey]: filteredQueue });

            consoleLog(`Items removed from ${this.config.storageKey}. IDs:`, ids);
            ids.forEach(id => this.events.onItemRemoved?.(id));

            return filteredQueue;
        });
    }

    async updateQueueItem(id: string, updates: Partial<RetryObject>): Promise<RetryObject[]> {
        return this.withMutex(async () => {
            const queue = await this.getQueue();
            const updatedQueue = queue.map(item =>
                item.id === id ? { ...item, ...updates } : item,
            );

            await setStorage({ [this.config.storageKey]: updatedQueue });

            consoleLog(`Item updated in ${this.config.storageKey}. ID:`, id);
            this.events.onItemUpdated?.(id, updates);

            return updatedQueue;
        });
    }

    async getQueue(): Promise<RetryObject[]> {
        const result = await getStorage(this.config.storageKey);
        return result[this.config.storageKey] || [];
    }

    async updateEntireQueue(newQueue: RetryObject[]): Promise<RetryObject[]> {
        return this.withMutex(async () => {
            await setStorage({ [this.config.storageKey]: newQueue });
            consoleLog(`Entire ${this.config.storageKey} updated`);
            return newQueue;
        });
    }

    async startProcessing(
        processRequest: ProcessRequestFunction,
        options: ProcessingOptions = {},
    ): Promise<void> {
        const { intervalMin = 1000, intervalMax = 5000, retryEnabled = true } = options;

        if (this.processingState.isProcessing) {
            consoleLog('Processing is already running');
            return;
        }

        this.processingState.isProcessing = true;
        this.events.onProcessingStarted?.();

        const processNextRequests = async () => {
            if (!retryEnabled) {
                this.stopProcessing();
                return;
            }

            try {
                const isAuthenticated = await this.authService.isAuthenticated();

                if (!isAuthenticated) {
                    consoleLogWithoutSave('User is not authenticated. Skipping this cycle.');
                    clearBadge();
                    this.scheduleNextProcess(intervalMin, intervalMax, processNextRequests);
                    return;
                }

                await this.processQueueBatch(processRequest);
            } catch (error) {
                this.processingState.errorCount++;
                consoleError('Error in queue processing:', error);
                this.events.onProcessingError?.(error as Error);
            }

            this.scheduleNextProcess(intervalMin, intervalMax, processNextRequests);
        };

        // Start initial processing
        processNextRequests();
    }

    stopProcessing(): void {
        this.processingState.isProcessing = false;

        if (this.processingTimeoutId) {
            clearTimeout(this.processingTimeoutId);
            this.processingTimeoutId = null;
        }

        this.events.onProcessingStopped?.();
        consoleLog('Queue processing stopped');
    }

    // Public methods for monitoring
    getProcessingState(): QueueProcessingState {
        return { ...this.processingState };
    }

    async getStatistics(): Promise<QueueStatistics> {
        const queue = await this.getQueue();
        const statusCounts = queue.reduce(
            (acc, item) => {
                acc[item.status] = (acc[item.status] || 0) + 1;
                return acc;
            },
            {} as Record<string, number>,
        );

        return {
            totalItems: queue.length,
            inProgressItems: statusCounts['in-progress'] || 0,
            successItems: statusCounts['success'] || 0,
            errorItems: statusCounts['error'] || 0,
            pausedItems: statusCounts['paused'] || 0,
            averageProcessingTime: this.calculateAverageProcessingTime(queue),
        };
    }

    // Private helper methods
    private async withMutex<T>(operation: () => Promise<T>): Promise<T> {
        // Simple mutex implementation - can be enhanced with proper locking
        return operation();
    }

    private isValidItem(item: RetryObject): boolean {
        return !!(item.tvAppId && item.startSlot && item.url && item.status);
    }

    private isDuplicate(newItem: RetryObject, queue: RetryObject[]): boolean {
        return queue.some(
            item => item.tvAppId === newItem.tvAppId && item.startSlot === newItem.startSlot,
        );
    }

    private hasSameTvAppId(tvAppId: string, queue: RetryObject[]): boolean {
        return queue.some(item => item.tvAppId === tvAppId);
    }

    private async processQueueBatch(processRequest: ProcessRequestFunction): Promise<void> {
        const queue = await this.getQueue();
        updateBadge(queue.map(req => req.status));

        const inProgressRequests = queue.filter(req => req.status === 'in-progress');
        const batch = inProgressRequests.slice(0, this.config.batchSize);

        for (const req of batch) {
            try {
                consoleLogWithoutSave(`Processing request: ${req.id}`);
                const startTime = Date.now();

                const updatedReq = await processRequest(req, queue);

                if (updatedReq.status !== 'in-progress') {
                    await this.updateQueueItem(req.id, updatedReq);
                    this.processingState.processedCount++;

                    const processingTime = Date.now() - startTime;
                    consoleLog(
                        `Request ${req.id} processed successfully in ${processingTime}ms`,
                        updatedReq,
                    );
                }
            } catch (error) {
                this.processingState.errorCount++;
                consoleError(`Error processing request ${req.id}:`, error);

                await this.updateQueueItem(req.id, {
                    status: 'error',
                    status_message: error instanceof Error ? error.message : 'Error on processing',
                });
            }
        }

        this.processingState.lastProcessedAt = Date.now();
    }

    private scheduleNextProcess(
        intervalMin: number,
        intervalMax: number,
        processNextRequests: () => void,
    ): void {
        const randomInterval = Math.floor(
            Math.random() * (intervalMax - intervalMin + 1) + intervalMin,
        );

        this.processingState.currentInterval = randomInterval;
        this.processingTimeoutId = setTimeout(processNextRequests, randomInterval);

        consoleLogWithoutSave(`Next processing cycle in ${randomInterval / 1000} seconds`);
    }

    private calculateAverageProcessingTime(queue: RetryObject[]): number {
        const completedItems = queue.filter(
            item => item.status === 'success' || item.status === 'error',
        );

        if (completedItems.length === 0) return 0;

        const totalTime = completedItems.reduce((sum, item) => {
            // Calculate processing time based on timestamp
            return sum + (Date.now() - item.timestamp);
        }, 0);

        return totalTime / completedItems.length;
    }
}
