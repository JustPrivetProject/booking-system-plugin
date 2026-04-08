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
    ProcessBatchResult,
} from '../types/queue';
import type { ErrorResponse } from '../utils/index';
import { clearBadge, syncStatusBadgeFromStorage } from '../utils/badge';
import {
    consoleLog,
    consoleError,
    setStorage,
    generateUniqueId,
    getStorage,
    consoleLogWithoutSave,
    normalizeFormData,
    getFirstFormDataString,
} from '../utils/index';
import { Statuses, ErrorType, Messages } from '../data';
import {
    BOOKING_TERMINALS,
    getBookingTerminalFromUrl,
    type BookingTerminal,
} from '../types/terminal';
import { setTerminalStorageValue, TERMINAL_STORAGE_NAMESPACES } from '../utils/storage';
import {
    getSlots,
    checkSlotAvailability,
    executeRequest,
    validateRequestBeforeSlotCheck,
} from './baltichub';
import { isSlotRefreshTooOftenResponse } from '../utils/baltichub.helper';

export class QueueManager implements IQueueManager {
    private authService: IAuthService;
    private config: QueueConfig;
    private events: QueueEvents;
    private processingState: QueueProcessingState;
    private processingTimeoutId: NodeJS.Timeout | null = null;
    private recentServer500Timestamps: number[] = [];
    private readonly server500WindowMs = 2 * 60 * 1000;
    private readonly server500Threshold = 2;

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

    async updateMultipleQueueItems(
        ids: string[],
        updates: Partial<RetryObject>,
    ): Promise<RetryObject[]> {
        return this.withMutex(async () => {
            const queue = await this.getQueue();
            const idSet = new Set(ids);
            const updatedQueue = queue.map(item =>
                idSet.has(item.id) ? { ...item, ...updates } : item,
            );

            await setStorage({ [this.config.storageKey]: updatedQueue });

            consoleLog(`Items updated in ${this.config.storageKey}. IDs:`, ids);
            ids.forEach(id => this.events.onItemUpdated?.(id, updates));

            return updatedQueue;
        });
    }

    async getQueue(): Promise<RetryObject[]> {
        const result = await getStorage(this.config.storageKey);
        return (result[this.config.storageKey] as RetryObject[] | undefined) || [];
    }

    async updateEntireQueue(newQueue: RetryObject[]): Promise<RetryObject[]> {
        return this.withMutex(async () => {
            await setStorage({ [this.config.storageKey]: newQueue });
            consoleLog(`Entire ${this.config.storageKey} updated`);
            return newQueue;
        });
    }

    async startProcessing(options: ProcessingOptions = {}): Promise<void> {
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
                    this.scheduleNextProcess(intervalMin, intervalMax, processNextRequests, false);
                    return;
                }

                const { hasActiveSubscriptions, slotRefreshTooOften } =
                    await this.processQueueBatchWithSubscriptions(intervalMin, intervalMax);
                const pauseMs = slotRefreshTooOften ? 10000 : 0;
                this.scheduleNextProcess(
                    pauseMs > 0 ? pauseMs : intervalMin,
                    pauseMs > 0 ? pauseMs : intervalMax,
                    processNextRequests,
                    hasActiveSubscriptions,
                );
                return;
            } catch (error) {
                this.processingState.errorCount++;
                consoleError('Error in queue processing:', error);
                this.events.onProcessingError?.(error as Error);
            }

            this.scheduleNextProcess(intervalMin, intervalMax, processNextRequests, false);
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
        hasActiveSubscriptions: boolean = true,
    ): void {
        const randomInterval = Math.floor(
            Math.random() * (intervalMax - intervalMin + 1) + intervalMin,
        );

        this.processingState.currentInterval = randomInterval;
        this.processingTimeoutId = setTimeout(processNextRequests, randomInterval);

        if (hasActiveSubscriptions) {
            consoleLogWithoutSave(`Next processing cycle in ${randomInterval / 1000} seconds`);
        }
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
    // Returns ProcessBatchResult with hasActiveSubscriptions and slotRefreshTooOften flag
    private async processQueueBatchWithSubscriptions(
        intervalMin: number,
        intervalMax: number,
    ): Promise<ProcessBatchResult> {
        const queue = await this.getQueue();
        await syncStatusBadgeFromStorage();

        const inProgressRequests = queue.filter(req => req.status === 'in-progress');
        const batch = inProgressRequests.slice(0, this.config.batchSize);

        if (batch.length === 0) {
            return { hasActiveSubscriptions: false, slotRefreshTooOften: false };
        }

        // Step 1: Create subscriptions by date and slotType (PUSTE uses type 4)
        const subscriptions = this.createDateSlotTypeSubscriptions(batch);
        const subscriptionKeys = Array.from(subscriptions.keys());

        if (subscriptionKeys.length === 0) {
            return { hasActiveSubscriptions: false, slotRefreshTooOften: false };
        }

        let slotRefreshTooOften = false;

        // Step 2: Fetch slots SEQUENTIALLY per (date, slotType) (avoids rate limit from parallel bursts)
        for (const key of subscriptionKeys) {
            const [terminalKey, date, slotTypeStr] = key.split('|');
            const terminal =
                terminalKey === BOOKING_TERMINALS.BCT
                    ? BOOKING_TERMINALS.BCT
                    : BOOKING_TERMINALS.DCT;
            const slotType = slotTypeStr ? parseInt(slotTypeStr, 10) : 1;
            const requests = subscriptions.get(key);
            if (!requests) {
                consoleError(`No requests found for key ${key}, skipping`);
                continue;
            }

            let slots: Response | ErrorResponse | null = null;
            let error: ErrorResponse | null = null;

            try {
                slots = await getSlots(date, slotType, terminal);
            } catch (err) {
                error = {
                    ok: false,
                    error: {
                        type: ErrorType.NETWORK,
                        message: err instanceof Error ? err.message : 'Unknown error',
                        originalError: err instanceof Error ? err : undefined,
                    },
                    text: async () => (err instanceof Error ? err.message : 'Unknown error'),
                };
            }

            if (error) {
                await this.handleDateGroupError(date, requests, error);
                continue;
            }

            if (!slots || (!slots.ok && 'error' in slots)) {
                const errorResponse = slots as ErrorResponse;
                await this.handleDateGroupError(date, requests, errorResponse);
                continue;
            }

            // Parse body and check for business-level errors (200 OK + JSON error)
            let slotsText: string;
            try {
                slotsText = await slots.text();
            } catch (err) {
                await this.handleDateGroupError(date, requests, {
                    ok: false,
                    error: {
                        type: ErrorType.NETWORK,
                        message: err instanceof Error ? err.message : 'Failed to read response',
                    },
                    text: async () => '',
                });
                continue;
            }

            if (isSlotRefreshTooOftenResponse(slotsText)) {
                slotRefreshTooOften = true;
                consoleLog(
                    '⏸️ SlotRefreshTooOftenInfo: pausing 10s before next getSlots cycle',
                    date,
                );
                await this.handleDateGroupError(date, requests, {
                    ok: false,
                    error: {
                        type: ErrorType.SLOT_REFRESH_TOO_OFTEN,
                        message: Messages.SLOT_REFRESH_TOO_OFTEN,
                    },
                    text: async () => slotsText,
                });
                break;
            }

            this.clearRecentServer500Errors();

            // Success - process all subscriptions for this date
            await this.processDateGroup(
                date,
                requests,
                new Response(slotsText, { status: 200, statusText: 'OK' }),
                queue,
            );

            // Delay between getSlots calls (same interval as between cycles) to avoid rate limit
            const isLastKey = subscriptionKeys.indexOf(key) === subscriptionKeys.length - 1;
            if (!isLastKey) {
                const delayMs = Math.floor(
                    Math.random() * (intervalMax - intervalMin + 1) + intervalMin,
                );
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        this.processingState.lastProcessedAt = Date.now();
        return { hasActiveSubscriptions: true, slotRefreshTooOften };
    }

    private createDateSlotTypeSubscriptions(requests: RetryObject[]): DateSubscriptionsMap {
        const subscriptions = new Map<string, RetryObject[]>();

        for (const req of requests) {
            try {
                // Use date from req.startSlot if available (the date we're actually searching for),
                // otherwise fall back to cached date from body.SlotStart
                let date: string;
                if (req.startSlot) {
                    date = req.startSlot.split(' ')[0]; // "07.08.2025"
                    consoleLogWithoutSave(
                        '📅 Using date from req.startSlot:',
                        `RequestId=${req.id}`,
                        `tvAppId=${req.tvAppId}`,
                        `Date=${date}`,
                        `req.startSlot=${req.startSlot}`,
                    );
                } else if (req.body) {
                    const body = normalizeFormData(req.body).formData;
                    date = (getFirstFormDataString(body?.SlotStart) || '').split(' ')[0]; // "07.08.2025"
                    consoleLogWithoutSave(
                        '📅 Using date from cached body:',
                        `RequestId=${req.id}`,
                        `tvAppId=${req.tvAppId}`,
                        `Date=${date}`,
                        `Cached SlotStart=${getFirstFormDataString(body?.SlotStart) || ''}`,
                    );
                } else {
                    consoleError(`Request ${req.id} has no startSlot and no body, skipping`);
                    continue;
                }

                // Group by terminal + date + slotType so DCT and BCT never share a slot fetch cycle.
                const slotType = req.slotType ?? 1;
                const terminal = this.resolveRequestTerminal(req);
                const key = `${terminal}|${date}|${slotType}`;

                if (!subscriptions.has(key)) {
                    subscriptions.set(key, []);
                }
                const dateRequests = subscriptions.get(key);
                if (dateRequests) {
                    dateRequests.push(req);
                    consoleLogWithoutSave(
                        '📅 Added request to date/slotType group:',
                        `req.id=${req.id}`,
                        `tvAppId=${req.tvAppId}`,
                        `terminal=${terminal}`,
                        `Date=${date}`,
                        `slotType=${slotType}`,
                        `req.startSlot=${req.startSlot || 'not set'}`,
                        `Total in group=${dateRequests.length}`,
                    );
                }
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
        consoleLog(
            '📋 Processing date group:',
            `Date=${date}`,
            `Total requests=${requests.length}`,
            `Request IDs=${requests.map(r => r.id).join(', ')}`,
            `Request tvAppIds=${requests.map(r => r.tvAppId).join(', ')}`,
            `Request startSlots=${requests.map(r => r.startSlot || 'not set').join(', ')}`,
        );

        for (const req of requests) {
            try {
                const body = normalizeFormData(req.body).formData;
                const tvAppId = getFirstFormDataString(body?.TvAppId) || '';

                // Use time from req.startSlot if available (the time we're actually searching for),
                // otherwise fall back to cached time from body.SlotStart
                // IMPORTANT: Do NOT mutate req.body.formData here - it will be updated in executeRequest
                // This prevents race conditions and ensures consistency
                let time: string[];
                if (req.startSlot) {
                    time = req.startSlot.split(' ');
                } else {
                    time = (getFirstFormDataString(body?.SlotStart) || '').split(' ');
                }

                // Validate time array format
                if (!time || time.length < 2 || !time[1]) {
                    consoleError(
                        '❌ Invalid time format:',
                        `tvAppId=${tvAppId}`,
                        `req.id=${req.id}`,
                        `time=${JSON.stringify(time)}`,
                        `req.startSlot=${req.startSlot || 'not set'}`,
                    );
                    await this.updateQueueItem(req.id, {
                        status: 'error',
                        status_message: 'Invalid time format in request',
                    });
                    continue;
                }

                // Check if request is paused (e.g. after YbqToMuchTransactionInSector)
                if (req.pausedUntil && Date.now() < req.pausedUntil) {
                    const remainingSeconds = Math.ceil((req.pausedUntil - Date.now()) / 1000);
                    consoleLogWithoutSave(
                        `⏸️ Request paused for ${remainingSeconds}s:`,
                        tvAppId,
                        time.join(', '),
                    );
                    continue;
                }

                // Clear pausedUntil if pause has expired
                if (req.pausedUntil && Date.now() >= req.pausedUntil) {
                    await this.updateQueueItem(req.id, { pausedUntil: undefined });
                }

                // Validation checks before slot availability
                const validationResult = await validateRequestBeforeSlotCheck(req, queue);
                if (validationResult !== null) {
                    await this.updateQueueItem(req.id, validationResult);
                    continue;
                }

                // Check slot availability using fresh HTML
                const isSlotAvailable = await checkSlotAvailability(htmlText, time);

                const resultData = {
                    tvAppId,
                    Time: time[1]?.slice(0, 5) || 'unknown',
                    Available: isSlotAvailable,
                };
                consoleLog('📊 Slot availability:', JSON.stringify(resultData, null, 2));

                if (!isSlotAvailable) {
                    // Slot not available, keep in queue
                    // Clear custom color, updated flag, and reset message when slot is not available
                    // (this is normal "no slots" case, not "too many transactions")
                    if (req.status_color || req.updated) {
                        await this.updateQueueItem(req.id, {
                            status_color: undefined,
                            updated: undefined,
                            status_message: Messages.IN_PROGRESS,
                        });
                    }
                    continue;
                }

                // Reset updated flag before new attempt to allow fresh error detection
                // Create a copy to avoid mutating the original request object
                const clonedBody = {
                    ...req.body,
                    formData: req.body.formData ? { ...req.body.formData } : undefined,
                };

                const reqForProcessing: RetryObject = req.updated
                    ? {
                          ...req,
                          updated: false,
                          body: clonedBody,
                      }
                    : {
                          ...req,
                          body: clonedBody,
                      };

                // Slot available - execute request

                const updatedReq = await executeRequest(reqForProcessing, tvAppId, time);
                await this.updateQueueItem(req.id, updatedReq);
                this.processingState.processedCount++;
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
                if ('ok' in error && error.ok === false && 'error' in error) {
                    const errorData = error.error;
                    if (errorData.type === ErrorType.SLOT_REFRESH_TOO_OFTEN) {
                        await this.updateQueueItem(req.id, {
                            status_message: Messages.SLOT_REFRESH_TOO_OFTEN,
                        });
                        continue;
                    }

                    if (errorData.type === ErrorType.CLIENT_ERROR && errorData.status === 401) {
                        await this.markRequestUnauthorized(req);
                        await this.updateQueueItem(req.id, {
                            status: Statuses.AUTHORIZATION_ERROR,
                            status_message: 'Problem z autoryzacją - nieautoryzowany dostęp',
                        });
                        continue;
                    }

                    if (errorData.type === ErrorType.SERVER_ERROR) {
                        if (this.shouldTreatServer500AsUnauthorized()) {
                            await this.markRequestUnauthorized(req);
                            await this.updateQueueItem(req.id, {
                                status: Statuses.AUTHORIZATION_ERROR,
                                status_message:
                                    'Problem z autoryzacją - powtarzający się błąd serwera (500)',
                            });
                            continue;
                        }

                        await this.updateQueueItem(req.id, {
                            status: Statuses.NETWORK_ERROR,
                            status_message: 'Problem z serwerem - spróbuj ponownie później',
                        });
                        continue;
                    }

                    if (errorData.type === ErrorType.HTML_ERROR) {
                        await this.updateQueueItem(req.id, {
                            status: Statuses.AUTHORIZATION_ERROR,
                            status_message: 'Problem z autoryzacją - strona błędu',
                        });
                        continue;
                    }
                }

                if (
                    'type' in error &&
                    error.type === ErrorType.CLIENT_ERROR &&
                    'status' in error &&
                    error.status === 401
                ) {
                    await this.markRequestUnauthorized(req);
                    await this.updateQueueItem(req.id, {
                        status: Statuses.AUTHORIZATION_ERROR,
                        status_message: 'Problem z autoryzacją - nieautoryzowany dostęp',
                    });
                    continue;
                }

                await this.updateQueueItem(req.id, {
                    status: Statuses.NETWORK_ERROR,
                    status_message:
                        error instanceof Error ? error.message : 'Problem z połączeniem sieciowym',
                });
            } catch (updateError) {
                consoleError(`Error updating request ${req.id}:`, updateError);
            }
        }

        const isSlotRefreshTooOften =
            'error' in error && error.error?.type === ErrorType.SLOT_REFRESH_TOO_OFTEN;
        if (!isSlotRefreshTooOften) {
            this.processingState.errorCount += requests.length;
            consoleError(
                `Error processing date group ${date} for ${requests.length} requests:`,
                error,
            );
        }
    }

    private shouldTreatServer500AsUnauthorized(): boolean {
        const now = Date.now();
        this.recentServer500Timestamps = this.recentServer500Timestamps.filter(
            timestamp => now - timestamp <= this.server500WindowMs,
        );
        this.recentServer500Timestamps.push(now);

        if (this.recentServer500Timestamps.length < this.server500Threshold) {
            return false;
        }

        this.clearRecentServer500Errors();
        return true;
    }

    private clearRecentServer500Errors(): void {
        this.recentServer500Timestamps = [];
    }

    private resolveRequestTerminal(req: RetryObject): BookingTerminal {
        return req.terminal || getBookingTerminalFromUrl(req.url) || BOOKING_TERMINALS.DCT;
    }

    private async markRequestUnauthorized(req: RetryObject): Promise<void> {
        await setTerminalStorageValue(
            TERMINAL_STORAGE_NAMESPACES.UNAUTHORIZED,
            this.resolveRequestTerminal(req),
            true,
        );
    }
}
