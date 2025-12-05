// Mock Supabase client before importing http
jest.mock('../../../src/services/supabaseClient', () => ({
    supabase: {
        from: jest.fn(() => ({
            insert: jest.fn(),
        })),
    },
}));

// Mock errorLogService
jest.mock('../../../src/services/errorLogService', () => ({
    errorLogService: {
        logError: jest.fn(),
        logRequestError: jest.fn(),
    },
}));

import {
    fetchRequest,
    detectHtmlError,
    determineErrorType,
    testErrorHandling,
} from '../../../src/utils/http';

// Mock logging
jest.mock('../../../src/utils/logging', () => ({
    consoleLog: jest.fn(),
}));

// Mock data types
jest.mock('../../../src/data', () => ({
    ErrorType: {
        NETWORK: 'NETWORK',
        CLIENT_ERROR: 'CLIENT_ERROR',
        SERVER_ERROR: 'SERVER_ERROR',
        HTML_ERROR: 'HTML_ERROR',
        UNKNOWN: 'UNKNOWN',
    },
    HttpStatus: {
        OK: 200,
        BAD_REQUEST: 400,
        NOT_FOUND: 404,
        INTERNAL_SERVER_ERROR: 500,
        BAD_GATEWAY: 502,
    },
    DEFAULT_RETRY_CONFIG: {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
    },
    RETRYABLE_STATUSES: [502, 503, 504],
}));

describe('HTTP Functions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset fetch mock
        (global as any).fetch = jest.fn();
    });

    describe('fetchRequest', () => {
        it('should make successful request', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                text: jest.fn().mockResolvedValue('{"data": "test"}'),
                headers: {
                    get: jest.fn(),
                    has: jest.fn(),
                    set: jest.fn(),
                    append: jest.fn(),
                    delete: jest.fn(),
                    forEach: jest.fn(),
                    entries: jest.fn(),
                    keys: jest.fn(),
                    values: jest.fn(),
                },
            };

            (global as any).fetch.mockResolvedValue(mockResponse);

            const result = await fetchRequest('https://api.test.com');

            expect((global as any).fetch).toHaveBeenCalledWith(
                'https://api.test.com',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        Pragma: 'no-cache',
                        Expires: '0',
                    }),
                    credentials: 'include',
                }),
            );

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.status).toBe(200);
                expect(result.statusText).toBe('OK');
            }
        });

        it('should handle network errors', async () => {
            (global as any).fetch.mockRejectedValue(new Error('Network error'));

            const result = await fetchRequest('https://api.test.com', {
                retryConfig: { maxAttempts: 1, baseDelay: 10, maxDelay: 100 },
            });

            expect(result.ok).toBe(false);
            if (!result.ok && 'error' in result) {
                expect(result.error.type).toBe('NETWORK');
                expect(result.error.message).toContain('Network error');
            }
        }, 2000);

        it('should handle HTTP 404 errors', async () => {
            const mockResponse = {
                ok: false,
                status: 404,
                statusText: 'Not Found',
                text: jest.fn().mockResolvedValue('Not found'),
                headers: {
                    get: jest.fn(),
                    has: jest.fn(),
                    set: jest.fn(),
                    append: jest.fn(),
                    delete: jest.fn(),
                    forEach: jest.fn(),
                    entries: jest.fn(),
                    keys: jest.fn(),
                    values: jest.fn(),
                },
            };

            (global as any).fetch.mockResolvedValue(mockResponse);

            const result = await fetchRequest('https://api.test.com');

            expect(result.ok).toBe(false);
            if (!result.ok && 'error' in result) {
                expect(result.error.type).toBe('CLIENT_ERROR');
                expect(result.error.status).toBe(404);
            }
        });

        it('should handle HTTP 500 errors', async () => {
            const mockResponse = {
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: jest.fn().mockResolvedValue('Server error'),
                headers: {
                    get: jest.fn(),
                    has: jest.fn(),
                    set: jest.fn(),
                    append: jest.fn(),
                    delete: jest.fn(),
                    forEach: jest.fn(),
                    entries: jest.fn(),
                    keys: jest.fn(),
                    values: jest.fn(),
                },
            };

            (global as any).fetch.mockResolvedValue(mockResponse);

            const result = await fetchRequest('https://api.test.com');

            expect(result.ok).toBe(false);
            if (!result.ok && 'error' in result) {
                expect(result.error.type).toBe('SERVER_ERROR');
                expect(result.error.status).toBe(500);
            }
        });

        it('should retry on retryable errors', async () => {
            const mockResponse = {
                ok: false,
                status: 502,
                statusText: 'Bad Gateway',
                text: jest.fn().mockResolvedValue('Bad Gateway'),
                headers: {
                    get: jest.fn(),
                    has: jest.fn(),
                    set: jest.fn(),
                    append: jest.fn(),
                    delete: jest.fn(),
                    forEach: jest.fn(),
                    entries: jest.fn(),
                    keys: jest.fn(),
                    values: jest.fn(),
                },
            };

            (global as any).fetch.mockResolvedValue(mockResponse);

            const result = await fetchRequest('https://api.test.com', {
                retryConfig: { maxAttempts: 2, baseDelay: 10, maxDelay: 100 },
            });

            // Should be called 2 times: 1 initial + 1 retry (maxAttempts = 2)
            expect((global as any).fetch).toHaveBeenCalledTimes(2);
            expect(result.ok).toBe(false);
        });

        it('should handle custom headers', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                text: jest.fn().mockResolvedValue('{"data": "test"}'),
                headers: {
                    get: jest.fn(),
                    has: jest.fn(),
                    set: jest.fn(),
                    append: jest.fn(),
                    delete: jest.fn(),
                    forEach: jest.fn(),
                    entries: jest.fn(),
                    keys: jest.fn(),
                    values: jest.fn(),
                },
            };

            (global as any).fetch.mockResolvedValue(mockResponse);

            await fetchRequest('https://api.test.com', {
                headers: {
                    Authorization: 'Bearer token',
                    'Content-Type': 'application/json',
                },
            });

            expect((global as any).fetch).toHaveBeenCalledWith(
                'https://api.test.com',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer token',
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        Pragma: 'no-cache',
                        Expires: '0',
                    }),
                }),
            );
        });

        it('should handle HTML error in response', async () => {
            const htmlErrorContent =
                '<html><head><title>404 Not Found</title></head><body>Page not found</body></html>';
            const mockResponse = {
                ok: false,
                status: 404,
                statusText: 'Not Found',
                text: jest.fn().mockResolvedValue(htmlErrorContent),
                headers: {
                    get: jest.fn(),
                    has: jest.fn(),
                    set: jest.fn(),
                    append: jest.fn(),
                    delete: jest.fn(),
                    forEach: jest.fn(),
                    entries: jest.fn(),
                    keys: jest.fn(),
                    values: jest.fn(),
                },
            };

            (global as any).fetch.mockResolvedValue(mockResponse);

            const result = await fetchRequest('https://api.test.com');

            expect(result.ok).toBe(false);
            if (!result.ok && 'error' in result) {
                expect(result.error.message).toContain('HTML Error');
            }
        });

        it('should handle error when logging fails', async () => {
            const { errorLogService } = require('../../../src/services/errorLogService');
            errorLogService.logRequestError.mockRejectedValue(new Error('Logging failed'));

            const mockResponse = {
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: jest.fn().mockResolvedValue('Server error'),
                headers: {
                    get: jest.fn(),
                    has: jest.fn(),
                    set: jest.fn(),
                    append: jest.fn(),
                    delete: jest.fn(),
                    forEach: jest.fn(),
                    entries: jest.fn(),
                    keys: jest.fn(),
                    values: jest.fn(),
                },
            };

            (global as any).fetch.mockResolvedValue(mockResponse);

            const result = await fetchRequest('https://api.test.com', {
                retryConfig: { maxAttempts: 1, baseDelay: 10, maxDelay: 100 },
            });

            // Should still return error response even if logging fails
            expect(result.ok).toBe(false);
            if (!result.ok && 'error' in result) {
                expect(result.error.type).toBe('SERVER_ERROR');
            }
        });

        it('should handle logging failure on network error', async () => {
            const { errorLogService } = require('../../../src/services/errorLogService');
            errorLogService.logRequestError.mockRejectedValue(new Error('Logging failed'));

            (global as any).fetch.mockRejectedValue(new Error('Network error'));

            const result = await fetchRequest('https://api.test.com', {
                retryConfig: { maxAttempts: 1, baseDelay: 10, maxDelay: 100 },
            });

            // Should still return error response even if logging fails
            expect(result.ok).toBe(false);
            if (!result.ok && 'error' in result) {
                expect(result.error.type).toBe('NETWORK');
            }
        });

        it('should retry on network errors', async () => {
            (global as any).fetch
                .mockRejectedValueOnce(new Error('Network error'))
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    text: jest.fn().mockResolvedValue('Success'),
                    headers: {
                        get: jest.fn(),
                        has: jest.fn(),
                        set: jest.fn(),
                        append: jest.fn(),
                        delete: jest.fn(),
                        forEach: jest.fn(),
                        entries: jest.fn(),
                        keys: jest.fn(),
                        values: jest.fn(),
                    },
                });

            const result = await fetchRequest('https://api.test.com', {
                retryConfig: { maxAttempts: 3, baseDelay: 10, maxDelay: 100 },
            });

            expect((global as any).fetch).toHaveBeenCalledTimes(3);
            expect(result.ok).toBe(true);
        });

        it('should return ErrorResponse with working text() method', async () => {
            (global as any).fetch.mockRejectedValue(new Error('Network error'));

            const result = await fetchRequest('https://api.test.com', {
                retryConfig: { maxAttempts: 1, baseDelay: 10, maxDelay: 100 },
            });

            expect(result.ok).toBe(false);
            if (!result.ok && 'error' in result && 'text' in result) {
                const textContent = await result.text();
                expect(textContent).toContain('Network error');
            }
        });

        it('should handle non-Error exception in network catch block', async () => {
            (global as any).fetch.mockRejectedValue('String error');

            const result = await fetchRequest('https://api.test.com', {
                retryConfig: { maxAttempts: 1, baseDelay: 10, maxDelay: 100 },
            });

            expect(result.ok).toBe(false);
            if (!result.ok && 'error' in result) {
                expect(result.error.message).toContain('Unknown error');
            }
        });
    });

    describe('detectHtmlError', () => {
        it('should detect HTML error with status code in title', () => {
            const htmlContent =
                '<html><head><title>404 Not Found</title></head><body>Page not found</body></html>';
            const result = detectHtmlError(htmlContent);

            expect(result.isError).toBe(true);
            expect(result.status).toBe(404);
            expect(result.message).toContain('HTML Error Page Detected');
        });

        it('should detect HTML error with status code in h1', () => {
            const htmlContent = '<html><body><h1>500 Internal Server Error</h1></body></html>';
            const result = detectHtmlError(htmlContent);

            expect(result.isError).toBe(true);
            expect(result.status).toBe(500);
            expect(result.message).toContain('HTML Error Page Detected');
        });

        it('should detect HTML error with status text', () => {
            const htmlContent = '<html><body>Status: 403 Forbidden</body></html>';
            const result = detectHtmlError(htmlContent);

            expect(result.isError).toBe(true);
            expect(result.status).toBe(403);
            expect(result.message).toContain('HTML Error Page Detected');
        });

        it('should detect HTML error without status code', () => {
            const htmlContent =
                '<html><body><h1>Error</h1><p>Something went wrong</p></body></html>';
            const result = detectHtmlError(htmlContent);

            expect(result.isError).toBe(true);
            expect(result.status).toBeUndefined();
            expect(result.message).toContain('HTML Error Page Detected');
        });

        it('should not detect error in normal HTML', () => {
            const htmlContent =
                '<html><body><h1>Welcome</h1><p>This is a normal page</p></body></html>';
            const result = detectHtmlError(htmlContent);

            expect(result.isError).toBe(false);
        });

        it('should handle empty response', () => {
            const result = detectHtmlError('');
            expect(result.isError).toBe(false);
        });
    });

    describe('determineErrorType', () => {
        it('should return SERVER_ERROR for 5xx status codes', () => {
            expect(determineErrorType(500, '')).toBe('SERVER_ERROR');
            expect(determineErrorType(502, '')).toBe('SERVER_ERROR');
            expect(determineErrorType(503, '')).toBe('SERVER_ERROR');
        });

        it('should return CLIENT_ERROR for 4xx status codes', () => {
            expect(determineErrorType(400, '')).toBe('CLIENT_ERROR');
            expect(determineErrorType(404, '')).toBe('CLIENT_ERROR');
            expect(determineErrorType(403, '')).toBe('CLIENT_ERROR');
        });

        it('should return HTML_ERROR for HTML error pages', () => {
            const htmlError = '<html><title>404 Not Found</title></html>';
            expect(determineErrorType(200, htmlError)).toBe('HTML_ERROR');
        });

        it('should return UNKNOWN for other cases', () => {
            expect(determineErrorType(300, '')).toBe('UNKNOWN');
            expect(determineErrorType(100, '')).toBe('UNKNOWN');
        });
    });

    describe('testErrorHandling', () => {
        it('should run error handling tests', async () => {
            // Mock fetch to return different responses for different URLs
            (global as any).fetch.mockImplementation((url: string) => {
                if (url.includes('non-existent-url')) {
                    return Promise.reject(new Error('Network error'));
                } else if (url.includes('httpstat.us/404')) {
                    return Promise.resolve({
                        ok: false,
                        status: 404,
                        statusText: 'Not Found',
                        text: () => Promise.resolve('Not found'),
                        headers: { get: jest.fn() },
                    });
                } else if (url.includes('httpstat.us/502')) {
                    return Promise.resolve({
                        ok: false,
                        status: 502,
                        statusText: 'Bad Gateway',
                        text: () => Promise.resolve('Bad Gateway'),
                        headers: { get: jest.fn() },
                    });
                }
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve('Success'),
                    headers: { get: jest.fn() },
                });
            });

            await testErrorHandling();

            // Verify that fetch was called for each test case
            expect((global as any).fetch).toHaveBeenCalledWith(
                'https://non-existent-url-12345.com/test',
                expect.any(Object),
            );
            expect((global as any).fetch).toHaveBeenCalledWith(
                'https://httpstat.us/404',
                expect.any(Object),
            );
            expect((global as any).fetch).toHaveBeenCalledWith(
                'https://httpstat.us/502',
                expect.any(Object),
            );
        });
    });
});
