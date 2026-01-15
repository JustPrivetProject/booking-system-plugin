import type { ErrorResponse, FetchRequestOptions } from '../types/general';
import {
    ErrorType,
    // HttpStatus,
    // RetryConfig,
    DEFAULT_RETRY_CONFIG,
    RETRYABLE_STATUSES,
} from '../data';
import { errorLogService } from '../services/errorLogService';

import { consoleLog } from './logging';

// Mock responses for test build
const TEST_MOCKS: Record<string, { body: string; contentType: string }> = {
    '/Home/GetSlots': {
        body: `<div>
    <span>
        <button type="button" class="btn btn-outline btn-success-outlined btn-xs vbs-w-125 vbs-no-pointer">18:00-18:59</button>
    </span>
 <div>
        <span>
            <button type="button"  disabled="disabled" class="btn btn-outline btn-success-outlined btn-xs vbs-w-125 vbs-no-pointer">22:00-22:59</button>
        </span>
    </div>
</div>`,
        contentType: 'text/html',
    },
    '/TVApp/EditTvAppSubmit': {
        body: '{"error":"DFSU1488716 - Za duża ilość transakcji w sektorze","messageCode":"YbqToMuchTransactionInSector|DFSU1488716"}',
        contentType: 'application/json',
    },
};

// Check if mocking is enabled (set by webpack DefinePlugin in test build)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MOCKING_ENABLED = (process.env as any).TEST_MOCKS === true;

/**
 * Check if URL matches a mock pattern and return mock response
 */
function getMockResponse(url: string): Response | null {
    if (!MOCKING_ENABLED) {
        return null;
    }

    consoleLog(`[MOCK] Checking URL: ${url}, Mocking enabled: ${MOCKING_ENABLED}`);

    for (const [pattern, mock] of Object.entries(TEST_MOCKS)) {
        if (url.includes(pattern)) {
            consoleLog(`[MOCK] ✅ Intercepted request to ${pattern}`);
            return new Response(mock.body, {
                status: 200,
                statusText: 'OK (Mocked)',
                headers: {
                    'Content-Type': mock.contentType,
                    'X-Mocked': 'true',
                },
            });
        }
    }

    consoleLog(`[MOCK] ❌ No mock found for: ${url}`);
    return null;
}

export async function fetchRequest(
    url: string,
    options: FetchRequestOptions = {},
): Promise<Response | ErrorResponse> {
    // Check for mock response in test build
    const mockResponse = getMockResponse(url);
    if (mockResponse) {
        return mockResponse;
    }

    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
        // Keep-alive mechanism during fetch - Chrome API calls reset idle timer
        let keepAliveIntervalId: NodeJS.Timeout | null = null;

        try {
            // Start keep-alive during fetch to prevent service worker termination
            // Call Chrome API every 20 seconds to reset idle timer
            keepAliveIntervalId = setInterval(() => {
                try {
                    chrome.runtime.getPlatformInfo(() => {
                        // Timer reset
                    });
                } catch {
                    // Ignore errors - keep-alive attempt
                }
            }, 20000);

            const response = await fetch(url, {
                ...options,
                headers: {
                    ...options.headers,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    Pragma: 'no-cache',
                    Expires: '0',
                },
                credentials: 'include',
            });

            // Stop keep-alive after fetch starts (response received)
            if (keepAliveIntervalId) {
                clearInterval(keepAliveIntervalId);
                keepAliveIntervalId = null;
            }

            // Get response text for error analysis
            const responseText = await response.text();

            // Check if response is successful
            if (response.ok) {
                // Reconstruct response with the text we already read
                return new Response(responseText, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                });
            }

            // Analyze error type
            const htmlError = detectHtmlError(responseText);
            const errorType = determineErrorType(response.status, responseText);

            // Create detailed error message
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            if (htmlError.isError) {
                errorMessage += ` | HTML Error: ${htmlError.message}`;
            }
            if (responseText) {
                errorMessage += ` | Response: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`;
            }

            // Check if we should retry
            if (isRetryableError(response.status) && attempt < retryConfig.maxAttempts) {
                const delay = calculateDelay(attempt, retryConfig.baseDelay, retryConfig.maxDelay);
                consoleLog(
                    `Retry attempt ${attempt}/${retryConfig.maxAttempts} for ${url} after ${delay}ms. Status: ${response.status}`,
                );
                await sleep(delay);
                continue;
            }

            // Log error details
            consoleLog(`Request failed after ${attempt} attempts:`, {
                url,
                status: response.status,
                errorType,
                message: errorMessage,
                attempt,
            });

            // Log to error service for critical errors
            if (attempt === retryConfig.maxAttempts) {
                try {
                    await errorLogService.logRequestError(
                        errorType,
                        errorMessage,
                        url,
                        response.status,
                        attempt,
                        responseText,
                    );
                } catch (logError) {
                    consoleLog('Failed to log error to service:', logError);
                }
            }

            return createErrorResponse(
                errorType,
                errorMessage,
                response.status,
                undefined,
                attempt,
            );
        } catch (error) {
            // Stop keep-alive on error
            if (keepAliveIntervalId) {
                clearInterval(keepAliveIntervalId);
                keepAliveIntervalId = null;
            }

            lastError = error as Error;

            // Handle network errors
            if (attempt < retryConfig.maxAttempts) {
                const delay = calculateDelay(attempt, retryConfig.baseDelay, retryConfig.maxDelay);
                consoleLog(
                    `Network error, retry attempt ${attempt}/${retryConfig.maxAttempts} for ${url} after ${delay}ms:`,
                    error,
                );
                await sleep(delay);
                continue;
            }

            // Log final error
            consoleLog(`Request failed after ${attempt} attempts due to network error:`, {
                url,
                error,
                attempt,
            });

            // Log to error service for critical network errors
            if (attempt === retryConfig.maxAttempts) {
                try {
                    await errorLogService.logRequestError(
                        ErrorType.NETWORK,
                        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        url,
                        undefined,
                        attempt,
                        undefined,
                        { originalError: error },
                    );
                } catch (logError) {
                    consoleLog('Failed to log network error to service:', logError);
                }
            }

            return createErrorResponse(
                ErrorType.NETWORK,
                `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                undefined,
                error as Error,
                attempt,
            );
        }
    }

    // This should never be reached, but just in case
    return createErrorResponse(
        ErrorType.UNKNOWN,
        'Unexpected error in fetchRequest',
        undefined,
        lastError || undefined,
        retryConfig.maxAttempts,
    );
}

// Helper functions for error handling
function isRetryableError(status: number): boolean {
    return RETRYABLE_STATUSES.includes(status);
}

function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
    const delay = baseDelay * Math.pow(2, attempt - 1);
    return Math.min(delay, maxDelay);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function detectHtmlError(responseText: string): {
    isError: boolean;
    status?: number;
    message?: string;
} {
    // Check for common HTML error patterns
    const errorPatterns = [
        { pattern: /<title>.*?(\d{3}).*?<\/title>/i, extractStatus: true },
        { pattern: /<h1>.*?(\d{3}).*?<\/h1>/i, extractStatus: true },
        { pattern: /Status:\s*(\d{3})/i, extractStatus: true },
        { pattern: /Error\s*(\d{3})/i, extractStatus: true },
        { pattern: /<h1>.*?Error.*?<\/h1>/i, extractStatus: false },
        { pattern: /<title>.*?Error.*?<\/title>/i, extractStatus: false },
    ];

    for (const { pattern, extractStatus } of errorPatterns) {
        const match = responseText.match(pattern);
        if (match) {
            if (extractStatus && match[1]) {
                return {
                    isError: true,
                    status: parseInt(match[1]),
                    message: `HTML Error Page Detected: ${match[0]}`,
                };
            } else {
                return {
                    isError: true,
                    message: `HTML Error Page Detected: ${match[0]}`,
                };
            }
        }
    }

    return { isError: false };
}

export function determineErrorType(status: number, responseText: string): ErrorType {
    if (status >= 500) {
        return ErrorType.SERVER_ERROR;
    } else if (status >= 400) {
        return ErrorType.CLIENT_ERROR;
    } else if (detectHtmlError(responseText).isError) {
        return ErrorType.HTML_ERROR;
    }
    return ErrorType.UNKNOWN;
}

function createErrorResponse(
    type: ErrorType,
    message: string,
    status?: number,
    originalError?: Error,
    attempt?: number,
): ErrorResponse {
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
}

// Test function for error handling (for development purposes)
export async function testErrorHandling() {
    consoleLog('Testing error handling...');

    // Test 1: Network error (non-existent URL)
    const networkErrorResult = await fetchRequest('https://non-existent-url-12345.com/test', {
        method: 'GET',
        retryConfig: { maxAttempts: 2, baseDelay: 100, maxDelay: 500 },
    });

    if (!networkErrorResult.ok && 'error' in networkErrorResult) {
        consoleLog('Network error test result:', networkErrorResult.error);
    }

    // Test 2: Server error (404)
    const serverErrorResult = await fetchRequest('https://httpstat.us/404', {
        method: 'GET',
        retryConfig: { maxAttempts: 2, baseDelay: 100, maxDelay: 500 },
    });

    if (!serverErrorResult.ok && 'error' in serverErrorResult) {
        consoleLog('Server error test result:', serverErrorResult.error);
    }

    // Test 3: Retryable error (502)
    const retryableErrorResult = await fetchRequest('https://httpstat.us/502', {
        method: 'GET',
        retryConfig: { maxAttempts: 3, baseDelay: 100, maxDelay: 500 },
    });

    if (!retryableErrorResult.ok && 'error' in retryableErrorResult) {
        consoleLog('Retryable error test result:', retryableErrorResult.error);
    }

    consoleLog('Error handling tests completed');
}
