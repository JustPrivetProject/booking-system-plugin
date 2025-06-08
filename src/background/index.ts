import QueueManager from './queue-manager'
import {
    consoleLog,
    consoleError,
    getLastProperty,
    normalizeFormData,
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
} from '../types/baltichub'

chrome.runtime.onInstalled.addListener(() => {
    consoleLog('Plugin installed!')
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

async function cleanupCache(data) {
    if (data.testEnv) {
        return
    }

    if (!!Object.keys(data.requestCacheBody).length) {
        const lastKeyBody = Object.keys(data.requestCacheBody).pop()!
        delete data.requestCacheBody[lastKeyBody]
    }
    if (!!Object.keys(data.requestCacheHeaders).length) {
        const lastKeyHeaders = Object.keys(data.requestCacheHeaders).pop()!
        delete data.requestCacheHeaders[lastKeyHeaders]
    }

    return chrome.storage.local.set({
        requestCacheBody: data.requestCacheBody,
        requestCacheHeaders: data.requestCacheHeaders,
    })
}

// Cache logic
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.method === 'POST' && details.requestBody) {
            chrome.storage.local.get({ requestCacheBody: {} }, (data) => {
                let cacheBody: RequestCacheBodes = data.requestCacheBody

                cacheBody[details.requestId] = {
                    url: details.url,
                    // @ts-expect-error
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
        chrome.storage.local.get({ requestCacheHeaders: {} }, (data) => {
            let cacheHeaders: RequestCacheHeaders = data.requestCacheHeaders

            cacheHeaders[details.requestId] = {
                url: details.url,
                headers: details.requestHeaders!,
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
            {
                requestCacheBody: {},
                requestCacheHeaders: {},
                retryQueue: [],
                testEnv: false,
                tableData: [],
            },
            async (data) => {
                let requestCacheBody = getLastProperty(data.requestCacheBody)
                let requestCacheHeaders: RequestCacheHeaderBody =
                    getLastProperty(data.requestCacheHeaders)

                if (requestCacheBody) {
                    const tableData = data.tableData
                    const retryObject = { ...requestCacheBody }
                    const requestBody = normalizeFormData(requestCacheBody.body)
                    const tvAppId = requestBody.formData.TvAppId[0]
                    const driverAndContainer = (await getDriverNameAndContainer(
                        tvAppId,
                        data.retryQueue
                    )) || { driverName: '', containerNumber: '' }

                    retryObject.headersCache = requestCacheHeaders
                    retryObject.tvAppId = tvAppId
                    retryObject.startSlot = requestBody.formData.SlotStart[0]
                    retryObject.driverName = driverAndContainer.driverName || ''

                    if (tableData) {
                        const row = (retryObject.containerNumber =
                            tableData.find((row) => row.includes(tvAppId)))

                        if (row) {
                            retryObject.containerNumber =
                                row[tableData[0].indexOf('Nr kontenera')]
                        }
                    }

                    switch (message.action) {
                        case Actions.SHOW_ERROR:
                            retryObject.status = Statuses.IN_PROGRESS
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
                            retryObject.status_message = 'Nieznane działanie'
                            break
                    }
                    // Add request to the retry queue
                    await queueManager.addToQueue(retryObject)
                    // Remove the last request from the cache
                    await cleanupCache(data)
                } else {
                    consoleLog('No data in cache object')
                }
            }
        )
        sendResponse({ success: true })
    }
    if (message.action === Actions.PARSED_TABLE) {
        chrome.storage.local.set({ tableData: message.message }, () => {
            consoleLog('Table saved in the storage', message.message)
        })
        sendResponse({ success: true })
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

            default:
                consoleLog('Unknown action:', message.action)
                sendResponse({ success: false })
                return true
        }
    }
    return true
})
