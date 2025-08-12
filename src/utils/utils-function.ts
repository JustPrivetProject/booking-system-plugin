import { StatusesPriority } from '../data'
import { errorLogService } from '../services/errorLogService'

// Error types and retry configuration
export enum ErrorType {
    NETWORK = 'NETWORK',
    SERVER_ERROR = 'SERVER_ERROR',
    CLIENT_ERROR = 'CLIENT_ERROR',
    HTML_ERROR = 'HTML_ERROR',
    TIMEOUT = 'TIMEOUT',
    UNKNOWN = 'UNKNOWN',
}

export enum HttpStatus {
    // Client errors
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    METHOD_NOT_ALLOWED = 405,
    REQUEST_TIMEOUT = 408,
    CONFLICT = 409,
    TOO_MANY_REQUESTS = 429,

    // Server errors
    INTERNAL_SERVER_ERROR = 500,
    NOT_IMPLEMENTED = 501,
    BAD_GATEWAY = 502,
    SERVICE_UNAVAILABLE = 503,
    GATEWAY_TIMEOUT = 504,
    HTTP_VERSION_NOT_SUPPORTED = 505,
}

export interface RetryConfig {
    maxAttempts: number
    baseDelay: number
    maxDelay: number
}

export interface ErrorResponse {
    ok: false
    error: {
        type: ErrorType
        status?: number
        message: string
        originalError?: Error
        attempt?: number
    }
    text: () => Promise<string>
}

export interface FetchRequestOptions extends RequestInit {
    retryConfig?: RetryConfig
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
}

// Retryable status codes
const RETRYABLE_STATUSES = [
    HttpStatus.BAD_GATEWAY,
    HttpStatus.SERVICE_UNAVAILABLE,
    HttpStatus.GATEWAY_TIMEOUT,
    HttpStatus.REQUEST_TIMEOUT,
    HttpStatus.TOO_MANY_REQUESTS,
]

export function consoleLog(...args) {
    if (process.env.NODE_ENV === 'development') {
        const date = new Date().toLocaleString('pl-PL', {
            timeZone: 'Europe/Warsaw',
        })
        console.log(
            `%c[${date}] %c[JustPrivetProject]:`,
            'color: #00bfff; font-weight: bold;',
            'color: #ff8c00; font-weight: bold;',
            ...args
        )
    }
    // Save log to chrome.storage.session
    saveLogToSession('log', args).catch((e) => {
        console.warn('Error saving log to chrome.storage.session:', e)
    })
}

export function consoleLogWithoutSave(...args) {
    if (process.env.NODE_ENV === 'development') {
        const date = new Date().toLocaleString('pl-PL', {
            timeZone: 'Europe/Warsaw',
        })
        console.log(
            `%c[${date}] %c[JustPrivetProject]:`,
            'color: #00bfff; font-weight: bold;',
            'color: #ff8c00; font-weight: bold;',
            ...args
        )
    }
}

export function consoleError(...args) {
    const date = new Date().toLocaleString('pl-PL', {
        timeZone: 'Europe/Warsaw',
    })
    console.error(
        `%c[${date}] %c[JustPrivetProject] %c:`,
        'color: #00bfff; font-weight: bold;',
        'color: #ff8c00; font-weight: bold;',
        'color:rgb(192, 4, 4); font-weight: bold;',
        ...args
    )
    // Save error to chrome.storage.session
    saveLogToSession('error', args).catch((e) => {
        console.error('Error saving error to chrome.storage.session:', e)
    })
    // Log to Supabase only in development
    if (process.env.NODE_ENV === 'development') {
        const errorMessage = args
            .map((arg) => (arg instanceof Error ? arg.message : String(arg)))
            .join(' ')
        errorLogService.logError(errorMessage, 'background', { args })
    }
}

export function normalizeFormData(formData): Record<string, any> {
    const result = {}

    for (const key in formData) {
        // If it's an array with only one item, use that item directly
        if (Array.isArray(formData[key]) && formData[key].length === 1) {
            result[key] = formData[key][0]
        } else {
            result[key] = formData[key]
        }
    }

    return result
}

export async function fetchRequest(
    url: string,
    options: FetchRequestOptions = {}
): Promise<Response | ErrorResponse> {
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig }
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...options.headers,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    Pragma: 'no-cache',
                    Expires: '0',
                },
                credentials: 'include',
            })

            // Get response text for error analysis
            const responseText = await response.text()

            // Check if response is successful
            if (response.ok) {
                // Reconstruct response with the text we already read
                return new Response(responseText, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                })
            }

            // Analyze error type
            const htmlError = detectHtmlError(responseText)
            const errorType = determineErrorType(response.status, responseText)

            // Create detailed error message
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`
            if (htmlError.isError) {
                errorMessage += ` | HTML Error: ${htmlError.message}`
            }
            if (responseText) {
                errorMessage += ` | Response: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`
            }

            // Check if we should retry
            if (
                isRetryableError(response.status) &&
                attempt < retryConfig.maxAttempts
            ) {
                const delay = calculateDelay(
                    attempt,
                    retryConfig.baseDelay,
                    retryConfig.maxDelay
                )
                consoleLog(
                    `Retry attempt ${attempt}/${retryConfig.maxAttempts} for ${url} after ${delay}ms. Status: ${response.status}`
                )
                await sleep(delay)
                continue
            }

            // Log error details
            consoleLog(`Request failed after ${attempt} attempts:`, {
                url,
                status: response.status,
                errorType,
                message: errorMessage,
                attempt,
            })

            // Log to error service for critical errors
            if (attempt === retryConfig.maxAttempts) {
                try {
                    await errorLogService.logRequestError(
                        errorType,
                        errorMessage,
                        url,
                        response.status,
                        attempt,
                        responseText
                    )
                } catch (logError) {
                    consoleLog('Failed to log error to service:', logError)
                }
            }

            return createErrorResponse(
                errorType,
                errorMessage,
                response.status,
                undefined,
                attempt
            )
        } catch (error) {
            lastError = error as Error

            // Handle network errors
            if (attempt < retryConfig.maxAttempts) {
                const delay = calculateDelay(
                    attempt,
                    retryConfig.baseDelay,
                    retryConfig.maxDelay
                )
                consoleLog(
                    `Network error, retry attempt ${attempt}/${retryConfig.maxAttempts} for ${url} after ${delay}ms:`,
                    error
                )
                await sleep(delay)
                continue
            }

            // Log final error
            consoleLog(
                `Request failed after ${attempt} attempts due to network error:`,
                {
                    url,
                    error: error,
                    attempt,
                }
            )

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
                        { originalError: error }
                    )
                } catch (logError) {
                    consoleLog(
                        'Failed to log network error to service:',
                        logError
                    )
                }
            }

            return createErrorResponse(
                ErrorType.NETWORK,
                `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                undefined,
                error as Error,
                attempt
            )
        }
    }

    // This should never be reached, but just in case
    return createErrorResponse(
        ErrorType.UNKNOWN,
        'Unexpected error in fetchRequest',
        undefined,
        lastError || undefined,
        retryConfig.maxAttempts
    )
}

export function createFormData(formDataObj) {
    const formData = new FormData()

    Object.entries(formDataObj).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((item) => {
                formData.append(key, item)
            })
        } else {
            if (typeof value === 'string' || value instanceof Blob) {
                formData.append(key, value)
            } else {
                consoleError(`Unsupported value type for key "${key}":`, value)
            }
        }
    })

    return formData
}

export function getLastProperty<T>(obj: Record<string, T>): T | null {
    let keys = Object.keys(obj) // Get all keys
    if (keys.length === 0) return null // Return null if the object is empty

    let lastKey = keys[keys.length - 1] // Get the last key
    return { ...obj[lastKey] } // Return both key and value
}

export function getPropertyById<T>(
    obj: Record<string, T>,
    id: string
): T | null {
    if (!obj.hasOwnProperty(id)) return null
    return { ...obj[id] } // Возвращаем копию объекта по id
}

export function extractFirstId(obj: Record<string, unknown>): string | null {
    const keys = Object.keys(obj)
    return keys.length > 0 ? keys[0] : null
}

export function generateUniqueId() {
    return crypto.randomUUID()
}

export async function getOrCreateDeviceId(): Promise<string> {
    return new Promise((resolve) => {
        chrome.storage.local.get(['deviceId'], (result) => {
            if (result.deviceId) {
                resolve(result.deviceId)
            } else {
                const newId = generateUniqueId()
                chrome.storage.local.set({ deviceId: newId }, () => {
                    resolve(newId)
                })
            }
        })
    })
}

export function sortStatusesByPriority(statuses) {
    // Define the priority of statuses from the most critical to the least critical

    // Sort statuses according to the defined priority order
    return statuses.sort((a, b) => {
        const priorityA = StatusesPriority.indexOf(a)
        const priorityB = StatusesPriority.indexOf(b)

        // If the status is not found in the priority list, place it at the end
        return priorityA - priorityB
    })
}

export async function cleanupCache() {
    consoleLog('Cleaning up cache...')
    return new Promise((resolve) => {
        chrome.storage.local.set(
            {
                requestCacheBody: {},
                requestCacheHeaders: {},
            },
            () => {
                if (chrome.runtime.lastError) {
                    consoleError(
                        'Error cleaning up cache:',
                        chrome.runtime.lastError
                    )
                    resolve(false)
                } else {
                    resolve(true)
                }
            }
        )
    })
}

// Async helpers for chrome.storage.session
export async function saveLogToSession(type: 'log' | 'error', args: any[]) {
    return new Promise<void>((resolve) => {
        chrome.storage.session.get({ bramaLogs: [] }, ({ bramaLogs }) => {
            // Add new log entry
            bramaLogs.push({
                type,
                message: args.map(String).join(' '),
                timestamp: new Date().toISOString(),
            })
            const logsLength = 300
            // Keep only the last 300 entries
            if (bramaLogs.length > logsLength) {
                bramaLogs = bramaLogs.slice(-logsLength)
            }

            chrome.storage.session.set({ bramaLogs }, () => resolve())
        })
    })
}

export async function getLogsFromSession() {
    return new Promise<any[]>((resolve) => {
        chrome.storage.session.get({ bramaLogs: [] }, ({ bramaLogs }) => {
            resolve(bramaLogs)
        })
    })
}

export async function clearLogsInSession() {
    return new Promise<void>((resolve) => {
        chrome.storage.session.set({ bramaLogs: [] }, () => resolve())
    })
}

export async function getLocalStorageData() {
    return new Promise<any>((resolve) => {
        chrome.storage.local.get(null, (data) => {
            resolve(data)
        })
    })
}

export function JSONstringify(object) {
    return JSON.stringify(object, null, 2)
}

/**
 * Converts a date string from the format "DD.MM.YYYY HH:mm[:ss]" to a Date object.
 * @param input Date string, e.g. "26.06.2025 00:59:00" or "26.06.2025 00:59"
 * @returns Date object or Invalid Date if the format is incorrect
 */
export function parseDateTimeFromDMY(input: string): Date {
    const [datePart, timePart] = input.split(' ')
    if (!datePart || !timePart) return new Date(NaN)
    const [day, month, year] = datePart.split('.').map(Number)
    if (!day || !month || !year) return new Date(NaN)
    // Если timePart без секунд, добавим :00
    const time = timePart.length === 5 ? `${timePart}:00` : timePart
    const isoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${time}`
    return new Date(isoString)
}

/**
 * Formats a Date object to the format "DD.MM.YYYY"
 * @param date Date object to format (defaults to current date)
 * @returns Formatted date string, e.g. "07.08.2025"
 */
export function formatDateToDMY(date: Date = new Date()): string {
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}.${month}.${year}`
}

/**
 * Gets today's date in the format "DD.MM.YYYY"
 * @returns Today's date as string, e.g. "07.08.2025"
 */
export function getTodayFormatted(): string {
    return formatDateToDMY(new Date())
}

// Helper functions for error handling
function isRetryableError(status: number): boolean {
    return RETRYABLE_STATUSES.includes(status)
}

function calculateDelay(
    attempt: number,
    baseDelay: number,
    maxDelay: number
): number {
    const delay = baseDelay * Math.pow(2, attempt - 1)
    return Math.min(delay, maxDelay)
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function detectHtmlError(responseText: string): {
    isError: boolean
    status?: number
    message?: string
} {
    // Check for common HTML error patterns
    const errorPatterns = [
        { pattern: /<title>.*?(\d{3}).*?<\/title>/i, extractStatus: true },
        { pattern: /<h1>.*?(\d{3}).*?<\/h1>/i, extractStatus: true },
        { pattern: /Status:\s*(\d{3})/i, extractStatus: true },
        { pattern: /Error\s*(\d{3})/i, extractStatus: true },
        { pattern: /<h1>.*?Error.*?<\/h1>/i, extractStatus: false },
        { pattern: /<title>.*?Error.*?<\/title>/i, extractStatus: false },
    ]

    for (const { pattern, extractStatus } of errorPatterns) {
        const match = responseText.match(pattern)
        if (match) {
            if (extractStatus && match[1]) {
                return {
                    isError: true,
                    status: parseInt(match[1]),
                    message: `HTML Error Page Detected: ${match[0]}`,
                }
            } else {
                return {
                    isError: true,
                    message: `HTML Error Page Detected: ${match[0]}`,
                }
            }
        }
    }

    return { isError: false }
}

function determineErrorType(status: number, responseText: string): ErrorType {
    if (status >= 500) {
        return ErrorType.SERVER_ERROR
    } else if (status >= 400) {
        return ErrorType.CLIENT_ERROR
    } else if (detectHtmlError(responseText).isError) {
        return ErrorType.HTML_ERROR
    }
    return ErrorType.UNKNOWN
}

function createErrorResponse(
    type: ErrorType,
    message: string,
    status?: number,
    originalError?: Error,
    attempt?: number
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
    }
}

// Test function for error handling (for development purposes)
export async function testErrorHandling() {
    consoleLog('Testing error handling...')

    // Test 1: Network error (non-existent URL)
    const networkErrorResult = await fetchRequest(
        'https://non-existent-url-12345.com/test',
        {
            method: 'GET',
            retryConfig: { maxAttempts: 2, baseDelay: 100, maxDelay: 500 },
        }
    )

    if (!networkErrorResult.ok && 'error' in networkErrorResult) {
        consoleLog('Network error test result:', networkErrorResult.error)
    }

    // Test 2: Server error (404)
    const serverErrorResult = await fetchRequest('https://httpstat.us/404', {
        method: 'GET',
        retryConfig: { maxAttempts: 2, baseDelay: 100, maxDelay: 500 },
    })

    if (!serverErrorResult.ok && 'error' in serverErrorResult) {
        consoleLog('Server error test result:', serverErrorResult.error)
    }

    // Test 3: Retryable error (502)
    const retryableErrorResult = await fetchRequest('https://httpstat.us/502', {
        method: 'GET',
        retryConfig: { maxAttempts: 3, baseDelay: 100, maxDelay: 500 },
    })

    if (!retryableErrorResult.ok && 'error' in retryableErrorResult) {
        consoleLog('Retryable error test result:', retryableErrorResult.error)
    }

    consoleLog('Error handling tests completed')
}
