// Mock the existing utilities FIRST, before any imports
jest.mock('../../../src/utils', () => ({
    generateUniqueId: jest.fn(() => 'mock-id'),
    consoleLog: jest.fn(),
    consoleError: jest.fn(),
    consoleLogWithoutSave: jest.fn(),
    getStorage: jest.fn(),
    setStorage: jest.fn(),
    normalizeFormData: jest.fn((body: any) => {
        // normalizeFormData should return the same structure if body already has formData
        // In real code it normalizes arrays, but for tests we preserve the structure
        if (body && body.formData) {
            return body;
        }
        // If body is already formData structure, return it wrapped
        return {
            formData: {
                TvAppId: ['test-tv-app'],
                SlotStart: ['01.01.2025 10:00'],
                SlotEnd: ['01.01.2025 11:00'],
            },
        };
    }),
    parseDateTimeFromDMY: jest.fn((_date: string) => new Date('2025-01-01T11:00:00')),
}));

// Mock baltichub helper functions
jest.mock('../../../src/utils/baltichub.helper', () => ({
    isTaskCompletedInAnotherQueue: jest.fn().mockReturnValue(false),
    parseSlotsIntoButtons: jest.fn(),
    handleErrorResponse: jest.fn(),
}));

// Mock baltichub functions
jest.mock('../../../src/services/baltichub', () => ({
    getSlots: jest.fn(),
    validateRequestBeforeSlotCheck: jest.fn(),
    checkSlotAvailability: jest.fn(),
    executeRequest: jest.fn(),
}));

// Storage functions are now included in the main utils mock above

jest.mock('../../../src/utils/badge', () => ({
    updateBadge: jest.fn(),
    clearBadge: jest.fn(),
}));

// Import AFTER all mocks are declared
import { QueueManager } from '../../../src/services/queueManager';
import { RetryObject } from '../../../src/types/baltichub';
import { QueueEvents } from '../../../src/types/queue';

describe('QueueManager', () => {
    let queueManager: QueueManager;
    let mockAuthService: { isAuthenticated: jest.Mock };
    let mockEvents: QueueEvents;
    let mockGetStorage: jest.Mock;
    let mockSetStorage: jest.Mock;
    let mockConsoleLog: jest.Mock;
    let mockConsoleLogWithoutSave: jest.Mock;
    let mockConsoleError: jest.Mock;
    let mockClearBadge: jest.Mock;

    const mockRetryObject: RetryObject = {
        id: 'test-id-1',
        tvAppId: 'test-tv-app',
        startSlot: '01.01.2025 10:00:00',
        endSlot: '01.01.2025 11:00:00',
        currentSlot: '2025-01-01 10:00:00',
        status: 'in-progress',
        status_message: 'Processing',
        url: 'https://test.com',
        body: {
            formData: {
                TvAppId: ['test-tv-app'],
                SlotStart: ['01.01.2025 10:00'],
                SlotEnd: ['01.01.2025 11:00'],
            },
        },
        headersCache: [],
        timestamp: Date.now(),
        updated: false,
    };

    beforeEach(() => {
        // Reset mocks but preserve implementations
        jest.clearAllMocks();

        // Get mock functions
        const { getStorage, setStorage, normalizeFormData } = require('../../../src/utils');
        const { consoleLog, consoleLogWithoutSave, consoleError } = require('../../../src/utils');
        const { clearBadge } = require('../../../src/utils/badge');

        mockGetStorage = getStorage;
        mockSetStorage = setStorage;
        mockConsoleLog = consoleLog;
        mockConsoleLogWithoutSave = consoleLogWithoutSave;
        mockConsoleError = consoleError;
        mockClearBadge = clearBadge;

        // Restore normalizeFormData implementation after clearAllMocks
        normalizeFormData.mockImplementation((body: any) => {
            if (body && body.formData) {
                return body;
            }
            return {
                formData: {
                    TvAppId: ['test-tv-app'],
                    SlotStart: ['01.01.2025 10:00'],
                    SlotEnd: ['01.01.2025 11:00'],
                },
            };
        });

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

        it('should not add success status item if no same tvAppId exists', async () => {
            mockGetStorage.mockResolvedValue({ testQueue: [] });

            const successItem = { ...mockRetryObject, status: 'success' };
            const result = await queueManager.addToQueue(successItem);

            expect(result).toHaveLength(0);
            expect(mockConsoleLog).toHaveBeenCalledWith(
                expect.stringContaining("Item with status 'success'"),
            );
        });

        it('should add success status item if same tvAppId exists', async () => {
            // existingItem has tvAppId 'test-tv-app' and startSlot '01.01.2025 10:00:00'
            const existingItem = { ...mockRetryObject, id: 'existing-id', status: 'in-progress' };
            mockGetStorage.mockResolvedValue({ testQueue: [existingItem] });
            mockSetStorage.mockResolvedValue(undefined);

            // successItem has same tvAppId 'test-tv-app' but different startSlot
            // So hasSameTvAppId returns true (same tvAppId exists)
            // But isDuplicate returns false (different startSlot)
            // Therefore, the item should be added (because !hasSameTvAppId is false, so condition passes)
            const successItem = {
                ...mockRetryObject,
                status: 'success',
                id: 'new-id',
                tvAppId: 'test-tv-app', // Same tvAppId as existingItem
                startSlot: '01.01.2025 11:00:00', // Different startSlot to avoid duplicate check
                body: {
                    formData: {
                        TvAppId: ['test-tv-app'],
                        SlotStart: ['01.01.2025 11:00'], // Different time
                        SlotEnd: ['01.01.2025 12:00'],
                    },
                },
            };
            const result = await queueManager.addToQueue(successItem);

            expect(result).toHaveLength(2);
            expect(result.find(item => item.id === 'new-id')).toBeDefined();
            expect(result.find(item => item.id === 'existing-id')).toBeDefined();
        });

        it('should generate id if not present', async () => {
            mockGetStorage.mockResolvedValue({ testQueue: [] });
            mockSetStorage.mockResolvedValue(undefined);

            const itemWithoutId: Omit<typeof mockRetryObject, 'id'> & { id?: string } = {
                ...mockRetryObject,
            };
            delete itemWithoutId.id;

            const { generateUniqueId } = require('../../../src/utils');
            generateUniqueId.mockReturnValue('generated-id');

            const result = await queueManager.addToQueue(itemWithoutId as any);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('generated-id');
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

    describe('removeMultipleFromQueue', () => {
        it('should remove multiple items by ids', async () => {
            const item1 = { ...mockRetryObject, id: 'id-1' };
            const item2 = { ...mockRetryObject, id: 'id-2' };
            const item3 = { ...mockRetryObject, id: 'id-3' };
            const existingQueue = [item1, item2, item3];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });
            mockSetStorage.mockResolvedValue(undefined);

            const result = await queueManager.removeMultipleFromQueue(['id-1', 'id-3']);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('id-2');
            expect(mockEvents.onItemRemoved).toHaveBeenCalledTimes(2);
            expect(mockEvents.onItemRemoved).toHaveBeenCalledWith('id-1');
            expect(mockEvents.onItemRemoved).toHaveBeenCalledWith('id-3');
            expect(mockSetStorage).toHaveBeenCalledWith({
                testQueue: [item2],
            });
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

    describe('updateEntireQueue', () => {
        it('should update entire queue', async () => {
            const newQueue = [
                { ...mockRetryObject, id: 'new-id-1' },
                { ...mockRetryObject, id: 'new-id-2' },
            ];
            mockSetStorage.mockResolvedValue(undefined);

            const result = await queueManager.updateEntireQueue(newQueue);

            expect(result).toEqual(newQueue);
            expect(mockSetStorage).toHaveBeenCalledWith({ testQueue: newQueue });
            expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Entire'));
        });
    });

    describe('startProcessing', () => {
        let mockGetSlots: jest.Mock;
        let mockValidateRequest: jest.Mock;
        let mockCheckSlotAvailability: jest.Mock;
        let mockExecuteRequest: jest.Mock;

        beforeEach(() => {
            // Get fresh references to mocks after each test
            const baltichub = require('../../../src/services/baltichub');
            mockGetSlots = baltichub.getSlots;
            mockValidateRequest = baltichub.validateRequestBeforeSlotCheck;
            mockCheckSlotAvailability = baltichub.checkSlotAvailability;
            mockExecuteRequest = baltichub.executeRequest;

            // Clear call history but keep implementations
            mockGetSlots.mockClear();
            mockValidateRequest.mockClear();
            mockCheckSlotAvailability.mockClear();
            mockExecuteRequest.mockClear();

            // Default mocks - these will be used by dynamic imports
            mockGetSlots.mockResolvedValue({
                ok: true,
                text: jest.fn().mockResolvedValue('<html>slots</html>'),
            });
            mockValidateRequest.mockResolvedValue(null); // Validation passed
            mockCheckSlotAvailability.mockResolvedValue(true); // Slot available
            mockExecuteRequest.mockResolvedValue({
                ...mockRetryObject,
                status: 'success',
                status_message: 'Processed',
            });
        });

        it('should start processing when not already running', async () => {
            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });
            mockSetStorage.mockResolvedValue(undefined);

            queueManager.startProcessing({
                intervalMin: 10,
                intervalMax: 20,
            });

            // Wait for processing to start
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockEvents.onProcessingStarted).toHaveBeenCalled();
            expect(mockGetSlots).toHaveBeenCalled();
        });

        it('should not start processing if already running', async () => {
            queueManager.startProcessing();
            queueManager.startProcessing(); // Second call

            expect(mockConsoleLog).toHaveBeenCalledWith('Processing is already running');
        });

        it('should stop processing when user is not authenticated', async () => {
            mockAuthService.isAuthenticated.mockResolvedValue(false);
            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });

            queueManager.startProcessing({
                intervalMin: 10,
                intervalMax: 20,
            });

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockClearBadge).toHaveBeenCalled();
        });

        it('should stop processing when retryEnabled is false', async () => {
            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });

            queueManager.startProcessing({
                intervalMin: 10,
                intervalMax: 20,
                retryEnabled: false,
            });

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockEvents.onProcessingStarted).toHaveBeenCalled();
            expect(mockEvents.onProcessingStopped).toHaveBeenCalled();
        });

        it('should handle processing errors gracefully', async () => {
            mockExecuteRequest.mockRejectedValue(new Error('Processing failed'));
            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });
            mockSetStorage.mockResolvedValue(undefined);

            queueManager.startProcessing({
                intervalMin: 10,
                intervalMax: 20,
            });

            await new Promise(resolve => setTimeout(resolve, 50));

            // Error should be logged and item should be updated to error status
            expect(mockConsoleError).toHaveBeenCalledWith(
                'Error processing request test-id-1 for date 01.01.2025:',
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

            queueManager.startProcessing({
                intervalMin: 10,
                intervalMax: 20,
            });

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockEvents.onProcessingError).toHaveBeenCalledWith(expect.any(Error));
        });

        it('should process requests successfully when slot is available', async () => {
            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });
            mockSetStorage.mockResolvedValue(undefined);

            queueManager.startProcessing({
                intervalMin: 10,
                intervalMax: 20,
            });

            // Wait for processing to complete
            await new Promise(resolve => setTimeout(resolve, 50));

            // Verify that getSlots was called with the date
            expect(mockGetSlots).toHaveBeenCalledWith('01.01.2025');
            // Verify that validateRequestBeforeSlotCheck was called
            expect(mockValidateRequest).toHaveBeenCalled();
            // Verify that checkSlotAvailability was called
            expect(mockCheckSlotAvailability).toHaveBeenCalled();
            // Verify that executeRequest was called
            expect(mockExecuteRequest).toHaveBeenCalled();
            // Verify that item was updated
            expect(mockSetStorage).toHaveBeenCalled();
        });

        it('should keep request in queue when slot is not available', async () => {
            mockCheckSlotAvailability.mockResolvedValue(false); // Slot not available

            const existingQueue = [{ ...mockRetryObject, status_color: 'red' }];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });
            mockSetStorage.mockResolvedValue(undefined);

            queueManager.startProcessing({
                intervalMin: 10,
                intervalMax: 20,
            });

            // Wait for processing to complete
            await new Promise(resolve => setTimeout(resolve, 50));

            // Verify that getSlots was called
            expect(mockGetSlots).toHaveBeenCalled();
            // Verify that checkSlotAvailability was called
            expect(mockCheckSlotAvailability).toHaveBeenCalled();
            // Verify that executeRequest was NOT called (slot not available)
            expect(mockExecuteRequest).not.toHaveBeenCalled();
            // Verify that status_color was removed
            expect(mockSetStorage).toHaveBeenCalledWith({
                testQueue: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'test-id-1',
                        status_color: undefined,
                    }),
                ]),
            });
        });

        it('should handle validation errors', async () => {
            // Mock validation to return error status
            mockValidateRequest.mockResolvedValue({
                ...mockRetryObject,
                status: 'expired',
                status_message: 'Request expired',
            });

            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });
            mockSetStorage.mockResolvedValue(undefined);

            queueManager.startProcessing({
                intervalMin: 10,
                intervalMax: 20,
            });

            // Wait for processing to complete
            await new Promise(resolve => setTimeout(resolve, 50));

            // Verify that validateRequestBeforeSlotCheck was called
            expect(mockValidateRequest).toHaveBeenCalled();
            // Verify that checkSlotAvailability was NOT called (validation failed)
            expect(mockCheckSlotAvailability).not.toHaveBeenCalled();
            // Verify that item was updated with error status
            expect(mockSetStorage).toHaveBeenCalledWith({
                testQueue: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'test-id-1',
                        status: 'expired',
                    }),
                ]),
            });
        });

        it('should handle empty batch', async () => {
            const existingQueue = [{ ...mockRetryObject, status: 'success' }];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });

            queueManager.startProcessing({
                intervalMin: 10,
                intervalMax: 20,
            });

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockGetSlots).not.toHaveBeenCalled();
        });

        it('should handle empty unique dates', async () => {
            const { normalizeFormData } = require('../../../src/utils');
            // Mock normalizeFormData to throw error, which will be caught in createDateSubscriptions
            normalizeFormData.mockImplementation(() => {
                throw new Error('Parse error');
            });

            // Create a request without startSlot to test error handling in normalizeFormData
            const requestWithoutStartSlot = {
                ...mockRetryObject,
                startSlot: '', // Empty startSlot forces use of normalizeFormData
            };
            const existingQueue = [requestWithoutStartSlot];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });

            queueManager.startProcessing({
                intervalMin: 10,
                intervalMax: 20,
            });

            await new Promise(resolve => setTimeout(resolve, 50));

            // createDateSubscriptions will catch the error and skip the request
            // So subscriptions will be empty, and getSlots should not be called
            expect(mockGetSlots).not.toHaveBeenCalled();
        });

        it('should handle error reading slots text', async () => {
            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });
            mockSetStorage.mockResolvedValue(undefined);

            // getSlots returns successful Response, but text() throws error
            const mockText = jest.fn().mockRejectedValue(new Error('Text read error'));
            mockGetSlots.mockResolvedValue({
                ok: true,
                text: mockText,
            });

            queueManager.startProcessing({
                intervalMin: 10,
                intervalMax: 20,
            });

            // Wait longer to ensure processing completes
            await new Promise(resolve => setTimeout(resolve, 200));

            // getSlots should be called with the date extracted from SlotStart
            expect(mockGetSlots).toHaveBeenCalledWith('01.01.2025');
            expect(mockConsoleError).toHaveBeenCalledWith(
                expect.stringContaining('Error reading slots text'),
                expect.any(Error),
            );
        });

        it('should handle getSlots rejection', async () => {
            const existingQueue = [mockRetryObject];
            // First call for getQueue, then multiple calls for updateQueueItem
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });
            mockSetStorage.mockResolvedValue(undefined);

            // getSlots throws error, which gets caught and converted to ErrorResponse
            mockGetSlots.mockRejectedValue(new Error('Network error'));

            queueManager.startProcessing({
                intervalMin: 10,
                intervalMax: 20,
            });

            // Wait longer to ensure processing completes
            await new Promise(resolve => setTimeout(resolve, 200));

            // Should update queue item with error status
            // getSlots should be called with the date from SlotStart
            expect(mockGetSlots).toHaveBeenCalledWith('01.01.2025');
            expect(mockSetStorage).toHaveBeenCalled();
        });

        it('should handle getSlots error response', async () => {
            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });
            mockSetStorage.mockResolvedValue(undefined);

            // getSlots returns ErrorResponse directly
            mockGetSlots.mockResolvedValue({
                ok: false,
                error: {
                    type: 'NETWORK',
                    message: 'Network error',
                },
            });

            queueManager.startProcessing({
                intervalMin: 10,
                intervalMax: 20,
            });

            // Wait longer to ensure processing completes
            await new Promise(resolve => setTimeout(resolve, 200));

            // Should update queue item with error status
            // getSlots should be called with the date from SlotStart
            expect(mockGetSlots).toHaveBeenCalledWith('01.01.2025');
            expect(mockSetStorage).toHaveBeenCalled();
        });

        it('should handle error in createDateSubscriptions', async () => {
            const { normalizeFormData } = require('../../../src/utils');
            normalizeFormData.mockImplementation(() => {
                throw new Error('Parse error');
            });

            // Create a request without startSlot to test error handling in normalizeFormData
            const requestWithoutStartSlot = {
                ...mockRetryObject,
                startSlot: '', // Empty startSlot forces use of normalizeFormData
            };
            const existingQueue = [requestWithoutStartSlot];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });

            queueManager.startProcessing({
                intervalMin: 10,
                intervalMax: 20,
            });

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockConsoleError).toHaveBeenCalledWith(
                expect.stringContaining('Error creating subscription'),
                expect.any(Error),
            );
        });

        it('should handle 401 client error', async () => {
            const { Statuses, ErrorType } = require('../../../src/data');
            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });
            mockSetStorage.mockResolvedValue(undefined);

            // getSlots returns ErrorResponse directly (not throwing)
            mockGetSlots.mockResolvedValue({
                ok: false,
                error: {
                    type: ErrorType.CLIENT_ERROR,
                    status: 401,
                    message: 'Unauthorized',
                },
            });

            queueManager.startProcessing({
                intervalMin: 10,
                intervalMax: 20,
            });

            // Wait longer to ensure processing completes
            await new Promise(resolve => setTimeout(resolve, 200));

            // Check that unauthorized was set (setStorage is called with {unauthorized: true})
            expect(mockSetStorage).toHaveBeenCalledWith(
                expect.objectContaining({
                    unauthorized: true,
                }),
            );
            // Check that queue item was updated
            expect(mockSetStorage).toHaveBeenCalledWith({
                testQueue: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'test-id-1',
                        status: Statuses.AUTHORIZATION_ERROR,
                    }),
                ]),
            });
        });

        it('should handle server error', async () => {
            const { Statuses, ErrorType } = require('../../../src/data');
            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });
            mockSetStorage.mockResolvedValue(undefined);

            // getSlots returns ErrorResponse directly
            mockGetSlots.mockResolvedValue({
                ok: false,
                error: {
                    type: ErrorType.SERVER_ERROR,
                    message: 'Server error',
                },
            });

            queueManager.startProcessing({
                intervalMin: 10,
                intervalMax: 20,
            });

            // Wait longer to ensure processing completes
            await new Promise(resolve => setTimeout(resolve, 200));

            // getSlots should be called with the date from SlotStart
            expect(mockGetSlots).toHaveBeenCalledWith('01.01.2025');
            expect(mockSetStorage).toHaveBeenCalledWith({
                testQueue: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'test-id-1',
                        status: Statuses.NETWORK_ERROR,
                    }),
                ]),
            });
        });

        it('should handle HTML error', async () => {
            const { Statuses, ErrorType } = require('../../../src/data');
            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });
            mockSetStorage.mockResolvedValue(undefined);

            // getSlots returns ErrorResponse directly
            mockGetSlots.mockResolvedValue({
                ok: false,
                error: {
                    type: ErrorType.HTML_ERROR,
                    message: 'HTML error',
                },
            });

            queueManager.startProcessing({
                intervalMin: 10,
                intervalMax: 20,
            });

            // Wait longer to ensure processing completes
            await new Promise(resolve => setTimeout(resolve, 200));

            // getSlots should be called with the date from SlotStart
            expect(mockGetSlots).toHaveBeenCalledWith('01.01.2025');
            expect(mockSetStorage).toHaveBeenCalledWith({
                testQueue: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'test-id-1',
                        status: Statuses.AUTHORIZATION_ERROR,
                    }),
                ]),
            });
        });

        it('should handle simple error object with 401 status', async () => {
            const { ErrorType } = require('../../../src/data');
            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });
            mockSetStorage.mockResolvedValue(undefined);

            // getSlots returns ErrorResponse directly
            mockGetSlots.mockResolvedValue({
                ok: false,
                error: {
                    type: ErrorType.CLIENT_ERROR,
                    status: 401,
                },
            });

            queueManager.startProcessing({
                intervalMin: 10,
                intervalMax: 20,
            });

            // Wait longer to ensure processing completes
            await new Promise(resolve => setTimeout(resolve, 200));

            // getSlots should be called with the date from SlotStart
            expect(mockGetSlots).toHaveBeenCalledWith('01.01.2025');
            expect(mockSetStorage).toHaveBeenCalledWith(
                expect.objectContaining({
                    unauthorized: true,
                }),
            );
        });

        it('should handle default network error', async () => {
            const { Statuses } = require('../../../src/data');
            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });
            mockSetStorage.mockResolvedValue(undefined);

            // getSlots throws error, which gets caught and converted to ErrorResponse with ErrorType.NETWORK
            mockGetSlots.mockRejectedValue(new Error('Network error'));

            queueManager.startProcessing({
                intervalMin: 10,
                intervalMax: 20,
            });

            // Wait longer to ensure processing completes
            await new Promise(resolve => setTimeout(resolve, 200));

            // getSlots should be called with the date from SlotStart
            expect(mockGetSlots).toHaveBeenCalledWith('01.01.2025');
            expect(mockSetStorage).toHaveBeenCalledWith({
                testQueue: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'test-id-1',
                        status: Statuses.NETWORK_ERROR,
                    }),
                ]),
            });
        });

        it('should handle error updating request in handleDateGroupError', async () => {
            const existingQueue = [mockRetryObject];
            // First call for getQueue in processQueueBatchWithSubscriptions
            // Then calls in updateQueueItem (which calls getQueue again)
            mockGetStorage
                .mockResolvedValueOnce({ testQueue: existingQueue }) // First getQueue call
                .mockResolvedValue({ testQueue: existingQueue }); // Subsequent getQueue calls in updateQueueItem
            // Make updateQueueItem fail by making setStorage reject on first update attempt
            mockSetStorage.mockRejectedValueOnce(new Error('Update error'));

            // getSlots throws error, which gets caught and converted to ErrorResponse
            mockGetSlots.mockRejectedValue(new Error('Network error'));

            queueManager.startProcessing({
                intervalMin: 10,
                intervalMax: 20,
            });

            // Wait longer to ensure processing completes
            await new Promise(resolve => setTimeout(resolve, 200));

            // Should have error updating request (when setStorage rejects in updateQueueItem)
            // getSlots should be called with the date from SlotStart
            expect(mockGetSlots).toHaveBeenCalledWith('01.01.2025');
            expect(mockConsoleError).toHaveBeenCalledWith(
                expect.stringContaining('Error updating request'),
                expect.any(Error),
            );
        });

        describe('pausedUntil functionality', () => {
            it('should skip processing requests that are paused', async () => {
                const pausedRequest = {
                    ...mockRetryObject,
                    id: 'paused-request',
                    pausedUntil: Date.now() + 60 * 1000, // paused for 1 minute
                };
                mockGetStorage.mockResolvedValue({ testQueue: [pausedRequest] });
                mockSetStorage.mockResolvedValue(undefined);

                queueManager.startProcessing({
                    intervalMin: 10,
                    intervalMax: 20,
                });

                await new Promise(resolve => setTimeout(resolve, 100));

                // executeRequest should NOT be called because request is paused
                expect(mockExecuteRequest).not.toHaveBeenCalled();
            });

            it('should process requests after pause expires', async () => {
                const expiredPauseRequest = {
                    ...mockRetryObject,
                    id: 'expired-pause-request',
                    pausedUntil: Date.now() - 1000, // pause expired 1 second ago
                };
                mockGetStorage.mockResolvedValue({ testQueue: [expiredPauseRequest] });
                mockSetStorage.mockResolvedValue(undefined);

                // Setup slots response
                mockGetSlots.mockResolvedValue({
                    ok: true,
                    text: jest
                        .fn()
                        .mockResolvedValue(
                            '<button>10:00-10:59</button><button disabled>22:00-22:59</button>',
                        ),
                });

                queueManager.startProcessing({
                    intervalMin: 10,
                    intervalMax: 20,
                });

                await new Promise(resolve => setTimeout(resolve, 100));

                // getSlots SHOULD be called because pause expired
                expect(mockGetSlots).toHaveBeenCalled();
                // pausedUntil should be cleared
                expect(mockSetStorage).toHaveBeenCalledWith({
                    testQueue: expect.arrayContaining([
                        expect.objectContaining({
                            id: 'expired-pause-request',
                            pausedUntil: undefined,
                        }),
                    ]),
                });
            });

            it('should process non-paused requests while skipping paused ones', async () => {
                const pausedRequest = {
                    ...mockRetryObject,
                    id: 'paused-request',
                    tvAppId: 'paused-tv-app',
                    pausedUntil: Date.now() + 60 * 1000, // still paused
                };
                const activeRequest = {
                    ...mockRetryObject,
                    id: 'active-request',
                    tvAppId: 'active-tv-app',
                    pausedUntil: undefined, // not paused
                };
                mockGetStorage.mockResolvedValue({ testQueue: [pausedRequest, activeRequest] });
                mockSetStorage.mockResolvedValue(undefined);

                // Setup slots response
                mockGetSlots.mockResolvedValue({
                    ok: true,
                    text: jest
                        .fn()
                        .mockResolvedValue(
                            '<button>10:00-10:59</button><button disabled>22:00-22:59</button>',
                        ),
                });

                queueManager.startProcessing({
                    intervalMin: 10,
                    intervalMax: 20,
                });

                await new Promise(resolve => setTimeout(resolve, 100));

                // getSlots should be called for active request date
                expect(mockGetSlots).toHaveBeenCalledWith('01.01.2025');
            });

            it('should log remaining pause time when skipping paused request', async () => {
                const pausedRequest = {
                    ...mockRetryObject,
                    id: 'paused-request',
                    pausedUntil: Date.now() + 30 * 1000, // 30 seconds remaining
                };
                mockGetStorage.mockResolvedValue({ testQueue: [pausedRequest] });
                mockSetStorage.mockResolvedValue(undefined);

                queueManager.startProcessing({
                    intervalMin: 10,
                    intervalMax: 20,
                });

                await new Promise(resolve => setTimeout(resolve, 100));

                // Should log with remaining seconds
                expect(mockConsoleLogWithoutSave).toHaveBeenCalledWith(
                    expect.stringContaining('⏸️ Request paused for'),
                    expect.any(String),
                    expect.any(String),
                );
            });
        });

        describe('error handling in slot fetching', () => {
            it('should handle rejected promise from getSlots', async () => {
                const existingQueue = [mockRetryObject];
                mockGetStorage.mockResolvedValue({ testQueue: existingQueue });
                mockSetStorage.mockResolvedValue(undefined);

                // Mock getSlots to throw (will be caught by Promise.allSettled as rejected)
                mockGetSlots.mockImplementation(() => {
                    throw new Error('Unexpected error in getSlots');
                });

                queueManager.startProcessing({
                    intervalMin: 10,
                    intervalMax: 20,
                });

                await new Promise(resolve => setTimeout(resolve, 100));

                // Should handle the error gracefully
                expect(mockSetStorage).toHaveBeenCalled();
            });

            it('should handle getSlots returning null slots', async () => {
                const existingQueue = [mockRetryObject];
                mockGetStorage.mockResolvedValue({ testQueue: existingQueue });
                mockSetStorage.mockResolvedValue(undefined);

                // Mock getSlots to return null
                mockGetSlots.mockResolvedValue(null);

                queueManager.startProcessing({
                    intervalMin: 10,
                    intervalMax: 20,
                });

                await new Promise(resolve => setTimeout(resolve, 100));

                // Should handle null slots gracefully
                expect(mockGetSlots).toHaveBeenCalled();
            });

            it('should handle getSlots returning error response', async () => {
                const { ErrorType } = require('../../../src/data');
                const existingQueue = [mockRetryObject];
                mockGetStorage.mockResolvedValue({ testQueue: existingQueue });
                mockSetStorage.mockResolvedValue(undefined);

                // Mock getSlots to return ErrorResponse
                mockGetSlots.mockResolvedValue({
                    ok: false,
                    error: {
                        type: ErrorType.NETWORK,
                        message: 'Network error',
                    },
                });

                queueManager.startProcessing({
                    intervalMin: 10,
                    intervalMax: 20,
                });

                await new Promise(resolve => setTimeout(resolve, 100));

                // Should handle error response
                expect(mockGetSlots).toHaveBeenCalled();
            });
        });
    });

    describe('stopProcessing', () => {
        it('should stop processing and clear timeout', async () => {
            const existingQueue = [mockRetryObject];
            mockGetStorage.mockResolvedValue({ testQueue: existingQueue });

            queueManager.startProcessing({
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
