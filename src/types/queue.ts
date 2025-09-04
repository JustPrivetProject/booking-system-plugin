import type { RetryObject } from './baltichub';

// Core interfaces for Queue Management
export interface IQueueManager {
    addToQueue(item: RetryObject): Promise<RetryObject[]>;
    removeFromQueue(id: string): Promise<RetryObject[]>;
    removeMultipleFromQueue(ids: string[]): Promise<RetryObject[]>;
    updateQueueItem(id: string, updates: Partial<RetryObject>): Promise<RetryObject[]>;
    getQueue(): Promise<RetryObject[]>;
    updateEntireQueue(newQueue: RetryObject[]): Promise<RetryObject[]>;
    startProcessing(
        processRequest: ProcessRequestFunction,
        options?: ProcessingOptions,
    ): Promise<void>;
    stopProcessing(): void;
}

// Authentication service interface (still needed for dependency injection)
export interface IAuthService {
    isAuthenticated(): Promise<boolean>;
}

// Processing function type
export type ProcessRequestFunction = (
    request: RetryObject,
    queue: RetryObject[],
) => Promise<RetryObject>;

// Processing options
export interface ProcessingOptions {
    intervalMin?: number;
    intervalMax?: number;
    retryEnabled?: boolean;
}

// Queue processing state
export interface QueueProcessingState {
    isProcessing: boolean;
    currentInterval: number;
    lastProcessedAt: number;
    processedCount: number;
    errorCount: number;
}

// Queue statistics
export interface QueueStatistics {
    totalItems: number;
    inProgressItems: number;
    successItems: number;
    errorItems: number;
    pausedItems: number;
    averageProcessingTime: number;
}

// Queue events
export interface QueueEvents {
    onItemAdded?: (item: RetryObject) => void;
    onItemRemoved?: (id: string) => void;
    onItemUpdated?: (id: string, updates: Partial<RetryObject>) => void;
    onProcessingStarted?: () => void;
    onProcessingStopped?: () => void;
    onProcessingError?: (error: Error) => void;
}

// Queue configuration
export interface QueueConfig {
    storageKey: string;
    retryDelay: number;
    batchSize: number;
    enableLogging: boolean;
}
