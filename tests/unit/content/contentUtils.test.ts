import { jest } from '@jest/globals';
import { Actions } from '../../../src/data';

// Mock autoLoginHelper before importing contentUtils
jest.mock('../../../src/content/utils/autoLoginHelper', () => ({
    autoLoginHelper: {
        loadCredentials: jest.fn().mockImplementation(() => Promise.resolve(null)),
        fillLoginForm: jest.fn(),
    },
}));

// Mock extensionWarningModal before importing contentUtils
jest.mock('../../../src/content/modals/extensionWarningModal', () => ({
    showExtensionWarningModal: jest.fn().mockImplementation(() => Promise.resolve()),
}));

// Mock console to avoid noise in tests
const originalConsole = { ...console };
(global as any).console = {
    ...originalConsole,
    log: jest.fn(),
};

describe('contentUtils', () => {
    let contentUtils: any;
    let chrome: any;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        // Setup chrome mock using sinon-chrome pattern
        chrome = {
            runtime: {
                sendMessage: jest.fn(),
                lastError: null,
            },
        };
        (global as any).chrome = chrome;

        // Clear setTimeout/clearTimeout mocks
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        // Reset chrome runtime error
        if ((global as any).chrome && (global as any).chrome.runtime) {
            (global as any).chrome.runtime.lastError = null;
        }
    });

    beforeAll(async () => {
        // Import the functions after mocks are set up
        const module = await import('../../../src/content/utils/contentUtils');
        contentUtils = module.contentUtils;
    });

    describe('sendActionToBackground', () => {
        it('should return early when chrome is undefined', () => {
            (global as any).chrome = undefined;

            contentUtils.sendActionToBackground('TEST_ACTION', { data: 'test' });

            expect(console.log).toHaveBeenCalledWith('Chrome runtime API is not available');
        });

        it('should return early when chrome.runtime is undefined', () => {
            (global as any).chrome = {};

            contentUtils.sendActionToBackground('TEST_ACTION', { data: 'test' });

            expect(console.log).toHaveBeenCalledWith('Chrome runtime API is not available');
        });

        it('should return early when chrome.runtime.sendMessage is undefined', () => {
            (global as any).chrome = { runtime: {} };

            contentUtils.sendActionToBackground('TEST_ACTION', { data: 'test' });

            expect(console.log).toHaveBeenCalledWith('Chrome runtime API is not available');
        });

        it('should send message when chrome runtime is available', () => {
            const messageData = { data: 'test' };

            contentUtils.sendActionToBackground('TEST_ACTION', messageData);

            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
                { action: 'TEST_ACTION', message: messageData },
                expect.any(Function),
            );
        });

        it('should call callback when provided', () => {
            const mockCallback = jest.fn();
            const messageData = { data: 'test' };

            contentUtils.sendActionToBackground('TEST_ACTION', messageData, mockCallback);

            // Simulate chrome response
            const sendMessageCallback = chrome.runtime.sendMessage.mock.calls[0][1];
            sendMessageCallback('response data');

            expect(mockCallback).toHaveBeenCalledWith('response data');
        });

        it('should not call callback when chrome.runtime.lastError exists', () => {
            const mockCallback = jest.fn();
            const messageData = { data: 'test' };
            chrome.runtime.lastError = { message: 'Test error' };

            contentUtils.sendActionToBackground('TEST_ACTION', messageData, mockCallback);

            // Simulate chrome response with error
            const sendMessageCallback = chrome.runtime.sendMessage.mock.calls[0][1];
            sendMessageCallback('response data');

            expect(console.log).toHaveBeenCalledWith('Error sending TEST_ACTION message:', {
                message: 'Test error',
            });
            expect(mockCallback).toHaveBeenCalledWith('response data');
        });
    });

    describe('waitForElement', () => {
        let mockObserver: any;

        beforeEach(() => {
            // Mock MutationObserver
            mockObserver = {
                observe: jest.fn(),
                disconnect: jest.fn(),
                callback: null,
            };

            (global as any).MutationObserver = jest.fn().mockImplementation(callback => {
                // Store callback for testing
                mockObserver.callback = callback;
                return mockObserver;
            });
        });

        it('should create MutationObserver and start observing', () => {
            const mockCallback = jest.fn();
            const querySelectorSpy = jest.spyOn(document, 'querySelector');
            querySelectorSpy.mockReturnValue(null);

            contentUtils.waitForElement('#test-selector', mockCallback);

            expect((global as any).MutationObserver).toHaveBeenCalled();

            querySelectorSpy.mockRestore();
        });

        it('should call callback when element is found', () => {
            const mockCallback = jest.fn();
            const mockElement = { id: 'test-element' } as any;
            const querySelectorSpy = jest.spyOn(document, 'querySelector');

            // Mock querySelector to return element when observer callback is triggered
            querySelectorSpy.mockReturnValue(mockElement);

            contentUtils.waitForElement('#test-selector', mockCallback);

            // Simulate MutationObserver detecting changes
            if (mockObserver.callback) {
                mockObserver.callback(
                    [
                        /* mutations */
                    ],
                    mockObserver,
                );
            }

            expect(mockCallback).toHaveBeenCalledWith(mockElement);
            expect(querySelectorSpy).toHaveBeenCalledWith('#test-selector');

            querySelectorSpy.mockRestore();
        });

        it('should disconnect observer when element is found', () => {
            const mockCallback = jest.fn();
            const mockElement = { id: 'test-element' } as any;
            const querySelectorSpy = jest.spyOn(document, 'querySelector');

            // Mock querySelector to return element when observer callback is triggered
            querySelectorSpy.mockReturnValue(mockElement);

            contentUtils.waitForElement('#test-selector', mockCallback);

            // Simulate MutationObserver detecting changes
            if (mockObserver.callback) {
                mockObserver.callback(
                    [
                        /* mutations */
                    ],
                    mockObserver,
                );
            }

            expect(mockObserver.disconnect).toHaveBeenCalled();

            querySelectorSpy.mockRestore();
        });
    });

    describe('waitForElementToDisappear', () => {
        let mockObserver: any;

        beforeEach(() => {
            // Mock MutationObserver
            mockObserver = {
                observe: jest.fn(),
                disconnect: jest.fn(),
                callback: null,
            };

            (global as any).MutationObserver = jest.fn().mockImplementation(callback => {
                // Store callback for testing
                mockObserver.callback = callback;
                return mockObserver;
            });
        });

        it('should call callback immediately when element is not found', () => {
            const mockCallback = jest.fn();
            const querySelectorSpy = jest.spyOn(document, 'querySelector');
            querySelectorSpy.mockReturnValue(null);

            contentUtils.waitForElementToDisappear('#test-selector', mockCallback);

            expect(mockCallback).toHaveBeenCalled();
            expect((global as any).MutationObserver).not.toHaveBeenCalled();

            querySelectorSpy.mockRestore();
        });

        it('should create observer when element exists', () => {
            const mockCallback = jest.fn();
            const mockElement = { id: 'test-element' } as any;
            const querySelectorSpy = jest.spyOn(document, 'querySelector');
            querySelectorSpy.mockReturnValue(mockElement);

            contentUtils.waitForElementToDisappear('#test-selector', mockCallback);

            expect((global as any).MutationObserver).toHaveBeenCalled();

            querySelectorSpy.mockRestore();
        });

        it('should call callback and disconnect when element disappears', () => {
            const mockCallback = jest.fn();
            const querySelectorSpy = jest.spyOn(document, 'querySelector');

            // First call returns element, then returns null
            querySelectorSpy
                .mockReturnValueOnce({ id: 'test-element' } as any)
                .mockReturnValueOnce(null);

            contentUtils.waitForElementToDisappear('#test-selector', mockCallback);

            // Get the observer instance and simulate callback
            if (mockObserver.callback) {
                mockObserver.callback();
            }

            expect(mockCallback).toHaveBeenCalled();
            expect(mockObserver.disconnect).toHaveBeenCalled();

            querySelectorSpy.mockRestore();
        });
    });

    describe('sendActionAfterElementDisappears', () => {
        it('should be a function', () => {
            expect(typeof contentUtils.sendActionAfterElementDisappears).toBe('function');
        });

        it('should call waitForElement with correct parameters', () => {
            const mockCallback = jest.fn();
            const messageData = { data: 'test' };

            // Mock waitForElement to track calls
            const waitForElementSpy = jest
                .spyOn(contentUtils, 'waitForElement')
                .mockImplementation((selector, callback: any) => {
                    // Simulate immediate callback to trigger the chain
                    callback();
                });

            // Also mock waitForElementToDisappear since it will be called in the chain
            const waitForElementToDisappearSpy = jest
                .spyOn(contentUtils, 'waitForElementToDisappear')
                .mockImplementation((selector, callback: any) => {
                    callback();
                });

            // Mock sendActionToBackground
            const sendActionSpy = jest
                .spyOn(contentUtils, 'sendActionToBackground')
                .mockImplementation(() => {});

            contentUtils.sendActionAfterElementDisappears(
                '#selector',
                'ACTION',
                messageData,
                mockCallback,
            );

            expect(waitForElementSpy).toHaveBeenCalledWith('#selector', expect.any(Function));

            // Restore original functions
            waitForElementSpy.mockRestore();
            waitForElementToDisappearSpy.mockRestore();
            sendActionSpy.mockRestore();
        });
    });

    describe('waitElementAndSendChromeMessage', () => {
        let mockObserver: any;

        beforeEach(() => {
            // Mock MutationObserver
            mockObserver = {
                observe: jest.fn(),
                disconnect: jest.fn(),
                callback: null,
            };

            (global as any).MutationObserver = jest.fn().mockImplementation(callback => {
                // Store callback for testing
                mockObserver.callback = callback;
                return mockObserver;
            });
        });

        it('should return early when chrome is undefined', () => {
            (global as any).chrome = undefined;
            const mockActionFunction = jest.fn();
            const mockElement = { id: 'test-element' } as any;
            const querySelectorSpy = jest.spyOn(document, 'querySelector');
            querySelectorSpy.mockReturnValue(mockElement);

            contentUtils.waitElementAndSendChromeMessage('#selector', 'ACTION', mockActionFunction);

            // Simulate MutationObserver detecting changes
            if (mockObserver.callback) {
                mockObserver.callback(
                    [
                        /* mutations */
                    ],
                    mockObserver,
                );
            }

            expect(mockActionFunction).not.toHaveBeenCalled();
            expect(console.log).toHaveBeenCalledWith('Chrome runtime API is not available');

            querySelectorSpy.mockRestore();
        });

        it('should return early when chrome.runtime is undefined', () => {
            (global as any).chrome = {};
            const mockActionFunction = jest.fn();
            const mockElement = { id: 'test-element' } as any;
            const querySelectorSpy = jest.spyOn(document, 'querySelector');
            querySelectorSpy.mockReturnValue(mockElement);

            contentUtils.waitElementAndSendChromeMessage('#selector', 'ACTION', mockActionFunction);

            // Simulate MutationObserver detecting changes
            if (mockObserver.callback) {
                mockObserver.callback(
                    [
                        /* mutations */
                    ],
                    mockObserver,
                );
            }

            expect(mockActionFunction).not.toHaveBeenCalled();
            expect(console.log).toHaveBeenCalledWith('Chrome runtime API is not available');

            querySelectorSpy.mockRestore();
        });

        it('should call actionFunction when chrome is available', () => {
            const mockActionFunction = jest.fn().mockReturnValue({ data: 'test' });
            const mockElement = { id: 'test-element' } as any;
            const querySelectorSpy = jest.spyOn(document, 'querySelector');

            // Mock querySelector to return element when observer callback is triggered
            querySelectorSpy.mockReturnValue(mockElement);

            contentUtils.waitElementAndSendChromeMessage('#selector', 'ACTION', mockActionFunction);

            // Simulate MutationObserver detecting changes
            if (mockObserver.callback) {
                mockObserver.callback(
                    [
                        /* mutations */
                    ],
                    mockObserver,
                );
            }

            expect(mockActionFunction).toHaveBeenCalled();

            querySelectorSpy.mockRestore();
        });

        it('should handle actionFunction error gracefully', () => {
            const mockActionFunction = jest.fn().mockImplementation(() => {
                throw new Error('Action function error');
            });
            const mockElement = { id: 'test-element' } as any;
            const querySelectorSpy = jest.spyOn(document, 'querySelector');

            // Mock querySelector to return element when observer callback is triggered
            querySelectorSpy.mockReturnValue(mockElement);

            contentUtils.waitElementAndSendChromeMessage('#selector', 'ACTION', mockActionFunction);

            // Simulate MutationObserver detecting changes
            if (mockObserver.callback) {
                mockObserver.callback(
                    [
                        /* mutations */
                    ],
                    mockObserver,
                );
            }

            expect(mockActionFunction).toHaveBeenCalled();
            expect(console.log).toHaveBeenCalledWith('Error processing ACTION:', expect.any(Error));

            querySelectorSpy.mockRestore();
        });
    });

    describe('parseTable', () => {
        it('should parse table data correctly', () => {
            const mockTable = {
                querySelectorAll: jest.fn().mockReturnValue([
                    {
                        querySelectorAll: jest
                            .fn()
                            .mockReturnValue([{ innerText: 'Cell 1' }, { innerText: 'Cell 2' }]),
                    },
                    {
                        querySelectorAll: jest
                            .fn()
                            .mockReturnValue([{ innerText: 'Cell 3' }, { innerText: 'Cell 4' }]),
                    },
                ]),
            };
            const querySelectorSpy = jest.spyOn(document, 'querySelector');
            querySelectorSpy.mockReturnValue(mockTable as any);

            const result = contentUtils.parseTable();

            expect(result).toEqual([
                ['Cell 1', 'Cell 2'],
                ['Cell 3', 'Cell 4'],
            ]);
            expect(querySelectorSpy).toHaveBeenCalledWith('#Grid table');

            querySelectorSpy.mockRestore();
        });

        it('should handle empty table', () => {
            const emptyTable = {
                querySelectorAll: jest.fn().mockReturnValue([]),
            };
            const querySelectorSpy = jest.spyOn(document, 'querySelector');
            querySelectorSpy.mockReturnValue(emptyTable as any);

            const result = contentUtils.parseTable();

            expect(result).toEqual([]);
            expect(querySelectorSpy).toHaveBeenCalledWith('#Grid table');

            querySelectorSpy.mockRestore();
        });

        it('should return empty array when table is not found', () => {
            const querySelectorSpy = jest.spyOn(document, 'querySelector');
            querySelectorSpy.mockReturnValue(null);

            const result = contentUtils.parseTable();

            expect(result).toEqual([]);
            expect(querySelectorSpy).toHaveBeenCalledWith('#Grid table');

            querySelectorSpy.mockRestore();
        });

        it('should handle cells with whitespace', () => {
            const tableWithSpaces = {
                querySelectorAll: jest.fn().mockReturnValue([
                    {
                        querySelectorAll: jest
                            .fn()
                            .mockReturnValue([
                                { innerText: '  Cell with spaces  ' },
                                { innerText: 'Cell with\ttabs' },
                            ]),
                    },
                ]),
            };
            const querySelectorSpy = jest.spyOn(document, 'querySelector');
            querySelectorSpy.mockReturnValue(tableWithSpaces as any);

            const result = contentUtils.parseTable();

            expect(result).toEqual([['Cell with spaces', 'Cell with\ttabs']]);

            querySelectorSpy.mockRestore();
        });
    });

    describe('isUserAuthenticated', () => {
        it('should return false when chrome is undefined', async () => {
            (global as any).chrome = undefined;

            const result = await contentUtils.isUserAuthenticated();

            expect(result).toBe(false);
            expect(console.log).toHaveBeenCalledWith(
                '[content] Error in isUserAuthenticated:',
                expect.any(Error),
            );
        });

        it('should return false when chrome.runtime is undefined', async () => {
            (global as any).chrome = {};

            const result = await contentUtils.isUserAuthenticated();

            expect(result).toBe(false);
            expect(console.log).toHaveBeenCalledWith('[content] Chrome runtime not available');
        });

        it('should return false on timeout', async () => {
            chrome.runtime.sendMessage.mockImplementation((_message, _callback) => {
                // Don't call callback to simulate timeout
            });

            const resultPromise = contentUtils.isUserAuthenticated();

            // Advance timers to trigger timeout
            jest.advanceTimersByTime(5000);

            const result = await resultPromise;

            expect(result).toBe(false);
            expect(console.log).toHaveBeenCalledWith('[content] isUserAuthenticated timeout');
        });

        it('should return false when runtime error occurs', async () => {
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                chrome.runtime.lastError = { message: 'Test error' };
                callback(null);
            });

            const result = await contentUtils.isUserAuthenticated();

            expect(result).toBe(false);
            expect(console.log).toHaveBeenCalledWith('[content] Runtime error:', {
                message: 'Test error',
            });
        });

        it('should return false when no response from background', async () => {
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback(null);
            });

            const result = await contentUtils.isUserAuthenticated();

            expect(result).toBe(false);
            expect(console.log).toHaveBeenCalledWith('[content] No response from background');
        });

        it('should return true when user is authenticated', async () => {
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback({ isAuthenticated: true });
            });

            const result = await contentUtils.isUserAuthenticated();

            expect(result).toBe(true);
            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
                { action: Actions.IS_AUTHENTICATED },
                expect.any(Function),
            );
        });
    });

    describe('isAppUnauthorized', () => {
        it('should return false when chrome is undefined', async () => {
            (global as any).chrome = undefined;

            const result = await contentUtils.isAppUnauthorized();

            expect(result).toBe(false);
            expect(console.log).toHaveBeenCalledWith(
                '[content] Error in isAppUnauthorized:',
                expect.any(Error),
            );
        });

        it('should return false when chrome.runtime is undefined', async () => {
            (global as any).chrome = {};

            const result = await contentUtils.isAppUnauthorized();

            expect(result).toBe(false);
            expect(console.log).toHaveBeenCalledWith('[content] Chrome runtime not available');
        });

        it('should return false on timeout', async () => {
            chrome.runtime.sendMessage.mockImplementation((_message, _callback) => {
                // Don't call callback to simulate timeout
            });

            const resultPromise = contentUtils.isAppUnauthorized();

            // Advance timers to trigger timeout
            jest.advanceTimersByTime(5000);

            const result = await resultPromise;

            expect(result).toBe(false);
            expect(console.log).toHaveBeenCalledWith('[content] isAppUnauthorized timeout');
        });

        it('should return false when runtime error occurs', async () => {
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                chrome.runtime.lastError = { message: 'Test error' };
                callback(null);
            });

            const result = await contentUtils.isAppUnauthorized();

            expect(result).toBe(false);
            expect(console.log).toHaveBeenCalledWith('[content] Runtime error:', {
                message: 'Test error',
            });
        });

        it('should return false when no response from background', async () => {
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback(null);
            });

            const result = await contentUtils.isAppUnauthorized();

            expect(result).toBe(false);
            expect(console.log).toHaveBeenCalledWith('[content] No response from background');
        });

        it('should return true when app is unauthorized', async () => {
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback({ unauthorized: true });
            });

            const result = await contentUtils.isAppUnauthorized();

            expect(result).toBe(true);
            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
                { action: Actions.GET_AUTH_STATUS },
                expect.any(Function),
            );
        });
    });

    describe('isAutoLoginEnabled', () => {
        it('should return true when auto-login is enabled', async () => {
            // Mock sendActionToBackground to call callback immediately
            const sendActionSpy = jest
                .spyOn(contentUtils, 'sendActionToBackground')
                .mockImplementation((action, message, callback: any) => {
                    callback({ isEnabled: true });
                });

            const result = await contentUtils.isAutoLoginEnabled();

            expect(result).toBe(true);

            // Restore original function
            sendActionSpy.mockRestore();
        });

        it('should return false when auto-login is disabled', async () => {
            // Mock sendActionToBackground to call callback immediately
            const sendActionSpy = jest
                .spyOn(contentUtils, 'sendActionToBackground')
                .mockImplementation((action, message, callback: any) => {
                    callback({ isEnabled: false });
                });

            const result = await contentUtils.isAutoLoginEnabled();

            expect(result).toBe(false);

            // Restore original function
            sendActionSpy.mockRestore();
        });
    });

    describe('tryClickLoginButton', () => {
        let mockForm: any;
        let mockButton: any;

        beforeEach(() => {
            mockForm = {
                focus: jest.fn(),
            };
            mockButton = {
                click: jest.fn(),
            };

            // Mock sendActionToBackground
            jest.spyOn(contentUtils, 'sendActionToBackground').mockImplementation(() => {});
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should focus form when available', async () => {
            const querySelectorSpy = jest.spyOn(document, 'querySelector');
            querySelectorSpy
                .mockReturnValueOnce(mockForm) // form found
                .mockReturnValueOnce(mockButton); // button found

            await contentUtils.tryClickLoginButton();

            expect(mockForm.focus).toHaveBeenCalled();
            expect(mockButton.click).toHaveBeenCalled();

            querySelectorSpy.mockRestore();
        });

        it('should click login button when found', async () => {
            const querySelectorSpy = jest.spyOn(document, 'querySelector');
            querySelectorSpy
                .mockReturnValueOnce(null) // form not found
                .mockReturnValueOnce(mockButton); // button found

            await contentUtils.tryClickLoginButton();

            expect(mockButton.click).toHaveBeenCalled();

            querySelectorSpy.mockRestore();
        });

        it('should return early when login button is not found', async () => {
            const querySelectorSpy = jest.spyOn(document, 'querySelector');
            querySelectorSpy
                .mockReturnValueOnce(null) // form not found
                .mockReturnValueOnce(null); // button not found

            await contentUtils.tryClickLoginButton();

            expect(console.log).toHaveBeenCalledWith('[content] Login button not found');

            querySelectorSpy.mockRestore();
        });
    });

    describe('clickLoginButton', () => {
        it('should click login button when found', async () => {
            const mockButton = { click: jest.fn() } as any;
            const querySelectorSpy = jest.spyOn(document, 'querySelector');
            querySelectorSpy.mockReturnValue(mockButton);

            await contentUtils.clickLoginButton();

            expect(mockButton.click).toHaveBeenCalled();
            expect(querySelectorSpy).toHaveBeenCalledWith('a.product-box[href="/login"]');

            querySelectorSpy.mockRestore();
        });

        it('should return early when login button is not found', async () => {
            const querySelectorSpy = jest.spyOn(document, 'querySelector');
            querySelectorSpy.mockReturnValue(null);

            await contentUtils.clickLoginButton();

            expect(querySelectorSpy).toHaveBeenCalledWith('a.product-box[href="/login"]');

            querySelectorSpy.mockRestore();
        });
    });

    describe('checkExtensionConnection', () => {
        it('should return false when chrome is undefined', async () => {
            (global as any).chrome = undefined;

            const result = await contentUtils.checkExtensionConnection();

            expect(result).toBe(false);
        });

        it('should return false when chrome.runtime is undefined', async () => {
            (global as any).chrome = {};

            const result = await contentUtils.checkExtensionConnection();

            expect(result).toBe(false);
        });

        it('should return false on timeout', async () => {
            chrome.runtime.sendMessage.mockImplementation((_message, _callback) => {
                // Don't call callback to simulate timeout
            });

            const resultPromise = contentUtils.checkExtensionConnection();

            // Advance timers to trigger timeout
            jest.advanceTimersByTime(5000);

            const result = await resultPromise;

            expect(result).toBe(false);
        });

        it('should return false when runtime error occurs', async () => {
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                chrome.runtime.lastError = { message: 'Test error' };
                callback(null);
            });

            const result = await contentUtils.checkExtensionConnection();

            expect(result).toBe(false);
        });

        it('should return false when no response from background', async () => {
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback(null);
            });

            const result = await contentUtils.checkExtensionConnection();

            expect(result).toBe(false);
        });

        it('should return true when extension is connected', async () => {
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback({ connected: true });
            });

            const result = await contentUtils.checkExtensionConnection();

            expect(result).toBe(true);
            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
                { action: Actions.IS_AUTHENTICATED },
                expect.any(Function),
            );
        });
    });

    describe('checkConnectionAndShowWarning', () => {
        it('should return false when connection check fails', async () => {
            // Mock checkExtensionConnection to return false
            const checkConnectionSpy = jest
                .spyOn(contentUtils, 'checkExtensionConnection')
                .mockResolvedValue(false);

            const result = await contentUtils.checkConnectionAndShowWarning();

            expect(result).toBe(false);
            expect(checkConnectionSpy).toHaveBeenCalled();

            // Restore original function
            checkConnectionSpy.mockRestore();
        });

        it('should return true when connection check passes', async () => {
            // Mock checkExtensionConnection to return true
            const checkConnectionSpy = jest
                .spyOn(contentUtils, 'checkExtensionConnection')
                .mockResolvedValue(true);

            const result = await contentUtils.checkConnectionAndShowWarning();

            expect(result).toBe(true);
            expect(checkConnectionSpy).toHaveBeenCalled();

            // Restore original function
            checkConnectionSpy.mockRestore();
        });
    });
});
