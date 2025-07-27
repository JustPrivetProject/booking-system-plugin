import QueueManager from './queue-manager'
import {
    consoleLog,
    consoleError,
    getLastProperty,
    normalizeFormData,
    cleanupCache,
    getPropertyById,
    extractFirstId,
    getLogsFromSession,
    clearLogsInSession,
    getLocalStorageData,
} from '../utils/utils-function'
import {
    getDriverNameAndContainer,
    processRequest,
} from '../services/baltichub'
import { Actions, Statuses } from '../data'
import {
    RequestCacheHeaders,
    RequestCacheHeaderBody,
    RequestCacheBodes,
    RequestCacheBodyObject,
    RetryObject,
} from '../types/baltichub'
import { errorLogService } from '../services/errorLogService'
import { authService } from '../services/authService'
import { getOrCreateDeviceId } from '../utils/deviceId'
import { sessionService } from '../services/sessionService'
import { clearBadge } from '../utils/badge'

chrome.runtime.onInstalled.addListener(() => {
    consoleLog('Plugin installed!')
    clearBadge()
})
// Settings
chrome.storage.local.set({ retryEnabled: true })
chrome.storage.local.set({ testEnv: false })
const queueManager = QueueManager.getInstance()

// Start retry attempts with random intervals between 2 and 5 seconds
queueManager.startProcessing(processRequest, {
    intervalMin: 2000, // Minimum interval (2 seconds)
    intervalMax: 5000, // Maximum interval (5 seconds)
    retryEnabled: true, // Can be controlled via storage
})

const maskForCache = '*://*/TVApp/EditTvAppSubmit/*'

// Cache logic
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.method === 'POST' && details.requestBody) {
            chrome.storage.local.get({ requestCacheBody: {} }, (data) => {
                let cacheBody: RequestCacheBodes = data.requestCacheBody

                cacheBody[details.requestId] = {
                    url: details.url,
                    body: details.requestBody,
                    timestamp: Date.now(),
                }

                chrome.storage.local.set(
                    { requestCacheBody: cacheBody },
                    () => {
                        consoleLog(
                            '✅ Cached Request Body:',
                            details.requestId,
                            cacheBody
                        )
                    }
                )
            })
        }
        return undefined // Explicitly return undefined
    },
    { urls: [maskForCache] },
    ['requestBody']
)

chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        // Проверка на наличие нужного заголовка
        consoleLog('Checking for our header:', details.requestHeaders)
        const hasOurHeader = details.requestHeaders?.some(
            (header) =>
                header.name.toLowerCase() === 'x-extension-request' &&
                header.value === 'JustPrivetProject'
        )
        if (hasOurHeader) {
            // Если заголовка нет — удаляем из requestCacheBody по requestId
            chrome.storage.local.get({ requestCacheBody: {} }, (data) => {
                let cacheBody: RequestCacheBodes = data.requestCacheBody
                if (cacheBody && cacheBody[details.requestId]) {
                    delete cacheBody[details.requestId]
                    chrome.storage.local.set(
                        { requestCacheBody: cacheBody },
                        () => {
                            consoleLog(
                                'Removed cacheBody by id (no header):',
                                details.requestId
                            )
                        }
                    )
                }
            })
            return undefined // Не наш запрос, не кэшируем
        }
        chrome.storage.local.get({ requestCacheHeaders: {} }, (data) => {
            let cacheHeaders: RequestCacheHeaders = data.requestCacheHeaders

            cacheHeaders[details.requestId] = {
                url: details.url,
                headers: details.requestHeaders,
                timestamp: Date.now(),
            }

            chrome.storage.local.set(
                { requestCacheHeaders: cacheHeaders },
                () => {
                    consoleLog(
                        '✅ Cached Request Headers:',
                        details.requestId,
                        cacheHeaders
                    )
                }
            )
        })
        return undefined // Explicitly return undefined
    },
    { urls: [maskForCache] },
    ['requestHeaders']
)

// Listen for messages from the content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const queueManager = QueueManager.getInstance()

    if (
        message.action === Actions.SHOW_ERROR ||
        message.action === Actions.SUCCEED_BOOKING
    ) {
        consoleLog('Getting request from Cache...')
        chrome.storage.local.get(
            { requestCacheHeaders: {} as RequestCacheHeaders },
            async (data) => {
                const user = await authService.getCurrentUser()

                if (!user) {
                    consoleLog('User is not authenticated, cant add Container!')
                    sendResponse({ success: true, error: 'Not authorized' })
                    return
                }

                if (data.requestCacheHeaders) {
                    let requestCacheHeaders: RequestCacheHeaderBody | null =
                        getLastProperty(data.requestCacheHeaders)

                    let requestId = extractFirstId(data.requestCacheHeaders)!
                    chrome.storage.local.get(
                        {
                            requestCacheBody: {} as RequestCacheBodes,
                            retryQueue: [] as RetryObject[],
                            testEnv: false as boolean,
                            tableData: [] as string[][],
                        },
                        async (data) => {
                            let requestCacheBody: RequestCacheBodyObject | null =
                                getPropertyById(
                                    data.requestCacheBody,
                                    requestId
                                )

                            if (requestCacheBody) {
                                const tableData = data.tableData
                                // @ts-expect-error
                                const retryObject: RetryObject = {
                                    ...requestCacheBody,
                                }
                                const requestBody = normalizeFormData(
                                    requestCacheBody.body
                                )
                                const tvAppId = requestBody.formData.TvAppId[0]
                                const driverAndContainer =
                                    (await getDriverNameAndContainer(
                                        tvAppId,
                                        data.retryQueue
                                    )) || {
                                        driverName: '',
                                        containerNumber: '',
                                    }

                                retryObject.headersCache =
                                    requestCacheHeaders!.headers
                                retryObject.tvAppId = tvAppId
                                retryObject.startSlot =
                                    requestBody.formData.SlotStart[0]
                                retryObject.endSlot =
                                    requestBody.formData.SlotEnd[0]
                                retryObject.driverName =
                                    driverAndContainer.driverName || ''

                                if (tableData) {
                                    const row = (retryObject.containerNumber =
                                        tableData.find((row) =>
                                            row.includes(tvAppId)
                                        ))

                                    if (row) {
                                        retryObject.containerNumber =
                                            row[
                                                tableData[0].indexOf(
                                                    'Nr kontenera'
                                                )
                                            ]
                                    }
                                }

                                switch (message.action) {
                                    case Actions.SHOW_ERROR:
                                        retryObject.status =
                                            Statuses.IN_PROGRESS
                                        retryObject.status_message =
                                            'Zadanie jest w trakcie realizacji'
                                        break
                                    case Actions.SUCCEED_BOOKING:
                                        retryObject.status = Statuses.SUCCESS
                                        retryObject.status_message =
                                            'Zadanie zakończone sukcesem'
                                        break
                                    default:
                                        retryObject.status = Statuses.ERROR
                                        retryObject.status_message =
                                            'Nieznane działanie'
                                        break
                                }
                                // Add request to the retry queue
                                await queueManager.addToQueue(retryObject)
                                // Remove the last request from the cache
                                await cleanupCache()
                            } else {
                                consoleLog('No data in cache object')
                            }
                            sendResponse({ success: true }) // sendResponse вызывается только здесь
                        }
                    )
                }
            }
        )
        return true // return true только в основном слушателе
    }
    if (message.action === Actions.PARSED_TABLE) {
        chrome.storage.local.set({ tableData: message.message }, () => {
            consoleLog('Table saved in the storage', message.message)
        })
        sendResponse({ success: true })
    }
    if (message.action === Actions.IS_AUTHENTICATED) {
        sessionService
            .isAuthenticated()
            .then((isAuth) => {
                consoleLog('[BG] Responding isAuthenticated:', isAuth)
                sendResponse({ isAuthenticated: isAuth })
            })
            .catch((e) => {
                consoleLog('[BG] Error in isAuthenticated:', e)
                sendResponse({ isAuthenticated: false })
            })
        return true // Важно для асинхронного ответа!)
    }
    if (message.target === 'background') {
        switch (message.action) {
            case Actions.REMOVE_REQUEST:
                queueManager
                    .removeFromQueue(message.data.id)
                    .then(() => sendResponse({ success: true }))
                    .catch((error) => {
                        consoleError('Error removing request:', error)
                        sendResponse({ success: false, error: error.message })
                    })
                return true // Indicates that the response is sent asynchronously
            case Actions.UPDATE_REQUEST_STATUS:
                queueManager
                    .updateQueueItem(message.data.id, {
                        status: message.data.status,
                        status_message: message.data.status_message,
                    })
                    .then(() => sendResponse({ success: true }))
                    .catch((error) => {
                        consoleError('Error updating request status:', error)
                        sendResponse({ success: false, error: error.message })
                    })
                return true // Indicates that the response is sent asynchronously
            case Actions.SEND_LOGS:
                ;(async () => {
                    const user = await authService.getCurrentUser()

                    if (!user) {
                        consoleLog('User is not authenticated, cant sent Logs')
                        sendResponse({
                            success: true,
                            error: 'Not authorized',
                        })
                        return
                    }

                    try {
                        consoleLog('Sending logs to Supabase...')
                        let localData = null
                        if (process.env.NODE_ENV === 'development') {
                            localData = await getLocalStorageData()
                        }

                        const logs = await getLogsFromSession()

                        let userId: string | null = null
                        const user = await authService.getCurrentUser()
                        if (user && user.id) {
                            userId = user.id
                        } else {
                            userId = await getOrCreateDeviceId()
                        }
                        const description = message.data?.description || null

                        // Send logs with localStorage data
                        if (logs && logs.length > 0) {
                            await errorLogService.sendLogs(
                                [logs],
                                userId,
                                description,
                                [localData]
                            )
                            await clearLogsInSession()
                        }
                        sendResponse({ success: true })
                    } catch (error) {
                        consoleError(`${Actions.SEND_LOGS} error:`, error)
                        const errorMsg =
                            error instanceof Error && error.message
                                ? error.message
                                : String(error)
                        sendResponse({ success: false, error: errorMsg })
                    }
                })()
                return true // Indicates that the response is sent asynchronously

            default:
                consoleLog('Unknown action:', message.action)
                sendResponse({ success: false })
                return true
        }
    }
    return true
})

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.tabs.create({
            url: chrome.runtime.getURL('welcome.html'),
        })
    }
})
