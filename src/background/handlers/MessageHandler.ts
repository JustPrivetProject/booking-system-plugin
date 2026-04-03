import { Actions, Statuses, Messages, TABLE_DATA_NAMES } from '../../data';
import { authService } from '../../services/authService';
import { autoLoginService } from '../../services/autoLoginService';
import { getDriverNameAndContainer } from '../../services/baltichub';
import { errorLogService } from '../../services/errorLogService';
import { featureAccessService } from '../../services/featureAccessService';
import type { FeatureKey } from '../../services/featureAccessService';
import type { QueueManagerAdapter } from '../../services/queueManagerAdapter';
import { sessionService } from '../../services/sessionService';
import type {
    RequestCacheHeaderBody,
    RequestCacheBodyObject,
    RetryObject,
    LocalStorageData,
    TableData,
} from '../../types/index';
import type { RequestCacheBodes, RequestCacheHeaders } from '../../types/baltichub';
import {
    consoleLog,
    consoleError,
    getLastProperty,
    normalizeFormData,
    getFirstFormDataString,
    getPropertyById,
    getLogsFromSession,
    clearLogsInSession,
    getLocalStorageData,
    consoleLogWithoutSave,
} from '../../utils';
import { getOrCreateDeviceId, getStorage, setStorage } from '../../utils/storage';
import { ContainerCheckerHandler, type ContainerCheckerMessage } from './ContainerCheckerHandler';
import { GctHandler, type GctMessage } from './GctHandler';

type SendResponse = (response?: unknown) => void;

interface BackgroundMessageData {
    id?: string;
    ids?: string[];
    status?: string;
    status_message?: string;
    description?: string | null;
    featureKey?: string;
}

interface HandlerMessage {
    action?: string;
    target?: string;
    data?: BackgroundMessageData;
    message?: unknown;
    type?: string;
}

interface CachedHeadersPayload {
    requestCacheHeaders?: RequestCacheHeaders;
}

interface RetryObjectContext {
    tableData?: TableData;
    retryQueue?: RetryObject[];
    requestCacheBody?: RequestCacheBodes;
}

interface AuthAttemptPayload {
    success?: boolean;
}

function getAuthAttemptPayload(message: HandlerMessage): AuthAttemptPayload {
    if (!message.message || typeof message.message !== 'object') {
        return {};
    }

    return message.message as AuthAttemptPayload;
}

function getTablePayload(message: HandlerMessage): TableData | null {
    return Array.isArray(message.message) ? (message.message as TableData) : null;
}

export class MessageHandler {
    private containerCheckerHandler: ContainerCheckerHandler;
    private gctHandler: GctHandler;

    constructor(private queueManager: QueueManagerAdapter) {
        this.containerCheckerHandler = new ContainerCheckerHandler();
        this.gctHandler = new GctHandler();
    }

    handleMessage(
        message: HandlerMessage,
        _sender: chrome.runtime.MessageSender,
        sendResponse: SendResponse,
    ): boolean {
        // Handle error and success booking actions
        if (message.action === Actions.SHOW_ERROR || message.action === Actions.SUCCEED_BOOKING) {
            this.handleBookingAction(message, sendResponse);
            return true;
        }

        // Handle table parsing
        if (message.action === Actions.PARSED_TABLE) {
            this.handleTableParsing(message, sendResponse);
            return true;
        }

        // Handle authentication actions
        if (message.action === Actions.IS_AUTHENTICATED) {
            this.handleAuthenticationCheck(sendResponse);
            return true;
        }

        if (message.action === Actions.GET_AUTH_STATUS) {
            this.handleAuthStatusCheck(sendResponse);
            return true;
        }

        if (message.action === Actions.LOGIN_SUCCESS) {
            this.handleLoginSuccess(message, sendResponse);
            return true;
        }

        if (message.action === Actions.AUTO_LOGIN_ATTEMPT) {
            this.handleAutoLoginAttempt(message, sendResponse);
            return true;
        }

        // Handle auto-login related actions
        if (message.action === Actions.LOAD_AUTO_LOGIN_CREDENTIALS) {
            this.handleLoadAutoLoginCredentials(sendResponse);
            return true;
        }

        if (message.action === Actions.IS_AUTO_LOGIN_ENABLED) {
            this.handleAutoLoginEnabledCheck(sendResponse);
            return true;
        }

        // Handle background-specific actions
        if (message.target === 'background') {
            return this.handleBackgroundActions(message, sendResponse);
        }

        // Handle Container Checker actions
        if (message.target === 'containerChecker') {
            return this.handleContainerCheckerActions(message, sendResponse);
        }

        if (message.target === 'gct') {
            return this.handleGctActions(message, sendResponse);
        }

        return true;
    }

    private async handleBookingAction(
        message: HandlerMessage,
        sendResponse: SendResponse,
    ): Promise<void> {
        consoleLog('Getting request from Cache...');

        try {
            const data = await getStorage('requestCacheHeaders');
            const user = await authService.getCurrentUser();

            if (!user) {
                consoleLog('User is not authenticated, cant add Container!');
                sendResponse({ success: true, error: 'Not authorized' });
                return;
            }

            if (data.requestCacheHeaders) {
                await this.processCachedRequest(
                    { requestCacheHeaders: data.requestCacheHeaders },
                    message,
                    sendResponse,
                );
            }
        } catch (error) {
            consoleError('Error in handleBookingAction:', error);
            sendResponse({
                success: false,
                error: 'Failed to process booking action',
            });
        }
    }

    private async processCachedRequest(
        data: CachedHeadersPayload,
        message: HandlerMessage,
        sendResponse: SendResponse,
    ): Promise<void> {
        // Use the same requestId for both headers and body to avoid mismatch
        // Get the last requestId (most recent) to match with getLastProperty
        const requestIds = Object.keys(data.requestCacheHeaders || {});

        if (requestIds.length === 0) {
            consoleLog('No requestId found in cache headers');
            sendResponse({ success: false, error: 'No cached request found' });
            return;
        }

        // Get the most recent requestId (last in object, which should be the most recent)
        const requestId = requestIds[requestIds.length - 1];

        // Get headers for the selected requestId
        const requestCacheHeaders: RequestCacheHeaderBody | null = getLastProperty(
            data.requestCacheHeaders || {},
        );

        // Validate that the cached request is not too old (more than 5 minutes)
        if (requestCacheHeaders) {
            const cacheAge = Date.now() - requestCacheHeaders.timestamp;
            const maxCacheAge = 5 * 60 * 1000; // 5 minutes

            if (cacheAge > maxCacheAge) {
                consoleLog(
                    '⚠️ Cached request is too old:',
                    `requestId=${requestId}`,
                    `Age=${Math.round(cacheAge / 1000)}s`,
                    `Max age=${maxCacheAge / 1000}s`,
                    `Will process anyway, but this might be stale`,
                );
            } else {
                consoleLog(
                    '✅ Cached request age is acceptable:',
                    `requestId=${requestId}`,
                    `Age=${Math.round(cacheAge / 1000)}s`,
                );
            }
        }

        consoleLog(
            '📦 Processing cached request:',
            `requestId=${requestId}`,
            `Total cached requests=${requestIds.length}`,
            `Cache headers keys=${requestIds.join(', ')}`,
            `Selected requestId=${requestId} (last in cache)`,
            `⚠️ IMPORTANT: Verifying this is the correct request`,
        );

        try {
            if (!requestCacheHeaders) {
                throw new Error('No cached request headers found');
            }

            const storageData = (await getStorage([
                'requestCacheBody',
                'retryQueue',
                'testEnv',
                'tableData',
            ])) as RetryObjectContext & { requestCacheBody?: RequestCacheBodes };

            const cachedBodyKeys = Object.keys(storageData.requestCacheBody || {});
            consoleLog(
                '📦 Cache state:',
                `requestId=${requestId}`,
                `Cached body keys=${cachedBodyKeys.join(', ')}`,
                `Total cached bodies=${cachedBodyKeys.length}`,
            );

            const cachedBodies: RequestCacheBodes =
                storageData.requestCacheBody ?? ({} as RequestCacheBodes);
            const requestCacheBody: RequestCacheBodyObject | null = getPropertyById(
                cachedBodies,
                requestId,
            );

            if (requestCacheBody) {
                const retryObject = await this.createRetryObject(
                    requestCacheBody,
                    requestCacheHeaders,
                    storageData as RetryObjectContext,
                    message.action,
                );

                await this.queueManager.addToQueue(retryObject);

                // Remove only the processed request from cache, not all
                await this.removeCachedRequest(requestId);

                consoleLog(
                    '✅ Successfully processed and removed from cache:',
                    `requestId=${requestId}`,
                );
            } else {
                consoleLog(
                    '⚠️ No data in cache object for requestId:',
                    requestId,
                    `Available body keys=${cachedBodyKeys.join(', ')}`,
                );
                // Remove the requestId from headers cache even if body is missing
                await this.removeCachedRequest(requestId);
            }

            sendResponse({ success: true });
        } catch (error) {
            consoleError('❌ Error in processCachedRequest:', error);
            // Try to clean up the failed request from cache
            try {
                await this.removeCachedRequest(requestId);
                consoleLog('🧹 Cleaned up failed request from cache:', requestId);
            } catch (cleanupError) {
                consoleError('❌ Error cleaning up failed request:', cleanupError);
            }
            sendResponse({
                success: false,
                error: 'Failed to process cached request',
            });
        }
    }

    /**
     * Removes a specific request from cache by requestId
     * Instead of clearing all cache, removes only the processed request
     */
    private async removeCachedRequest(requestId: string): Promise<void> {
        try {
            const [bodyData, headersData] = await Promise.all([
                getStorage('requestCacheBody'),
                getStorage('requestCacheHeaders'),
            ]);

            const cacheBody: RequestCacheBodes = bodyData.requestCacheBody ?? {};
            const cacheHeaders: RequestCacheHeaders = headersData.requestCacheHeaders ?? {};

            let removed = false;

            // Remove from body cache
            if (cacheBody[requestId]) {
                delete cacheBody[requestId];
                removed = true;
                consoleLog('🗑️ Removed from body cache:', requestId);
            }

            // Remove from headers cache
            if (cacheHeaders[requestId]) {
                delete cacheHeaders[requestId];
                removed = true;
                consoleLog('🗑️ Removed from headers cache:', requestId);
            }

            if (removed) {
                await Promise.all([
                    setStorage({ requestCacheBody: cacheBody }),
                    setStorage({ requestCacheHeaders: cacheHeaders }),
                ]);
                consoleLog(
                    '✅ Cache cleanup completed:',
                    `requestId=${requestId}`,
                    `Remaining body keys=${Object.keys(cacheBody).join(', ') || 'none'}`,
                    `Remaining header keys=${Object.keys(cacheHeaders).join(', ') || 'none'}`,
                );
            } else {
                consoleLog('ℹ️ Request not found in cache (already removed?):', requestId);
            }
        } catch (error) {
            consoleError('❌ Error removing cached request:', requestId, error);
        }
    }

    private async createRetryObject(
        requestCacheBody: RequestCacheBodyObject,
        requestCacheHeaders: RequestCacheHeaderBody,
        data: RetryObjectContext,
        action?: string,
    ): Promise<RetryObject> {
        const tableData = data.tableData;
        const retryObject: RetryObject = {
            ...requestCacheBody,
            id: crypto.randomUUID(),
            headersCache: requestCacheHeaders.headers,
            currentSlot: '',
            startSlot: '',
            endSlot: '',
            status: '',
            status_message: '',
            tvAppId: '',
        };

        const requestBody = normalizeFormData(requestCacheBody.body);
        const tvAppId = getFirstFormDataString(requestBody.formData?.TvAppId) || '';

        const driverAndContainer = (await getDriverNameAndContainer(
            tvAppId,
            data.retryQueue || [],
        )) || {
            driverName: '',
            containerNumber: '',
        };

        retryObject.headersCache = requestCacheHeaders.headers;
        retryObject.tvAppId = tvAppId;
        retryObject.startSlot = getFirstFormDataString(requestBody.formData?.SlotStart) || '';
        retryObject.endSlot = getFirstFormDataString(requestBody.formData?.SlotEnd) || '';
        retryObject.driverName = driverAndContainer.driverName || '';
        retryObject.containerNumber = driverAndContainer.containerNumber || '';

        const slotTypeFromForm = getFirstFormDataString(requestBody.formData?.SlotType);
        const parsedSlotType = Number(slotTypeFromForm);
        if (!Number.isNaN(parsedSlotType) && parsedSlotType > 0) {
            retryObject.slotType = parsedSlotType;
            consoleLog(
                '🎯 slotType set from cached formData.SlotType:',
                `tvAppId=${tvAppId}`,
                `slotType=${parsedSlotType}`,
            );
        }

        if (tableData) {
            let tableRow: TableData[number] | undefined;
            consoleLog('Getting table data...');
            const idIndex = tableData[0].indexOf(TABLE_DATA_NAMES.ID);
            if (idIndex >= 0) {
                tableRow = tableData.find((row: string[]) => row[idIndex].includes(tvAppId));
            }

            if (!tableRow && driverAndContainer.containerNumber) {
                consoleLog('TV App ID row not found, searching by container number...');
                const containerIndex = tableData[0].indexOf(TABLE_DATA_NAMES.CONTAINER_NUMBER);
                if (containerIndex >= 0) {
                    tableRow = tableData.find((row: string[]) =>
                        row[containerIndex].includes(driverAndContainer.containerNumber),
                    );
                }
            }

            if (!tableRow) {
                consoleLog('No matching table row found for tvAppId or container number:', tvAppId);
            }
            consoleLog('Row: ', tableRow);

            if (tableRow) {
                const currentSlot = `${tableRow[tableData[0].indexOf(TABLE_DATA_NAMES.SELECTED_DATE)]} ${tableRow[tableData[0].indexOf(TABLE_DATA_NAMES.START)]}`;
                consoleLog('Getting current slot time... :', currentSlot);
                if (currentSlot) {
                    retryObject.currentSlot = currentSlot;
                }

                const containerNumber =
                    tableRow[tableData[0].indexOf(TABLE_DATA_NAMES.CONTAINER_NUMBER)];
                if (containerNumber) {
                    retryObject.containerNumber = containerNumber;
                }

                // PUSTE status (empty container) requires type 4 for getSlots API.
                // Fallback only: prefer slotType derived from cached formData.SlotType above.
                if (retryObject.slotType === undefined) {
                    const statusIndex = tableData[0].indexOf(TABLE_DATA_NAMES.STATUS);
                    if (statusIndex >= 0 && tableRow[statusIndex]) {
                        const statusValue = String(tableRow[statusIndex]).toUpperCase().trim();
                        if (statusValue === 'PUSTE') {
                            retryObject.slotType = 4;
                            consoleLog(
                                '🎯 slotType fallback from table status:',
                                `tvAppId=${tvAppId}`,
                                `status=${statusValue}`,
                                'slotType=4',
                            );
                        }
                    }
                }
            }
        }

        switch (action) {
            case Actions.SHOW_ERROR:
                retryObject.status = Statuses.IN_PROGRESS;
                retryObject.status_message = Messages.IN_PROGRESS;
                break;
            case Actions.SUCCEED_BOOKING:
                retryObject.status = Statuses.SUCCESS;
                retryObject.status_message = Messages.SUCCESS;
                break;
            default:
                retryObject.status = Statuses.ERROR;
                retryObject.status_message = Messages.ERROR;
                break;
        }

        return retryObject;
    }

    private async handleTableParsing(
        message: HandlerMessage,
        sendResponse: SendResponse,
    ): Promise<void> {
        try {
            const tableData = getTablePayload(message);

            if (!tableData) {
                sendResponse({ success: false, error: 'Invalid table data payload' });
                return;
            }

            await setStorage({ tableData });
            consoleLog('Table saved in the storage', tableData);
            sendResponse({ success: true });
        } catch (error) {
            consoleError('Error saving table data:', error);
            sendResponse({ success: false, error: 'Failed to save table data' });
        }
    }

    private handleAuthenticationCheck(sendResponse: SendResponse): void {
        sessionService
            .isAuthenticated()
            .then(isAuth => {
                consoleLogWithoutSave('[BG] Responding isAuthenticated:', isAuth);
                sendResponse({ isAuthenticated: isAuth });
            })
            .catch(e => {
                consoleLog('[BG] Error in isAuthenticated:', e);
                sendResponse({ isAuthenticated: false });
            });
    }

    private handleAuthStatusCheck(sendResponse: SendResponse): void {
        getStorage('unauthorized')
            .then(({ unauthorized }) => {
                const isUnauthorized = !!unauthorized;
                sendResponse({ unauthorized: isUnauthorized });
            })
            .catch(error => {
                consoleError('[background] Error getting auth status:', error);
                sendResponse({ unauthorized: false });
            });
    }

    private async handleLoginSuccess(
        message: HandlerMessage,
        sendResponse: SendResponse,
    ): Promise<void> {
        const { success } = getAuthAttemptPayload(message);
        consoleLog('[background] LOGIN_SUCCESS:', success);

        if (success) {
            try {
                await setStorage({ unauthorized: false });
                consoleLog('[background] Manual login successful - Auth restored');
                sendResponse({ success: true });
            } catch (error) {
                consoleError('[background] Error setting unauthorized status:', error);
                sendResponse({
                    success: false,
                    error: 'Failed to update auth status',
                });
            }
        } else {
            consoleLog('[background] Manual login attempt (not yet successful)');
            sendResponse({ success: false });
        }
    }

    private async handleAutoLoginAttempt(
        message: HandlerMessage,
        sendResponse: SendResponse,
    ): Promise<void> {
        const { success } = getAuthAttemptPayload(message);

        if (success) {
            try {
                await setStorage({ unauthorized: false });
                consoleLog('[background] Auto-login successful - Auth restored');
                sendResponse({ success: true, autoLogin: true });
            } catch (error) {
                consoleError('[background] Error setting unauthorized status:', error);
                sendResponse({
                    success: false,
                    autoLogin: true,
                    error: 'Failed to update auth status',
                });
            }
        } else {
            consoleLog('[background] Auto-login attempt (not yet successful)');
            sendResponse({ success: false, autoLogin: true });
        }
    }

    private handleLoadAutoLoginCredentials(sendResponse: SendResponse): void {
        autoLoginService
            .loadCredentials()
            .then(credentials => {
                if (credentials) {
                    const isLoginValid =
                        typeof credentials.login === 'string' &&
                        credentials.login.length > 0 &&
                        !credentials.login.includes('□') &&
                        !credentials.login.includes('\\');

                    const isPasswordValid =
                        typeof credentials.password === 'string' && credentials.password.length > 0;

                    if (isLoginValid && isPasswordValid) {
                        consoleLog('[background] Auto-login credentials loaded');
                        sendResponse({
                            success: true,
                            credentials: {
                                login: credentials.login,
                                password: credentials.password,
                            },
                        });
                    } else {
                        consoleLog(
                            '[background] Detected corrupted auto-login credentials, clearing...',
                        );
                        autoLoginService.clearCredentials();
                        sendResponse({ success: false, credentials: null });
                    }
                } else {
                    consoleLog('[background] No auto-login credentials found');
                    sendResponse({ success: false, credentials: null });
                }
            })
            .catch(error => {
                consoleLog('[background] Error loading auto-login credentials:', error);
                autoLoginService.clearCredentials();
                sendResponse({ success: false, error: error.message });
            });
    }

    private handleAutoLoginEnabledCheck(sendResponse: SendResponse): void {
        autoLoginService.isEnabled().then(isEnabled => {
            sendResponse({ success: true, isEnabled });
        });
    }

    private handleBackgroundActions(message: HandlerMessage, sendResponse: SendResponse): boolean {
        const data = message.data || {};

        switch (message.action) {
            case Actions.REMOVE_REQUEST:
                if (!data.id) {
                    sendResponse({ success: false, error: 'Request id is required' });
                    return true;
                }

                this.queueManager
                    .removeFromQueue(data.id)
                    .then(() => sendResponse({ success: true }))
                    .catch(error => {
                        consoleError('Error removing request:', error);
                        sendResponse({ success: false, error: error.message });
                    });
                return true;

            case Actions.REMOVE_MULTIPLE_REQUESTS:
                if (!data.ids) {
                    sendResponse({ success: false, error: 'Request ids are required' });
                    return true;
                }

                this.queueManager
                    .removeMultipleFromQueue(data.ids)
                    .then(() => sendResponse({ success: true }))
                    .catch(error => {
                        consoleError('Error removing multiple requests:', error);
                        sendResponse({ success: false, error: error.message });
                    });
                return true;

            case Actions.UPDATE_REQUEST_STATUS:
                if (!data.id || !data.status || !data.status_message) {
                    sendResponse({ success: false, error: 'Status update payload is incomplete' });
                    return true;
                }

                this.queueManager
                    .updateQueueItem(data.id, {
                        status: data.status,
                        status_message: data.status_message,
                    })
                    .then(() => sendResponse({ success: true }))
                    .catch(error => {
                        consoleError('Error updating request status:', error);
                        sendResponse({ success: false, error: error.message });
                    });
                return true;

            case Actions.UPDATE_MULTIPLE_REQUESTS_STATUS:
                if (!data.ids || !data.status || !data.status_message) {
                    sendResponse({
                        success: false,
                        error: 'Bulk status update payload is incomplete',
                    });
                    return true;
                }

                this.queueManager
                    .updateMultipleQueueItems(data.ids, {
                        status: data.status,
                        status_message: data.status_message,
                    })
                    .then(() => sendResponse({ success: true }))
                    .catch(error => {
                        consoleError('Error updating multiple requests status:', error);
                        sendResponse({ success: false, error: error.message });
                    });
                return true;

            case Actions.SEND_LOGS:
                this.handleSendLogs(message, sendResponse);
                return true;

            case Actions.GET_FEATURE_ACCESS:
                if (!data.featureKey) {
                    sendResponse({
                        success: false,
                        enabled: false,
                        error: 'Feature key is required',
                    });
                    return true;
                }

                featureAccessService
                    .isFeatureEnabled(data.featureKey as FeatureKey)
                    .then(enabled => sendResponse({ success: true, enabled }))
                    .catch(error => {
                        consoleError('Error getting feature access:', error);
                        sendResponse({
                            success: false,
                            enabled: false,
                            error: error instanceof Error ? error.message : String(error),
                        });
                    });
                return true;

            default:
                consoleLog('Unknown action:', message.action);
                sendResponse({ success: false });
                return true;
        }
    }

    private handleContainerCheckerActions(
        message: HandlerMessage,
        sendResponse: SendResponse,
    ): boolean {
        this.containerCheckerHandler
            .handleMessage(message as ContainerCheckerMessage)
            .then(result => sendResponse({ ok: true, result }))
            .catch(error =>
                sendResponse({
                    ok: false,
                    error: (error as Error)?.message || String(error),
                }),
            );
        return true;
    }

    private handleGctActions(message: HandlerMessage, sendResponse: SendResponse): boolean {
        this.gctHandler
            .handleMessage(message as GctMessage)
            .then(result => sendResponse({ ok: true, result }))
            .catch(error =>
                sendResponse({
                    ok: false,
                    error: (error as Error)?.message || String(error),
                }),
            );
        return true;
    }

    private async handleSendLogs(
        message: HandlerMessage,
        sendResponse: SendResponse,
    ): Promise<void> {
        const user = await authService.getCurrentUser();

        if (!user) {
            consoleLog('User is not authenticated, cant sent Logs');
            sendResponse({
                success: true,
                error: 'Not authorized',
            });
            return;
        }

        try {
            consoleLog('Sending logs to Supabase...');
            let localData: LocalStorageData | null = null;
            if (process.env.NODE_ENV === 'development') {
                localData = await getLocalStorageData();
            }
            const logs = await getLogsFromSession();

            let userId: string | null = null;
            const user = await authService.getCurrentUser();
            if (user && user.id) {
                userId = user.id;
            } else {
                userId = await getOrCreateDeviceId();
            }
            const description = message.data?.description || undefined;

            if (logs && logs.length > 0) {
                await errorLogService.sendLogs(logs, userId, description, localData || undefined);
                await clearLogsInSession();
            }
            sendResponse({ success: true });
        } catch (error) {
            consoleError(`${Actions.SEND_LOGS} error:`, error);
            const errorMsg =
                error instanceof Error && error.message ? error.message : String(error);
            sendResponse({ success: false, error: errorMsg });
        }
    }
}
