import { BackgroundController } from '../../../src/background/BackgroundController';
import { QueueManagerAdapter } from '../../../src/services/queueManagerAdapter';
import { MessageHandler } from '../../../src/background/handlers/MessageHandler';
import { RequestHandler } from '../../../src/background/handlers/RequestHandler';
import { StorageHandler } from '../../../src/background/handlers/StorageHandler';
import { setStorage, getStorage } from '../../../src/utils/storage';
import { consoleLog, consoleError } from '../../../src/utils';
import { clearBadge } from '../../../src/utils/badge';
import { autoLoginService } from '../../../src/services/autoLoginService';

// Mock dependencies
jest.mock('../../../src/services/queueManagerAdapter');
jest.mock('../../../src/background/handlers/MessageHandler');
jest.mock('../../../src/background/handlers/RequestHandler');
jest.mock('../../../src/background/handlers/StorageHandler');
jest.mock('../../../src/utils/storage');
jest.mock('../../../src/utils');
jest.mock('../../../src/utils/badge', () => ({
    clearBadge: jest.fn(),
}));
jest.mock('../../../src/services/autoLoginService', () => ({
    autoLoginService: {
        migrateAndCleanData: jest.fn(() => Promise.resolve()),
    },
}));
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

// Chrome mock is now global in tests/setup.ts

// Mock dynamic import
jest.mock('../../../src/services/baltichub', () => ({
    processRequest: jest.fn(),
}));

const mockQueueManager = {
    startProcessing: jest.fn(),
};

const mockMessageHandler = {
    handleMessage: jest.fn(),
};

const mockRequestHandler = {
    setupRequestListeners: jest.fn(),
};

const mockStorageHandler = {
    setupStorageListener: jest.fn(),
};

describe('BackgroundController', () => {
    let backgroundController: BackgroundController;

    beforeEach(() => {
        jest.clearAllMocks();
        (QueueManagerAdapter.getInstance as jest.Mock).mockReturnValue(mockQueueManager);
        (MessageHandler as jest.Mock).mockImplementation(() => mockMessageHandler);
        (RequestHandler as jest.Mock).mockImplementation(() => mockRequestHandler);
        (StorageHandler as jest.Mock).mockImplementation(() => mockStorageHandler);
        backgroundController = new BackgroundController();
    });

    describe('constructor', () => {
        it('should initialize all handlers', () => {
            expect(QueueManagerAdapter.getInstance).toHaveBeenCalled();
            expect(MessageHandler).toHaveBeenCalledWith(mockQueueManager);
            expect(RequestHandler).toHaveBeenCalled();
            expect(StorageHandler).toHaveBeenCalledWith(mockQueueManager);
        });
    });

    describe('initialize', () => {
        it('should initialize successfully', async () => {
            (setStorage as jest.Mock).mockResolvedValue(undefined);
            (getStorage as jest.Mock).mockResolvedValue({});

            await backgroundController.initialize();

            expect(consoleLog).toHaveBeenCalledWith('Initializing Background Controller...');
            expect(setStorage).toHaveBeenCalledWith({ retryEnabled: true });
            expect(setStorage).toHaveBeenCalledWith({ testEnv: false });
            expect(mockQueueManager.startProcessing).toHaveBeenCalled();
            expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalled();
            expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
            expect(mockRequestHandler.setupRequestListeners).toHaveBeenCalled();
            expect(mockStorageHandler.setupStorageListener).toHaveBeenCalled();
            expect(consoleLog).toHaveBeenCalledWith(
                'Background Controller initialized successfully',
            );
        });

        it('should handle initialization errors', async () => {
            const error = new Error('Initialization failed');
            (setStorage as jest.Mock).mockRejectedValue(error);

            await expect(backgroundController.initialize()).rejects.toThrow(
                'Initialization failed',
            );
        });
    });

    describe('initializeSettings', () => {
        it('should set default settings', async () => {
            (setStorage as jest.Mock).mockResolvedValue(undefined);
            (getStorage as jest.Mock).mockResolvedValue({});

            await backgroundController['initializeSettings']();

            expect(setStorage).toHaveBeenCalledWith({ retryEnabled: true });
            expect(setStorage).toHaveBeenCalledWith({ testEnv: false });
        });
    });

    describe('startQueueProcessing', () => {
        it('should start queue processing with correct parameters', async () => {
            const mockProcessRequest = jest.fn();
            jest.doMock('../../../src/services/baltichub', () => ({
                processRequest: mockProcessRequest,
            }));

            await backgroundController['startQueueProcessing']();

            expect(mockQueueManager.startProcessing).toHaveBeenCalledWith(expect.any(Function), {
                intervalMin: 200,
                intervalMax: 500,
                retryEnabled: true,
            });
        });
    });

    describe('setupEventListeners', () => {
        it('should setup all event listeners', () => {
            backgroundController['setupEventListeners']();

            expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalled();
            expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
            expect(mockRequestHandler.setupRequestListeners).toHaveBeenCalled();
            expect(mockStorageHandler.setupStorageListener).toHaveBeenCalled();
        });

        it('should setup message listener with correct handler', () => {
            backgroundController['setupEventListeners']();

            const messageListenerCall = (chrome.runtime.onMessage.addListener as jest.Mock).mock
                .calls[0];
            const messageHandler = messageListenerCall[0];

            // Test that the message handler calls our MessageHandler
            const mockMessage = { action: 'TEST' };
            const mockSender = {} as chrome.runtime.MessageSender;
            const mockSendResponse = jest.fn();

            messageHandler(mockMessage, mockSender, mockSendResponse);

            expect(mockMessageHandler.handleMessage).toHaveBeenCalledWith(
                mockMessage,
                mockSender,
                mockSendResponse,
            );
        });
    });

    describe('handleInstallation', () => {
        it('should not open welcome page on install (handled by checkIfFreshInstall)', () => {
            const details = {
                reason: 'install',
            } as chrome.runtime.InstalledDetails;

            backgroundController['handleInstallation'](details);

            expect(chrome.runtime.getURL).not.toHaveBeenCalledWith('welcome.html');
            expect(chrome.tabs.create).not.toHaveBeenCalled();
        });

        it('should not open welcome page on update', () => {
            const details = {
                reason: 'update',
            } as chrome.runtime.InstalledDetails;

            backgroundController['handleInstallation'](details);

            expect(chrome.tabs.create).not.toHaveBeenCalled();
        });

        it('should migrate auto-login data', () => {
            const details = {
                reason: 'install',
            } as chrome.runtime.InstalledDetails;
            (autoLoginService.migrateAndCleanData as jest.Mock).mockResolvedValue(undefined);

            backgroundController['handleInstallation'](details);

            expect(autoLoginService.migrateAndCleanData).toHaveBeenCalled();
        });

        it('should handle migration errors gracefully', () => {
            const details = {
                reason: 'install',
            } as chrome.runtime.InstalledDetails;
            const error = new Error('Migration failed');
            (autoLoginService.migrateAndCleanData as jest.Mock).mockRejectedValue(error);

            // Should not throw error
            expect(() => backgroundController['handleInstallation'](details)).not.toThrow();
        });

        it('should log installation and clear badge', () => {
            const details = {
                reason: 'install',
            } as chrome.runtime.InstalledDetails;

            backgroundController['handleInstallation'](details);

            expect(consoleLog).toHaveBeenCalledWith('Plugin installed!');
            expect(clearBadge).toHaveBeenCalled();
        });
    });

    describe('initializeDefaultStorageValues', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should initialize all default storage values', async () => {
            // Mock empty storage
            (getStorage as jest.Mock).mockResolvedValue({});

            await backgroundController['initializeDefaultStorageValues']();

            // Check that all default values are set
            expect(setStorage).toHaveBeenCalledWith({ retryEnabled: true });
            expect(setStorage).toHaveBeenCalledWith({ testEnv: false });
            expect(setStorage).toHaveBeenCalledWith({ unauthorized: false });
            expect(setStorage).toHaveBeenCalledWith({ headerHidden: false });
            expect(setStorage).toHaveBeenCalledWith({ tableData: [] });
            expect(setStorage).toHaveBeenCalledWith({ retryQueue: [] });
            expect(setStorage).toHaveBeenCalledWith({ groupStates: {} });
            expect(setStorage).toHaveBeenCalledWith({ requestCacheBody: {} });
            expect(setStorage).toHaveBeenCalledWith({ requestCacheHeaders: {} });
        });

        it('should initialize notification settings with defaults', async () => {
            (getStorage as jest.Mock).mockResolvedValue({});

            await backgroundController['initializeDefaultStorageValues']();

            expect(setStorage).toHaveBeenCalledWith({
                notificationSettings: {
                    email: {
                        enabled: false,
                        userEmail: '',
                        additionalEmails: [],
                    },
                    windows: {
                        enabled: true,
                    },
                    createdAt: expect.any(Number),
                },
            });
        });

        it('should not override existing values', async () => {
            const existingData = {
                notificationSettings: { email: { enabled: true } },
                tableData: [['existing', 'data']],
            };
            (getStorage as jest.Mock).mockResolvedValue(existingData);

            await backgroundController['initializeDefaultStorageValues']();

            // Should not set existing values
            expect(setStorage).not.toHaveBeenCalledWith(
                expect.objectContaining({ notificationSettings: expect.any(Object) }),
            );
            expect(setStorage).not.toHaveBeenCalledWith(
                expect.objectContaining({ tableData: expect.any(Array) }),
            );
        });
    });

    describe('checkIfFreshInstall', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should show welcome page if welcomeShown is not set', async () => {
            (getStorage as jest.Mock).mockResolvedValue({});
            (chrome.runtime.getURL as jest.Mock).mockReturnValue('chrome-extension://welcome.html');

            await backgroundController['checkIfFreshInstall']();

            expect(chrome.runtime.getURL).toHaveBeenCalledWith('welcome.html');
            expect(chrome.tabs.create).toHaveBeenCalledWith({
                url: 'chrome-extension://welcome.html',
            });
            expect(setStorage).toHaveBeenCalledWith({ welcomeShown: true });
        });

        it('should not show welcome page if welcomeShown is already true', async () => {
            (getStorage as jest.Mock).mockResolvedValue({ welcomeShown: true });

            await backgroundController['checkIfFreshInstall']();

            expect(chrome.tabs.create).not.toHaveBeenCalled();
            expect(setStorage).not.toHaveBeenCalledWith({ welcomeShown: true });
        });

        it('should handle errors gracefully', async () => {
            const error = new Error('Storage error');
            (getStorage as jest.Mock).mockRejectedValue(error);

            await expect(backgroundController['checkIfFreshInstall']()).resolves.not.toThrow();
            expect(consoleError).toHaveBeenCalledWith(
                '[background] Error checking fresh install:',
                error,
            );
        });
    });

    describe('integration', () => {
        it('should handle complete initialization flow', async () => {
            (setStorage as jest.Mock).mockResolvedValue(undefined);
            (getStorage as jest.Mock).mockResolvedValue({});

            await backgroundController.initialize();

            // Verify all components are initialized
            expect(QueueManagerAdapter.getInstance).toHaveBeenCalled();
            expect(MessageHandler).toHaveBeenCalledWith(mockQueueManager);
            expect(RequestHandler).toHaveBeenCalled();
            expect(StorageHandler).toHaveBeenCalledWith(mockQueueManager);

            // Verify settings are set
            expect(setStorage).toHaveBeenCalledWith({ retryEnabled: true });
            expect(setStorage).toHaveBeenCalledWith({ testEnv: false });

            // Verify queue processing is started
            expect(mockQueueManager.startProcessing).toHaveBeenCalled();

            // Verify event listeners are set up
            expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalled();
            expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
            expect(mockRequestHandler.setupRequestListeners).toHaveBeenCalled();
            expect(mockStorageHandler.setupStorageListener).toHaveBeenCalled();
        });

        it('should handle message routing correctly', () => {
            backgroundController['setupEventListeners']();

            const messageListenerCall = (chrome.runtime.onMessage.addListener as jest.Mock).mock
                .calls[0];
            const messageHandler = messageListenerCall[0];

            const mockMessage = { action: 'TEST_ACTION' };
            const mockSender = {
                tab: { id: 1 },
            } as chrome.runtime.MessageSender;
            const mockSendResponse = jest.fn();

            mockMessageHandler.handleMessage.mockReturnValue(true);

            const result = messageHandler(mockMessage, mockSender, mockSendResponse);

            expect(mockMessageHandler.handleMessage).toHaveBeenCalledWith(
                mockMessage,
                mockSender,
                mockSendResponse,
            );
            expect(result).toBe(true);
        });
    });

    describe('error handling', () => {
        it('should handle storage errors during initialization', async () => {
            const error = new Error('Storage error');
            (setStorage as jest.Mock).mockRejectedValue(error);

            await expect(backgroundController.initialize()).rejects.toThrow('Storage error');
        });

        it('should handle queue manager errors during initialization', async () => {
            (setStorage as jest.Mock).mockResolvedValue(undefined);
            (getStorage as jest.Mock).mockResolvedValue({});
            const error = new Error('Queue error');
            mockQueueManager.startProcessing.mockRejectedValue(error);

            try {
                await backgroundController.initialize();
                fail('Should have thrown an error');
            } catch (err) {
                expect(err).toBe(error);
            }
        });

        it('should handle handler initialization errors', async () => {
            (setStorage as jest.Mock).mockResolvedValue(undefined);
            (getStorage as jest.Mock).mockResolvedValue({});
            mockQueueManager.startProcessing.mockResolvedValue(undefined);
            const error = new Error('Handler error');
            mockRequestHandler.setupRequestListeners.mockImplementation(() => {
                throw error;
            });

            try {
                await backgroundController.initialize();
                fail('Should have thrown an error');
            } catch (err) {
                expect(err.message).toBe('Handler error');
            }
        });
    });
});
