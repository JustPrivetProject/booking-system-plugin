import type { RetryObject } from './baltichub';
import type { ErrorResponse } from '../utils/index';

// @deprecated ProcessRequestFunction is no longer used - processing logic is now internal to QueueManager

// Core interfaces for Queue Management
export interface IQueueManager {
    addToQueue(item: RetryObject): Promise<RetryObject[]>;
    removeFromQueue(id: string): Promise<RetryObject[]>;
    removeMultipleFromQueue(ids: string[]): Promise<RetryObject[]>;
    updateQueueItem(id: string, updates: Partial<RetryObject>): Promise<RetryObject[]>;
    getQueue(): Promise<RetryObject[]>;
    updateEntireQueue(newQueue: RetryObject[]): Promise<RetryObject[]>;
    startProcessing(options?: ProcessingOptions): Promise<void>;
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

// Slot subscription types for date-based processing
export type DateSubscription = {
    date: string; // "07.08.2025"
    requests: RetryObject[]; // All queue items with this date
};

export type DateSubscriptionsMap = Map<string, RetryObject[]>; // date -> requests[]

export type DateProcessingResult = {
    date: string;
    htmlText?: string;
    error?: ErrorResponse;
    processedRequests: Array<{
        request: RetryObject;
        result: RetryObject;
    }>;
};
