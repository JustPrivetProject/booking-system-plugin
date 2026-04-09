import type { RequestCacheHeaders, RequestCacheBodes } from '../../types/baltichub';
import { getBookingTerminalFromUrl } from '../../types/terminal';
import { consoleLog, JSONstringify } from '../../utils';
import {
    getTerminalStorageValue,
    setTerminalStorageValue,
    TERMINAL_STORAGE_NAMESPACES,
} from '../../utils/storage';

export class RequestHandler {
    private readonly maskForCache = '*://*/TVApp/EditTvAppSubmit/*';
    private readonly requestCacheMaxAgeMs = 5 * 60 * 1000;
    // Track requestIds of our requests (with X-Extension-Request header)
    // to prevent caching them
    private ourRequestIds = new Set<string>();

    setupRequestListeners(): void {
        this.setupBeforeRequestListener();
        this.setupBeforeSendHeadersListener();
        this.setupCompletedListener();
    }

    private setupBeforeRequestListener(): void {
        chrome.webRequest.onBeforeRequest.addListener(
            details => {
                // Cache all requests - cleanup will happen in onCompleted
                if (details.method === 'POST' && details.requestBody) {
                    this.cacheRequestBody(details).catch(error => {
                        consoleLog('Error in cacheRequestBody:', error);
                    });
                }
                return undefined;
            },
            { urls: [this.maskForCache] },
            ['requestBody'],
        );
    }

    private setupBeforeSendHeadersListener(): void {
        chrome.webRequest.onBeforeSendHeaders.addListener(
            details => {
                this.handleRequestHeaders(details);
                return undefined;
            },
            { urls: [this.maskForCache] },
            ['requestHeaders'],
        );
    }

    private async cacheRequestBody(
        details: chrome.webRequest.OnBeforeRequestDetails,
    ): Promise<void> {
        try {
            if (!details.requestBody) {
                return;
            }

            const terminal = getBookingTerminalFromUrl(details.url);

            if (!terminal) {
                consoleLog('Skipping request body cache for unsupported booking URL:', details.url);
                return;
            }

            const cacheBody = await getTerminalStorageValue(
                TERMINAL_STORAGE_NAMESPACES.REQUEST_CACHE_BODY,
                terminal,
                {} as RequestCacheBodes,
            );

            this.pruneExpiredEntries(cacheBody);

            cacheBody[details.requestId] = {
                url: details.url,
                body: details.requestBody,
                timestamp: Date.now(),
            };

            await setTerminalStorageValue(
                TERMINAL_STORAGE_NAMESPACES.REQUEST_CACHE_BODY,
                terminal,
                cacheBody,
            );
            const cacheData = {
                requestId: details.requestId,
                terminal,
                url: details.url,
                timestamp: Date.now(),
                totalCached: Object.keys(cacheBody).length,
            };
            consoleLog('✅ Cached Request Body:', JSON.stringify(cacheData, null, 2));
        } catch (error) {
            consoleLog('Error caching request body:', error);
        }
    }

    private handleRequestHeaders(details: chrome.webRequest.OnBeforeSendHeadersDetails): void {
        const hasOurHeader = details.requestHeaders?.some(
            header =>
                header.name.toLowerCase() === 'x-extension-request' &&
                header.value === 'JustPrivetProject',
        );

        if (hasOurHeader) {
            this.ourRequestIds.add(details.requestId);
            this.removeCachedBody(details.requestId, details.url).catch(error => {
                consoleLog('Error removing cached body for extension request:', error);
            });
            this.removeCachedHeaders(details.requestId, details.url).catch(error => {
                consoleLog('Error removing cached headers for extension request:', error);
            });
            consoleLog('✅ Marked request as extension-owned:', details.requestId);
            return;
        }

        this.cacheRequestHeaders(details).catch(error => {
            consoleLog('Error in cacheRequestHeaders:', error);
        });
    }

    private async removeCachedBody(requestId: string, url?: string): Promise<void> {
        try {
            const terminal = getBookingTerminalFromUrl(url);

            if (!terminal) {
                return;
            }

            const cacheBody = await getTerminalStorageValue(
                TERMINAL_STORAGE_NAMESPACES.REQUEST_CACHE_BODY,
                terminal,
                {} as RequestCacheBodes,
            );

            this.pruneExpiredEntries(cacheBody);

            if (cacheBody && cacheBody[requestId]) {
                delete cacheBody[requestId];
                await setTerminalStorageValue(
                    TERMINAL_STORAGE_NAMESPACES.REQUEST_CACHE_BODY,
                    terminal,
                    cacheBody,
                );
                const removeData = {
                    requestId,
                    terminal,
                    reason: 'X-Extension-Request header found (our request)',
                    totalCached: Object.keys(cacheBody).length,
                };
                consoleLog(
                    '🗑️ Removed cacheBody (our request):',
                    JSON.stringify(removeData, null, 2),
                );
            } else {
                consoleLog('⚠️ cacheBody not found for requestId:', requestId);
            }
        } catch (error) {
            consoleLog('Error removing cached body:', error);
        }
    }

    private setupCompletedListener(): void {
        // Clean up cache for our requests after they complete
        chrome.webRequest.onCompleted.addListener(
            details => {
                if (this.ourRequestIds.has(details.requestId)) {
                    consoleLog(
                        '🧹 Cleaning up cache for our completed request:',
                        details.requestId,
                    );
                    this.removeCachedBody(details.requestId, details.url).catch(error => {
                        consoleLog('Error removing cached body in onCompleted:', error);
                    });
                    this.removeCachedHeaders(details.requestId, details.url).catch(error => {
                        consoleLog('Error removing cached headers in onCompleted:', error);
                    });
                    this.ourRequestIds.delete(details.requestId);
                }
            },
            { urls: [this.maskForCache] },
        );

        // Also handle errors
        chrome.webRequest.onErrorOccurred.addListener(
            details => {
                if (this.ourRequestIds.has(details.requestId)) {
                    consoleLog('🧹 Cleaning up cache for our failed request:', details.requestId);
                    this.removeCachedBody(details.requestId, details.url).catch(error => {
                        consoleLog('Error removing cached body in onErrorOccurred:', error);
                    });
                    this.removeCachedHeaders(details.requestId, details.url).catch(error => {
                        consoleLog('Error removing cached headers in onErrorOccurred:', error);
                    });
                    this.ourRequestIds.delete(details.requestId);
                }
            },
            { urls: [this.maskForCache] },
        );
    }

    private async removeCachedHeaders(requestId: string, url?: string): Promise<void> {
        try {
            const terminal = getBookingTerminalFromUrl(url);

            if (!terminal) {
                return;
            }

            const cacheHeaders = await getTerminalStorageValue(
                TERMINAL_STORAGE_NAMESPACES.REQUEST_CACHE_HEADERS,
                terminal,
                {} as RequestCacheHeaders,
            );

            this.pruneExpiredEntries(cacheHeaders);

            if (cacheHeaders && cacheHeaders[requestId]) {
                delete cacheHeaders[requestId];
                await setTerminalStorageValue(
                    TERMINAL_STORAGE_NAMESPACES.REQUEST_CACHE_HEADERS,
                    terminal,
                    cacheHeaders,
                );
                consoleLog('🗑️ Removed cached headers for requestId:', requestId);
            }
        } catch (error) {
            consoleLog('Error removing cached headers:', error);
        }
    }

    private async cacheRequestHeaders(
        details: chrome.webRequest.OnBeforeSendHeadersDetails,
    ): Promise<void> {
        try {
            const terminal = getBookingTerminalFromUrl(details.url);

            if (!terminal) {
                consoleLog(
                    'Skipping request headers cache for unsupported booking URL:',
                    details.url,
                );
                return;
            }

            const cacheHeaders = await getTerminalStorageValue(
                TERMINAL_STORAGE_NAMESPACES.REQUEST_CACHE_HEADERS,
                terminal,
                {} as RequestCacheHeaders,
            );

            this.pruneExpiredEntries(cacheHeaders);

            cacheHeaders[details.requestId] = {
                url: details.url,
                headers: details.requestHeaders,
                timestamp: Date.now(),
            };

            await setTerminalStorageValue(
                TERMINAL_STORAGE_NAMESPACES.REQUEST_CACHE_HEADERS,
                terminal,
                cacheHeaders,
            );
            consoleLog(
                '✅ Cached Request Headers:',
                details.requestId,
                JSONstringify(cacheHeaders),
            );
        } catch (error) {
            consoleLog('Error caching request headers:', error);
        }
    }

    private pruneExpiredEntries<T extends { timestamp: number }>(cache: Record<string, T>): void {
        const now = Date.now();

        Object.entries(cache).forEach(([requestId, value]) => {
            if (now - value.timestamp > this.requestCacheMaxAgeMs) {
                delete cache[requestId];
            }
        });
    }
}
