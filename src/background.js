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
// Cache logic
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.method === 'POST' && details.requestBody) {
            console.log('Request:', details.requestId, details.url)
            console.log('Request Body:', details.requestBody)
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

            for (const req of queue) {
                try {
                    let body = normalizeFormData(req.body).formData
                    const time = body.SlotStart[0].split(' ')
                    const slots = await getSlots(time[0])
                    const htmlText = await slots.text()
                    const buttons = parseSlotsIntoButtons(htmlText)

                    const isDisabled = buttons.find((button) =>
                        button.text.includes(time[1].slice(0, 5))
                    ).disabled
                    // const isDisabled = false
                    if (!isDisabled) {
                        const formData = new FormData()

                        // Заполняем FormData данными из объекта
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
                        let parsedResponse = await response.text() // Was successful 1 time, but get error on parse response
                        console.log('Response:', parsedResponse)
                        if (!!parsedResponse.error) {
                            // TODO: {"error":"Brak dostępnych slotów","messageCode":"CannotCreateTvaInSelectedSlot"}
                            console.warn(
                                '❌ Retry failed, keeping in queue:',
                                req.url
                            )
                            newQueue.push(req)
                        } else {
                            console.log(
                                'Request retried successfully:',
                                req.url
                            )
                            req.status = 'success'
                            newQueue.push(req)
                        }
                    } else {
                        console.warn(
                            '❌ No slots, keeping in queue:',
                            time.join(', '),
                            req.url
                        )
                        newQueue.push(req)
                    }
                } catch (err) {
                    console.error('Error retrying request:', err)
                    newQueue.push(req)
                }
            }

            chrome.storage.local.set({ retryQueue: newQueue })
        }
    )
}

// chrome.webRequest.onCompleted.addListener(
//     (details) => {
//         chrome.storage.local.get(
//             {
//                 requestCacheBody: {},
//                 requestCacheHeaders: {},
//                 responseCache: {},
//             },
//             (data) => {
//                 let bodyCache = data.requestCacheBody
//                 let headersCache = data.requestCacheHeaders
//                 let responseCache = data.responseCache

//                 delete bodyCache[details.requestId] // Remove processed request body
//                 delete headersCache[details.requestId] // Remove processed request headers
//                 delete responseCache[details.requestId] // Remove processed response cache

//                 chrome.storage.local.set({
//                     requestCacheBody: bodyCache,
//                     requestCacheHeaders: headersCache,
//                     responseCache: responseCache,
//                 })
//             }
//         )
//     },
//     { urls: [maskForCache] }
// )

function getLastProperty(obj) {
    let keys = Object.keys(obj) // Get all keys
    if (keys.length === 0) return null // Return null if the object is empty

    let lastKey = keys[keys.length - 1] // Get the last key
    return { ...obj[lastKey] } // Return both key and value
}

// TODO: https://trello.com/c/42rY2esL/2-how-to-handle-fail-request
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'showError') {
        console.log('❌ Request failed, checking cache')

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
            }
        )
    }
})

// Settings
chrome.storage.local.set({ retryEnabled: true })
const RETRY_INTERVAL = 15 * 1000
// Start retry attempts every 60 seconds
setInterval(retryRequests, RETRY_INTERVAL)
