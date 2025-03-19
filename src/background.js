chrome.runtime.onInstalled.addListener(() => {
    console.log('Plugin installed!')
})

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

// Button for searching
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchData') {
        ;(async () => {
            try {
                const response = await getSlots(request.date)
                const htmlText = await response.text()

                sendResponse({ success: true, html: htmlText })
            } catch (error) {
                console.error('Fetch error:', error)
                sendResponse({ success: false, error: error.message })
            }
        })()

        return true
    }
})
// Cache logic
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.method === 'POST' && details.requestBody) {
            let rawData = details.requestBody.raw
            if (rawData && rawData[0]) {
                let decoder = new TextDecoder('utf-8')
                let body = decoder.decode(rawData[0].bytes)

                chrome.storage.local.get({ requestCacheBody: {} }, (data) => {
                    let cacheBody = data.requestCacheBody

                    cacheBody[details.requestId] = {
                        url: details.url,
                        body,
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
        }
    },
    { urls: ['*://*/Home/GetSlotsForPreview*'] },
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
    { urls: ['*://*/Home/GetSlotsForPreview*'] },
    ['requestHeaders']
)

chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
        chrome.storage.local.get({ responseCache: {} }, (data) => {
            let cache = data.responseCache

            if (!cache[details.requestId]) {
                cache[details.requestId] = {
                    url: details.url,
                    responseHeaders: details.responseHeaders,
                }

                chrome.storage.local.set({ responseCache: cache }, () => {
                    console.log(
                        'Cached Response Headers:',
                        details.requestId,
                        details.url
                    )
                })
            } else {
                console.log(
                    'Response Headers already in cache:',
                    details.requestId,
                    details.url
                )
            }
        })
    },
    { urls: ['*://*/Home/GetSlotsForPreview*'] },
    ['responseHeaders']
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
                    let body =
                        typeof req.body === 'string'
                            ? req.body
                            : JSON.stringify(req.body) // Ensure string
                    // TODO: time from body - SlotStart - 20.02.2025 22:00:00
                    // const time = JSON.parse(req.body).SlotStart.split(' ') // (2) ['20.02.2025', '22:00:00']
                    time = ['19.03.2025', '19:00:00']
                    const slots = await getSlots(time[0])
                    const htmlText = await slots.text()
                    const buttons = parseSlotsIntoButtons(htmlText)

                    const isDisabled = buttons.find((button) =>
                        button.text.includes(time[1].slice(0, 5))
                    ).disabled
                    // const isDisabled = false
                    if (!isDisabled) {
                        let response = await fetch(req.url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'X-Extension-Request': 'JustPrivetProject' },
                            body: body,
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

chrome.webRequest.onCompleted.addListener(
  (details) => {
    chrome.storage.local.get(
      { requestCacheBody: {}, requestCacheHeaders: {}, responseCache: {} },
      (data) => {
        let bodyCache = data.requestCacheBody
        let headersCache = data.requestCacheHeaders
        let responseCache = data.responseCache

        delete bodyCache[details.requestId] // Remove processed request body
        delete headersCache[details.requestId] // Remove processed request headers
        delete responseCache[details.requestId] // Remove processed response cache

        chrome.storage.local.set({
          requestCacheBody: bodyCache,
          requestCacheHeaders: headersCache,
          responseCache: responseCache,
        })
      }
    )
  },
  { urls: ['*://*/Home/GetSlotsForPreview*'] }
)

// TODO: https://trello.com/c/42rY2esL/2-how-to-handle-fail-request
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   if (message.action === "showError") {
//     console.log("Ошибка была поймана:", message.message);

//     // Здесь ты можешь выполнить дополнительные действия, например, логировать ошибку, показывать уведомление и т.д.
//   }
// });

// Intercept responses and add to queue on error
chrome.webRequest.onCompleted.addListener(
    (details) => {
        // TODO: Think about it // TODO: https://trello.com/c/42rY2esL/2-how-to-handle-fail-request
        if (details.statusCode == 200) {
            console.log('❌ Request failed, checking cache:', details.requestId)

            chrome.storage.local.get(
                {
                    requestCacheBody: {},
                    retryQueue: [],
                    requestCacheHeaders: {},
                },
                (data) => { 
                    let requestCacheBody = data.requestCacheBody
                    let requestCacheHeaders = data.requestCacheHeaders
                    let queue = data.retryQueue
                    // TODO: We should use upper listener on message
                    // Check if the request is already in the cache, do not add it to the queue
                    if (
                        !requestCacheHeaders[details.requestId].headers.find(
                            (h) => {
                                return (
                                    h.name.toLowerCase() ===
                                    'x-extension-request'
                                )
                            }
                        )
                    ) {
                        if (requestCacheBody[details.requestId]) {
                            // Check if the request is already in the retry queue

                            queue.push(requestCacheBody[details.requestId]) // Add request to queue
                            chrome.storage.local.set(
                                { retryQueue: queue },
                                () => {
                                    console.log(
                                        'Added to retry queue:',
                                        requestCacheBody[details.requestId].url
                                    )
                                }
                            )
                        } else {
                            console.log(
                                'Request is already in the retry queue:',
                                requestCacheBody[details.requestId].url
                            )
                        }
                    }
                }
            )
        }
    },
    { urls: ['*://*/Home/GetSlotsForPreview*'] }
)

// Settings
chrome.storage.local.set({ retryEnabled: true })
const RETRY_INTERVAL = 60 * 1000
// Start retry attempts every 60 seconds
setInterval(retryRequests, RETRY_INTERVAL)
