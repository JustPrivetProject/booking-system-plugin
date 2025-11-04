import type { RetryObject } from '../types/baltichub';
import type {
    IQueueManager,
    IAuthService,
    ProcessingOptions,
    QueueProcessingState,
    QueueStatistics,
    QueueEvents,
    QueueConfig,
    DateSubscriptionsMap,
} from '../types/queue';
import type { ErrorResponse } from '../utils/index';
import { updateBadge, clearBadge } from '../utils/badge';
import {
    consoleLog,
    consoleError,
    setStorage,
    generateUniqueId,
    getStorage,
    consoleLogWithoutSave,
    normalizeFormData,
} from '../utils/index';
import { Statuses, ErrorType } from '../data';
import {
    getSlots,
    checkSlotAvailability,
    executeRequest,
    validateRequestBeforeSlotCheck,
} from './baltichub';

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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _processRequest: unknown, // Deprecated: no longer used, kept for backward compatibility
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

                await this.processQueueBatchWithSubscriptions();
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

    // Subscription-based processing methods
    private async processQueueBatchWithSubscriptions(): Promise<void> {
        const queue = await this.getQueue();
        updateBadge(queue.map(req => req.status));

        const inProgressRequests = queue.filter(req => req.status === 'in-progress');
        const batch = inProgressRequests.slice(0, this.config.batchSize);

        if (batch.length === 0) {
            return;
        }

        // Step 1: Create subscriptions by date
        const subscriptions = this.createDateSubscriptions(batch);
        const uniqueDates = Array.from(subscriptions.keys());

        if (uniqueDates.length === 0) {
            return;
        }

        // Step 2: Fetch slots for all dates in parallel (no caching, always fresh)
        const slotPromises = uniqueDates.map(async date => {
            try {
                const slots = await getSlots(date);
                return { date, slots, error: null };
            } catch (error) {
                // Convert error to ErrorResponse-like structure
                const errorResponse: ErrorResponse = {
                    ok: false,
                    error: {
                        type: ErrorType.NETWORK,
                        message: error instanceof Error ? error.message : 'Unknown error',
                        originalError: error instanceof Error ? error : undefined,
                    },
                    text: async () => (error instanceof Error ? error.message : 'Unknown error'),
                };
                return {
                    date,
                    slots: null,
                    error: errorResponse,
                };
            }
        });

        // Step 3: Process all dates in parallel
        const results = await Promise.allSettled(slotPromises);

        // Step 4: Process each date result reactively
        for (let i = 0; i < results.length; i++) {
            const date = uniqueDates[i];
            const result = results[i];
            const requests = subscriptions.get(date)!;

            if (result.status === 'rejected') {
                // Handle rejection
                await this.handleDateGroupError(date, requests, new Error('Failed to fetch slots'));
                continue;
            }

            const { slots, error } = result.value;

            if (error) {
                // Handle error response
                await this.handleDateGroupError(date, requests, error);
                continue;
            }

            if (!slots || (!slots.ok && 'error' in slots)) {
                // Handle error response from getSlots
                const errorResponse = slots as ErrorResponse;
                await this.handleDateGroupError(date, requests, errorResponse);
                continue;
            }

            // Success - process all subscriptions for this date
            await this.processDateGroup(date, requests, slots, queue);
        }

        this.processingState.lastProcessedAt = Date.now();
    }

    private createDateSubscriptions(requests: RetryObject[]): DateSubscriptionsMap {
        const subscriptions = new Map<string, RetryObject[]>();

        for (const req of requests) {
            try {
                const body = normalizeFormData(req.body).formData;
                const date = body.SlotStart[0].split(' ')[0]; // "07.08.2025"

                if (!subscriptions.has(date)) {
                    subscriptions.set(date, []);
                }
                subscriptions.get(date)!.push(req);
            } catch (error) {
                consoleError(`Error creating subscription for request ${req.id}:`, error);
                // Skip invalid requests
            }
        }

        return subscriptions;
    }

    private async processDateGroup(
        date: string,
        requests: RetryObject[],
        slots: Response,
        queue: RetryObject[],
    ): Promise<void> {
        let htmlText: string;
        try {
            htmlText = await slots.text();
        } catch (error) {
            consoleError(`Error reading slots text for date ${date}:`, error);
            await this.handleDateGroupError(date, requests, error as Error);
            return;
        }

        // Process all requests for this date
        for (const req of requests) {
            try {
                const body = normalizeFormData(req.body).formData;
                const tvAppId = body.TvAppId[0];
                const time = body.SlotStart[0].split(' ');

                // Validation checks before slot availability
                const validationResult = await validateRequestBeforeSlotCheck(req, queue);
                if (validationResult !== null) {
                    await this.updateQueueItem(req.id, validationResult);
                    continue;
                }

                // Check slot availability using fresh HTML
                const isSlotAvailable = await checkSlotAvailability(htmlText, time);

                if (!isSlotAvailable) {
                    // Slot not available, keep in queue
                    consoleLogWithoutSave(
                        '❌ No slots, keeping in queue:',
                        tvAppId,
                        time.join(', '),
                    );
                    if (req.status_color) {
                        await this.updateQueueItem(req.id, { status_color: undefined });
                    }
                    continue;
                }

                // Slot available - execute request
                const updatedReq = await executeRequest(req, tvAppId, time);
                await this.updateQueueItem(req.id, updatedReq);
                this.processingState.processedCount++;

                consoleLog(`Request ${req.id} processed successfully for date ${date}`, updatedReq);
            } catch (error) {
                this.processingState.errorCount++;
                consoleError(`Error processing request ${req.id} for date ${date}:`, error);
                await this.updateQueueItem(req.id, {
                    status: 'error',
                    status_message: error instanceof Error ? error.message : 'Error on processing',
                });
            }
        }
    }

    private async handleDateGroupError(
        date: string,
        requests: RetryObject[],
        error: ErrorResponse | Error | { type: string; message: string },
    ): Promise<void> {
        for (const req of requests) {
            try {
                // Handle ErrorResponse
                if ('ok' in error && error.ok === false && 'error' in error) {
                    const errorData = error.error;
                    if (errorData.type === ErrorType.CLIENT_ERROR && errorData.status === 401) {
                        setStorage({ unauthorized: true });
                        await this.updateQueueItem(req.id, {
                            status: Statuses.AUTHORIZATION_ERROR,
                            status_message: 'Problem z autoryzacją - nieautoryzowany dostęp',
                        });
                        continue;
                    } else if (errorData.type === ErrorType.SERVER_ERROR) {
                        await this.updateQueueItem(req.id, {
                            status: Statuses.NETWORK_ERROR,
                            status_message: 'Problem z serwerem - spróbuj ponownie później',
                        });
                        continue;
                    } else if (errorData.type === ErrorType.HTML_ERROR) {
                        await this.updateQueueItem(req.id, {
                            status: Statuses.AUTHORIZATION_ERROR,
                            status_message: 'Problem z autoryzacją - strona błędu',
                        });
                        continue;
                    }
                }
                // Handle simple error objects or Error instances
                if (
                    'type' in error &&
                    error.type === ErrorType.CLIENT_ERROR &&
                    'status' in error &&
                    error.status === 401
                ) {
                    setStorage({ unauthorized: true });
                    await this.updateQueueItem(req.id, {
                        status: Statuses.AUTHORIZATION_ERROR,
                        status_message: 'Problem z autoryzacją - nieautoryzowany dostęp',
                    });
                    continue;
                }

                // Default: network error
                await this.updateQueueItem(req.id, {
                    status: Statuses.NETWORK_ERROR,
                    status_message:
                        error instanceof Error ? error.message : 'Problem z połączeniem sieciowym',
                });
            } catch (updateError) {
                consoleError(`Error updating request ${req.id}:`, updateError);
            }
        }

        this.processingState.errorCount += requests.length;
        consoleError(`Error processing date group ${date} for ${requests.length} requests:`, error);
    }
}
