chrome.runtime.onInstalled.addListener(() => {
    consoleLog('Plugin installed!')
})

class QueueManager {
    constructor(storageKey = 'retryQueue') {
        if (QueueManager.instance) {
            return QueueManager.instance
        }

        this.storageKey = storageKey
        this.updateQueue = Promise.resolve()
        this.mutex = false
        QueueManager.instance = this
    }

    static getInstance(storageKey = 'retryQueue') {
        if (!QueueManager.instance) {
            QueueManager.instance = new QueueManager(storageKey)
        }
        return QueueManager.instance
    }

    // Safely add an item to the queue
    async addToQueue(newItem) {
        return this._synchronizedOperation(async () => {
            const result = await chrome.storage.local.get([this.storageKey])
            const queue = result[this.storageKey] || []
            const startSlot = newItem.startSlot
            const tvAppId = newItem.tvAppId
            const status = newItem.status

            if (status === 'success') {
                const hasSameTvAppId = queue.some(
                    (item) => item.tvAppId === tvAppId
                )
                if (!hasSameTvAppId) {
                    consoleLog(
                        `Item with status 'success' and new tvAppId ${tvAppId} not added to ${this.storageKey}`
                    )
                    return queue
                }
            }

            const isDuplicate = queue.some(
                (item) =>
                    item.tvAppId === tvAppId && item.startSlot === startSlot
            )

            if (isDuplicate) {
                consoleLog(
                    `Duplicate item with tvAppId ${tvAppId} and startSlot ${startSlot} not added to ${this.storageKey}`
                )
                return queue
            }

            // Add unique identifier if not present
            if (!newItem.id) {
                newItem.id = generateUniqueId()
            }

            queue.push(newItem)
            await chrome.storage.local.set({ [this.storageKey]: queue })
            consoleLog(`Item added to ${this.storageKey}:`, newItem)

            return queue
        })
    }

    // Safely remove an item from the queue
    async removeFromQueue(id) {
        return this._synchronizedOperation(async () => {
            const result = await chrome.storage.local.get([this.storageKey])
            let queue = result[this.storageKey] || []

            // Remove item
            queue = queue.filter((item) => item.id !== id)

            // Save updated queue
            await chrome.storage.local.set({ [this.storageKey]: queue })
            consoleLog(`Item removed from ${this.storageKey}. ID:`, id)

            return queue
        })
    }

    // Safely update an item in the queue
    async updateQueueItem(id, updateData) {
        return this._synchronizedOperation(async () => {
            const result = await chrome.storage.local.get([this.storageKey])
            let queue = result[this.storageKey] || []

            // Find and update item
            const updatedQueue = queue.map((item) =>
                item.id === id ? { ...item, ...updateData } : item
            )

            // Save updated queue
            await chrome.storage.local.set({ [this.storageKey]: updatedQueue })
            consoleLog(`Item updated in ${this.storageKey}. ID:`, id)

            return updatedQueue
        })
    }

    // Get current queue
    async getQueue() {
        const result = await chrome.storage.local.get([this.storageKey])
        return result[this.storageKey] || []
    }

    // Internal method to synchronize operations
    async _synchronizedOperation(operation) {
        while (this.mutex) {
            await new Promise((resolve) => setTimeout(resolve, 50))
        }

        // Set the lock
        this.mutex = true

        try {
            // Perform the operation
            const result = await operation()
            return result
        } catch (error) {
            consoleError(
                `Error in synchronized operation for ${this.storageKey}:`,
                error
            )
            throw error
        } finally {
            // Release the lock
            this.mutex = false
        }
    }

    async updateEntireQueue(newQueue) {
        return this._synchronizedOperation(async () => {
            await chrome.storage.local.set({ [this.storageKey]: newQueue })
            consoleLog(`Entire ${this.storageKey} updated`)
            return newQueue
        })
    }

    async startProcessing(processRequest, options = {}) {
        const {
            intervalMin = 2000, // Minimum interval in milliseconds (2 seconds)
            intervalMax = 10000, // Maximum interval in milliseconds (10 seconds)
            retryEnabled = true,
        } = options

        if (this.isProcessing) {
            consoleLog('Processing is already running')
            return
        }

        this.isProcessing = true

        const processNextRequests = async () => {
            if (!retryEnabled) {
                this.isProcessing = false
                return
            }

            try {
                const queue = await this.getQueue()

                // Filter requests in progress
                const inProgressRequests = queue.filter((req) => req.status === 'in-progress');

                // Sequential processing
                for (const req of inProgressRequests) {
                    try {
                        consoleLog(`Processing request: ${req.id}`)

                        const updatedReq = await processRequest(req, queue)
                        if (updatedReq.status !== 'in-progress') {
                            await this.updateQueueItem(req.id, updatedReq)
                            consoleLog(`Request ${req.id} processed successfully`, updatedReq)
                        }
                    } catch (error) {
                        consoleError(
                            `Error processing request ${req.id}:`,
                            error
                        )

                        // Update status in case of an error
                        await this.updateQueueItem(req.id, {
                            status: 'error',
                            status_message:
                                error.message || 'Error on processing',
                        })
                    }
                }
            } catch (error) {
                consoleError('Error in queue processing:', error)
            }

            // Calculate a random interval between intervalMin and intervalMax
            const randomInterval = Math.floor(
                Math.random() * (intervalMax - intervalMin + 1) + intervalMin
            )
            consoleLog(`Next processing cycle in ${randomInterval / 1000} seconds`)

            // Start the next processing cycle with random interval
            setTimeout(processNextRequests, randomInterval)
        }

        // Initial start
        processNextRequests()
    }
}

const maskForCache = '*://*/TVApp/EditTvAppSubmit/*'

async function fetchRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers
            },
            credentials: 'include',
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        return response
    } catch (error) {
        consoleError('Error fetching request:', error)
        return { ok: false, text: () => Promise.resolve('') }
    }
}

async function getSlots(date) {
    const [day, month, year] = date.split('.').map(Number)
    const newDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
    const dateAfterTransfer = newDate.toISOString()
    return fetchRequest('https://ebrama.baltichub.com/Home/GetSlots', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'X-requested-with': 'XMLHttpRequest',
            Referer: 'https://ebrama.baltichub.com/vbs-slots',
            Accept: '*/*',
            'X-Extension-Request': 'JustPrivetProject',
        },
        body: JSON.stringify({ date: dateAfterTransfer, type: 1 }), // 26.02.2025
        credentials: 'include',
    })
}

async function getEditForm(tvAppId) {
    return fetchRequest(`https://ebrama.baltichub.com/TVApp/EditTvAppModal?tvAppId=${tvAppId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'X-requested-with': 'XMLHttpRequest',
            Referer: 'https://ebrama.baltichub.com/vbs-slots',
            Accept: '*/*',
            'X-Extension-Request': 'JustPrivetProject',
        },
        credentials: 'include',
    })
}

function consoleLog(...args) {
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

function consoleError(...args) {
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
}

function generateUniqueId() {
    return crypto.randomUUID()
}

function normalizeFormData(formData) {
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

function getLastProperty(obj) {
    let keys = Object.keys(obj) // Get all keys
    if (keys.length === 0) return null // Return null if the object is empty

    let lastKey = keys[keys.length - 1] // Get the last key
    return { ...obj[lastKey] } // Return both key and value
}

parseSlotsIntoButtons = (htmlText) => {
    const buttonRegex = /<button[^>]*>(.*?)<\/button>/gs
    const buttons = [...htmlText.matchAll(buttonRegex)].map((match) => {
        const buttonHTML = match[0] // The entire matched <button>...</button> tag
        const text = match[1].trim() // The text inside the button
        const disabled = /disabled/i.test(buttonHTML) // Check for the presence of the disabled attribute

        return { text, disabled }
    })
    return buttons
}

function createFormData(formDataObj) {
    const formData = new FormData()

    Object.entries(formDataObj).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((item) => {
                formData.append(key, item)
            })
        } else {
            formData.append(key, value)
        }
    })

    return formData
}

/**
 * Processes a request by normalizing its form data, checking task completion,
 * verifying authorization, checking slot availability, and executing the request if applicable.
 *
 * @async
 * @function
 * @param {Object} req - The request object containing the body and other details.
 * @param {Array} queue - The queue of tasks to check for task completion.
 * @returns {Promise<Object>} A promise that resolves to the updated request object with status and status_message.
 *
 * @throws {Error} Throws an error if there is an issue during slot retrieval or execution.
 *
 * @example
 * const req = {
 *   body: {
 *     TvAppId: ['12345'],
 *     SlotStart: ['2023-10-01 10:00']
 *   }
 * };
 * const queue = [];
 * const result = await processRequest(req, queue);
 * console.log(result);
 */
async function processRequest(req, queue) {
    let body = normalizeFormData(req.body).formData
    const tvAppId = body.TvAppId[0]
    const time = body.SlotStart[0].split(' ')

    if (isTaskCompletedInAnotherQueue(req, queue)) {
        consoleLog(
            '✅ The request was executed in another task:',
            tvAppId,
            time.join(', ')
        )
        return {
            ...req,
            status: 'another-task',
            status_message: 'Zadanie zakończone w innym wątku',
        }
    }
    const slots = await getSlots(time[0])
    // Check Authorization
    if (!slots.ok) {
        consoleLog('❌ Problem with authorization:', tvAppId, time.join(', '))
        return {
            ...req,
            status: 'authorization-error',
            status_message: 'Problem z autoryzacją',
        }
    }
    const htmlText = await slots.text()
    const isSlotAvailable = await checkSlotAvailability(htmlText, time)
    if (!isSlotAvailable) {
        consoleLog('❌ No slots, keeping in queue:', tvAppId, time.join(', '))
        return req
    }
    const objectToReturn = await executeRequest(req, tvAppId, time)
    return objectToReturn;
}

function isTaskCompletedInAnotherQueue(req, queue) {
    return queue.some(
        (task) => task.tvAppId === req.tvAppId && task.status === 'success'
    )
}

async function checkSlotAvailability(htmlText, time) {
    const buttons = parseSlotsIntoButtons(htmlText)
    const slotButton = buttons.find((button) =>
        button.text.includes(time[1].slice(0, 5))
    )
    consoleLog('Slot button:', slotButton)
    return !slotButton.disabled
}

/**
 * Executes an HTTP POST request with the provided data and handles the response.
 *
 * @async
 * @function
 * @param {Object} req - The request object containing the URL, headers, and body data.
 * @param {string} req.url - The URL to send the request to.
 * @param {Object} req.headersCache - Cached headers for the request.
 * @param {Object} req.headersCache.headers - Headers to include in the request.
 * @param {Object} req.body - The body of the request.
 * @param {Object} req.body.formData - The form data to be sent in the request body.
 * @param {string} tvAppId - The identifier for the TV application.
 * @param {Array<string>} time - An array containing time-related data.
 * @returns {Promise<Object>} A promise that resolves to an object containing the updated request status and message.
 * @throws {Error} If there is an issue with sending the notification or handling the response.
 */
async function executeRequest(req, tvAppId, time) {
    const formData = createFormData(req.body.formData)

    const response = await fetchRequest(req.url, {
        method: 'POST',
        headers: {
            ...req.headersCache.headers,
            'X-Extension-Request': 'JustPrivetProject',
            credentials: 'include',
        },
        body: formData,
    })

    const parsedResponse = await response.text()
    if (!parsedResponse.includes('error') && response.ok) {
        consoleLog('✅Request retried successfully:', tvAppId, time.join(', '))
        // Send notification to user
        try {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: './icons/icon-144x144.png',
                title: 'Zmiana czasu',
                message: `✅ Zmiana czasu dla nr ${tvAppId} - zakończyła się pomyślnie - ${time[1].slice(0, 5)}`,
                priority: 2,
            })
        } catch (error) {
            consoleError('Error sending notification:', error)
        }

        return {
            ...req,
            status: 'success',
            status_message: 'Zadanie zakończone sukcesem',
        }
    }

    return handleErrorResponse(req, parsedResponse, tvAppId, time)
    // TODO: add action to update grid
}

/**
 * Handles error responses by analyzing the parsed response and returning an appropriate object.
 *
 * @param {Object} req - The original request object.
 * @param {string} parsedResponse - The parsed response string from the server.
 * @param {string} tvAppId - The ID of the TV application associated with the request.
 * @param {Array<string>} time - An array of time-related strings associated with the request.
 * @returns {Object} - The modified request object or an object containing error details.
 *
 * @description
 * This function processes error responses and determines the appropriate action based on the error type:
 * - If the error is "CannotCreateTvaInSelectedSlot", it logs the error and returns the original request.
 * - If the error is "TaskWasUsedInAnotherTva", it logs the success message and returns a modified request object with a status of "another-task".
 * - For unknown errors, it logs the error and returns a modified request object with a status of "error" and an error message.
 */

function handleErrorResponse(req, parsedResponse, tvAppId, time) {
    if (parsedResponse.includes('CannotCreateTvaInSelectedSlot')) {
        consoleLog(
            '❌ Retry failed, keeping in queue:',
            tvAppId,
            time.join(', '),
            parsedResponse
        )
        return req
    }

    if (parsedResponse.includes('TaskWasUsedInAnotherTva')) {
        consoleLog(
            '✅ The request was executed in another task:',
            tvAppId,
            time.join(', '),
            parsedResponse
        )
        return {
            ...req,
            status: 'another-task',
            status_message: 'Zadanie zakończone w innym wątku',
        }
    }

    let responseObj;
    try {
        responseObj = JSON.parse(parsedResponse);

        // Handle specific error codes
        if (responseObj.messageCode && responseObj.messageCode.includes('ToMuchTransactionInSector')) {
            consoleLog(
                '⚠️ Too many transactions in sector, keeping in queue:',
                tvAppId,
                time.join(', '),
                parsedResponse
            )
            return req;
        }

        if (responseObj.messageCode === 'NoSlotsAvailable') {
            consoleLog(
                '⚠️ No slots available, keeping in queue:',
                tvAppId,
                time.join(', '),
                parsedResponse
            )
            return req;
        }

        if (responseObj.messageCode && responseObj.messageCode.includes('FE_0091')) {
            consoleLog(
                '⚠️ Too many transactions in sector, keeping in queue:',
                tvAppId,
                time.join(', '),
                parsedResponse
            )
            return {
                ...req,
                status: 'another-task',
                status_message: 'Awizacja edytowana przez innego użytkownika. Otwórz okno ponownie w celu aktualizacji awizacji',
            }
        }

        // Handle unknown JSON error
        consoleError('❌ Unknown error occurred:', parsedResponse)
        return {
            ...req,
            status: 'error',
            status_message: responseObj.error || 'Nieznany błąd',
        }
    } catch (e) {
        // Handle non-JSON responses
        consoleError('❌ Unknown error (not JSON):', parsedResponse)
        return {
            ...req,
            status: 'error',
            status_message: 'Nieznany błąd (niepoprawny format)',
        }
    }
}

async function cleanupCache(data) {
    if (data.testEnv) {
        return
    }

    if (!!Object.keys(data.requestCacheBody).length) {
        const lastKeyBody = Object.keys(data.requestCacheBody).pop()
        delete data.requestCacheBody[lastKeyBody]
    }
    if (!!Object.keys(data.requestCacheHeaders).length) {
        const lastKeyHeaders = Object.keys(data.requestCacheHeaders).pop()
        delete data.requestCacheHeaders[lastKeyHeaders]
    }

    return chrome.storage.local.set({
        requestCacheBody: data.requestCacheBody,
        requestCacheHeaders: data.requestCacheHeaders,
    })
}

/**
 * Retrieves the driver name and container ID associated with a given tvAppId.
 * If the tvAppId exists in the retryQueue, it returns the cached driver name and container number.
 * Otherwise, it fetches the edit form, extracts the driver name and container ID from the response, and returns them.
 *
 * @async
 * @function getDriverNameAndContainer
 * @param {string} tvAppId - The ID of the TV application to retrieve data for.
 * @param {Array<Object>} retryQueue - An array of retry queue objects, each containing `tvAppId`, `driverName`, and `containerNumber`.
 * @returns {Promise<{driverName: string} | null>} An object containing the driver's name and container ID, or `null` if an error occurs.
 * @throws Will log an error message to the console if an exception is encountered during processing.
 */

async function getDriverNameAndContainer(tvAppId, retryQueue) {
    const regex = /<select[^>]*id="SelectedDriver"[^>]*>[\s\S]*?<option[^>]*selected="selected"[^>]*>(.*?)<\/option>/;
    const sameItem = retryQueue.find((item) => item.tvAppId === tvAppId)
    try {
        if (sameItem) {
            return { driverName: sameItem.driverName || '', containerNumber: sameItem.containerNumber || '' }
        } else {
            const request = await (await getEditForm(tvAppId)).text()
            const driverNameObject = request.match(regex)?.[1] || ''
            const driverNameItems = driverNameObject.split(' ')
            return { driverName: `${driverNameItems[0] || ''} ${driverNameItems[1] || ''}`.trim() }
        }
    } catch (err) {
        console.log('Error getting driver name:', err)
        return { driverName: '', containerNumber: '' }
    }

}

// Cache logic
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.method === 'POST' && details.requestBody) {
            chrome.storage.local.get({ requestCacheBody: {} }, (data) => {
                let cacheBody = data.requestCacheBody

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
    },
    { urls: [maskForCache] },
    ['requestBody']
)

chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        chrome.storage.local.get({ requestCacheHeaders: {} }, (data) => {
            let cacheHeaders = data.requestCacheHeaders

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
    },
    { urls: [maskForCache] },
    ['requestHeaders']
)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const queueManager = QueueManager.getInstance()

    if (message.action === 'showError' || message.action === 'succeedBooking') {
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
                let requestCacheHeaders = getLastProperty(
                    data.requestCacheHeaders
                )

                if (requestCacheBody) {
                    const tableData = data.tableData
                    const retryObject = { ...requestCacheBody }
                    const requestBody = normalizeFormData(requestCacheBody.body)
                    const tvAppId = requestBody.formData.TvAppId[0]
                    const driverAndContainer = await getDriverNameAndContainer(tvAppId, data.retryQueue) || { driverName: '', containerNumber: '' }

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
                        case 'showError':
                            retryObject.status = 'in-progress'
                            retryObject.status_message = 'Zadanie jest w trakcie realizacji'
                            break
                        case 'succeedBooking':
                            retryObject.status = 'success'
                            retryObject.status_message = 'Zadanie zakończone sukcesem'
                            break
                        default:
                            retryObject.status = 'error'
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
    if (message.action === 'parsedTable') {
        chrome.storage.local.set({ tableData: message.message }, () => {
            consoleLog('Table saved in the storage', message.message)
        })
        sendResponse({ success: true })
    }
    if (message.target === 'background') {
        switch (message.action) {
            case 'removeRequest':
                queueManager
                    .removeFromQueue(message.data.id)
                    .then(() => sendResponse({ success: true }))
                    .catch((error) => {
                        consoleError('Error removing request:', error)
                        sendResponse({ success: false, error: error.message })
                    })
                return true // Indicates that the response is sent asynchronously

            case 'updateRequestStatus':
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