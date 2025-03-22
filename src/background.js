chrome.runtime.onInstalled.addListener(() => {
    console.log('Plugin installed!')
})

const maskForCache = '*://*/TVApp/EditTvAppSubmit/*'

async function getSlots(date) {
    return fetch('https://ebrama.baltichub.com/Home/GetSlotsForPreview', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'X-requested-with': 'XMLHttpRequest',
            Referer: 'https://ebrama.baltichub.com/vbs-slots',
            Accept: '*/*',
            'X-Extension-Request': 'JustPrivetProject',
        },
        body: JSON.stringify({ date: date }),
        credentials: 'include',
    })
}

function retryRequests() {
    chrome.storage.local.get(
        { retryQueue: [], retryEnabled: true },
        async (data) => {
            if (!data.retryEnabled) {
                console.log('Retrying is disabled.')
                return
            }

            const queue = data.retryQueue
            const newQueue = []

            for (const req of queue) {
                if (req.status !== 'in-progress') {
                    newQueue.push(req)
                    continue
                }

                try {
                    const updatedReq = await processRequest(req, queue)
                    newQueue.push(updatedReq)
                } catch (err) {
                    console.error('Error retrying request:', err)
                    newQueue.push(req)
                }
            }

            chrome.storage.local.set({ retryQueue: newQueue })
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
    const taskNumber = body['SelectedTasks[0].TaskNo'][0]
    const time = body.SlotStart[0].split(' ')

    if (isTaskCompletedInAnotherQueue(req, queue)) {
        console.warn(
            '✅ The request was executed in another task:',
            taskNumber,
            time.join(', ')
        )
        return {
            ...req,
            status: 'another-task',
        }
    }

    const isSlotAvailable = await checkSlotAvailability(time)
    if (!isSlotAvailable) {
        console.warn(
            '❌ No slots, keeping in queue:',
            taskNumber,
            time.join(', ')
        )
        return req
    }

    return await executeRequest(req, taskNumber, time)
}

function isTaskCompletedInAnotherQueue(req, queue) {
    return queue.some(
        (task) =>
            task.taskNumber === req.taskNumber && task.status === 'success'
    )
}

async function checkSlotAvailability(time) {
    const slots = await getSlots(time[0])
    const htmlText = await slots.text()
    const buttons = parseSlotsIntoButtons(htmlText)
    const slotButton = buttons.find((button) =>
        button.text.includes(time[1].slice(0, 5))
    )

    return !slotButton.disabled
}

async function executeRequest(req, taskNumber, time) {
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
    if (!parsedResponse.includes('error')) {
        console.log(
            '✅Request retried successfully:',
            taskNumber,
            time.join(', ')
        )
        return {
            ...req,
            status: 'success',
            status_message: 'Zadanie zakończone sukcesem',
        }
    }

    return handleErrorResponse(req, parsedResponse, taskNumber, time)
}

function handleErrorResponse(req, parsedResponse, taskNumber, time) {
    if (parsedResponse.includes('CannotCreateTvaInSelectedSlot')) {
        console.warn(
            '❌ Retry failed, keeping in queue:',
            taskNumber,
            time.join(', ')
        )
        return req
    }

    if (parsedResponse.includes('TaskWasUsedInAnotherTva')) {
        console.warn(
            '✅ The request was executed in another task:',
            taskNumber,
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
                retryQueue: [],
                requestCacheHeaders: {},
                retryEnabled: true,
            },
            (data) => {
                if (data.retryEnabled) {
                    chrome.storage.local.set({ retryEnabled: false })
                }
                let requestCacheBody = getLastProperty(data.requestCacheBody)
                let requestCacheHeaders = getLastProperty(
                    data.requestCacheHeaders
                )
                let queue = data.retryQueue

                if (requestCacheBody) {
                    // Check if the request is already in the retry queue
                    const retryObject = requestCacheBody
                    retryObject.headersCache = requestCacheHeaders
                    retryObject.status = 'in-progress'
                    retryObject.status_message =
                        'Zadanie jest w trakcie realizacji'
                    retryObject.taskNumber = normalizeFormData(
                        requestCacheBody.body
                    ).formData['SelectedTasks[0].TaskNo'][0]
                    queue.push(retryObject) // Add request to queue
                    chrome.storage.local.set({ retryQueue: queue }, () => {
                        console.log(
                            'Added to retry queue:',
                            requestCacheBody.url
                        )
                    })
                } else {
                    console.log(
                        'Request is already in the retry queue:',
                        requestCacheBody.url
                    )
                }
                chrome.storage.local.set({ retryEnabled: data.retryEnabled })
            }
        )
        sendResponse({ success: true })
    }
    return true
})

// Settings
chrome.storage.local.set({ retryEnabled: true })
const RETRY_INTERVAL = 15 * 1000
// Start retry attempts every 60 seconds
setInterval(retryRequests, RETRY_INTERVAL)
