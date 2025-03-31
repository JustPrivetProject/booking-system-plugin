chrome.runtime.onInstalled.addListener(() => {
    console.log('Plugin installed!')
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
            const slotStart = newItem.slotStart
            const tvAppId = newItem.tvAppId
            const status = newItem.status

            if (status === 'success') {
                const hasSameTvAppId = queue.some(
                    (item) => item.tvAppId === tvAppId
                )
                if (!hasSameTvAppId) {
                    console.log(
                        `Item with status 'success' and new tvAppId ${tvAppId} not added to ${this.storageKey}`
                    )
                    return queue
                }
            }

            const isDuplicate = queue.some(
                (item) =>
                    item.tvAppId === tvAppId && item.slotStart === slotStart
            )

            if (isDuplicate) {
                console.log(
                    `Duplicate item with tvAppId ${tvAppId} and slotStart ${slotStart} not added to ${this.storageKey}`
                )
                return queue
            }

            // Add unique identifier if not present
            if (!newItem.id) {
                newItem.id = generateUniqueId()
            }

            queue.push(newItem)
            await chrome.storage.local.set({ [this.storageKey]: queue })
            console.log(`Item added to ${this.storageKey}:`, newItem)

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
            console.log(`Item removed from ${this.storageKey}. ID:`, id)

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
            console.log(`Item updated in ${this.storageKey}. ID:`, id)

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

        // Устанавливаем блокировку
        this.mutex = true

        try {
            // Выполняем операцию
            const result = await operation()
            return result
        } catch (error) {
            console.error(
                `Error in synchronized operation for ${this.storageKey}:`,
                error
            )
            throw error
        } finally {
            // Снимаем блокировку
            this.mutex = false
        }
    }

    async updateEntireQueue(newQueue) {
        return this._synchronizedOperation(async () => {
            await chrome.storage.local.set({ [this.storageKey]: newQueue })
            console.log(`Entire ${this.storageKey} updated`)
            return newQueue
        })
    }

    async startProcessing(processRequest, options = {}) {
        const {
            interval = 5000,
            maxConcurrentRequests = 1,
            retryEnabled = true,
        } = options

        if (this.isProcessing) {
            console.log('Processing is already running')
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

                // Фильтруем запросы в прогрессе
                const inProgressRequests = queue
                    .filter((req) => req.status === 'in-progress')
                    .slice(0, maxConcurrentRequests)

                // Последовательная обработка
                for (const req of inProgressRequests) {
                    try {
                        console.log(`Processing request: ${req.id}`)

                        const updatedReq = await processRequest(req, queue)

                        await this.updateQueueItem(req.id, updatedReq)

                        console.log(`Request ${req.id} processed successfully`) // TODO: update log way
                    } catch (error) {
                        console.error(
                            `Error processing request ${req.id}:`,
                            error
                        )

                        // Обновляем статус в случае ошибки
                        await this.updateQueueItem(req.id, {
                            status: 'error',
                            status_message:
                                error.message || 'Error on processing',
                        })
                    }
                }
            } catch (error) {
                console.error('Error in queue processing:', error)
            }

            // Запускаем следующий цикл обработки
            setTimeout(processNextRequests, interval)
        }

        // Первый запуск
        processNextRequests()
    }
}

const maskForCache = '*://*/TVApp/EditTvAppSubmit/*'

async function getSlots(date) {
    const [day, month, year] = date.split('.').map(Number)
    const newDate = new Date(Date.UTC(year, month - 1, day, 23, 0, 0, 0))
    const dateAfterTransfer = newDate.toISOString()

    return fetch('https://ebrama.baltichub.com/Home/GetSlots', {
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
    return fetch(`https://ebrama.baltichub.com/TVApp/EditTvAppModal?tvAppId=${tvAppId}`, {
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
        const buttonHTML = match[0] // Весь найденный тег <button>...</button>
        const text = match[1].trim() // Текст внутри кнопки
        const disabled = /disabled/i.test(buttonHTML) // Проверяем наличие атрибута disabled

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

async function processRequest(req, queue) {
    let body = normalizeFormData(req.body).formData
    const tvAppId = body.TvAppId[0]
    const time = body.SlotStart[0].split(' ')

    if (isTaskCompletedInAnotherQueue(req, queue)) {
        console.warn(
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
        console.warn('❌ Problem with authorization:', tvAppId, time.join(', '))
        return {
            ...req,
            status: 'authorization-error',
            status_message: 'Problem z autoryzacją',
        }
    }
    const htmlText = await slots.text()
    const isSlotAvailable = await checkSlotAvailability(htmlText, time)
    if (!isSlotAvailable) {
        console.warn('❌ No slots, keeping in queue:', tvAppId, time.join(', '))
        return req
    }

    return await executeRequest(req, tvAppId, time)
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

    return !slotButton.disabled
}

async function executeRequest(req, tvAppId, time) {
    const formData = createFormData(req.body.formData)

    const response = await fetch(req.url, {
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
        console.log('✅Request retried successfully:', tvAppId, time.join(', '))
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
            console.error('Error sending notification:', error)
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

function handleErrorResponse(req, parsedResponse, tvAppId, time) {
    if (parsedResponse.includes('CannotCreateTvaInSelectedSlot')) {
        console.warn(
            '❌ Retry failed, keeping in queue:',
            tvAppId,
            time.join(', ')
        )
        return req
    }

    if (parsedResponse.includes('TaskWasUsedInAnotherTva')) {
        console.warn(
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

    console.error('❌ Unknown error occurred:', parsedResponse)
    return {
        ...req,
        status: 'error',
        status_message: 'Nieznany błąd',
    }
}

function cleanupCache(data) {
    if (data.testEnv) {
        return
    }

    const lastKeyBody = Object.keys(data.requestCacheBody).pop()
    const lastKeyHeaders = Object.keys(data.requestCacheHeaders).pop()

    delete data.requestCacheBody[lastKeyBody]
    delete data.requestCacheHeaders[lastKeyHeaders]

    chrome.storage.local.set({
        requestCacheBody: data.requestCacheBody,
        requestCacheHeaders: data.requestCacheHeaders,
    })
}

/**
 * Устанавливает статус и сообщение для объекта retry в зависимости от действия
 *
 * @param {Object} retryObject - Объект для установки статуса
 * @param {string} action - Действие, определяющее статус
 */
function setStatus(retryObject, action) {
    switch (action) {
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
                        console.log(
                            '✅ Cached Request Body:',
                            details.requestId,
                            details.url
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
                    console.log(
                        '✅ Cached Request Headers:',
                        details.requestId,
                        details.url
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
        console.log('Getting request from Cache...')

        chrome.storage.local.get(
            {
                requestCacheBody: {},
                requestCacheHeaders: {},
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

                    retryObject.headersCache = requestCacheHeaders
                    retryObject.tvAppId = tvAppId
                    retryObject.startSlot = requestBody.formData.SlotStart[0]

                    setStatus(retryObject, message.action)

                    if (tableData) {
                        const row = (retryObject.containerNumber =
                            tableData.find((row) => row.includes(tvAppId)))

                        if (row) {
                            retryObject.containerNumber =
                                row[tableData[0].indexOf('Nr kontenera')]
                        }
                    }
                    // Add request to the retry queue
                    await queueManager.addToQueue(retryObject)
                    // Remove the last request from the cache
                    cleanupCache(data)
                } else {
                    console.log('No data in cache object')
                }
            }
        )
        sendResponse({ success: true })
    }
    if (message.action === 'parsedTable') {
        chrome.storage.local.set({ tableData: message.message }, () => {
            console.log('Table saved in the storage', message.message)
        })
        sendResponse({ success: true })
    }
    if (message.action === 'testGetEditForm') {
        const regex = /<select[^>]*id="SelectedDriver"[^>]*>[\s\S]*?<option[^>]*selected="selected"[^>]*>(.*?)<\/option>/;
       getEditForm().then(body => body.text()).then(text => console.log(text.match(regex)[1])).catch(error => console.log(error));
       sendResponse({ success: true })
    }
    if (message.target === 'background') {
        switch (message.action) {
            case 'removeRequest':
                queueManager
                    .removeFromQueue(message.data.id)
                    .then(() => sendResponse({ success: true }))
                    .catch((error) => {
                        console.error('Error removing request:', error)
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
                        console.error('Error updating request status:', error)
                        sendResponse({ success: false, error: error.message })
                    })
                return true // Indicates that the response is sent asynchronously

            default:
                console.warn('Unknown action:', message.action)
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
const RETRY_INTERVAL = 15 * 1000
// Start retry attempts every 60 seconds
queueManager.startProcessing(processRequest, {
    interval: RETRY_INTERVAL, // Интервал между циклами обработки
    maxConcurrentRequests: 2, // Максимальное количество параллельных запросов
    retryEnabled: true, // Можно контролировать через storage
})
