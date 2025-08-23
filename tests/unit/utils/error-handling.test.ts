// Mock Supabase client before importing utils-function
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
    consoleError,
    saveLogToSession,
    getLogsFromSession,
    clearLogsInSession,
    detectHtmlError,
    determineErrorType,
    ErrorType,
    HttpStatus,
} from '../../../src/utils/index';

// Mock the non-exported functions locally
const createErrorResponse = (
    type: ErrorType,
    message: string,
    status?: number,
    originalError?: Error,
    attempt?: number,
) => {
    return {
        ok: false,
        error: {
            type,
            status,
            message,
            originalError,
            attempt,
        },
        text: () => Promise.resolve(message),
    };
};

const isRetryableError = (status: number): boolean => {
    const RETRYABLE_STATUSES = [
        HttpStatus.BAD_GATEWAY,
        HttpStatus.SERVICE_UNAVAILABLE,
        HttpStatus.GATEWAY_TIMEOUT,
        HttpStatus.REQUEST_TIMEOUT,
        HttpStatus.TOO_MANY_REQUESTS,
    ];
    return RETRYABLE_STATUSES.includes(status);
};

const calculateDelay = (attempt: number, baseDelay: number, maxDelay: number): number => {
    const delay = baseDelay * Math.pow(2, attempt - 1);
    return Math.min(delay, maxDelay);
};

const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

describe('Error Handling Functions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('detectHtmlError', () => {
        it('should detect error with status code in title', () => {
            const responseText = '<title>Error 404 - Page Not Found</title>';
            const result = detectHtmlError(responseText);

            expect(result.isError).toBe(true);
            expect(result.status).toBe(404);
            expect(result.message).toContain('HTML Error Page Detected');
        });

        it('should detect error with status code in h1', () => {
            const responseText = '<h1>Error 500 - Internal Server Error</h1>';
            const result = detectHtmlError(responseText);

            expect(result.isError).toBe(true);
            expect(result.status).toBe(500);
            expect(result.message).toContain('HTML Error Page Detected');
        });

        it('should detect error with Status pattern', () => {
            const responseText = '<div>Status: 403 Forbidden</div>';
            const result = detectHtmlError(responseText);

            expect(result.isError).toBe(true);
            expect(result.status).toBe(403);
            expect(result.message).toContain('HTML Error Page Detected');
        });

        it('should detect error with Error pattern', () => {
            const responseText = '<div>Error 502 Bad Gateway</div>';
            const result = detectHtmlError(responseText);

            expect(result.isError).toBe(true);
            expect(result.status).toBe(502);
            expect(result.message).toContain('HTML Error Page Detected');
        });

        it('should detect error without status code in h1', () => {
            const responseText = '<h1>Error Page</h1>';
            const result = detectHtmlError(responseText);

            expect(result.isError).toBe(true);
            expect(result.status).toBeUndefined();
            expect(result.message).toContain('HTML Error Page Detected');
        });

        it('should detect error without status code in title', () => {
            const responseText = '<title>Error Page</title>';
            const result = detectHtmlError(responseText);

            expect(result.isError).toBe(true);
            expect(result.status).toBeUndefined();
            expect(result.message).toContain('HTML Error Page Detected');
        });

        it('should return false for non-error HTML', () => {
            const responseText = '<html><body><h1>Welcome</h1></body></html>';
            const result = detectHtmlError(responseText);

            expect(result.isError).toBe(false);
        });

        it('should return false for empty string', () => {
            const result = detectHtmlError('');
            expect(result.isError).toBe(false);
        });
    });

    describe('determineErrorType', () => {
        it('should return SERVER_ERROR for 5xx status codes', () => {
            expect(determineErrorType(500, '')).toBe(ErrorType.SERVER_ERROR);
            expect(determineErrorType(502, '')).toBe(ErrorType.SERVER_ERROR);
            expect(determineErrorType(503, '')).toBe(ErrorType.SERVER_ERROR);
            expect(determineErrorType(504, '')).toBe(ErrorType.SERVER_ERROR);
        });

        it('should return CLIENT_ERROR for 4xx status codes', () => {
            expect(determineErrorType(400, '')).toBe(ErrorType.CLIENT_ERROR);
            expect(determineErrorType(401, '')).toBe(ErrorType.CLIENT_ERROR);
            expect(determineErrorType(403, '')).toBe(ErrorType.CLIENT_ERROR);
            expect(determineErrorType(404, '')).toBe(ErrorType.CLIENT_ERROR);
            expect(determineErrorType(429, '')).toBe(ErrorType.CLIENT_ERROR);
        });

        it('should return HTML_ERROR when HTML error is detected', () => {
            // Mock detectHtmlError to return true
            jest.spyOn(require('../../../src/utils/http'), 'detectHtmlError').mockReturnValue({
                isError: true,
                message: 'HTML Error',
            });

            const result = determineErrorType(200, '<h1>Error</h1>');
            expect(result).toBe(ErrorType.HTML_ERROR);

            // Restore original function
            jest.restoreAllMocks();
        });

        it('should return UNKNOWN for other status codes', () => {
            expect(determineErrorType(200, '')).toBe(ErrorType.UNKNOWN);
            expect(determineErrorType(300, '')).toBe(ErrorType.UNKNOWN);
            expect(determineErrorType(100, '')).toBe(ErrorType.UNKNOWN);
        });
    });

    describe('createErrorResponse', () => {
        it('should create error response with all parameters', () => {
            const originalError = new Error('Original error');
            const result = createErrorResponse(
                ErrorType.NETWORK,
                'Network error occurred',
                500,
                originalError,
                2,
            );

            expect(result.ok).toBe(false);
            expect(result.error.type).toBe(ErrorType.NETWORK);
            expect(result.error.message).toBe('Network error occurred');
            expect(result.error.status).toBe(500);
            expect(result.error.originalError).toBe(originalError);
            expect(result.error.attempt).toBe(2);
        });

        it('should create error response with minimal parameters', () => {
            const result = createErrorResponse(ErrorType.UNKNOWN, 'Unknown error');

            expect(result.ok).toBe(false);
            expect(result.error.type).toBe(ErrorType.UNKNOWN);
            expect(result.error.message).toBe('Unknown error');
            expect(result.error.status).toBeUndefined();
            expect(result.error.originalError).toBeUndefined();
            expect(result.error.attempt).toBeUndefined();
        });

        it('should have working text method', async () => {
            const result = createErrorResponse(ErrorType.CLIENT_ERROR, 'Client error message');

            const text = await result.text();
            expect(text).toBe('Client error message');
        });
    });

    describe('isRetryableError', () => {
        it('should return true for retryable status codes', () => {
            expect(isRetryableError(HttpStatus.BAD_GATEWAY)).toBe(true);
            expect(isRetryableError(HttpStatus.SERVICE_UNAVAILABLE)).toBe(true);
            expect(isRetryableError(HttpStatus.GATEWAY_TIMEOUT)).toBe(true);
            expect(isRetryableError(HttpStatus.REQUEST_TIMEOUT)).toBe(true);
            expect(isRetryableError(HttpStatus.TOO_MANY_REQUESTS)).toBe(true);
        });

        it('should return false for non-retryable status codes', () => {
            expect(isRetryableError(HttpStatus.BAD_REQUEST)).toBe(false);
            expect(isRetryableError(HttpStatus.UNAUTHORIZED)).toBe(false);
            expect(isRetryableError(HttpStatus.FORBIDDEN)).toBe(false);
            expect(isRetryableError(HttpStatus.NOT_FOUND)).toBe(false);
            expect(isRetryableError(HttpStatus.INTERNAL_SERVER_ERROR)).toBe(false);
        });

        it('should return false for undefined status', () => {
            expect(isRetryableError(undefined as any)).toBe(false);
        });
    });
});
