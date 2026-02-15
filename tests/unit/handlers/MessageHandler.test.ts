import { MessageHandler } from '../../../src/background/handlers/MessageHandler';
import { QueueManagerAdapter } from '../../../src/services/queueManagerAdapter';
import { Actions, Statuses } from '../../../src/data';
import { authService } from '../../../src/services/authService';
import { sessionService } from '../../../src/services/sessionService';
import { autoLoginService } from '../../../src/services/autoLoginService';
import { errorLogService } from '../../../src/services/errorLogService';

// Mock dependencies
jest.mock('../../../src/services/queueManagerAdapter');
jest.mock('../../../src/services/authService');
jest.mock('../../../src/services/sessionService');
jest.mock('../../../src/services/autoLoginService');
jest.mock('../../../src/services/errorLogService');
jest.mock('../../../src/utils/storage', () => {
    const actual = jest.requireActual('../../../src/utils/storage');
    return {
        ...actual,
        getStorage: jest.fn(),
        setStorage: jest.fn(),
        removeCachedRequest: jest.fn(),
        getOrCreateDeviceId: jest.fn(),
    };
});
jest.mock('../../../src/utils');
jest.mock('../../../src/services/baltichub');
jest.mock('../../../src/services/supabaseClient', () => ({
    supabase: {
        auth: {
            getUser: jest.fn(),
            signInWithPassword: jest.fn(),
            signOut: jest.fn(),
        },
        from: jest.fn(() => ({
            select: jest.fn(),
            insert: jest.fn(),
            update: jest.fn(),
            eq: jest.fn(),
            single: jest.fn(),
        })),
    },
}));

const mockQueueManager = {
    addToQueue: jest.fn(),
    removeFromQueue: jest.fn(),
    removeMultipleFromQueue: jest.fn(),
    updateQueueItem: jest.fn(),
    updateMultipleQueueItems: jest.fn(),
    getQueue: jest.fn(),
};

const mockSendResponse = jest.fn();

// Helper function to wait for async operations to complete
async function waitForAsyncOperations(
    mockSendResponse: jest.Mock,
    timeout: number = 2000,
): Promise<void> {
    const startTime = Date.now();
    // Wait for sendResponse to be called
    while (mockSendResponse.mock.calls.length === 0 && Date.now() - startTime < timeout) {
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    // Wait for all microtasks and promises to resolve
    // Use multiple setTimeout calls to ensure all async operations complete
    // This ensures addToQueue, removeCachedRequest, and sendResponse all complete
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 100));
    await new Promise(resolve => setTimeout(resolve, 100));
}

describe('MessageHandler', () => {
    let messageHandler: MessageHandler;
    let mockGetLastProperty: jest.Mock;
    let mockExtractFirstId: jest.Mock;
    let mockGetPropertyById: jest.Mock;
    let mockNormalizeFormData: jest.Mock;
    let mockGetStorage: jest.Mock;
    let mockSetStorage: jest.Mock;
    let mockRemoveCachedRequest: jest.Mock;
    let mockGetDriverNameAndContainer: jest.Mock;
    let mockGetLogsFromSession: jest.Mock;
    let mockClearLogsInSession: jest.Mock;
    let mockGetLocalStorageData: jest.Mock;
    let mockGetOrCreateDeviceId: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mock functions to ensure clean state
        mockQueueManager.addToQueue.mockReset();
        mockQueueManager.addToQueue.mockResolvedValue([]);
        (QueueManagerAdapter.getInstance as jest.Mock).mockReturnValue(mockQueueManager);
        messageHandler = new MessageHandler(mockQueueManager as any);

        // Mock crypto for randomUUID
        Object.defineProperty(global, 'crypto', {
            value: {
                randomUUID: jest.fn(() => 'test-uuid-12345'),
            },
            writable: true,
        });

        // Setup mocks for storage first (cleanupCache is used by utils)
        const storage = require('../../../src/utils/storage');
        mockGetStorage = storage.getStorage = jest.fn();
        mockSetStorage = storage.setStorage = jest.fn();
        mockRemoveCachedRequest = storage.removeCachedRequest = jest.fn().mockResolvedValue(true);
        mockGetOrCreateDeviceId = storage.getOrCreateDeviceId = jest.fn();

        // Setup mocks for utils (cleanupCache is re-exported from storage)
        const utils = require('../../../src/utils');
        mockGetLastProperty = utils.getLastProperty = jest.fn();
        mockExtractFirstId = utils.extractFirstId = jest.fn();
        mockGetPropertyById = utils.getPropertyById = jest.fn();
        mockNormalizeFormData = utils.normalizeFormData = jest.fn();
        mockGetLogsFromSession = utils.getLogsFromSession = jest.fn();
        mockClearLogsInSession = utils.clearLogsInSession = jest.fn();
        mockGetLocalStorageData = utils.getLocalStorageData = jest.fn();

        // Setup mocks for baltichub
        const baltichub = require('../../../src/services/baltichub');
        mockGetDriverNameAndContainer = baltichub.getDriverNameAndContainer = jest.fn();
    });

    describe('handleMessage', () => {
        it('should handle SHOW_ERROR action', async () => {
            const message = { action: Actions.SHOW_ERROR };
            const sender = {} as chrome.runtime.MessageSender;

            // Mock storage data
            const mockStorageData = {
                requestCacheHeaders: {
                    'request-1': {
                        url: 'test-url',
                        headers: [{ name: 'test', value: 'test' }],
                        timestamp: Date.now(),
                    },
                },
            };

            // Mock auth service
            (authService.getCurrentUser as jest.Mock).mockResolvedValue({
                id: 'user-1',
                email: 'test@example.com',
            });

            // Mock storage
            mockGetStorage.mockResolvedValue(mockStorageData);

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            // Note: Due to async nature, we need to wait for the promise to resolve
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        it('should handle SUCCEED_BOOKING action', async () => {
            const message = { action: Actions.SUCCEED_BOOKING };
            const sender = {} as chrome.runtime.MessageSender;

            // Mock auth service
            (authService.getCurrentUser as jest.Mock).mockResolvedValue({
                id: 'user-1',
                email: 'test@example.com',
            });

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
        });

        it('should handle PARSED_TABLE action', async () => {
            const message = {
                action: Actions.PARSED_TABLE,
                message: [['data']],
            };
            const sender = {} as chrome.runtime.MessageSender;

            mockSetStorage.mockResolvedValue(undefined);

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
        });

        it('should handle IS_AUTHENTICATED action', () => {
            const message = { action: Actions.IS_AUTHENTICATED };
            const sender = {} as chrome.runtime.MessageSender;

            (sessionService.isAuthenticated as jest.Mock).mockResolvedValue(true);

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
        });

        it('should handle GET_AUTH_STATUS action', () => {
            const message = { action: Actions.GET_AUTH_STATUS };
            const sender = {} as chrome.runtime.MessageSender;

            mockGetStorage.mockResolvedValue({ unauthorized: false });

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
        });

        it('should handle LOGIN_SUCCESS action', () => {
            const message = {
                action: Actions.LOGIN_SUCCESS,
                message: { success: true },
            };
            const sender = {} as chrome.runtime.MessageSender;

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
        });

        it('should handle AUTO_LOGIN_ATTEMPT action', () => {
            const message = {
                action: Actions.AUTO_LOGIN_ATTEMPT,
                message: { success: true },
            };
            const sender = {} as chrome.runtime.MessageSender;

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
        });

        it('should handle LOAD_AUTO_LOGIN_CREDENTIALS action', () => {
            const message = { action: Actions.LOAD_AUTO_LOGIN_CREDENTIALS };
            const sender = {} as chrome.runtime.MessageSender;

            (autoLoginService.loadCredentials as jest.Mock).mockResolvedValue({
                login: 'test@example.com',
                password: 'password123',
            });

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
        });

        it('should handle IS_AUTO_LOGIN_ENABLED action', () => {
            const message = { action: Actions.IS_AUTO_LOGIN_ENABLED };
            const sender = {} as chrome.runtime.MessageSender;

            (autoLoginService.isEnabled as jest.Mock).mockResolvedValue(true);

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
        });

        describe('background target actions', () => {
            it('should handle REMOVE_REQUEST action', () => {
                const message = {
                    target: 'background',
                    action: Actions.REMOVE_REQUEST,
                    data: { id: 'request-1' },
                };
                const sender = {} as chrome.runtime.MessageSender;

                mockQueueManager.removeFromQueue.mockResolvedValue(undefined);

                const result = messageHandler.handleMessage(message, sender, mockSendResponse);

                expect(result).toBe(true);
                expect(mockQueueManager.removeFromQueue).toHaveBeenCalledWith('request-1');
            });

            it('should handle UPDATE_REQUEST_STATUS action', () => {
                const message = {
                    target: 'background',
                    action: Actions.UPDATE_REQUEST_STATUS,
                    data: {
                        id: 'request-1',
                        status: Statuses.SUCCESS,
                        status_message: 'Success',
                    },
                };
                const sender = {} as chrome.runtime.MessageSender;

                mockQueueManager.updateQueueItem.mockResolvedValue(undefined);

                const result = messageHandler.handleMessage(message, sender, mockSendResponse);

                expect(result).toBe(true);
                expect(mockQueueManager.updateQueueItem).toHaveBeenCalledWith('request-1', {
                    status: Statuses.SUCCESS,
                    status_message: 'Success',
                });
            });

            it('should handle SEND_LOGS action', () => {
                const message = {
                    target: 'background',
                    action: Actions.SEND_LOGS,
                    data: { description: 'Test logs' },
                };
                const sender = {} as chrome.runtime.MessageSender;

                (authService.getCurrentUser as jest.Mock).mockResolvedValue({
                    id: 'user-1',
                    email: 'test@example.com',
                });

                const result = messageHandler.handleMessage(message, sender, mockSendResponse);

                expect(result).toBe(true);
            });

            it('should handle unknown action', () => {
                const message = {
                    target: 'background',
                    action: 'UNKNOWN_ACTION',
                };
                const sender = {} as chrome.runtime.MessageSender;

                const result = messageHandler.handleMessage(message, sender, mockSendResponse);

                expect(result).toBe(true);
                expect(mockSendResponse).toHaveBeenCalledWith({
                    success: false,
                });
            });
        });

        it('should return true for unknown actions', () => {
            const message = { action: 'UNKNOWN_ACTION' };
            const sender = {} as chrome.runtime.MessageSender;

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
        });
    });

    describe('error handling', () => {
        it('should handle authentication errors gracefully', async () => {
            const message = { action: Actions.SHOW_ERROR };
            const sender = {} as chrome.runtime.MessageSender;

            (authService.getCurrentUser as jest.Mock).mockResolvedValue(null);

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(mockSendResponse).toHaveBeenCalledWith({
                success: true,
                error: 'Not authorized',
            });
        });

        it('should handle storage errors gracefully', async () => {
            const message = { action: Actions.SHOW_ERROR };
            const sender = {} as chrome.runtime.MessageSender;

            (authService.getCurrentUser as jest.Mock).mockResolvedValue({
                id: 'user-1',
                email: 'test@example.com',
            });

            mockGetStorage.mockRejectedValue(new Error('Storage error'));

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(mockSendResponse).toHaveBeenCalledWith({
                success: false,
                error: 'Failed to process booking action',
            });
        });

        it('should call removeCachedRequest after adding to queue', async () => {
            // Arrange
            const message = { action: Actions.SHOW_ERROR };
            const sender = {} as chrome.runtime.MessageSender;

            const mockStorageData = {
                requestCacheHeaders: {
                    'request-1': {
                        url: 'test-url',
                        headers: [{ name: 'test', value: 'test' }],
                        timestamp: Date.now(),
                    },
                },
            };

            const mockRequestCacheBody = {
                'request-1': {
                    url: 'test-url',
                    body: {
                        formData: {
                            TvAppId: ['test-tv-id'],
                            SlotStart: ['01.01.2025 10:00'],
                            SlotEnd: ['01.01.2025 11:00'],
                        },
                    },
                    timestamp: Date.now(),
                },
            };

            (authService.getCurrentUser as jest.Mock).mockResolvedValue({
                id: 'user-1',
                email: 'test@example.com',
            });

            // Setup getStorage calls:
            // 1. First call in handleMessage for requestCacheHeaders
            // 2. Second call in processCachedRequest for [requestCacheBody, retryQueue, testEnv, tableData]
            // 3-4. Two calls inside removeCachedRequest for requestCacheBody and requestCacheHeaders
            mockGetStorage
                .mockResolvedValueOnce(mockStorageData) // First call: requestCacheHeaders
                .mockResolvedValueOnce({
                    // Second call: [requestCacheBody, retryQueue, testEnv, tableData]
                    requestCacheBody: mockRequestCacheBody,
                    retryQueue: [],
                    testEnv: false,
                    tableData: null,
                })
                .mockResolvedValueOnce({
                    // Third call: inside removeCachedRequest for requestCacheBody
                    requestCacheBody: mockRequestCacheBody,
                })
                .mockResolvedValueOnce({
                    // Fourth call: inside removeCachedRequest for requestCacheHeaders
                    requestCacheHeaders: mockStorageData.requestCacheHeaders,
                });

            mockGetDriverNameAndContainer.mockResolvedValue({
                driverName: 'Test Driver',
                containerNumber: 'TEST123',
            });
            mockNormalizeFormData.mockReturnValue({
                formData: {
                    TvAppId: ['test-tv-id'],
                    SlotStart: ['01.01.2025 10:00'],
                    SlotEnd: ['01.01.2025 11:00'],
                },
            });

            mockGetLastProperty.mockReturnValue(mockStorageData.requestCacheHeaders['request-1']);
            mockExtractFirstId.mockReturnValue('request-1');
            mockGetPropertyById.mockReturnValue(mockRequestCacheBody['request-1']);

            mockQueueManager.addToQueue.mockResolvedValue(undefined);

            // Act
            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            // Assert
            expect(result).toBe(true);

            // Wait for async operations to complete
            await waitForAsyncOperations(mockSendResponse);

            expect(mockGetStorage).toHaveBeenCalledWith('requestCacheHeaders');
            expect(mockQueueManager.addToQueue).toHaveBeenCalled();
            // removeCachedRequest calls setStorage twice: once for body, once for headers
            // After removing 'request-1', both caches should be empty (no 'request-1' key)
            expect(mockSetStorage).toHaveBeenCalledTimes(2);
            const setStorageCalls = mockSetStorage.mock.calls;
            const bodyCall = setStorageCalls.find(call => call[0].requestCacheBody !== undefined);
            const headersCall = setStorageCalls.find(
                call => call[0].requestCacheHeaders !== undefined,
            );
            expect(bodyCall).toBeDefined();
            expect(headersCall).toBeDefined();
            expect(bodyCall[0].requestCacheBody).not.toHaveProperty('request-1');
            expect(headersCall[0].requestCacheHeaders).not.toHaveProperty('request-1');
            expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
        });

        it('should create retry object with tableData and container number', async () => {
            // Arrange
            const message = { action: Actions.SHOW_ERROR };
            const sender = {} as chrome.runtime.MessageSender;

            const { TABLE_DATA_NAMES } = require('../../../src/data');

            const mockStorageData = {
                requestCacheHeaders: {
                    'request-1': {
                        url: 'test-url',
                        headers: [{ name: 'test', value: 'test' }],
                        timestamp: Date.now(),
                    },
                },
            };

            const mockRequestCacheBody = {
                'request-1': {
                    url: 'test-url',
                    body: {
                        formData: {
                            TvAppId: ['test-tv-id'],
                            SlotStart: ['01.01.2025 10:00'],
                            SlotEnd: ['01.01.2025 11:00'],
                        },
                    },
                    timestamp: Date.now(),
                },
            };

            const mockTableData = [
                [
                    TABLE_DATA_NAMES.CONTAINER_NUMBER,
                    TABLE_DATA_NAMES.ID,
                    TABLE_DATA_NAMES.SELECTED_DATE,
                    TABLE_DATA_NAMES.START,
                ],
                ['TEST123', 'test-tv-id', '01.01.2025', '10:00'],
            ];

            (authService.getCurrentUser as jest.Mock).mockResolvedValue({
                id: 'user-1',
                email: 'test@example.com',
            });

            mockGetStorage.mockResolvedValueOnce(mockStorageData).mockResolvedValueOnce({
                requestCacheBody: mockRequestCacheBody,
                retryQueue: [],
                testEnv: false,
                tableData: mockTableData,
            });

            mockRemoveCachedRequest.mockResolvedValue(true);
            mockGetDriverNameAndContainer.mockResolvedValue({
                driverName: 'Test Driver',
                containerNumber: 'TEST123',
            });
            mockNormalizeFormData.mockReturnValue({
                formData: {
                    TvAppId: ['test-tv-id'],
                    SlotStart: ['01.01.2025 10:00'],
                    SlotEnd: ['01.01.2025 11:00'],
                },
            });

            mockGetLastProperty.mockReturnValue(mockStorageData.requestCacheHeaders['request-1']);
            mockExtractFirstId.mockReturnValue('request-1');
            mockGetPropertyById.mockReturnValue(mockRequestCacheBody['request-1']);

            mockQueueManager.addToQueue.mockResolvedValue(undefined);

            // Act
            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            // Assert
            expect(result).toBe(true);
            await waitForAsyncOperations(mockSendResponse);

            expect(mockQueueManager.addToQueue).toHaveBeenCalled();
            expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
        });

        it('should create retry object with tableData searching by TV App ID', async () => {
            // Arrange
            const message = { action: Actions.SHOW_ERROR };
            const sender = {} as chrome.runtime.MessageSender;

            const { TABLE_DATA_NAMES } = require('../../../src/data');

            const mockStorageData = {
                requestCacheHeaders: {
                    'request-1': {
                        url: 'test-url',
                        headers: [{ name: 'test', value: 'test' }],
                        timestamp: Date.now(),
                    },
                },
            };

            const mockRequestCacheBody = {
                'request-1': {
                    url: 'test-url',
                    body: {
                        formData: {
                            TvAppId: ['test-tv-id'],
                            SlotStart: ['01.01.2025 10:00'],
                            SlotEnd: ['01.01.2025 11:00'],
                        },
                    },
                    timestamp: Date.now(),
                },
            };

            const mockTableData = [
                [
                    TABLE_DATA_NAMES.CONTAINER_NUMBER,
                    TABLE_DATA_NAMES.ID,
                    TABLE_DATA_NAMES.SELECTED_DATE,
                    TABLE_DATA_NAMES.START,
                ],
                ['', 'test-tv-id', '01.01.2025', '10:00'],
            ];

            (authService.getCurrentUser as jest.Mock).mockResolvedValue({
                id: 'user-1',
                email: 'test@example.com',
            });

            mockGetStorage.mockResolvedValueOnce(mockStorageData).mockResolvedValueOnce({
                requestCacheBody: mockRequestCacheBody,
                retryQueue: [],
                testEnv: false,
                tableData: mockTableData,
            });

            mockRemoveCachedRequest.mockResolvedValue(true);
            mockGetDriverNameAndContainer.mockResolvedValue({
                driverName: 'Test Driver',
                containerNumber: '', // No container number
            });
            mockNormalizeFormData.mockReturnValue({
                formData: {
                    TvAppId: ['test-tv-id'],
                    SlotStart: ['01.01.2025 10:00'],
                    SlotEnd: ['01.01.2025 11:00'],
                },
            });

            mockGetLastProperty.mockReturnValue(mockStorageData.requestCacheHeaders['request-1']);
            mockExtractFirstId.mockReturnValue('request-1');
            mockGetPropertyById.mockReturnValue(mockRequestCacheBody['request-1']);

            mockQueueManager.addToQueue.mockResolvedValue([]);

            // Act
            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            // Assert
            expect(result).toBe(true);
            await waitForAsyncOperations(mockSendResponse);

            expect(mockQueueManager.addToQueue).toHaveBeenCalled();
            expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
        });

        it('should create retry object with SUCCEED_BOOKING action', async () => {
            // Arrange
            const message = { action: Actions.SUCCEED_BOOKING };
            const sender = {} as chrome.runtime.MessageSender;

            const mockStorageData = {
                requestCacheHeaders: {
                    'request-1': {
                        url: 'test-url',
                        headers: [{ name: 'test', value: 'test' }],
                        timestamp: Date.now(),
                    },
                },
            };

            const mockRequestCacheBody = {
                'request-1': {
                    url: 'test-url',
                    body: {
                        formData: {
                            TvAppId: ['test-tv-id'],
                            SlotStart: ['01.01.2025 10:00'],
                            SlotEnd: ['01.01.2025 11:00'],
                        },
                    },
                    timestamp: Date.now(),
                },
            };

            (authService.getCurrentUser as jest.Mock).mockResolvedValue({
                id: 'user-1',
                email: 'test@example.com',
            });

            mockGetStorage.mockResolvedValueOnce(mockStorageData).mockResolvedValueOnce({
                requestCacheBody: mockRequestCacheBody,
                retryQueue: [],
                testEnv: false,
                tableData: null,
            });

            mockRemoveCachedRequest.mockResolvedValue(true);
            mockGetDriverNameAndContainer.mockResolvedValue({
                driverName: 'Test Driver',
                containerNumber: 'TEST123',
            });
            mockNormalizeFormData.mockReturnValue({
                formData: {
                    TvAppId: ['test-tv-id'],
                    SlotStart: ['01.01.2025 10:00'],
                    SlotEnd: ['01.01.2025 11:00'],
                },
            });

            mockGetLastProperty.mockReturnValue(mockStorageData.requestCacheHeaders['request-1']);
            mockExtractFirstId.mockReturnValue('request-1');
            mockGetPropertyById.mockReturnValue(mockRequestCacheBody['request-1']);

            mockQueueManager.addToQueue.mockResolvedValue([]);

            // Act
            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            // Assert
            expect(result).toBe(true);
            await waitForAsyncOperations(mockSendResponse);

            expect(mockQueueManager.addToQueue).toHaveBeenCalled();
            expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
        });

        it('should handle no requestCacheBody in processCachedRequest', async () => {
            const message = { action: Actions.SHOW_ERROR };
            const sender = {} as chrome.runtime.MessageSender;

            const mockStorageData = {
                requestCacheHeaders: {
                    'request-1': {
                        url: 'test-url',
                        headers: [{ name: 'test', value: 'test' }],
                        timestamp: Date.now(),
                    },
                },
            };

            (authService.getCurrentUser as jest.Mock).mockResolvedValue({
                id: 'user-1',
                email: 'test@example.com',
            });

            mockGetStorage.mockResolvedValueOnce(mockStorageData).mockResolvedValueOnce({
                requestCacheBody: {},
                retryQueue: [],
                testEnv: false,
                tableData: null,
            });

            mockGetLastProperty.mockReturnValue(mockStorageData.requestCacheHeaders['request-1']);
            mockExtractFirstId.mockReturnValue('request-1');
            mockGetPropertyById.mockReturnValue(null); // No requestCacheBody found

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await waitForAsyncOperations(mockSendResponse);
            expect(mockQueueManager.addToQueue).not.toHaveBeenCalled();
        });

        it('should handle error in processCachedRequest', async () => {
            const message = { action: Actions.SHOW_ERROR };
            const sender = {} as chrome.runtime.MessageSender;

            const mockStorageData = {
                requestCacheHeaders: {
                    'request-1': {
                        url: 'test-url',
                        headers: [{ name: 'test', value: 'test' }],
                        timestamp: Date.now(),
                    },
                },
            };

            (authService.getCurrentUser as jest.Mock).mockResolvedValue({
                id: 'user-1',
                email: 'test@example.com',
            });

            mockGetStorage
                .mockResolvedValueOnce(mockStorageData)
                .mockRejectedValueOnce(new Error('Storage error'));

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await waitForAsyncOperations(mockSendResponse);
            expect(mockSendResponse).toHaveBeenCalledWith({
                success: false,
                error: 'Failed to process cached request',
            });
        });

        it('should handle table parsing error', async () => {
            const message = {
                action: Actions.PARSED_TABLE,
                message: [['data']],
            };
            const sender = {} as chrome.runtime.MessageSender;

            mockSetStorage.mockRejectedValue(new Error('Storage error'));

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await waitForAsyncOperations(mockSendResponse);
            expect(mockSendResponse).toHaveBeenCalledWith({
                success: false,
                error: 'Failed to save table data',
            });
        });

        it('should handle authentication check error', async () => {
            const message = { action: Actions.IS_AUTHENTICATED };
            const sender = {} as chrome.runtime.MessageSender;

            (sessionService.isAuthenticated as jest.Mock).mockRejectedValue(
                new Error('Auth error'),
            );

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            // Wait for promise to resolve
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(mockSendResponse).toHaveBeenCalledWith({ isAuthenticated: false });
        });

        it('should handle auth status check error', async () => {
            const message = { action: Actions.GET_AUTH_STATUS };
            const sender = {} as chrome.runtime.MessageSender;

            mockGetStorage.mockRejectedValue(new Error('Storage error'));

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(mockSendResponse).toHaveBeenCalledWith({ unauthorized: false });
        });

        it('should handle LOGIN_SUCCESS with success false', async () => {
            const message = {
                action: Actions.LOGIN_SUCCESS,
                message: { success: false },
            };
            const sender = {} as chrome.runtime.MessageSender;

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(mockSendResponse).toHaveBeenCalledWith({ success: false });
        });

        it('should handle LOGIN_SUCCESS error', async () => {
            const message = {
                action: Actions.LOGIN_SUCCESS,
                message: { success: true },
            };
            const sender = {} as chrome.runtime.MessageSender;

            mockSetStorage.mockRejectedValue(new Error('Storage error'));

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(mockSendResponse).toHaveBeenCalledWith({
                success: false,
                error: 'Failed to update auth status',
            });
        });

        it('should handle AUTO_LOGIN_ATTEMPT with success false', async () => {
            const message = {
                action: Actions.AUTO_LOGIN_ATTEMPT,
                message: { success: false },
            };
            const sender = {} as chrome.runtime.MessageSender;

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(mockSendResponse).toHaveBeenCalledWith({
                success: false,
                autoLogin: true,
            });
        });

        it('should handle AUTO_LOGIN_ATTEMPT error', async () => {
            const message = {
                action: Actions.AUTO_LOGIN_ATTEMPT,
                message: { success: true },
            };
            const sender = {} as chrome.runtime.MessageSender;

            mockSetStorage.mockRejectedValue(new Error('Storage error'));

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(mockSendResponse).toHaveBeenCalledWith({
                success: false,
                autoLogin: true,
                error: 'Failed to update auth status',
            });
        });

        it('should handle corrupted auto-login credentials with special character', async () => {
            const message = { action: Actions.LOAD_AUTO_LOGIN_CREDENTIALS };
            const sender = {} as chrome.runtime.MessageSender;

            (autoLoginService.loadCredentials as jest.Mock).mockResolvedValue({
                login: 'test□corrupted',
                password: 'password123',
            });

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(autoLoginService.clearCredentials).toHaveBeenCalled();
            expect(mockSendResponse).toHaveBeenCalledWith({
                success: false,
                credentials: null,
            });
        });

        it('should handle corrupted auto-login credentials with backslash', async () => {
            const message = { action: Actions.LOAD_AUTO_LOGIN_CREDENTIALS };
            const sender = {} as chrome.runtime.MessageSender;

            (autoLoginService.loadCredentials as jest.Mock).mockResolvedValue({
                login: 'test\\corrupted',
                password: 'password123',
            });

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(autoLoginService.clearCredentials).toHaveBeenCalled();
            expect(mockSendResponse).toHaveBeenCalledWith({
                success: false,
                credentials: null,
            });
        });

        it('should handle corrupted auto-login credentials with empty login', async () => {
            const message = { action: Actions.LOAD_AUTO_LOGIN_CREDENTIALS };
            const sender = {} as chrome.runtime.MessageSender;

            (autoLoginService.loadCredentials as jest.Mock).mockResolvedValue({
                login: '',
                password: 'password123',
            });

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(autoLoginService.clearCredentials).toHaveBeenCalled();
            expect(mockSendResponse).toHaveBeenCalledWith({
                success: false,
                credentials: null,
            });
        });

        it('should handle corrupted auto-login credentials with empty password', async () => {
            const message = { action: Actions.LOAD_AUTO_LOGIN_CREDENTIALS };
            const sender = {} as chrome.runtime.MessageSender;

            (autoLoginService.loadCredentials as jest.Mock).mockResolvedValue({
                login: 'test@example.com',
                password: '',
            });

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(autoLoginService.clearCredentials).toHaveBeenCalled();
            expect(mockSendResponse).toHaveBeenCalledWith({
                success: false,
                credentials: null,
            });
        });

        it('should handle no auto-login credentials', async () => {
            const message = { action: Actions.LOAD_AUTO_LOGIN_CREDENTIALS };
            const sender = {} as chrome.runtime.MessageSender;

            (autoLoginService.loadCredentials as jest.Mock).mockResolvedValue(null);

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(mockSendResponse).toHaveBeenCalledWith({
                success: false,
                credentials: null,
            });
        });

        it('should handle auto-login credentials load error', async () => {
            const message = { action: Actions.LOAD_AUTO_LOGIN_CREDENTIALS };
            const sender = {} as chrome.runtime.MessageSender;

            (autoLoginService.loadCredentials as jest.Mock).mockRejectedValue(
                new Error('Load error'),
            );

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(autoLoginService.clearCredentials).toHaveBeenCalled();
            expect(mockSendResponse).toHaveBeenCalledWith({
                success: false,
                error: 'Load error',
            });
        });

        it('should handle REMOVE_REQUEST error', async () => {
            const message = {
                target: 'background',
                action: Actions.REMOVE_REQUEST,
                data: { id: 'request-1' },
            };
            const sender = {} as chrome.runtime.MessageSender;

            mockQueueManager.removeFromQueue.mockRejectedValue(new Error('Remove error'));

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(mockSendResponse).toHaveBeenCalledWith({
                success: false,
                error: 'Remove error',
            });
        });

        it('should handle REMOVE_MULTIPLE_REQUESTS action', async () => {
            const message = {
                target: 'background',
                action: Actions.REMOVE_MULTIPLE_REQUESTS,
                data: { ids: ['request-1', 'request-2'] },
            };
            const sender = {} as chrome.runtime.MessageSender;

            mockQueueManager.removeMultipleFromQueue = jest.fn().mockResolvedValue([]);

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(mockQueueManager.removeMultipleFromQueue).toHaveBeenCalledWith([
                'request-1',
                'request-2',
            ]);
            expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
        });

        it('should handle REMOVE_MULTIPLE_REQUESTS error', async () => {
            const message = {
                target: 'background',
                action: Actions.REMOVE_MULTIPLE_REQUESTS,
                data: { ids: ['request-1', 'request-2'] },
            };
            const sender = {} as chrome.runtime.MessageSender;

            mockQueueManager.removeMultipleFromQueue = jest
                .fn()
                .mockRejectedValue(new Error('Remove error'));

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(mockSendResponse).toHaveBeenCalledWith({
                success: false,
                error: 'Remove error',
            });
        });

        it('should handle UPDATE_MULTIPLE_REQUESTS_STATUS action', async () => {
            const message = {
                target: 'background',
                action: Actions.UPDATE_MULTIPLE_REQUESTS_STATUS,
                data: {
                    ids: ['request-1', 'request-2'],
                    status: Statuses.PAUSED,
                    status_message: 'Zadanie jest wstrzymane',
                },
            };
            const sender = {} as chrome.runtime.MessageSender;

            mockQueueManager.updateMultipleQueueItems = jest.fn().mockResolvedValue([]);

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(mockQueueManager.updateMultipleQueueItems).toHaveBeenCalledWith(
                ['request-1', 'request-2'],
                {
                    status: Statuses.PAUSED,
                    status_message: 'Zadanie jest wstrzymane',
                },
            );
            expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
        });

        it('should handle UPDATE_MULTIPLE_REQUESTS_STATUS error', async () => {
            const message = {
                target: 'background',
                action: Actions.UPDATE_MULTIPLE_REQUESTS_STATUS,
                data: {
                    ids: ['request-1', 'request-2'],
                    status: Statuses.PAUSED,
                    status_message: 'Zadanie jest wstrzymane',
                },
            };
            const sender = {} as chrome.runtime.MessageSender;

            mockQueueManager.updateMultipleQueueItems = jest
                .fn()
                .mockRejectedValue(new Error('Update error'));

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(mockSendResponse).toHaveBeenCalledWith({
                success: false,
                error: 'Update error',
            });
        });

        it('should handle UPDATE_REQUEST_STATUS error', async () => {
            const message = {
                target: 'background',
                action: Actions.UPDATE_REQUEST_STATUS,
                data: {
                    id: 'request-1',
                    status: Statuses.SUCCESS,
                    status_message: 'Success',
                },
            };
            const sender = {} as chrome.runtime.MessageSender;

            mockQueueManager.updateQueueItem.mockRejectedValue(new Error('Update error'));

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(mockSendResponse).toHaveBeenCalledWith({
                success: false,
                error: 'Update error',
            });
        });

        it('should handle SEND_LOGS with unauthenticated user', async () => {
            const message = {
                target: 'background',
                action: Actions.SEND_LOGS,
                data: { description: 'Test logs' },
            };
            const sender = {} as chrome.runtime.MessageSender;

            (authService.getCurrentUser as jest.Mock).mockResolvedValue(null);

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await waitForAsyncOperations(mockSendResponse);
            expect(mockSendResponse).toHaveBeenCalledWith({
                success: true,
                error: 'Not authorized',
            });
        });

        it('should handle SEND_LOGS in development mode', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            const message = {
                target: 'background',
                action: Actions.SEND_LOGS,
                data: { description: 'Test logs' },
            };
            const sender = {} as chrome.runtime.MessageSender;

            (authService.getCurrentUser as jest.Mock).mockResolvedValue({
                id: 'user-1',
                email: 'test@example.com',
            });

            mockGetLogsFromSession.mockResolvedValue([{ log: 'test log' }]);
            mockClearLogsInSession.mockResolvedValue(undefined);
            mockGetLocalStorageData.mockResolvedValue({ test: 'data' });
            mockGetOrCreateDeviceId.mockResolvedValue('device-id');

            (errorLogService.sendLogs as jest.Mock).mockResolvedValue(undefined);

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await waitForAsyncOperations(mockSendResponse);
            expect(mockGetLocalStorageData).toHaveBeenCalled();

            process.env.NODE_ENV = originalEnv;
        });

        it('should handle SEND_LOGS with user without id', async () => {
            const message = {
                target: 'background',
                action: Actions.SEND_LOGS,
                data: { description: 'Test logs' },
            };
            const sender = {} as chrome.runtime.MessageSender;

            (authService.getCurrentUser as jest.Mock)
                .mockResolvedValueOnce({
                    id: 'user-1',
                    email: 'test@example.com',
                })
                .mockResolvedValueOnce({
                    email: 'test@example.com',
                    // no id
                });

            mockGetLogsFromSession.mockResolvedValue([{ log: 'test log' }]);
            mockClearLogsInSession.mockResolvedValue(undefined);
            mockGetOrCreateDeviceId.mockResolvedValue('device-id');

            (errorLogService.sendLogs as jest.Mock).mockResolvedValue(undefined);

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await waitForAsyncOperations(mockSendResponse);
            expect(mockGetOrCreateDeviceId).toHaveBeenCalled();
        });

        it('should handle SEND_LOGS successfully', async () => {
            const message = {
                target: 'background',
                action: Actions.SEND_LOGS,
                data: { description: 'Test logs' },
            };
            const sender = {} as chrome.runtime.MessageSender;

            (authService.getCurrentUser as jest.Mock).mockResolvedValue({
                id: 'user-1',
                email: 'test@example.com',
            });

            mockGetLogsFromSession.mockResolvedValue([{ log: 'test log' }]);
            mockClearLogsInSession.mockResolvedValue(undefined);

            (errorLogService.sendLogs as jest.Mock).mockResolvedValue(undefined);

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await waitForAsyncOperations(mockSendResponse);
            expect(errorLogService.sendLogs).toHaveBeenCalled();
            expect(mockClearLogsInSession).toHaveBeenCalled();
            expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
        });

        it('should handle SEND_LOGS error', async () => {
            const message = {
                target: 'background',
                action: Actions.SEND_LOGS,
                data: { description: 'Test logs' },
            };
            const sender = {} as chrome.runtime.MessageSender;

            (authService.getCurrentUser as jest.Mock).mockResolvedValue({
                id: 'user-1',
                email: 'test@example.com',
            });

            mockGetLogsFromSession.mockRejectedValue(new Error('Logs error'));

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await waitForAsyncOperations(mockSendResponse);
            expect(mockSendResponse).toHaveBeenCalledWith({
                success: false,
                error: 'Logs error',
            });
        });

        it('should create retry object with tableData and currentSlot', async () => {
            const message = { action: Actions.SHOW_ERROR };
            const sender = {} as chrome.runtime.MessageSender;

            const { TABLE_DATA_NAMES } = require('../../../src/data');

            const mockStorageData = {
                requestCacheHeaders: {
                    'request-1': {
                        url: 'test-url',
                        headers: [{ name: 'test', value: 'test' }],
                        timestamp: Date.now(),
                    },
                },
            };

            const mockRequestCacheBody = {
                'request-1': {
                    url: 'test-url',
                    body: {
                        formData: {
                            TvAppId: ['test-tv-id'],
                            SlotStart: ['01.01.2025 10:00'],
                            SlotEnd: ['01.01.2025 11:00'],
                        },
                    },
                    timestamp: Date.now(),
                },
            };

            const mockTableData = [
                [
                    TABLE_DATA_NAMES.CONTAINER_NUMBER,
                    TABLE_DATA_NAMES.ID,
                    TABLE_DATA_NAMES.SELECTED_DATE,
                    TABLE_DATA_NAMES.START,
                ],
                ['TEST123', 'test-tv-id', '01.01.2025', '10:00'],
            ];

            (authService.getCurrentUser as jest.Mock).mockResolvedValue({
                id: 'user-1',
                email: 'test@example.com',
            });

            mockGetStorage.mockResolvedValueOnce(mockStorageData).mockResolvedValueOnce({
                requestCacheBody: mockRequestCacheBody,
                retryQueue: [],
                testEnv: false,
                tableData: mockTableData,
            });

            mockRemoveCachedRequest.mockResolvedValue(true);
            mockGetDriverNameAndContainer.mockResolvedValue({
                driverName: 'Test Driver',
                containerNumber: 'TEST123',
            });
            mockNormalizeFormData.mockReturnValue({
                formData: {
                    TvAppId: ['test-tv-id'],
                    SlotStart: ['01.01.2025 10:00'],
                    SlotEnd: ['01.01.2025 11:00'],
                },
            });

            mockGetLastProperty.mockReturnValue(mockStorageData.requestCacheHeaders['request-1']);
            mockExtractFirstId.mockReturnValue('request-1');
            mockGetPropertyById.mockReturnValue(mockRequestCacheBody['request-1']);

            mockQueueManager.addToQueue.mockResolvedValue([]);

            // Act
            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            // Assert
            expect(result).toBe(true);
            await waitForAsyncOperations(mockSendResponse);

            expect(mockQueueManager.addToQueue).toHaveBeenCalled();
            expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
        });

        it('should create retry object with tableData but no tableRow found', async () => {
            // Arrange
            const message = { action: Actions.SHOW_ERROR };
            const sender = {} as chrome.runtime.MessageSender;

            const { TABLE_DATA_NAMES } = require('../../../src/data');

            const mockStorageData = {
                requestCacheHeaders: {
                    'request-1': {
                        url: 'test-url',
                        headers: [{ name: 'test', value: 'test' }],
                        timestamp: Date.now(),
                    },
                },
            };

            const mockRequestCacheBody = {
                'request-1': {
                    url: 'test-url',
                    body: {
                        formData: {
                            TvAppId: ['test-tv-id'],
                            SlotStart: ['01.01.2025 10:00'],
                            SlotEnd: ['01.01.2025 11:00'],
                        },
                    },
                    timestamp: Date.now(),
                },
            };

            const mockTableData = [
                [
                    TABLE_DATA_NAMES.CONTAINER_NUMBER,
                    TABLE_DATA_NAMES.ID,
                    TABLE_DATA_NAMES.SELECTED_DATE,
                    TABLE_DATA_NAMES.START,
                ],
                ['OTHER123', 'other-id', '01.01.2025', '10:00'], // Different container and ID
            ];

            (authService.getCurrentUser as jest.Mock).mockResolvedValue({
                id: 'user-1',
                email: 'test@example.com',
            });

            mockGetStorage.mockResolvedValueOnce(mockStorageData).mockResolvedValueOnce({
                requestCacheBody: mockRequestCacheBody,
                retryQueue: [],
                testEnv: false,
                tableData: mockTableData,
            });

            mockRemoveCachedRequest.mockResolvedValue(true);
            mockGetDriverNameAndContainer.mockResolvedValue({
                driverName: 'Test Driver',
                containerNumber: 'TEST123',
            });
            mockNormalizeFormData.mockReturnValue({
                formData: {
                    TvAppId: ['test-tv-id'],
                    SlotStart: ['01.01.2025 10:00'],
                    SlotEnd: ['01.01.2025 11:00'],
                },
            });

            mockGetLastProperty.mockReturnValue(mockStorageData.requestCacheHeaders['request-1']);
            mockExtractFirstId.mockReturnValue('request-1');
            mockGetPropertyById.mockReturnValue(mockRequestCacheBody['request-1']);

            mockQueueManager.addToQueue.mockResolvedValue([]);

            // Act
            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            // Assert
            expect(result).toBe(true);
            await waitForAsyncOperations(mockSendResponse);

            expect(mockQueueManager.addToQueue).toHaveBeenCalled();
            expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
        });

        it('should return true for unknown action without calling handleBookingAction', async () => {
            // Arrange
            const message = { action: 'UNKNOWN_ACTION' };
            const sender = {} as chrome.runtime.MessageSender;

            // Act
            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            // Assert
            expect(result).toBe(true);
            // Should not trigger any async operations
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(mockGetStorage).not.toHaveBeenCalled();
            expect(mockQueueManager.addToQueue).not.toHaveBeenCalled();
        });

        it('should handle SEND_LOGS with no logs', async () => {
            const message = {
                target: 'background',
                action: Actions.SEND_LOGS,
                data: { description: 'Test logs' },
            };
            const sender = {} as chrome.runtime.MessageSender;

            (authService.getCurrentUser as jest.Mock).mockResolvedValue({
                id: 'user-1',
                email: 'test@example.com',
            });

            mockGetLogsFromSession.mockResolvedValue([]); // Empty logs

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await waitForAsyncOperations(mockSendResponse);
            expect(errorLogService.sendLogs).not.toHaveBeenCalled();
            expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
        });

        it('should handle SEND_LOGS error with string error', async () => {
            const message = {
                target: 'background',
                action: Actions.SEND_LOGS,
                data: { description: 'Test logs' },
            };
            const sender = {} as chrome.runtime.MessageSender;

            (authService.getCurrentUser as jest.Mock).mockResolvedValue({
                id: 'user-1',
                email: 'test@example.com',
            });

            mockGetLogsFromSession.mockRejectedValue('String error');

            const result = messageHandler.handleMessage(message, sender, mockSendResponse);

            expect(result).toBe(true);
            await waitForAsyncOperations(mockSendResponse);
            expect(mockSendResponse).toHaveBeenCalledWith({
                success: false,
                error: 'String error',
            });
        });
    });
});
