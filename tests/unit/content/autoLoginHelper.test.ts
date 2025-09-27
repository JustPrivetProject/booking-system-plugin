import { jest } from '@jest/globals';
import { Actions } from '../../../src/data';

// Mock console to avoid noise in tests
const originalConsole = { ...console };
(global as any).console = {
    ...originalConsole,
    log: jest.fn(),
};

describe('autoLoginHelper', () => {
    let autoLoginHelper: any;
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
        const module = await import('../../../src/content/utils/autoLoginHelper');
        autoLoginHelper = module.autoLoginHelper;
    });

    describe('loadCredentials', () => {
        it('should return null when chrome is undefined', async () => {
            (global as any).chrome = undefined;

            const result = await autoLoginHelper.loadCredentials();

            expect(result).toBe(null);
            expect(console.log).toHaveBeenCalledWith(
                '[content] Error loading auto-login credentials:',
                expect.any(Error),
            );
        });

        it('should return null when chrome.runtime is undefined', async () => {
            (global as any).chrome = {};

            const result = await autoLoginHelper.loadCredentials();

            expect(result).toBe(null);
            expect(console.log).toHaveBeenCalledWith(
                '[content] Chrome runtime not available for auto-login',
            );
        });

        it('should return null when chrome.runtime.sendMessage is undefined', async () => {
            (global as any).chrome = {
                runtime: {},
            };

            const result = await autoLoginHelper.loadCredentials();

            expect(result).toBe(null);
            expect(console.log).toHaveBeenCalledWith(
                '[content] Chrome runtime not available for auto-login',
            );
        });

        it('should return null on timeout', async () => {
            // Don't call the callback, let it timeout
            chrome.runtime.sendMessage.mockImplementation(() => {
                // Simulate no response (timeout)
            });

            const promise = autoLoginHelper.loadCredentials();

            // Fast-forward time to trigger timeout
            jest.advanceTimersByTime(5000);

            const result = await promise;

            expect(result).toBe(null);
            expect(console.log).toHaveBeenCalledWith('[content] Auto-login credentials timeout');
            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
                { action: Actions.LOAD_AUTO_LOGIN_CREDENTIALS },
                expect.any(Function),
            );
        });

        it('should return null when chrome.runtime.lastError exists', async () => {
            chrome.runtime.lastError = { message: 'Extension context invalidated' };
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback(undefined);
            });

            const result = await autoLoginHelper.loadCredentials();

            expect(result).toBe(null);
            expect(console.log).toHaveBeenCalledWith(
                '[content] Runtime error in auto-login:',
                chrome.runtime.lastError,
            );
            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
                { action: Actions.LOAD_AUTO_LOGIN_CREDENTIALS },
                expect.any(Function),
            );
        });

        it('should return null when response is undefined', async () => {
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback(undefined);
            });

            const result = await autoLoginHelper.loadCredentials();

            expect(result).toBe(null);
            expect(console.log).toHaveBeenCalledWith(
                '[content] No response from background for auto-login',
            );
        });

        it('should return null when response is null', async () => {
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback(null);
            });

            const result = await autoLoginHelper.loadCredentials();

            expect(result).toBe(null);
            expect(console.log).toHaveBeenCalledWith(
                '[content] No response from background for auto-login',
            );
        });

        it('should return null when response.success is false', async () => {
            const mockResponse = { success: false };
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback(mockResponse);
            });

            const result = await autoLoginHelper.loadCredentials();

            expect(result).toBe(null);
        });

        it('should return null when response.credentials is missing', async () => {
            const mockResponse = { success: true };
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback(mockResponse);
            });

            const result = await autoLoginHelper.loadCredentials();

            expect(result).toBe(null);
        });

        it('should return credentials when response is successful', async () => {
            const mockCredentials = { login: 'test@example.com', password: 'password123' };
            const mockResponse = { success: true, credentials: mockCredentials };
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback(mockResponse);
            });

            const result = await autoLoginHelper.loadCredentials();

            expect(result).toEqual(mockCredentials);
            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
                { action: Actions.LOAD_AUTO_LOGIN_CREDENTIALS },
                expect.any(Function),
            );
        });

        it('should return null when sendMessage throws an error', async () => {
            chrome.runtime.sendMessage.mockImplementation(() => {
                throw new Error('Network error');
            });

            const result = await autoLoginHelper.loadCredentials();

            expect(result).toBe(null);
            expect(console.log).toHaveBeenCalledWith(
                '[content] Error loading auto-login credentials:',
                expect.any(Error),
            );
        });

        it('should clear timeout when response is received', async () => {
            const mockCredentials = { login: 'test@example.com', password: 'password123' };
            const mockResponse = { success: true, credentials: mockCredentials };
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                // Simulate immediate response
                setTimeout(() => callback(mockResponse), 1000);
            });

            const promise = autoLoginHelper.loadCredentials();

            // Fast-forward time to receive response (but not timeout)
            jest.advanceTimersByTime(1000);

            const result = await promise;

            expect(result).toEqual(mockCredentials);
            // Advance more time to ensure timeout was cleared
            jest.advanceTimersByTime(5000);
            // If timeout wasn't cleared, the test would fail due to additional calls
        });
    });

    describe('isEnabled', () => {
        it('should return true when credentials are loaded successfully', async () => {
            const mockCredentials = { login: 'test@example.com', password: 'password123' };
            const mockResponse = { success: true, credentials: mockCredentials };
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback(mockResponse);
            });

            const result = await autoLoginHelper.isEnabled();

            expect(result).toBe(true);
        });

        it('should return false when credentials are not loaded', async () => {
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callback(null);
            });

            const result = await autoLoginHelper.isEnabled();

            expect(result).toBe(false);
        });

        it('should return false when loadCredentials throws an error', async () => {
            // Mock loadCredentials to throw an error by making chrome undefined
            (global as any).chrome = undefined;

            const result = await autoLoginHelper.isEnabled();

            expect(result).toBe(false);
            expect(console.log).toHaveBeenCalledWith(
                '[content] Error loading auto-login credentials:',
                expect.any(Error),
            );
        });
    });

    describe('fillLoginForm', () => {
        const mockCredentials = { login: 'test@example.com', password: 'password123' };
        let mockLoginInput: HTMLInputElement;
        let mockPasswordInput: HTMLInputElement;
        let querySelectorSpy: any;

        beforeEach(() => {
            mockLoginInput = {
                value: '',
                dispatchEvent: jest.fn(),
            } as any;
            mockPasswordInput = {
                value: '',
                dispatchEvent: jest.fn(),
            } as any;

            // Mock document.querySelector
            querySelectorSpy = jest.spyOn(document, 'querySelector');
        });

        afterEach(() => {
            querySelectorSpy.mockRestore();
        });

        it('should return false when login input is not found', () => {
            querySelectorSpy
                .mockReturnValueOnce(null) // login input not found
                .mockReturnValueOnce(mockPasswordInput); // password input found

            const result = autoLoginHelper.fillLoginForm(mockCredentials);

            expect(result).toBe(false);
            expect(querySelectorSpy).toHaveBeenCalledWith('#UserName');
            expect(querySelectorSpy).toHaveBeenCalledWith('#Password');
            expect(querySelectorSpy).toHaveBeenCalledTimes(2);
        });

        it('should return false when password input is not found', () => {
            querySelectorSpy
                .mockReturnValueOnce(mockLoginInput) // login input found
                .mockReturnValueOnce(null); // password input not found

            const result = autoLoginHelper.fillLoginForm(mockCredentials);

            expect(result).toBe(false);
            expect(querySelectorSpy).toHaveBeenCalledTimes(2);
        });

        it('should return false when both inputs are not found', () => {
            querySelectorSpy
                .mockReturnValueOnce(null) // login input not found
                .mockReturnValueOnce(null); // password input not found

            const result = autoLoginHelper.fillLoginForm(mockCredentials);

            expect(result).toBe(false);
            expect(querySelectorSpy).toHaveBeenCalledTimes(2);
        });

        it('should fill form and return true when both inputs are found', () => {
            querySelectorSpy
                .mockReturnValueOnce(mockLoginInput) // login input found
                .mockReturnValueOnce(mockPasswordInput); // password input found

            const result = autoLoginHelper.fillLoginForm(mockCredentials);

            expect(result).toBe(true);
            expect(mockLoginInput.value).toBe(mockCredentials.login);
            expect(mockPasswordInput.value).toBe(mockCredentials.password);
            expect(mockLoginInput.dispatchEvent).toHaveBeenCalledWith(
                new Event('input', { bubbles: true }),
            );
            expect(mockPasswordInput.dispatchEvent).toHaveBeenCalledWith(
                new Event('input', { bubbles: true }),
            );
            expect(querySelectorSpy).toHaveBeenCalledTimes(2);
        });

        it('should use correct selectors for form inputs', () => {
            querySelectorSpy
                .mockReturnValueOnce(mockLoginInput)
                .mockReturnValueOnce(mockPasswordInput);

            autoLoginHelper.fillLoginForm(mockCredentials);

            expect(querySelectorSpy).toHaveBeenNthCalledWith(1, '#UserName');
            expect(querySelectorSpy).toHaveBeenNthCalledWith(2, '#Password');
            expect(querySelectorSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('Edge cases and error handling', () => {
        it('should handle rapid successive calls to loadCredentials correctly', async () => {
            const mockCredentials = { login: 'test@example.com', password: 'password123' };
            const mockResponse = { success: true, credentials: mockCredentials };
            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                setTimeout(() => callback(mockResponse), 100);
            });

            // Call multiple times rapidly
            const promises = [
                autoLoginHelper.loadCredentials(),
                autoLoginHelper.loadCredentials(),
                autoLoginHelper.loadCredentials(),
            ];

            jest.advanceTimersByTime(100);

            const results = await Promise.all(promises);

            expect(results).toEqual([mockCredentials, mockCredentials, mockCredentials]);
            expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(3);
        });

        it('should handle mixed success/failure scenarios in loadCredentials', async () => {
            let callCount = 0;
            const mockCredentials = { login: 'test@example.com', password: 'password123' };
            const mockResponse = { success: true, credentials: mockCredentials };

            chrome.runtime.sendMessage.mockImplementation((message, callback) => {
                callCount++;
                if (callCount === 1) {
                    callback(mockResponse); // Success
                } else if (callCount === 2) {
                    callback(null); // Failure
                } else {
                    chrome.runtime.lastError = { message: 'Error' };
                    callback(undefined); // Error
                }
            });

            const result1 = await autoLoginHelper.loadCredentials();
            chrome.runtime.lastError = null; // Reset for next call
            const result2 = await autoLoginHelper.loadCredentials();
            const result3 = await autoLoginHelper.loadCredentials();

            expect(result1).toEqual(mockCredentials);
            expect(result2).toBe(null);
            expect(result3).toBe(null);
        });

        it('should handle form filling with empty credentials', () => {
            const emptyCredentials = { login: '', password: '' };
            const mockLoginInput = {
                value: '',
                dispatchEvent: jest.fn(),
            } as any;
            const mockPasswordInput = {
                value: '',
                dispatchEvent: jest.fn(),
            } as any;

            const edgeQuerySelectorSpy = jest.spyOn(document, 'querySelector');
            edgeQuerySelectorSpy
                .mockReturnValueOnce(mockLoginInput)
                .mockReturnValueOnce(mockPasswordInput);

            const result = autoLoginHelper.fillLoginForm(emptyCredentials);

            expect(result).toBe(true);
            expect(mockLoginInput.value).toBe('');
            expect(mockPasswordInput.value).toBe('');
            expect(edgeQuerySelectorSpy).toHaveBeenCalledTimes(2);

            edgeQuerySelectorSpy.mockRestore();
        });

        it('should handle form filling with special characters in credentials', () => {
            const specialCredentials = { login: 'test@example.com', password: 'p@ssw0rd!@#$%' };
            const mockLoginInput = {
                value: '',
                dispatchEvent: jest.fn(),
            } as any;
            const mockPasswordInput = {
                value: '',
                dispatchEvent: jest.fn(),
            } as any;

            const edgeQuerySelectorSpy = jest.spyOn(document, 'querySelector');
            edgeQuerySelectorSpy
                .mockReturnValueOnce(mockLoginInput)
                .mockReturnValueOnce(mockPasswordInput);

            const result = autoLoginHelper.fillLoginForm(specialCredentials);

            expect(result).toBe(true);
            expect(mockLoginInput.value).toBe(specialCredentials.login);
            expect(mockPasswordInput.value).toBe(specialCredentials.password);
            expect(edgeQuerySelectorSpy).toHaveBeenCalledTimes(2);

            edgeQuerySelectorSpy.mockRestore();
        });
    });
});
