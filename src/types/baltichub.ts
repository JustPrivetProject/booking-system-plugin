export type RetryObject = {
    body: RequestBody
    driverName?: string
    containerNumber?: string // MSNU2991953
    headersCache: RequestHeader
    id: string
    startSlot: string // "05.06.2025 19:00:00"
    endSlot: string // 26.06.2025 00:59:00
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

export type RequestBody =
    chrome.webRequest.OnBeforeRequestDetails['requestBody']

export type RequestHeader =
    chrome.webRequest.OnBeforeSendHeadersDetails['requestHeaders']
