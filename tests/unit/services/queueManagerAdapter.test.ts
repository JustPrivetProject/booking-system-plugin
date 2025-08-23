import { QueueManagerAdapter } from '../../../src/services/queueManagerAdapter';
import type { RetryObject } from '../../../src/types/baltichub';
import type { ProcessRequestFunction, ProcessingOptions } from '../../../src/types/queue';

// Mock QueueManagerFactory
jest.mock('../../../src/services/queueManagerFactory', () => ({
    QueueManagerFactory: {
        create: jest.fn(),
    },
}));

// Mock QueueManager
const mockQueueManager = {
    addToQueue: jest.fn(),
    removeFromQueue: jest.fn(),
    updateQueueItem: jest.fn(),
    getQueue: jest.fn(),
    updateEntireQueue: jest.fn(),
    startProcessing: jest.fn(),
    stopProcessing: jest.fn(),
    getProcessingState: jest.fn(),
    getStatistics: jest.fn(),
};

describe('QueueManagerAdapter', () => {
    const mockQueueManagerFactory =
        require('../../../src/services/queueManagerFactory').QueueManagerFactory;

    const testRetryObject: RetryObject = {
        id: 'test-id',
        url: 'https://api.example.com/endpoint',
        body: { raw: [{ bytes: new Uint8Array([1, 2, 3]).buffer }] },
        headersCache: [{ name: 'Content-Type', value: 'application/json' }],
        driverName: 'test-driver',
        containerNumber: 'MSNU2991953',
        currentSlot: '2025-07-30 19:00',
        startSlot: '05.06.2025 19:00:00',
        endSlot: '26.06.2025 00:59:00',
        status: 'paused',
        status_message: 'Test status',
        timestamp: Date.now(),
        tvAppId: 'test-app',
    };

    const testProcessRequest: ProcessRequestFunction = jest.fn();
    const testOptions: ProcessingOptions = { intervalMin: 5000, intervalMax: 10000 };

    beforeEach(() => {
        jest.clearAllMocks();
        mockQueueManagerFactory.create.mockReturnValue(mockQueueManager);

        // Reset singleton instance
        (QueueManagerAdapter as any).instance = null;
    });

    describe('Constructor and Singleton Pattern', () => {
        it('should create a new instance with default storage key', () => {
            const adapter = new QueueManagerAdapter();

            expect(mockQueueManagerFactory.create).toHaveBeenCalledWith({
                storageKey: 'retryQueue',
                enableLogging: true,
            });
            expect(adapter).toBeInstanceOf(QueueManagerAdapter);
        });

        it('should create a new instance with custom storage key', () => {
            new QueueManagerAdapter('customQueue');

            expect(mockQueueManagerFactory.create).toHaveBeenCalledWith({
                storageKey: 'customQueue',
                enableLogging: true,
            });
        });

        it('should return the same instance when called multiple times (singleton)', () => {
            const adapter1 = new QueueManagerAdapter();
            const adapter2 = new QueueManagerAdapter();

            expect(adapter1).toBe(adapter2);
            expect(mockQueueManagerFactory.create).toHaveBeenCalledTimes(1);
        });

        it('should maintain singleton behavior across different storage keys', () => {
            const adapter1 = new QueueManagerAdapter('key1');
            const adapter2 = new QueueManagerAdapter('key2');

            expect(adapter1).toBe(adapter2);
            // Should use the first storage key
            expect(mockQueueManagerFactory.create).toHaveBeenCalledWith({
                storageKey: 'key1',
                enableLogging: true,
            });
        });
    });

    describe('getInstance Static Method', () => {
        it('should return existing instance when available', () => {
            const adapter1 = QueueManagerAdapter.getInstance();
            const adapter2 = QueueManagerAdapter.getInstance();

            expect(adapter1).toBe(adapter2);
            expect(mockQueueManagerFactory.create).toHaveBeenCalledTimes(1);
        });

        it('should create new instance when none exists', () => {
            const adapter = QueueManagerAdapter.getInstance();

            expect(adapter).toBeInstanceOf(QueueManagerAdapter);
            expect(mockQueueManagerFactory.create).toHaveBeenCalledWith({
                storageKey: 'retryQueue',
                enableLogging: true,
            });
        });

        it('should use custom storage key when provided', () => {
            QueueManagerAdapter.getInstance('customKey');

            expect(mockQueueManagerFactory.create).toHaveBeenCalledWith({
                storageKey: 'customKey',
                enableLogging: true,
            });
        });
    });

    describe('Queue Management Methods', () => {
        let adapter: QueueManagerAdapter;

        beforeEach(() => {
            adapter = new QueueManagerAdapter();
        });

        describe('addToQueue', () => {
            it('should forward addToQueue call to underlying QueueManager', async () => {
                const expectedQueue = [testRetryObject];
                mockQueueManager.addToQueue.mockResolvedValue(expectedQueue);

                const result = await adapter.addToQueue(testRetryObject);

                expect(mockQueueManager.addToQueue).toHaveBeenCalledWith(testRetryObject);
                expect(result).toEqual(expectedQueue);
            });

            it('should handle errors from underlying QueueManager', async () => {
                const error = new Error('Queue error');
                mockQueueManager.addToQueue.mockRejectedValue(error);

                await expect(adapter.addToQueue(testRetryObject)).rejects.toThrow('Queue error');
                expect(mockQueueManager.addToQueue).toHaveBeenCalledWith(testRetryObject);
            });
        });

        describe('removeFromQueue', () => {
            it('should forward removeFromQueue call to underlying QueueManager', async () => {
                const expectedQueue: RetryObject[] = [];
                mockQueueManager.removeFromQueue.mockResolvedValue(expectedQueue);

                const result = await adapter.removeFromQueue('test-id');

                expect(mockQueueManager.removeFromQueue).toHaveBeenCalledWith('test-id');
                expect(result).toEqual(expectedQueue);
            });

            it('should handle errors from underlying QueueManager', async () => {
                const error = new Error('Remove error');
                mockQueueManager.removeFromQueue.mockRejectedValue(error);

                await expect(adapter.removeFromQueue('test-id')).rejects.toThrow('Remove error');
                expect(mockQueueManager.removeFromQueue).toHaveBeenCalledWith('test-id');
            });
        });

        describe('updateQueueItem', () => {
            it('should forward updateQueueItem call to underlying QueueManager', async () => {
                const updateData = { status: 'success' };
                const expectedQueue = [{ ...testRetryObject, ...updateData }];
                mockQueueManager.updateQueueItem.mockResolvedValue(expectedQueue);

                const result = await adapter.updateQueueItem('test-id', updateData);

                expect(mockQueueManager.updateQueueItem).toHaveBeenCalledWith(
                    'test-id',
                    updateData,
                );
                expect(result).toEqual(expectedQueue);
            });

            it('should handle errors from underlying QueueManager', async () => {
                const error = new Error('Update error');
                mockQueueManager.updateQueueItem.mockRejectedValue(error);

                await expect(
                    adapter.updateQueueItem('test-id', { status: 'error' }),
                ).rejects.toThrow('Update error');
                expect(mockQueueManager.updateQueueItem).toHaveBeenCalledWith('test-id', {
                    status: 'error',
                });
            });
        });

        describe('getQueue', () => {
            it('should forward getQueue call to underlying QueueManager', async () => {
                const expectedQueue = [testRetryObject];
                mockQueueManager.getQueue.mockResolvedValue(expectedQueue);

                const result = await adapter.getQueue();

                expect(mockQueueManager.getQueue).toHaveBeenCalled();
                expect(result).toEqual(expectedQueue);
            });

            it('should handle errors from underlying QueueManager', async () => {
                const error = new Error('Get queue error');
                mockQueueManager.getQueue.mockRejectedValue(error);

                await expect(adapter.getQueue()).rejects.toThrow('Get queue error');
                expect(mockQueueManager.getQueue).toHaveBeenCalled();
            });
        });

        describe('updateEntireQueue', () => {
            it('should forward updateEntireQueue call to underlying QueueManager', async () => {
                const newQueue = [testRetryObject];
                mockQueueManager.updateEntireQueue.mockResolvedValue(newQueue);

                const result = await adapter.updateEntireQueue(newQueue);

                expect(mockQueueManager.updateEntireQueue).toHaveBeenCalledWith(newQueue);
                expect(result).toEqual(newQueue);
            });

            it('should handle errors from underlying QueueManager', async () => {
                const error = new Error('Update entire queue error');
                mockQueueManager.updateEntireQueue.mockRejectedValue(error);

                await expect(adapter.updateEntireQueue([])).rejects.toThrow(
                    'Update entire queue error',
                );
                expect(mockQueueManager.updateEntireQueue).toHaveBeenCalledWith([]);
            });
        });
    });

    describe('Processing Methods', () => {
        let adapter: QueueManagerAdapter;

        beforeEach(() => {
            adapter = new QueueManagerAdapter();
        });

        describe('startProcessing', () => {
            it('should forward startProcessing call to underlying QueueManager', async () => {
                mockQueueManager.startProcessing.mockResolvedValue(undefined);

                await adapter.startProcessing(testProcessRequest, testOptions);

                expect(mockQueueManager.startProcessing).toHaveBeenCalledWith(
                    testProcessRequest,
                    testOptions,
                );
            });

            it('should forward startProcessing call with default options', async () => {
                mockQueueManager.startProcessing.mockResolvedValue(undefined);

                await adapter.startProcessing(testProcessRequest);

                expect(mockQueueManager.startProcessing).toHaveBeenCalledWith(
                    testProcessRequest,
                    {},
                );
            });

            it('should handle errors from underlying QueueManager', async () => {
                const error = new Error('Start processing error');
                mockQueueManager.startProcessing.mockRejectedValue(error);

                await expect(
                    adapter.startProcessing(testProcessRequest, testOptions),
                ).rejects.toThrow('Start processing error');
                expect(mockQueueManager.startProcessing).toHaveBeenCalledWith(
                    testProcessRequest,
                    testOptions,
                );
            });
        });

        describe('stopProcessing', () => {
            it('should forward stopProcessing call to underlying QueueManager', () => {
                adapter.stopProcessing();

                expect(mockQueueManager.stopProcessing).toHaveBeenCalled();
            });
        });
    });

    describe('Additional Methods', () => {
        let adapter: QueueManagerAdapter;

        beforeEach(() => {
            adapter = new QueueManagerAdapter();
        });

        describe('getProcessingState', () => {
            it('should forward getProcessingState call to underlying QueueManager', () => {
                const expectedState = { isProcessing: true, lastProcessed: Date.now() };
                mockQueueManager.getProcessingState.mockReturnValue(expectedState);

                const result = adapter.getProcessingState();

                expect(mockQueueManager.getProcessingState).toHaveBeenCalled();
                expect(result).toEqual(expectedState);
            });
        });

        describe('getStatistics', () => {
            it('should forward getStatistics call to underlying QueueManager', async () => {
                const expectedStats = { totalItems: 5, processedItems: 3, failedItems: 1 };
                mockQueueManager.getStatistics.mockResolvedValue(expectedStats);

                const result = await adapter.getStatistics();

                expect(mockQueueManager.getStatistics).toHaveBeenCalled();
                expect(result).toEqual(expectedStats);
            });

            it('should handle errors from underlying QueueManager', async () => {
                const error = new Error('Statistics error');
                mockQueueManager.getStatistics.mockRejectedValue(error);

                await expect(adapter.getStatistics()).rejects.toThrow('Statistics error');
                expect(mockQueueManager.getStatistics).toHaveBeenCalled();
            });
        });

        describe('getQueueManager', () => {
            it('should return the underlying QueueManager instance', () => {
                const result = adapter.getQueueManager();

                expect(result).toBe(mockQueueManager);
            });
        });
    });

    describe('Integration with QueueManager', () => {
        it('should maintain consistent state across method calls', async () => {
            const adapter = new QueueManagerAdapter();
            const testQueue = [testRetryObject];

            // Setup mocks
            mockQueueManager.addToQueue.mockResolvedValue(testQueue);
            mockQueueManager.getQueue.mockResolvedValue(testQueue);
            mockQueueManager.getProcessingState.mockReturnValue({ isProcessing: false });

            // Perform operations
            await adapter.addToQueue(testRetryObject);
            const queue = await adapter.getQueue();
            const state = adapter.getProcessingState();

            // Verify all operations used the same underlying QueueManager
            expect(mockQueueManager.addToQueue).toHaveBeenCalledWith(testRetryObject);
            expect(queue).toEqual(testQueue);
            expect(state).toEqual({ isProcessing: false });
        });

        it('should handle complex workflow scenarios', async () => {
            const adapter = new QueueManagerAdapter();
            const initialQueue = [testRetryObject];
            const updatedQueue = [{ ...testRetryObject, status: 'success' }];

            // Setup mocks for a complex workflow
            mockQueueManager.addToQueue.mockResolvedValue(initialQueue);
            mockQueueManager.updateQueueItem.mockResolvedValue(updatedQueue);
            mockQueueManager.getQueue.mockResolvedValue(updatedQueue);
            mockQueueManager.removeFromQueue.mockResolvedValue([]);
            mockQueueManager.startProcessing.mockResolvedValue(undefined);
            mockQueueManager.stopProcessing.mockImplementation(() => {});

            // Simulate a complex workflow
            await adapter.addToQueue(testRetryObject);
            await adapter.updateQueueItem('test-id', { status: 'success' });
            const queue = await adapter.getQueue();
            await adapter.startProcessing(testProcessRequest);
            adapter.stopProcessing();
            await adapter.removeFromQueue('test-id');

            // Verify all operations were called correctly
            expect(mockQueueManager.addToQueue).toHaveBeenCalledWith(testRetryObject);
            expect(mockQueueManager.updateQueueItem).toHaveBeenCalledWith('test-id', {
                status: 'success',
            });
            expect(queue).toEqual(updatedQueue);
            expect(mockQueueManager.startProcessing).toHaveBeenCalledWith(testProcessRequest, {});
            expect(mockQueueManager.stopProcessing).toHaveBeenCalled();
            expect(mockQueueManager.removeFromQueue).toHaveBeenCalledWith('test-id');
        });
    });

    describe('Error Handling and Edge Cases', () => {
        let adapter: QueueManagerAdapter;

        beforeEach(() => {
            adapter = new QueueManagerAdapter();
        });

        it('should handle null or undefined parameters gracefully', async () => {
            mockQueueManager.addToQueue.mockResolvedValue([]);
            mockQueueManager.updateQueueItem.mockResolvedValue([]);

            // These should not throw errors but pass through to the underlying QueueManager
            await adapter.addToQueue(null as any);
            await adapter.updateQueueItem('test-id', null as any);

            expect(mockQueueManager.addToQueue).toHaveBeenCalledWith(null);
            expect(mockQueueManager.updateQueueItem).toHaveBeenCalledWith('test-id', null);
        });

        it('should maintain singleton behavior even after errors', () => {
            const adapter1 = new QueueManagerAdapter();

            // Simulate an error in the underlying QueueManager
            mockQueueManager.getQueue.mockRejectedValue(new Error('Test error'));

            const adapter2 = new QueueManagerAdapter();

            expect(adapter1).toBe(adapter2);
            expect(mockQueueManagerFactory.create).toHaveBeenCalledTimes(1);
        });
    });
});
