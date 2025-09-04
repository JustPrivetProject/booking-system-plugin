import { jest } from '@jest/globals';
import { Actions } from '../../../src/data';

// Mock DOM methods before importing the functions
const mockDocument = {
    getElementById: jest.fn(),
    createElement: jest.fn(),
    body: {
        appendChild: jest.fn(),
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
};
(global as any).document = mockDocument;

// Mock sessionStorage
const mockSessionStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
(global as any).sessionStorage = mockSessionStorage;

// Mock window
(global as any).window = {};

describe('Extension Connection Checker', () => {
    let checkExtensionConnection: any;
    let checkConnectionAndShowWarning: any;
    let chrome: any;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        // Setup chrome mock
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
    });

    beforeAll(async () => {
        // Import the functions after mocks are set up
        const module = await import('../../../src/content/utils/contentUtils');
        checkExtensionConnection = module.checkExtensionConnection;
        checkConnectionAndShowWarning = module.checkConnectionAndShowWarning;
    });

    describe('checkExtensionConnection', () => {
        it('should return false when chrome is undefined', async () => {
            (global as any).chrome = undefined;

            const result = await checkExtensionConnection();

            expect(result).toBe(false);
        });

        it('should return false when chrome.runtime is undefined', async () => {
            (global as any).chrome = {};

            const result = await checkExtensionConnection();

            expect(result).toBe(false);
        });

        it('should return false when chrome.runtime.sendMessage is undefined', async () => {
            (global as any).chrome = {
                runtime: {},
            };

            const result = await checkExtensionConnection();

            expect(result).toBe(false);
        });

        it('should return false on timeout', async () => {
            // Don't call the callback, let it timeout
            chrome.runtime.sendMessage.mockImplementation(() => {
                // Simulate no response (timeout)
            });

            const promise = checkExtensionConnection();

            // Fast-forward time to trigger timeout
            jest.advanceTimersByTime(5000);

            const result = await promise;

            expect(result).toBe(false);
            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
                { action: Actions.IS_AUTHENTICATED },
                expect.any(Function),
            );
        });

        it('should return false when chrome.runtime.lastError exists', async () => {
            chrome.runtime.lastError = { message: 'Extension context invalidated' };
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback(undefined);
            });

            const result = await checkExtensionConnection();

            expect(result).toBe(false);
            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
                { action: Actions.IS_AUTHENTICATED },
                expect.any(Function),
            );
        });

        it('should return false when response is undefined', async () => {
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback(undefined);
            });

            const result = await checkExtensionConnection();

            expect(result).toBe(false);
        });

        it('should return false when response is null', async () => {
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback(null);
            });

            const result = await checkExtensionConnection();

            expect(result).toBe(false);
        });

        it('should return true when response exists (authenticated user)', async () => {
            const mockResponse = { isAuthenticated: true };
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback(mockResponse);
            });

            const result = await checkExtensionConnection();

            expect(result).toBe(true);
            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
                { action: Actions.IS_AUTHENTICATED },
                expect.any(Function),
            );
        });

        it('should return true when response exists (non-authenticated user)', async () => {
            const mockResponse = { isAuthenticated: false };
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback(mockResponse);
            });

            const result = await checkExtensionConnection();

            expect(result).toBe(true);
            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
                { action: Actions.IS_AUTHENTICATED },
                expect.any(Function),
            );
        });

        it('should return false when sendMessage throws an error', async () => {
            chrome.runtime.sendMessage.mockImplementation(() => {
                throw new Error('Network error');
            });

            const result = await checkExtensionConnection();

            expect(result).toBe(false);
        });

        it('should clear timeout when response is received', async () => {
            const mockResponse = { isAuthenticated: true };
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                // Simulate immediate response
                setTimeout(() => callback(mockResponse), 1000);
            });

            const promise = checkExtensionConnection();

            // Fast-forward time to receive response (but not timeout)
            jest.advanceTimersByTime(1000);

            const result = await promise;

            expect(result).toBe(true);
            // Advance more time to ensure timeout was cleared
            jest.advanceTimersByTime(5000);
            // If timeout wasn't cleared, the test would fail due to additional calls
        });
    });

    describe('checkConnectionAndShowWarning', () => {
        let mockShowExtensionWarningModal: jest.Mock;

        beforeEach(() => {
            mockShowExtensionWarningModal = jest.fn();

            // Mock dynamic import
            jest.doMock('../../../src/content/modals/extensionWarningModal', () => ({
                showExtensionWarningModal: mockShowExtensionWarningModal,
            }));
        });

        it('should return true when connection is available', async () => {
            // Mock successful connection
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback({ isAuthenticated: true });
            });

            const result = await checkConnectionAndShowWarning();

            expect(result).toBe(true);
            expect(mockShowExtensionWarningModal).not.toHaveBeenCalled();
        });

        it('should return false and show modal when connection is lost', async () => {
            // Mock failed connection
            chrome.runtime.sendMessage.mockImplementation(() => {
                // No callback call (timeout)
            });

            const promise = checkConnectionAndShowWarning();

            // Fast-forward time to trigger timeout
            jest.advanceTimersByTime(5000);

            const result = await promise;

            expect(result).toBe(false);
        });

        it('should handle modal import error gracefully', async () => {
            // Mock failed connection
            chrome.runtime.sendMessage.mockImplementation(() => {
                // No callback call (timeout)
            });

            // Mock import error
            jest.doMock('../../../src/content/modals/extensionWarningModal', () => {
                throw new Error('Import failed');
            });

            const promise = checkConnectionAndShowWarning();

            // Fast-forward time to trigger timeout
            jest.advanceTimersByTime(5000);

            const result = await promise;

            expect(result).toBe(false);
            // Should not throw error despite import failure
        });
    });

    describe('Edge cases and error handling', () => {
        it('should handle rapid successive calls correctly', async () => {
            const mockResponse = { isAuthenticated: true };
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                setTimeout(() => callback(mockResponse), 100);
            });

            // Call multiple times rapidly
            const promises = [
                checkExtensionConnection(),
                checkExtensionConnection(),
                checkExtensionConnection(),
            ];

            jest.advanceTimersByTime(100);

            const results = await Promise.all(promises);

            expect(results).toEqual([true, true, true]);
            expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(3);
        });

        it('should handle mixed success/failure scenarios', async () => {
            let callCount = 0;
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callCount++;
                if (callCount === 1) {
                    callback({ isAuthenticated: true }); // Success
                } else if (callCount === 2) {
                    callback(null); // Failure
                } else {
                    chrome.runtime.lastError = { message: 'Error' };
                    callback(undefined); // Error
                }
            });

            const result1 = await checkExtensionConnection();
            chrome.runtime.lastError = null; // Reset for next call
            const result2 = await checkExtensionConnection();
            const result3 = await checkExtensionConnection();

            expect(result1).toBe(true);
            expect(result2).toBe(false);
            expect(result3).toBe(false);
        });
    });
});
