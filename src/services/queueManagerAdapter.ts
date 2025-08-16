import type { RetryObject } from '../types/baltichub';
import type { ProcessRequestFunction, ProcessingOptions } from '../types/queue';

import type { QueueManager } from './queueManager';
import { QueueManagerFactory } from './queueManagerFactory';

/**
 * Adapter class to maintain backward compatibility with the old QueueManager singleton pattern
 * This allows gradual migration from the old implementation to the new one
 */
export class QueueManagerAdapter {
    private static instance: QueueManagerAdapter | null = null;
    private queueManager!: QueueManager;

    constructor(storageKey = 'retryQueue') {
        if (QueueManagerAdapter.instance) {
            return QueueManagerAdapter.instance;
        }

        this.queueManager = QueueManagerFactory.create({
            storageKey,
            enableLogging: true,
        });

        QueueManagerAdapter.instance = this;
    }

    static getInstance(storageKey = 'retryQueue'): QueueManagerAdapter {
        if (!QueueManagerAdapter.instance) {
            QueueManagerAdapter.instance = new QueueManagerAdapter(storageKey);
        }
        return QueueManagerAdapter.instance;
    }

    // Forward all methods to the new QueueManager implementation
    async addToQueue(newItem: RetryObject): Promise<RetryObject[]> {
        return this.queueManager.addToQueue(newItem);
    }

    async removeFromQueue(id: string): Promise<RetryObject[]> {
        return this.queueManager.removeFromQueue(id);
    }

    async updateQueueItem(id: string, updateData: Partial<RetryObject>): Promise<RetryObject[]> {
        return this.queueManager.updateQueueItem(id, updateData);
    }

    async getQueue(): Promise<RetryObject[]> {
        return this.queueManager.getQueue();
    }

    async updateEntireQueue(newQueue: RetryObject[]): Promise<RetryObject[]> {
        return this.queueManager.updateEntireQueue(newQueue);
    }

    async startProcessing(
        processRequest: ProcessRequestFunction,
        options: ProcessingOptions = {},
    ): Promise<void> {
        return this.queueManager.startProcessing(processRequest, options);
    }

    stopProcessing(): void {
        this.queueManager.stopProcessing();
    }

    // Additional methods from the new implementation
    getProcessingState() {
        return this.queueManager.getProcessingState();
    }

    async getStatistics() {
        return this.queueManager.getStatistics();
    }

    // Method to access the underlying QueueManager for advanced usage
    getQueueManager(): QueueManager {
        return this.queueManager;
    }
}

// Export a default instance for backward compatibility
export default QueueManagerAdapter;
