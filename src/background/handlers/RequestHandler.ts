import { RequestCacheHeaders, RequestCacheBodes } from '../../types/baltichub'
import { consoleLog, JSONstringify } from '../../utils'
import { getStorage, setStorage } from '../../utils/storage'

export class RequestHandler {
    private readonly maskForCache = '*://*/TVApp/EditTvAppSubmit/*'

    setupRequestListeners(): void {
        this.setupBeforeRequestListener()
        this.setupBeforeSendHeadersListener()
    }

    private setupBeforeRequestListener(): void {
        chrome.webRequest.onBeforeRequest.addListener(
            (details) => {
                if (details.method === 'POST' && details.requestBody) {
                    this.cacheRequestBody(details).catch((error) => {
                        consoleLog('Error in cacheRequestBody:', error)
                    })
                }
                return undefined
            },
            { urls: [this.maskForCache] },
            ['requestBody']
        )
    }

    private setupBeforeSendHeadersListener(): void {
        chrome.webRequest.onBeforeSendHeaders.addListener(
            (details) => {
                this.handleRequestHeaders(details)
                return undefined
            },
            { urls: [this.maskForCache] },
            ['requestHeaders']
        )
    }

    private async cacheRequestBody(
        details: chrome.webRequest.OnBeforeRequestDetails
    ): Promise<void> {
        try {
            const data = await getStorage('requestCacheBody')
            let cacheBody: RequestCacheBodes = data.requestCacheBody || {}

            cacheBody[details.requestId] = {
                url: details.url,
                body: details.requestBody,
                timestamp: Date.now(),
            }

            await setStorage({ requestCacheBody: cacheBody })
            consoleLog(
                '✅ Cached Request Body:',
                details.requestId,
                JSONstringify(cacheBody)
            )
        } catch (error) {
            consoleLog('Error caching request body:', error)
        }
    }

    private handleRequestHeaders(
        details: chrome.webRequest.OnBeforeSendHeadersDetails
    ): void {
        consoleLog(
            'Checking for our header:',
            JSONstringify(details.requestHeaders)
        )

        const hasOurHeader = details.requestHeaders?.some(
            (header) =>
                header.name.toLowerCase() === 'x-extension-request' &&
                header.value === 'JustPrivetProject'
        )

        if (hasOurHeader) {
            this.removeCachedBody(details.requestId).catch((error) => {
                consoleLog('Error in removeCachedBody:', error)
            })
            return
        }

        this.cacheRequestHeaders(details).catch((error) => {
            consoleLog('Error in cacheRequestHeaders:', error)
        })
    }

    private async removeCachedBody(requestId: string): Promise<void> {
        try {
            const data = await getStorage('requestCacheBody')
            let cacheBody: RequestCacheBodes = data.requestCacheBody || {}
            if (cacheBody && cacheBody[requestId]) {
                delete cacheBody[requestId]
                await setStorage({ requestCacheBody: cacheBody })
                consoleLog('Removed cacheBody by id (no header):', requestId)
            }
        } catch (error) {
            consoleLog('Error removing cached body:', error)
        }
    }

    private async cacheRequestHeaders(
        details: chrome.webRequest.OnBeforeSendHeadersDetails
    ): Promise<void> {
        try {
            const data = await getStorage('requestCacheHeaders')
            let cacheHeaders: RequestCacheHeaders =
                data.requestCacheHeaders || {}

            cacheHeaders[details.requestId] = {
                url: details.url,
                headers: details.requestHeaders,
                timestamp: Date.now(),
            }

            await setStorage({ requestCacheHeaders: cacheHeaders })
            consoleLog(
                '✅ Cached Request Headers:',
                details.requestId,
                cacheHeaders
            )
        } catch (error) {
            consoleLog('Error caching request headers:', error)
        }
    }
}
