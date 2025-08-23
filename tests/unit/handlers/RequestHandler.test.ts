import { RequestHandler } from '../../../src/background/handlers/RequestHandler';
import { getStorage, setStorage } from '../../../src/utils/storage';
import { consoleLog } from '../../../src/utils';

// Mock dependencies
jest.mock('../../../src/utils/storage');
jest.mock('../../../src/utils', () => ({
    consoleLog: jest.fn(),
    JSONstringify: jest.fn(obj => JSON.stringify(obj)),
}));

// Chrome mock is now global in tests/setup.ts

describe('RequestHandler', () => {
    let requestHandler: RequestHandler;

    beforeEach(() => {
        jest.clearAllMocks();
        requestHandler = new RequestHandler();
    });

    describe('setupRequestListeners', () => {
        it('should setup both request listeners', () => {
            requestHandler.setupRequestListeners();

            expect(chrome.webRequest.onBeforeRequest.addListener).toHaveBeenCalled();
            expect(chrome.webRequest.onBeforeSendHeaders.addListener).toHaveBeenCalled();
        });

        it('should setup beforeRequest listener with correct parameters', () => {
            requestHandler.setupRequestListeners();

            const call = (chrome.webRequest.onBeforeRequest.addListener as jest.Mock).mock.calls[0];
            expect(call[1]).toEqual({ urls: ['*://*/TVApp/EditTvAppSubmit/*'] });
            expect(call[2]).toEqual(['requestBody']);
        });

        it('should setup beforeSendHeaders listener with correct parameters', () => {
            requestHandler.setupRequestListeners();

            const call = (chrome.webRequest.onBeforeSendHeaders.addListener as jest.Mock).mock
                .calls[0];
            expect(call[1]).toEqual({ urls: ['*://*/TVApp/EditTvAppSubmit/*'] });
            expect(call[2]).toEqual(['requestHeaders']);
        });
    });

    describe('cacheRequestBody', () => {
        it('should cache request body successfully', async () => {
            const details = {
                requestId: 'test-request-1',
                url: 'https://example.com/test',
                method: 'POST',
                frameId: 0,
                parentFrameId: -1,
                tabId: 1,
                timeStamp: Date.now(),
                type: 'main_frame' as chrome.webRequest.ResourceType,
                requestBody: {
                    formData: {
                        test: ['value'],
                    },
                },
            } as chrome.webRequest.OnBeforeRequestDetails;

            const mockStorageData = {
                requestCacheBody: {
                    'existing-request': {
                        url: 'existing-url',
                        body: {},
                        timestamp: Date.now(),
                    },
                },
            };

            (getStorage as jest.Mock).mockResolvedValue(mockStorageData);
            (setStorage as jest.Mock).mockResolvedValue(undefined);

            await requestHandler['cacheRequestBody'](details);

            expect(getStorage).toHaveBeenCalledWith('requestCacheBody');
            expect(setStorage).toHaveBeenCalledWith({
                requestCacheBody: {
                    'existing-request': mockStorageData.requestCacheBody['existing-request'],
                    'test-request-1': {
                        url: 'https://example.com/test',
                        body: details.requestBody,
                        timestamp: expect.any(Number),
                    },
                },
            });
            expect(consoleLog).toHaveBeenCalledWith(
                '✅ Cached Request Body:',
                'test-request-1',
                expect.any(String),
            );
        });

        it('should handle storage errors gracefully', async () => {
            const details = {
                requestId: 'test-request-1',
                url: 'https://example.com/test',
                method: 'POST',
                frameId: 0,
                parentFrameId: -1,
                tabId: 1,
                timeStamp: Date.now(),
                type: 'main_frame' as chrome.webRequest.ResourceType,
                requestBody: {
                    formData: {
                        test: ['value'],
                    },
                },
            } as chrome.webRequest.OnBeforeRequestDetails;

            (getStorage as jest.Mock).mockRejectedValue(new Error('Storage error'));

            await requestHandler['cacheRequestBody'](details);

            expect(consoleLog).toHaveBeenCalledWith(
                'Error caching request body:',
                expect.any(Error),
            );
        });

        it('should handle empty storage data', async () => {
            const details = {
                requestId: 'test-request-1',
                url: 'https://example.com/test',
                method: 'POST',
                frameId: 0,
                parentFrameId: -1,
                tabId: 1,
                timeStamp: Date.now(),
                type: 'main_frame' as chrome.webRequest.ResourceType,
                requestBody: {
                    formData: {
                        test: ['value'],
                    },
                },
            } as chrome.webRequest.OnBeforeRequestDetails;

            (getStorage as jest.Mock).mockResolvedValue({});
            (setStorage as jest.Mock).mockResolvedValue(undefined);

            await requestHandler['cacheRequestBody'](details);

            expect(setStorage).toHaveBeenCalledWith({
                requestCacheBody: {
                    'test-request-1': {
                        url: 'https://example.com/test',
                        body: details.requestBody,
                        timestamp: expect.any(Number),
                    },
                },
            });
        });
    });

    describe('handleRequestHeaders', () => {
        it('should cache headers when no extension header is present', async () => {
            const details = {
                requestId: 'test-request-1',
                url: 'https://example.com/test',
                frameId: 0,
                parentFrameId: -1,
                tabId: 1,
                timeStamp: Date.now(),
                type: 'main_frame' as chrome.webRequest.ResourceType,
                requestHeaders: [
                    { name: 'Content-Type', value: 'application/json' },
                    { name: 'User-Agent', value: 'Chrome' },
                ],
            } as chrome.webRequest.OnBeforeSendHeadersDetails;

            (getStorage as jest.Mock).mockResolvedValue({});
            (setStorage as jest.Mock).mockResolvedValue(undefined);

            requestHandler['handleRequestHeaders'](details);

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(consoleLog).toHaveBeenCalledWith('Checking for our header:', expect.any(String));
            expect(setStorage).toHaveBeenCalledWith({
                requestCacheHeaders: {
                    'test-request-1': {
                        url: 'https://example.com/test',
                        headers: details.requestHeaders,
                        timestamp: expect.any(Number),
                    },
                },
            });
        });

        it('should remove cached body when extension header is present', async () => {
            const details = {
                requestId: 'test-request-1',
                url: 'https://example.com/test',
                frameId: 0,
                parentFrameId: -1,
                tabId: 1,
                timeStamp: Date.now(),
                type: 'main_frame' as chrome.webRequest.ResourceType,
                requestHeaders: [
                    { name: 'x-extension-request', value: 'JustPrivetProject' },
                    { name: 'Content-Type', value: 'application/json' },
                ],
            } as chrome.webRequest.OnBeforeSendHeadersDetails;

            const mockStorageData = {
                requestCacheBody: {
                    'test-request-1': {
                        url: 'test-url',
                        body: {},
                        timestamp: Date.now(),
                    },
                },
            };

            (getStorage as jest.Mock).mockResolvedValue(mockStorageData);
            (setStorage as jest.Mock).mockResolvedValue(undefined);

            requestHandler['handleRequestHeaders'](details);

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(consoleLog).toHaveBeenCalledWith(
                'Removed cacheBody by id (no header):',
                'test-request-1',
            );
            expect(setStorage).toHaveBeenCalledWith({
                requestCacheBody: {},
            });
        });

        it('should handle storage errors gracefully', async () => {
            const details = {
                requestId: 'test-request-1',
                url: 'https://example.com/test',
                frameId: 0,
                parentFrameId: -1,
                tabId: 1,
                timeStamp: Date.now(),
                type: 'main_frame' as chrome.webRequest.ResourceType,
                requestHeaders: [{ name: 'Content-Type', value: 'application/json' }],
            } as chrome.webRequest.OnBeforeSendHeadersDetails;

            (getStorage as jest.Mock).mockRejectedValue(new Error('Storage error'));

            requestHandler['handleRequestHeaders'](details);

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(consoleLog).toHaveBeenCalledWith(
                'Error caching request headers:',
                expect.any(Error),
            );
        });
    });

    describe('removeCachedBody', () => {
        it('should remove cached body successfully', async () => {
            const requestId = 'test-request-1';
            const mockStorageData = {
                requestCacheBody: {
                    'test-request-1': {
                        url: 'test-url',
                        body: {},
                        timestamp: Date.now(),
                    },
                    'other-request': {
                        url: 'other-url',
                        body: {},
                        timestamp: Date.now(),
                    },
                },
            };

            (getStorage as jest.Mock).mockResolvedValue(mockStorageData);
            (setStorage as jest.Mock).mockResolvedValue(undefined);

            await requestHandler['removeCachedBody'](requestId);

            expect(getStorage).toHaveBeenCalledWith('requestCacheBody');
            expect(setStorage).toHaveBeenCalledWith({
                requestCacheBody: {
                    'other-request': mockStorageData.requestCacheBody['other-request'],
                },
            });
            expect(consoleLog).toHaveBeenCalledWith(
                'Removed cacheBody by id (no header):',
                'test-request-1',
            );
        });

        it('should handle non-existent request ID', async () => {
            const requestId = 'non-existent-request';
            const mockStorageData = {
                requestCacheBody: {
                    'existing-request': {
                        url: 'test-url',
                        body: {},
                        timestamp: Date.now(),
                    },
                },
            };

            (getStorage as jest.Mock).mockResolvedValue(mockStorageData);
            (setStorage as jest.Mock).mockResolvedValue(undefined);

            await requestHandler['removeCachedBody'](requestId);

            expect(setStorage).not.toHaveBeenCalled();
            expect(consoleLog).not.toHaveBeenCalledWith(
                'Removed cacheBody by id (no header):',
                'non-existent-request',
            );
        });

        it('should handle storage errors gracefully', async () => {
            const requestId = 'test-request-1';

            (getStorage as jest.Mock).mockRejectedValue(new Error('Storage error'));

            await requestHandler['removeCachedBody'](requestId);

            expect(consoleLog).toHaveBeenCalledWith(
                'Error removing cached body:',
                expect.any(Error),
            );
        });
    });

    describe('cacheRequestHeaders', () => {
        it('should cache request headers successfully', async () => {
            const details = {
                requestId: 'test-request-1',
                url: 'https://example.com/test',
                frameId: 0,
                parentFrameId: -1,
                tabId: 1,
                timeStamp: Date.now(),
                type: 'main_frame' as chrome.webRequest.ResourceType,
                requestHeaders: [
                    { name: 'Content-Type', value: 'application/json' },
                    { name: 'Authorization', value: 'Bearer token' },
                ],
            } as chrome.webRequest.OnBeforeSendHeadersDetails;

            const mockStorageData = {
                requestCacheHeaders: {
                    'existing-request': {
                        url: 'existing-url',
                        headers: [],
                        timestamp: Date.now(),
                    },
                },
            };

            (getStorage as jest.Mock).mockResolvedValue(mockStorageData);
            (setStorage as jest.Mock).mockResolvedValue(undefined);

            await requestHandler['cacheRequestHeaders'](details);

            expect(getStorage).toHaveBeenCalledWith('requestCacheHeaders');
            expect(setStorage).toHaveBeenCalledWith({
                requestCacheHeaders: {
                    'existing-request': mockStorageData.requestCacheHeaders['existing-request'],
                    'test-request-1': {
                        url: 'https://example.com/test',
                        headers: details.requestHeaders,
                        timestamp: expect.any(Number),
                    },
                },
            });
            expect(consoleLog).toHaveBeenCalledWith(
                '✅ Cached Request Headers:',
                'test-request-1',
                expect.any(String),
            );
        });

        it('should handle storage errors gracefully', async () => {
            const details = {
                requestId: 'test-request-1',
                url: 'https://example.com/test',
                frameId: 0,
                parentFrameId: -1,
                tabId: 1,
                timeStamp: Date.now(),
                type: 'main_frame' as chrome.webRequest.ResourceType,
                requestHeaders: [{ name: 'Content-Type', value: 'application/json' }],
            } as chrome.webRequest.OnBeforeSendHeadersDetails;

            (getStorage as jest.Mock).mockRejectedValue(new Error('Storage error'));

            await requestHandler['cacheRequestHeaders'](details);

            expect(consoleLog).toHaveBeenCalledWith(
                'Error caching request headers:',
                expect.any(Error),
            );
        });
    });
});
