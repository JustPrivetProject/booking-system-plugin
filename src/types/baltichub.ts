export type RetryObject = {
    body: chrome.webRequest.OnBeforeRequestDetails['requestBody']
    driverName?: string
    containerNumber?: string // MSNU2991953
    headersCache: chrome.webRequest.OnBeforeSendHeadersDetails['requestHeaders']
    id: string
    startSlot: string // "05.06.2025 19:00:00"
    status: string // e.g. "paused"
    status_message: string // e.g. "Zadanie jest wstrzymane"
    timestamp: number
    tvAppId: string
    url: string
}

export type RetryObjectArray = RetryObject[]

export type GroupsStates = {
    [tvAppId: string]: boolean
}

export type RequestCacheBodes = {
    [id: string]: RequestCacheBodyObject
}

export type RequestCacheBodyObject = {
    body: chrome.webRequest.OnBeforeRequestDetails['requestBody']
    timestamp: number
    url: string
}

export type RequestCacheHeaders = {
    [id: string]: RequestCacheHeaderBody
}

export type RequestCacheHeaderBody = {
    headers: chrome.webRequest.OnBeforeSendHeadersDetails['requestHeaders']
    timestamp: number
    url: string
}
