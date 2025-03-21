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
//

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

// Function to retry requests
function retryRequests() {
    chrome.storage.local.get(
        { retryQueue: [], retryEnabled: true },
        async (data) => {
            if (!data.retryEnabled) {
                console.log('Retrying is disabled.')
                return
            }

            let queue = data.retryQueue
            let newQueue = []

            for (let i = 0; i < queue.length; i++) {
                const req = queue[i]
                if (req.status === 'in-progress') {
                    try {
                        let body = normalizeFormData(req.body).formData
                        const taskNumber = body['SelectedTasks[0].TaskNo'][0]
                        const time = body.SlotStart[0].split(' ')

                        // check if task was succeed in another queen
                        if (
                            req.status === 'in-progress' &&
                            queue.some(
                                (task) =>
                                    task.taskNumber === req.taskNumber &&
                                    task.status === 'success'
                            )
                        ) {
                            console.warn(
                                '✅ The request was executed in another task:',
                                taskNumber,
                                time.join(', ')
                            )
                            req.status = 'another-task'
                            newQueue.push(req)
                            continue
                        }

                        // check if slot is available
                        const slots = await getSlots(time[0])
                        const htmlText = await slots.text()
                        const buttons = parseSlotsIntoButtons(htmlText)
                        const isHasSlot = buttons.find((button) =>
                            button.text.includes(time[1].slice(0, 5))
                        ).disabled

                        // If there are no slots, keep the request in the queue
                        if (!isHasSlot) {
                            const formData = new FormData()

                            // Fill FormData from Object
                            Object.entries(req.body.formData).forEach(
                                ([key, value]) => {
                                    if (Array.isArray(value)) {
                                        value.forEach((item) => {
                                            formData.append(key, item)
                                        })
                                    } else {
                                        formData.append(key, value)
                                    }
                                }
                            )

                            let response = await fetch(req.url, {
                                method: 'POST',
                                headers: {
                                    ...req.headersCache.headers,
                                    'X-Extension-Request': 'JustPrivetProject',
                                    credentials: 'include',
                                },
                                body: formData,
                            })
                            let parsedResponse = await response.text()
                            console.log('Response:', parsedResponse)
                            if (parsedResponse.includes('error')) {
                                if (
                                    parsedResponse.includes(
                                        'CannotCreateTvaInSelectedSlot'
                                    )
                                ) {
                                    console.warn(
                                        '❌ Retry failed, keeping in queue:',
                                        taskNumber,
                                        time.join(', ')
                                    )
                                    newQueue.push(req)
                                } else if (
                                    parsedResponse.includes(
                                        'TaskWasUsedInAnotherTva'
                                    )
                                ) {
                                    console.warn(
                                        '✅ The request was executed in another task:',
                                        taskNumber,
                                        time.join(', ')
                                    )
                                    req.status = 'another-task'
                                    newQueue.push(req)
                                } else {
                                    console.error(
                                        '❌ Unknown error occurred:',
                                        parsedResponse
                                    )
                                    newQueue.push(req)
                                }
                            } else {
                                console.log(
                                    '✅Request retried successfully:',
                                    taskNumber,
                                    time.join(', ')
                                )
                                req.status = 'success'
                                newQueue.push(req)
                            }
                        } else {
                            console.warn(
                                '❌ No slots, keeping in queue:',
                                taskNumber,
                                time.join(', ')
                            )
                            newQueue.push(req)
                        }
                    } catch (err) {
                        console.error('Error retrying request:', err)
                        newQueue.push(req)
                    }
                } else {
                    newQueue.push(req)
                }
            }

            chrome.storage.local.set({ retryQueue: newQueue })
        }
    )
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'showError') {
        console.log('❌ Request failed, checking cache')
        chrome.storage.local.set({ retryEnabled: false })
        chrome.storage.local.get(
            {
                requestCacheBody: {},
                retryQueue: [],
                requestCacheHeaders: {},
            },
            (data) => {
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
                    retryObject.taskNumber =
                        normalizeFormData(requestCacheBody.body).formData[
                            'SelectedTasks[0].TaskNo'
                        ][0]
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
                chrome.storage.local.set({ retryEnabled: true })
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
