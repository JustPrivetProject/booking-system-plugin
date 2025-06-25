import { StatusesPriority } from '../data'
import { errorLogService } from '../services/errorLogService'

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
    url,
    options
): Promise<Response | { ok: false; text: () => Promise<string> }> {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
            },
            credentials: 'include',
        })

        if (!response.ok) {
            throw new Error(
                `Request Error! Message: ${await response.text()} Status: ${response.status}`
            )
        }

        return response
    } catch (error) {
        consoleError('Error fetching request:', error)
        return { ok: false, text: () => Promise.resolve('') }
    }
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
