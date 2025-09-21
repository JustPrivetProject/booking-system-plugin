import { QueueManager } from '../../../src/services/queueManager';
import { RetryObject } from '../../../src/types/baltichub';
import { QueueEvents } from '../../../src/types/queue';

// Mock the existing utilities
jest.mock('../../../src/utils', () => ({
    generateUniqueId: jest.fn(() => 'mock-id'),
    consoleLog: jest.fn(),
    consoleError: jest.fn(),
    consoleLogWithoutSave: jest.fn(),
    getStorage: jest.fn(),
    setStorage: jest.fn(),
}));

// Storage functions are now included in the main utils mock above

jest.mock('../../../src/utils/badge', () => ({
    updateBadge: jest.fn(),
    clearBadge: jest.fn(),
}));

describe('QueueManager', () => {
    let queueManager: QueueManager;
    let mockAuthService: { isAuthenticated: jest.Mock };
    let mockEvents: QueueEvents;
    let mockGetStorage: jest.Mock;
    let mockSetStorage: jest.Mock;
    let mockConsoleLog: jest.Mock;
    let mockConsoleError: jest.Mock;
    let mockClearBadge: jest.Mock;

    const mockRetryObject: RetryObject = {
        id: 'test-id-1',
        tvAppId: 'test-tv-app',
        startSlot: '2025-01-15 10:00:00',
        endSlot: '2025-01-15 11:00:00',
        currentSlot: '2025-01-15 10:00:00',
        status: 'in-progress',
        status_message: 'Processing',
        url: 'https://test.com',
        body: undefined,
        headersCache: [],
        timestamp: Date.now(),
        updated: false, // Add the updated field with default value
    };

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Get mock functions
        const { getStorage, setStorage } = require('../../../src/utils');
        const { consoleLog, consoleError } = require('../../../src/utils');
        const { clearBadge } = require('../../../src/utils/badge');

        mockGetStorage = getStorage;
        mockSetStorage = setStorage;
        mockConsoleLog = consoleLog;
        mockConsoleError = consoleError;
        mockClearBadge = clearBadge;

        mockAuthService = {
            isAuthenticated: jest.fn().mockResolvedValue(true),
        };

        mockEvents = {
            onItemAdded: jest.fn(),
            onItemRemoved: jest.fn(),
            onItemUpdated: jest.fn(),
            onProcessingStarted: jest.fn(),
            onProcessingStopped: jest.fn(),
            onProcessingError: jest.fn(),
        };

        // Create a fresh QueueManager instance for each test to ensure clean state
        queueManager = new QueueManager(mockAuthService, { storageKey: 'testQueue' }, mockEvents);
    });

    afterEach(() => {
        // Ensure processing is always stopped after each test
        queueManager?.stopProcessing();
    });

    describe('addToQueue', () => {
        it('should add valid item to queue', async () => {
            mockGetStorage.mockResolvedValue({ testQueue: [] });
            mockSetStorage.mockResolvedValue(undefined);

            const result = await queueManager.addToQueue(mockRetryObject);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(mockRetryObject);
            expect(mockEvents.onItemAdded).toHaveBeenCalledWith(mockRetryObject);
            expect(mockSetStorage).toHaveBeenCalledWith({
                testQueue: [mockRetryObject],
            });
        });

        it('should not add duplicate items', async () => {
            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });

            const duplicateItem = { ...mockRetryObject, id: 'different-id' };
            const result = await queueManager.addToQueue(duplicateItem);

            expect(result).toHaveLength(1);
            expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Duplicate item'));
        });

        it('should not add invalid items', async () => {
            mockGetStorage.mockResolvedValue({ testQueue: [] });

            const invalidItem = { ...mockRetryObject, tvAppId: '' };
            const result = await queueManager.addToQueue(invalidItem);

            expect(result).toHaveLength(0);
            expect(mockConsoleLog).toHaveBeenCalledWith(
                'Invalid item provided to queue',
                invalidItem,
            );
        });
    });

    describe('removeFromQueue', () => {
        it('should remove item by id', async () => {
            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });
            mockSetStorage.mockResolvedValue(undefined);

            const result = await queueManager.removeFromQueue(mockRetryObject.id);

            expect(result).toHaveLength(0);
            expect(mockEvents.onItemRemoved).toHaveBeenCalledWith(mockRetryObject.id);
            expect(mockSetStorage).toHaveBeenCalledWith({ testQueue: [] });
        });
    });

    describe('updateQueueItem', () => {
        it('should update existing item', async () => {
            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });
            mockSetStorage.mockResolvedValue(undefined);

            const updates = { status: 'success', status_message: 'Completed' };
            const result = await queueManager.updateQueueItem(mockRetryObject.id, updates);

            expect(result[0].status).toBe('success');
            expect(result[0].status_message).toBe('Completed');
            expect(mockEvents.onItemUpdated).toHaveBeenCalledWith(mockRetryObject.id, updates);
        });
    });

    describe('getQueue', () => {
        it('should return empty array when queue is empty', async () => {
            mockGetStorage.mockResolvedValue({ testQueue: [] });

            const result = await queueManager.getQueue();

            expect(result).toEqual([]);
        });

        it('should return all items in queue', async () => {
            const existingQueue = [mockRetryObject, { ...mockRetryObject, id: 'test-id-2' }];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });

            const result = await queueManager.getQueue();

            expect(result).toHaveLength(2);
        });
    });

    describe('startProcessing', () => {
        const mockProcessRequest = jest.fn();

        beforeEach(() => {
            mockProcessRequest.mockImplementation(async (req: RetryObject) => ({
                ...req,
                status: 'success',
                status_message: 'Processed',
            }));
        });

        it('should start processing when not already running', async () => {
            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });
            mockSetStorage.mockResolvedValue(undefined);

            queueManager.startProcessing(mockProcessRequest, {
                intervalMin: 10,
                intervalMax: 20,
            });

            // Wait for processing to start
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockEvents.onProcessingStarted).toHaveBeenCalled();
            expect(mockProcessRequest).toHaveBeenCalled();
        });

        it('should not start processing if already running', async () => {
            queueManager.startProcessing(mockProcessRequest);
            queueManager.startProcessing(mockProcessRequest); // Second call

            expect(mockConsoleLog).toHaveBeenCalledWith('Processing is already running');
        });

        it('should stop processing when user is not authenticated', async () => {
            mockAuthService.isAuthenticated.mockResolvedValue(false);
            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });

            queueManager.startProcessing(mockProcessRequest, {
                intervalMin: 10,
                intervalMax: 20,
            });

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockClearBadge).toHaveBeenCalled();
        });

        it('should handle processing errors gracefully', async () => {
            mockProcessRequest.mockRejectedValue(new Error('Processing failed'));
            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });

            queueManager.startProcessing(mockProcessRequest, {
                intervalMin: 10,
                intervalMax: 20,
            });

            await new Promise(resolve => setTimeout(resolve, 50));

            // Error should be logged and item should be updated to error status
            expect(mockConsoleError).toHaveBeenCalledWith(
                'Error processing request test-id-1:',
                expect.any(Error),
            );
            expect(mockSetStorage).toHaveBeenCalledWith({
                testQueue: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'test-id-1',
                        status: 'error',
                        status_message: 'Processing failed',
                    }),
                ]),
            });
        });

        it('should call onProcessingError for cycle-level errors', async () => {
            // Mock getQueue to throw an error
            mockGetStorage.mockRejectedValue(new Error('Storage error'));

            queueManager.startProcessing(mockProcessRequest, {
                intervalMin: 10,
                intervalMax: 20,
            });

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockEvents.onProcessingError).toHaveBeenCalledWith(expect.any(Error));
        });

        it('should update queue item when updated flag is true even if status is in-progress', async () => {
            // Mock processRequest to return item with updated flag set to true
            mockProcessRequest.mockImplementation(async (req: RetryObject) => ({
                ...req,
                status: 'in-progress', // Status stays the same
                updated: true, // But updated flag is set
                status_message: 'Updated while in progress',
            }));

            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });
            mockSetStorage.mockResolvedValue(undefined);

            queueManager.startProcessing(mockProcessRequest, {
                intervalMin: 10,
                intervalMax: 20,
            });

            // Wait for processing to complete
            await new Promise(resolve => setTimeout(resolve, 50));

            // Verify that updateQueueItem was called even though status is still 'in-progress'
            expect(mockSetStorage).toHaveBeenCalledWith({
                testQueue: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'test-id-1',
                        status: 'in-progress',
                        status_message: 'Updated while in progress',
                        updated: false, // Should be reset to false after update
                    }),
                ]),
            });

            // Verify that mockProcessRequest was called (indicating processing occurred)
            expect(mockProcessRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'test-id-1',
                    status: 'in-progress',
                }),
                expect.any(Array),
            );
        });

        it('should reset updated flag to false after updating queue item', async () => {
            // Mock processRequest to return item with updated flag set to true
            mockProcessRequest.mockImplementation(async (req: RetryObject) => ({
                ...req,
                status: 'success',
                updated: true,
                status_message: 'Completed with update',
            }));

            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });
            mockSetStorage.mockResolvedValue(undefined);

            queueManager.startProcessing(mockProcessRequest, {
                intervalMin: 10,
                intervalMax: 20,
            });

            // Wait for processing to complete
            await new Promise(resolve => setTimeout(resolve, 50));

            // Verify that updated flag was reset to false in the stored item
            expect(mockSetStorage).toHaveBeenCalledWith({
                testQueue: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'test-id-1',
                        status: 'success',
                        status_message: 'Completed with update',
                        updated: false, // Should be reset to false
                    }),
                ]),
            });
        });
    });

    describe('stopProcessing', () => {
        it('should stop processing and clear timeout', async () => {
            const mockProcessRequest = jest.fn();
            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });

            queueManager.startProcessing(mockProcessRequest, {
                intervalMin: 10,
                intervalMax: 20,
            });
            queueManager.stopProcessing();

            expect(mockEvents.onProcessingStopped).toHaveBeenCalled();
        });
    });

    describe('getStatistics', () => {
        it('should return correct statistics', async () => {
            const items = [
                { ...mockRetryObject, id: '1', status: 'in-progress' },
                { ...mockRetryObject, id: '2', status: 'success' },
                { ...mockRetryObject, id: '3', status: 'error' },
                { ...mockRetryObject, id: '4', status: 'paused' },
            ];

            mockGetStorage.mockResolvedValue({ testQueue: items });

            const stats = await queueManager.getStatistics();

            expect(stats.totalItems).toBe(4);
            expect(stats.inProgressItems).toBe(1);
            expect(stats.successItems).toBe(1);
            expect(stats.errorItems).toBe(1);
            expect(stats.pausedItems).toBe(1);
        });
    });

    describe('getProcessingState', () => {
        it('should return current processing state', () => {
            const state = queueManager.getProcessingState();

            expect(state).toEqual({
                isProcessing: false,
                currentInterval: 0,
                lastProcessedAt: 0,
                processedCount: 0,
                errorCount: 0,
            });
        });
    });
});
