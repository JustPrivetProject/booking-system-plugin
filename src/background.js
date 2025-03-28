chrome.runtime.onInstalled.addListener(() => {
    console.log('Plugin installed!')
})

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
function generateUniqueId() {
    return crypto.randomUUID()
}

function retryRequests() {
    chrome.storage.local.get(
        { toQueue: [], retryQueue: [], retryEnabled: true },
        async (data) => {
            if (!data.retryEnabled) {
                console.log('Retrying is disabled.')
                return
            }

            let retryQueue = data.retryQueue

            // Переносим задачи из toQueue в retryQueue, но не очищаем toQueue
            chrome.storage.local.get({ toQueue: [] }, async (latestData) => {
                let latestToQueue = latestData.toQueue
                let newRetryQueue = [...retryQueue]

                for (let i = 0; i < latestToQueue.length; i++) {
                    let request = latestToQueue[i]
                    if (!newRetryQueue.some((r) => r.id === request.id)) {
                        request.status = 'in-progress'
                        request.status_message = 'Zadanie jest w trakcie realizacji'
                        newRetryQueue.push(request)
                    }
                }

                let updatedQueue = await Promise.all(
                    newRetryQueue.map(async (req) => {
                        if (req.status !== 'in-progress') return req

                        try {
                            return await processRequest(req, newRetryQueue)
                        } catch (err) {
                            console.error('Error retrying request:', err)
                            return req
                        }
                    })
                )

                // Обновляем только retryQueue
                chrome.storage.local.set({ retryQueue: updatedQueue })
            })
        }
    )
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
    if (message.action === 'showError') {
        console.log('❌ Request failed, checking cache')
    
        chrome.storage.local.get(
            {
                requestCacheBody: {},
                toQueue: [],
                retryQueue: [],
                requestCacheHeaders: {},
                retryEnabled: true,
                testEnv: false,
                tableData: [],
            },
            (data) => {
                if (data.retryEnabled) {
                    chrome.storage.local.set({ retryEnabled: false })
                }
    
                let requestCacheBody = getLastProperty(data.requestCacheBody)
                let requestCacheHeaders = getLastProperty(data.requestCacheHeaders)
                let toQueue = data.toQueue
    
                if (requestCacheBody) {
                    const tvAppId = normalizeFormData(requestCacheBody.body).formData.TvAppId[0]
                    let retryObject = {
                        ...requestCacheBody,
                        headersCache: requestCacheHeaders,
                        status: 'pending',
                        status_message: 'Zadanie jest w trakcie realizacji',
                        tvAppId: tvAppId,
                        id: generateUniqueId()
                    }
    
                    toQueue.push(retryObject)
    
                    if (!data.testEnv) {
                        const lastKeyBody = Object.keys(data.requestCacheBody).pop()
                        const lastKeyHeaders = Object.keys(data.requestCacheHeaders).pop()
    
                        delete data.requestCacheBody[lastKeyBody]
                        delete data.requestCacheHeaders[lastKeyHeaders]
                    }
    
                    chrome.storage.local.set(
                        {
                            requestCacheBody: data.requestCacheBody,
                            requestCacheHeaders: data.requestCacheHeaders,
                            toQueue: toQueue
                        },
                        () => {
                            console.log('Added to toQueue:', requestCacheBody.url)
                        }
                    )
                }
                chrome.storage.local.set({ retryEnabled: data.retryEnabled })
            }
        )
        retryRequests()
        sendResponse({ success: true })
    }
    if (message.action === 'parsedTable') {
        chrome.storage.local.set({ tableData: message.message }, () => {
            console.log('Table saved in the storage', message.message)
        })
        sendResponse({ success: true })
    }
    return true
})

// Settings
chrome.storage.local.set({ retryEnabled: true })
chrome.storage.local.set({ testEnv: false })
const RETRY_INTERVAL = 15 * 1000
// Start retry attempts every 60 seconds
setInterval(retryRequests, RETRY_INTERVAL)
