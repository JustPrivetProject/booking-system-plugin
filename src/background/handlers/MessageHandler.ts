import { Actions, Statuses, Messages, TABLE_DATA_NAMES } from '../../data';
import { authService } from '../../services/authService';
import { autoLoginService } from '../../services/autoLoginService';
import { getDriverNameAndContainer } from '../../services/baltichub';
import { errorLogService } from '../../services/errorLogService';
import { featureAccessService } from '../../services/featureAccessService';
import type { FeatureKey } from '../../services/featureAccessService';
import { isFeatureKey } from '../../services/featureAccessService';
import { QueueManagerAdapter } from '../../services/queueManagerAdapter';
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
    BOOKING_TERMINALS,
    getBookingTerminalFromUrl,
    isBookingTerminal,
    type BookingTerminal,
} from '../../types/terminal';
import {
    consoleLog,
    consoleError,
    consoleLogWithContext,
    consoleErrorWithContext,
    normalizeFormData,
    getFirstFormDataString,
    getLogsFromSession,
    clearLogsInSession,
    getLocalStorageData,
    consoleLogWithoutSave,
} from '../../utils';
import {
    getOrCreateDeviceId,
    getStorage,
    getTerminalStorageKey,
    setStorage,
    TERMINAL_STORAGE_NAMESPACES,
} from '../../utils/storage';
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
    terminal?: string;
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

const REQUEST_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const EXTENSION_URL_PROTOCOLS = ['chrome-extension://', 'moz-extension://'] as const;

const TERMINAL_TABLE_COLUMN_ALIASES: Record<
    BookingTerminal,
    {
        id: string[];
        selectedDate: string[];
        start: string[];
        containerNumber: string[];
        status: string[];
    }
> = {
    [BOOKING_TERMINALS.DCT]: {
        id: [TABLE_DATA_NAMES.ID],
        selectedDate: [TABLE_DATA_NAMES.SELECTED_DATE],
        start: [TABLE_DATA_NAMES.START],
        containerNumber: [TABLE_DATA_NAMES.CONTAINER_NUMBER],
        status: [TABLE_DATA_NAMES.STATUS],
    },
    [BOOKING_TERMINALS.BCT]: {
        id: [TABLE_DATA_NAMES.ID, 'Nr zadania'],
        selectedDate: [
            'Data rozpoczęcia okna',
            'Data wybranego przedziału czasowego',
            TABLE_DATA_NAMES.SELECTED_DATE,
        ],
        start: [TABLE_DATA_NAMES.START],
        containerNumber: [TABLE_DATA_NAMES.CONTAINER_NUMBER, 'Nr kont. / ERO/EDO'],
        status: [TABLE_DATA_NAMES.STATUS],
    },
};

function getAuthAttemptPayload(message: HandlerMessage): AuthAttemptPayload {
    if (!message.message || typeof message.message !== 'object') {
        return {};
    }

    return message.message as AuthAttemptPayload;
}

function getTablePayload(message: HandlerMessage): TableData | null {
    return Array.isArray(message.message) ? (message.message as TableData) : null;
}

function resolveBookingTerminal(value?: string): BookingTerminal {
    return isBookingTerminal(value) ? value : BOOKING_TERMINALS.DCT;
}

function tryResolveMessageTerminal(
    message: HandlerMessage,
    sender?: chrome.runtime.MessageSender,
): BookingTerminal | null {
    if (isBookingTerminal(message.data?.terminal)) {
        return message.data.terminal;
    }

    return getBookingTerminalFromUrl(sender?.url);
}

function resolveMessageTerminal(
    message: HandlerMessage,
    sender?: chrome.runtime.MessageSender,
): BookingTerminal {
    return tryResolveMessageTerminal(message, sender) || BOOKING_TERMINALS.DCT;
}

function isExtensionSenderUrl(url?: string): boolean {
    return !!url && EXTENSION_URL_PROTOCOLS.some(protocol => url.startsWith(protocol));
}

function resolveRequiredMessageTerminal(
    message: HandlerMessage,
    sender?: chrome.runtime.MessageSender,
): BookingTerminal | null {
    const resolvedTerminal = tryResolveMessageTerminal(message, sender);

    if (resolvedTerminal) {
        return resolvedTerminal;
    }

    if (!sender?.url || isExtensionSenderUrl(sender.url)) {
        return BOOKING_TERMINALS.DCT;
    }

    consoleErrorWithContext(
        getMessageHandlerLogContext(),
        'Unable to resolve booking terminal for message',
        {
            action: message.action,
            senderUrl: sender.url,
            messageTerminal: message.data?.terminal,
        },
    );

    return null;
}

function findTableColumnIndex(header: string[], candidates: string[]): number {
    for (const candidate of candidates) {
        const index = header.indexOf(candidate);
        if (index >= 0) {
            return index;
        }
    }

    return -1;
}

function getTableCellValue(
    header: string[],
    row: TableData[number],
    candidates: string[],
): string | undefined {
    const columnIndex = findTableColumnIndex(header, candidates);

    if (columnIndex < 0 || columnIndex >= row.length) {
        return undefined;
    }

    const value = row[columnIndex];
    return typeof value === 'string' ? value : undefined;
}

function buildCurrentSlotValue(
    terminal: BookingTerminal,
    header: string[],
    row: TableData[number],
): string {
    const aliases = TERMINAL_TABLE_COLUMN_ALIASES[terminal];
    const selectedDate = getTableCellValue(header, row, aliases.selectedDate)?.trim();
    const start = getTableCellValue(header, row, aliases.start)?.trim();

    if (selectedDate && start) {
        return `${selectedDate} ${start}`;
    }

    if (selectedDate && /\d{1,2}:\d{2}/.test(selectedDate)) {
        return selectedDate;
    }

    return '';
}

function getRetryQueueStorageKey(terminal: BookingTerminal): string {
    return getTerminalStorageKey(TERMINAL_STORAGE_NAMESPACES.RETRY_QUEUE, terminal);
}

function getUnauthorizedStorageKey(terminal: BookingTerminal): string {
    return getTerminalStorageKey(TERMINAL_STORAGE_NAMESPACES.UNAUTHORIZED, terminal);
}

function getTableDataStorageKey(terminal: BookingTerminal): string {
    return terminal === BOOKING_TERMINALS.DCT ? 'tableData' : `tableData:${terminal}`;
}

function getRequestCacheBodyStorageKey(terminal: BookingTerminal): string {
    return getTerminalStorageKey(TERMINAL_STORAGE_NAMESPACES.REQUEST_CACHE_BODY, terminal);
}

function getRequestCacheHeadersStorageKey(terminal: BookingTerminal): string {
    return getTerminalStorageKey(TERMINAL_STORAGE_NAMESPACES.REQUEST_CACHE_HEADERS, terminal);
}

function getMessageHandlerLogContext(terminal?: BookingTerminal) {
    return {
        scope: 'background',
        terminal,
    };
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
        sender: chrome.runtime.MessageSender,
        sendResponse: SendResponse,
    ): boolean {
        // Handle error and success booking actions
        if (message.action === Actions.SHOW_ERROR || message.action === Actions.SUCCEED_BOOKING) {
            this.handleBookingAction(message, sender, sendResponse);
            return true;
        }

        // Handle table parsing
        if (message.action === Actions.PARSED_TABLE) {
            this.handleTableParsing(message, sender, sendResponse);
            return true;
        }

        // Handle authentication actions
        if (message.action === Actions.IS_AUTHENTICATED) {
            this.handleAuthenticationCheck(sendResponse);
            return true;
        }

        if (message.action === Actions.GET_AUTH_STATUS) {
            this.handleAuthStatusCheck(message, sender, sendResponse);
            return true;
        }

        if (message.action === Actions.LOGIN_SUCCESS) {
            this.handleLoginSuccess(message, sender, sendResponse);
            return true;
        }

        if (message.action === Actions.AUTO_LOGIN_ATTEMPT) {
            this.handleAutoLoginAttempt(message, sender, sendResponse);
            return true;
        }

        // Handle auto-login related actions
        if (message.action === Actions.LOAD_AUTO_LOGIN_CREDENTIALS) {
            this.handleLoadAutoLoginCredentials(message, sender, sendResponse);
            return true;
        }

        if (message.action === Actions.IS_AUTO_LOGIN_ENABLED) {
            this.handleAutoLoginEnabledCheck(message, sender, sendResponse);
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
        sender: chrome.runtime.MessageSender,
        sendResponse: SendResponse,
    ): Promise<void> {
        try {
            const terminal = resolveRequiredMessageTerminal(message, sender);
            if (!terminal) {
                sendResponse({ success: false, error: 'Unable to resolve booking terminal' });
                return;
            }
            consoleLogWithContext(
                getMessageHandlerLogContext(terminal),
                'Getting request from cache...',
            );
            const requestCacheHeadersKey = getRequestCacheHeadersStorageKey(terminal);
            const data = (await getStorage(requestCacheHeadersKey)) as Record<string, unknown>;
            const user = await authService.getCurrentUser();

            if (!user) {
                consoleLogWithContext(
                    getMessageHandlerLogContext(terminal),
                    'User is not authenticated, cannot add container',
                );
                sendResponse({ success: true, error: 'Not authorized' });
                return;
            }

            const requestCacheHeaders = data[requestCacheHeadersKey] as
                | RequestCacheHeaders
                | undefined;

            if (requestCacheHeaders) {
                await this.processCachedRequest(
                    { requestCacheHeaders },
                    message,
                    sendResponse,
                    terminal,
                );
            }
        } catch (error) {
            consoleErrorWithContext(
                getMessageHandlerLogContext(
                    resolveRequiredMessageTerminal(message, sender) || undefined,
                ),
                'Error in handleBookingAction:',
                error,
            );
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
        terminal: BookingTerminal = BOOKING_TERMINALS.DCT,
    ): Promise<void> {
        try {
            const requestCacheBodyKey = getRequestCacheBodyStorageKey(terminal);
            const retryQueueKey = getRetryQueueStorageKey(terminal);
            const tableDataKey = getTableDataStorageKey(terminal);
            const storageData = (await getStorage([
                requestCacheBodyKey,
                retryQueueKey,
                'testEnv',
                tableDataKey,
            ])) as Record<string, unknown> & RetryObjectContext;

            const retryQueue = (storageData[retryQueueKey] as RetryObject[] | undefined) || [];
            const tableData = (storageData[tableDataKey] as TableData | undefined) || undefined;
            const requestCacheBodyMap =
                (storageData[requestCacheBodyKey] as RequestCacheBodes | undefined) ||
                ({} as RequestCacheBodes);
            const requestCacheHeadersMap = data.requestCacheHeaders || {};

            const staleRequestIds = this.getExpiredCachedRequestIds(
                requestCacheHeadersMap,
                requestCacheBodyMap,
            );

            if (staleRequestIds.length > 0) {
                await this.removeCachedRequests(staleRequestIds, terminal);
            }

            const latestRequest = this.selectLatestCachedRequest(
                requestCacheHeadersMap,
                requestCacheBodyMap,
            );

            if (!latestRequest) {
                consoleLogWithContext(
                    getMessageHandlerLogContext(terminal),
                    'No matching cached request found after cache cleanup',
                );
                sendResponse({ success: false, error: 'No cached request found' });
                return;
            }

            const { requestId, requestCacheBody, requestCacheHeaders } = latestRequest;

            if (requestCacheBody) {
                const retryObject = await this.createRetryObject(
                    requestCacheBody,
                    requestCacheHeaders,
                    {
                        ...storageData,
                        tableData,
                        requestCacheBody: requestCacheBodyMap,
                        retryQueue,
                    } as RetryObjectContext,
                    message.action,
                    terminal,
                );

                await this.getQueueManagerForTerminal(terminal).addToQueue(retryObject);

                // Remove only the processed request from cache, not all
                await this.removeCachedRequest(requestId, terminal);

                consoleLogWithContext(
                    getMessageHandlerLogContext(terminal),
                    '✅ Successfully processed and removed from cache:',
                    `requestId=${requestId}`,
                );
            } else {
                const cachedBodyKeys = Object.keys(requestCacheBodyMap);
                consoleLogWithContext(
                    getMessageHandlerLogContext(terminal),
                    '⚠️ No data in cache object for requestId:',
                    requestId,
                    `Available body keys=${cachedBodyKeys.join(', ')}`,
                );
                // Remove the requestId from headers cache even if body is missing
                await this.removeCachedRequest(requestId, terminal);
            }

            sendResponse({ success: true });
        } catch (error) {
            consoleErrorWithContext(
                getMessageHandlerLogContext(terminal),
                '❌ Error in processCachedRequest:',
                error,
            );
            // Try to clean up the failed request from cache
            try {
                const requestIds = Object.keys(data.requestCacheHeaders || {});
                if (requestIds.length > 0) {
                    await this.removeCachedRequest(requestIds[requestIds.length - 1], terminal);
                    consoleLogWithContext(
                        getMessageHandlerLogContext(terminal),
                        '🧹 Cleaned up failed request from cache:',
                        requestIds[requestIds.length - 1],
                    );
                }
            } catch (cleanupError) {
                consoleErrorWithContext(
                    getMessageHandlerLogContext(terminal),
                    '❌ Error cleaning up failed request:',
                    cleanupError,
                );
            }
            sendResponse({
                success: false,
                error: 'Failed to process cached request',
            });
        }
    }

    private getExpiredCachedRequestIds(
        requestCacheHeaders: RequestCacheHeaders,
        requestCacheBodyMap: RequestCacheBodes,
    ): string[] {
        const now = Date.now();
        const requestIds = new Set([
            ...Object.keys(requestCacheHeaders),
            ...Object.keys(requestCacheBodyMap),
        ]);

        return Array.from(requestIds).filter(requestId => {
            const headerTimestamp = requestCacheHeaders[requestId]?.timestamp ?? 0;
            const bodyTimestamp = requestCacheBodyMap[requestId]?.timestamp ?? 0;
            const latestTimestamp = Math.max(headerTimestamp, bodyTimestamp);

            return latestTimestamp > 0 && now - latestTimestamp > REQUEST_CACHE_MAX_AGE_MS;
        });
    }

    private selectLatestCachedRequest(
        requestCacheHeaders: RequestCacheHeaders,
        requestCacheBodyMap: RequestCacheBodes,
    ): {
        requestId: string;
        requestCacheHeaders: RequestCacheHeaderBody;
        requestCacheBody: RequestCacheBodyObject;
    } | null {
        const requestIds = Object.keys(requestCacheHeaders)
            .filter(requestId => Boolean(requestCacheBodyMap[requestId]))
            .sort((left, right) => {
                const leftTimestamp = Math.max(
                    requestCacheHeaders[left]?.timestamp ?? 0,
                    requestCacheBodyMap[left]?.timestamp ?? 0,
                );
                const rightTimestamp = Math.max(
                    requestCacheHeaders[right]?.timestamp ?? 0,
                    requestCacheBodyMap[right]?.timestamp ?? 0,
                );

                return rightTimestamp - leftTimestamp;
            });

        const requestId = requestIds[0];

        if (!requestId) {
            return null;
        }

        const requestCacheHeadersEntry = requestCacheHeaders[requestId];
        const requestCacheBodyEntry = requestCacheBodyMap[requestId];

        if (!requestCacheHeadersEntry || !requestCacheBodyEntry) {
            return null;
        }

        return {
            requestId,
            requestCacheHeaders: requestCacheHeadersEntry,
            requestCacheBody: requestCacheBodyEntry,
        };
    }

    private async removeCachedRequests(
        requestIds: string[],
        terminal: BookingTerminal = BOOKING_TERMINALS.DCT,
    ): Promise<void> {
        await Promise.all(
            requestIds.map(requestId => this.removeCachedRequest(requestId, terminal)),
        );
    }

    /**
     * Removes a specific request from cache by requestId
     * Instead of clearing all cache, removes only the processed request
     */
    private async removeCachedRequest(
        requestId: string,
        terminal: BookingTerminal = BOOKING_TERMINALS.DCT,
    ): Promise<void> {
        try {
            const requestCacheBodyKey = getRequestCacheBodyStorageKey(terminal);
            const requestCacheHeadersKey = getRequestCacheHeadersStorageKey(terminal);
            const [bodyData, headersData] = await Promise.all([
                getStorage(requestCacheBodyKey),
                getStorage(requestCacheHeadersKey),
            ]);

            const cacheBody: RequestCacheBodes =
                ((bodyData as Record<string, unknown>)[requestCacheBodyKey] as RequestCacheBodes) ||
                {};
            const cacheHeaders: RequestCacheHeaders =
                ((headersData as Record<string, unknown>)[
                    requestCacheHeadersKey
                ] as RequestCacheHeaders) || {};

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
                    setStorage({ [requestCacheBodyKey]: cacheBody }),
                    setStorage({ [requestCacheHeadersKey]: cacheHeaders }),
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
        terminal: BookingTerminal = BOOKING_TERMINALS.DCT,
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
            terminal,
            tvAppId: '',
        };

        const requestBody = normalizeFormData(requestCacheBody.body);
        const tvAppId = getFirstFormDataString(requestBody.formData?.TvAppId) || '';

        const driverAndContainer = (await getDriverNameAndContainer(
            tvAppId,
            data.retryQueue || [],
            terminal,
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
            const header = tableData[0] || [];
            const columnAliases = TERMINAL_TABLE_COLUMN_ALIASES[terminal];
            let tableRow: TableData[number] | undefined;
            consoleLog('Getting table data...');
            const idIndex = findTableColumnIndex(header, columnAliases.id);
            if (idIndex >= 0) {
                tableRow = tableData.find((row: string[]) => row[idIndex].includes(tvAppId));
            }

            if (!tableRow && driverAndContainer.containerNumber) {
                consoleLog('TV App ID row not found, searching by container number...');
                const containerIndex = findTableColumnIndex(header, columnAliases.containerNumber);
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
                const currentSlot = buildCurrentSlotValue(terminal, header, tableRow);
                consoleLog('Getting current slot time... :', currentSlot);
                if (currentSlot) {
                    retryObject.currentSlot = currentSlot;
                }

                const containerNumber = getTableCellValue(
                    header,
                    tableRow,
                    columnAliases.containerNumber,
                );
                if (containerNumber) {
                    retryObject.containerNumber = containerNumber;
                }

                // PUSTE status (empty container) requires type 4 for getSlots API.
                // Fallback only: prefer slotType derived from cached formData.SlotType above.
                if (retryObject.slotType === undefined) {
                    const statusValue = getTableCellValue(header, tableRow, columnAliases.status)
                        ?.toUpperCase()
                        .trim();
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
        sender: chrome.runtime.MessageSender,
        sendResponse: SendResponse,
    ): Promise<void> {
        try {
            const tableData = getTablePayload(message);
            const terminal = resolveRequiredMessageTerminal(message, sender);

            if (!tableData) {
                sendResponse({ success: false, error: 'Invalid table data payload' });
                return;
            }

            if (!terminal) {
                sendResponse({ success: false, error: 'Unable to resolve booking terminal' });
                return;
            }

            await setStorage({ [getTableDataStorageKey(terminal)]: tableData });
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

    private handleAuthStatusCheck(
        message: HandlerMessage,
        sender: chrome.runtime.MessageSender,
        sendResponse: SendResponse,
    ): void {
        const terminal = resolveMessageTerminal(message, sender);
        const unauthorizedKey = getUnauthorizedStorageKey(terminal);

        getStorage(unauthorizedKey)
            .then(data => {
                const isUnauthorized = !!(data as Record<string, unknown>)[unauthorizedKey];
                sendResponse({ unauthorized: isUnauthorized });
            })
            .catch(error => {
                consoleError('[background] Error getting auth status:', error);
                sendResponse({ unauthorized: false });
            });
    }

    private async handleLoginSuccess(
        message: HandlerMessage,
        sender: chrome.runtime.MessageSender,
        sendResponse: SendResponse,
    ): Promise<void> {
        const { success } = getAuthAttemptPayload(message);
        const terminal = resolveMessageTerminal(message, sender);
        const unauthorizedKey = getUnauthorizedStorageKey(terminal);
        consoleLog('[background] LOGIN_SUCCESS:', success);

        if (success) {
            try {
                await setStorage({ [unauthorizedKey]: false });
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
        sender: chrome.runtime.MessageSender,
        sendResponse: SendResponse,
    ): Promise<void> {
        const { success } = getAuthAttemptPayload(message);
        const terminal = resolveMessageTerminal(message, sender);
        const unauthorizedKey = getUnauthorizedStorageKey(terminal);

        if (success) {
            try {
                await setStorage({ [unauthorizedKey]: false });
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

    private handleLoadAutoLoginCredentials(
        message: HandlerMessage,
        sender: chrome.runtime.MessageSender,
        sendResponse: SendResponse,
    ): void {
        const terminal = resolveMessageTerminal(message, sender);

        autoLoginService
            .loadCredentials(terminal)
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
                        autoLoginService.clearCredentials(terminal);
                        sendResponse({ success: false, credentials: null });
                    }
                } else {
                    consoleLog('[background] No auto-login credentials found');
                    sendResponse({ success: false, credentials: null });
                }
            })
            .catch(error => {
                consoleLog('[background] Error loading auto-login credentials:', error);
                autoLoginService.clearCredentials(terminal);
                sendResponse({ success: false, error: error.message });
            });
    }

    private handleAutoLoginEnabledCheck(
        message: HandlerMessage,
        sender: chrome.runtime.MessageSender,
        sendResponse: SendResponse,
    ): void {
        const terminal = resolveMessageTerminal(message, sender);

        autoLoginService.isEnabled(terminal).then(isEnabled => {
            sendResponse({ success: true, isEnabled });
        });
    }

    private handleBackgroundActions(message: HandlerMessage, sendResponse: SendResponse): boolean {
        const data = message.data || {};
        const queueManager = this.getQueueManagerForTerminal(resolveBookingTerminal(data.terminal));

        switch (message.action) {
            case Actions.REMOVE_REQUEST:
                if (!data.id) {
                    sendResponse({ success: false, error: 'Request id is required' });
                    return true;
                }

                queueManager
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

                queueManager
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

                queueManager
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

                queueManager
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

                if (!isFeatureKey(data.featureKey)) {
                    sendResponse({
                        success: false,
                        enabled: false,
                        error: 'Invalid feature key',
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

    private getQueueManagerForTerminal(terminal: BookingTerminal): QueueManagerAdapter {
        if (terminal === BOOKING_TERMINALS.DCT) {
            return this.queueManager;
        }

        return QueueManagerAdapter.getInstance(getRetryQueueStorageKey(terminal));
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
