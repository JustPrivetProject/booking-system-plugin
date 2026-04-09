import { autoLoginService } from '../services/autoLoginService';
import { QueueManagerAdapter } from '../services/queueManagerAdapter';
import { sessionService } from '../services/sessionService';
import { consoleLog, consoleError } from '../utils';
import {
    clearLegacyDctStorage,
    getStorage,
    getTerminalStorageKey,
    setStorage,
    TERMINAL_STORAGE_NAMESPACES,
} from '../utils/storage';
import { clearBadge, syncAuthenticationBadge } from '../utils/badge';
import { BOOKING_TERMINALS } from '../types/terminal';

import { MessageHandler } from './handlers/MessageHandler';
import { RequestHandler } from './handlers/RequestHandler';
import { StorageHandler } from './handlers/StorageHandler';
import { getContainerCheckerState } from '../containerChecker/storage';
import {
    updateContainerCheckerAlarm,
    runContainerCheckCycle,
} from '../services/containerChecker/containerCheckerService';
import {
    keepEbramaSessionAlive,
    getEbramaKeepAliveIntervalMs,
} from '../services/ebramaSessionService';
import { GCT_WATCHER_DEFAULTS } from '../gct/types';
import { getGctState } from '../gct/storage';
import { gctWatcherService } from '../services/gct/gctWatcherService';

const CONTAINER_CHECK_ALARM_NAME = 'container-check';
const EXTENSION_AUTH_BADGE_SYNC_INTERVAL_MS = 60000;

export class BackgroundController {
    private messageHandler: MessageHandler;
    private requestHandler: RequestHandler;
    private storageHandler: StorageHandler;
    private queueManager: QueueManagerAdapter;
    private keepAliveIntervalId: ReturnType<typeof setInterval> | null = null;
    private ebramaKeepAliveIntervalId: ReturnType<typeof setInterval> | null = null;
    private extensionAuthBadgeIntervalId: ReturnType<typeof setInterval> | null = null;

    constructor() {
        this.queueManager = QueueManagerAdapter.getInstance();
        this.messageHandler = new MessageHandler(this.queueManager);
        this.requestHandler = new RequestHandler();
        this.storageHandler = new StorageHandler(this.queueManager);
    }

    async initialize(): Promise<void> {
        consoleLog('Initializing Background Controller...');

        // Setup event listeners FIRST to catch installation events
        this.setupEventListeners();

        // Initialize settings
        await this.initializeSettings();

        // Setup keep-alive mechanism to prevent service worker from closing
        this.setupKeepAlive();
        this.setupEbramaSessionKeepAlive();
        this.setupExtensionAuthBadgeSync();

        // Start queue processing
        await this.startQueueProcessing();

        // Services initialized successfully
        consoleLog('Background Controller initialized successfully');
    }

    private async initializeSettings(): Promise<void> {
        // Initialize all default storage values
        await this.initializeDefaultStorageValues();
    }

    private async initializeDefaultStorageValues(): Promise<void> {
        await clearLegacyDctStorage();

        // Basic settings
        await setStorage({ retryEnabled: true });
        await setStorage({ testEnv: false });
        await setStorage({
            [getTerminalStorageKey(
                TERMINAL_STORAGE_NAMESPACES.UNAUTHORIZED,
                BOOKING_TERMINALS.DCT,
            )]: false,
            [getTerminalStorageKey(
                TERMINAL_STORAGE_NAMESPACES.UNAUTHORIZED,
                BOOKING_TERMINALS.BCT,
            )]: false,
        });
        await setStorage({ headerHidden: false });

        // Initialize notification settings if not exist
        const result = await getStorage('notificationSettings');
        const { notificationSettings } = result || {};
        if (!notificationSettings) {
            const defaultNotificationSettings = {
                email: {
                    enabled: false,
                    userEmail: '',
                    additionalEmails: [],
                },
                windows: {
                    enabled: true,
                },
                createdAt: Date.now(),
            };
            await setStorage({
                notificationSettings: defaultNotificationSettings,
            });
        }

        // Initialize table data if not exist
        const { tableData } = await getStorage('tableData');
        if (!tableData) {
            await setStorage({ tableData: [] });
        }

        const bctTableData = await getStorage('tableData:bct');
        if (!bctTableData['tableData:bct']) {
            await setStorage({ 'tableData:bct': [] });
        }

        const dctRetryQueueKey = getTerminalStorageKey(
            TERMINAL_STORAGE_NAMESPACES.RETRY_QUEUE,
            BOOKING_TERMINALS.DCT,
        );
        const bctRetryQueueKey = getTerminalStorageKey(
            TERMINAL_STORAGE_NAMESPACES.RETRY_QUEUE,
            BOOKING_TERMINALS.BCT,
        );
        const dctGroupStatesKey = getTerminalStorageKey(
            TERMINAL_STORAGE_NAMESPACES.GROUP_STATES,
            BOOKING_TERMINALS.DCT,
        );
        const bctGroupStatesKey = getTerminalStorageKey(
            TERMINAL_STORAGE_NAMESPACES.GROUP_STATES,
            BOOKING_TERMINALS.BCT,
        );
        const dctRequestCacheBodyKey = getTerminalStorageKey(
            TERMINAL_STORAGE_NAMESPACES.REQUEST_CACHE_BODY,
            BOOKING_TERMINALS.DCT,
        );
        const bctRequestCacheBodyKey = getTerminalStorageKey(
            TERMINAL_STORAGE_NAMESPACES.REQUEST_CACHE_BODY,
            BOOKING_TERMINALS.BCT,
        );
        const dctRequestCacheHeadersKey = getTerminalStorageKey(
            TERMINAL_STORAGE_NAMESPACES.REQUEST_CACHE_HEADERS,
            BOOKING_TERMINALS.DCT,
        );
        const bctRequestCacheHeadersKey = getTerminalStorageKey(
            TERMINAL_STORAGE_NAMESPACES.REQUEST_CACHE_HEADERS,
            BOOKING_TERMINALS.BCT,
        );

        const terminalState = await getStorage([
            dctRetryQueueKey,
            bctRetryQueueKey,
            dctGroupStatesKey,
            bctGroupStatesKey,
            dctRequestCacheBodyKey,
            bctRequestCacheBodyKey,
            dctRequestCacheHeadersKey,
            bctRequestCacheHeadersKey,
        ]);
        const terminalDefaults: Record<string, unknown> = {};

        if (terminalState[dctRetryQueueKey] === undefined) terminalDefaults[dctRetryQueueKey] = [];
        if (terminalState[bctRetryQueueKey] === undefined) terminalDefaults[bctRetryQueueKey] = [];
        if (terminalState[dctGroupStatesKey] === undefined)
            terminalDefaults[dctGroupStatesKey] = {};
        if (terminalState[bctGroupStatesKey] === undefined)
            terminalDefaults[bctGroupStatesKey] = {};
        if (terminalState[dctRequestCacheBodyKey] === undefined)
            terminalDefaults[dctRequestCacheBodyKey] = {};
        if (terminalState[bctRequestCacheBodyKey] === undefined)
            terminalDefaults[bctRequestCacheBodyKey] = {};
        if (terminalState[dctRequestCacheHeadersKey] === undefined)
            terminalDefaults[dctRequestCacheHeadersKey] = {};
        if (terminalState[bctRequestCacheHeadersKey] === undefined)
            terminalDefaults[bctRequestCacheHeadersKey] = {};

        if (Object.keys(terminalDefaults).length > 0) {
            await setStorage(terminalDefaults);
        }

        // Initialize Container Checker if not exist
        const { containerCheckerWatchlist } = await getStorage('containerCheckerWatchlist');
        if (containerCheckerWatchlist === undefined) {
            await setStorage({ containerCheckerWatchlist: [] });
        }
        const { containerCheckerSettings } = await getStorage('containerCheckerSettings');
        if (containerCheckerSettings === undefined) {
            await setStorage({
                containerCheckerSettings: { pollingMinutes: 10 },
            });
        }

        const { gctGroups } = await getStorage('gctGroups');
        if (gctGroups === undefined) {
            await setStorage({ gctGroups: [] });
        }

        const { gctSettings } = await getStorage('gctSettings');
        if (gctSettings === undefined) {
            await setStorage({
                gctSettings: { ...GCT_WATCHER_DEFAULTS },
            });
        }
    }

    private async startQueueProcessing(): Promise<void> {
        await this.queueManager.startProcessing({
            intervalMin: 500,
            intervalMax: 1500,
            retryEnabled: true,
        });
    }

    private setupEventListeners(): void {
        consoleLog('Setting up event listeners...');

        // Installation listener - only for migration, not for welcome page
        chrome.runtime.onInstalled.addListener(details => {
            consoleLog(`Installation event received: reason=${details.reason}`);
            this.handleInstallation(details);
        });

        // Check if this is a fresh install by checking storage
        this.checkIfFreshInstall();

        // Message listener
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            return this.messageHandler.handleMessage(message, sender, sendResponse);
        });

        // Web request listeners
        this.requestHandler.setupRequestListeners();

        // Storage change listener
        this.storageHandler.setupStorageListener();

        // Container Checker alarm listener
        chrome.alarms.onAlarm.addListener(alarm => {
            if (alarm.name === CONTAINER_CHECK_ALARM_NAME) {
                runContainerCheckCycle().catch(error => {
                    consoleError('[background] Container Check cycle failed:', error);
                });
            }
        });

        // Initialize Container Checker alarm
        this.initContainerChecker();
        this.initGctWatcher();
    }

    private async initContainerChecker(): Promise<void> {
        try {
            const state = await getContainerCheckerState();
            await updateContainerCheckerAlarm(state.settings.pollingMinutes);
        } catch (error) {
            consoleError('[background] Failed to init Container Checker:', error);
        }
    }

    private async initGctWatcher(): Promise<void> {
        try {
            await getGctState();
            await gctWatcherService.ensureSchedules();
        } catch (error) {
            consoleError('[background] Failed to init GCT watcher:', error);
        }
    }

    private setupKeepAlive(): void {
        // Use setInterval with Chrome API calls to reset idle timer
        // Chrome API calls (like chrome.runtime.getPlatformInfo) reset the service worker idle timer
        // This prevents service worker from being terminated during long-running requests
        // Ping every 20 seconds (less than service worker idle timeout of ~30 seconds)
        const keepAliveInterval = setInterval(() => {
            try {
                // Chrome API calls reset the idle timer - use lightweight APIs
                // chrome.runtime.getPlatformInfo is recommended as it's very lightweight
                chrome.runtime.getPlatformInfo(() => {
                    // API call completed - timer reset
                });
            } catch (error) {
                // Fallback to storage if runtime API fails
                getStorage('retryEnabled').catch(() => {
                    // Ignore errors - this is just a keep-alive ping
                });
            }
        }, 20000); // 20 seconds

        // Store interval ID for potential cleanup (though we want it to run forever)
        this.keepAliveIntervalId = keepAliveInterval;
    }

    private setupEbramaSessionKeepAlive(): void {
        const ebramaKeepAliveInterval = setInterval(() => {
            keepEbramaSessionAlive(BOOKING_TERMINALS.DCT).catch(error => {
                consoleError('[background] eBrama keepalive interval error for dct:', error);
            });

            keepEbramaSessionAlive(BOOKING_TERMINALS.BCT).catch(error => {
                consoleError('[background] eBrama keepalive interval error for bct:', error);
            });
        }, getEbramaKeepAliveIntervalMs());

        this.ebramaKeepAliveIntervalId = ebramaKeepAliveInterval;
    }

    private setupExtensionAuthBadgeSync(): void {
        const syncBadge = async () => {
            try {
                const isAuthenticated = await sessionService.isAuthenticated();
                await syncAuthenticationBadge(isAuthenticated);
            } catch (error) {
                consoleError('[background] Failed to sync extension auth badge:', error);
            }
        };

        syncBadge().catch(error => {
            consoleError('[background] Initial extension auth badge sync failed:', error);
        });

        const extensionAuthBadgeInterval = setInterval(() => {
            syncBadge().catch(error => {
                consoleError('[background] Extension auth badge interval error:', error);
            });
        }, EXTENSION_AUTH_BADGE_SYNC_INTERVAL_MS);

        this.extensionAuthBadgeIntervalId = extensionAuthBadgeInterval;
    }

    private handleInstallation(_details: chrome.runtime.InstalledDetails): void {
        consoleLog('Plugin installed!');
        clearBadge();

        // Welcome page is now handled by checkIfFreshInstall()
        // This method only handles installation-specific tasks

        // Initialize Container Checker alarm on install/update
        this.initContainerChecker().catch(error => {
            consoleError('[background] Failed to init Container Checker on install:', error);
        });
        this.initGctWatcher().catch(error => {
            consoleError('[background] Failed to init GCT watcher on install:', error);
        });

        // Migrate auto-login data to fix encoding issues
        autoLoginService.migrateAndCleanData(BOOKING_TERMINALS.DCT).catch(error => {
            consoleError('[background] Failed to migrate DCT auto-login data:', error);
        });
        autoLoginService.migrateAndCleanData(BOOKING_TERMINALS.BCT).catch(error => {
            consoleError('[background] Failed to migrate BCT auto-login data:', error);
        });
    }

    private async checkIfFreshInstall(): Promise<void> {
        try {
            const result = await getStorage('welcomeShown');
            // If welcomeShown is not set, show welcome page
            if (!result || result.welcomeShown === undefined) {
                consoleLog('Detected fresh install - welcome not shown yet');
                // Show welcome page for fresh installs
                const welcomeUrl = chrome.runtime.getURL('welcome.html');
                consoleLog(`Opening welcome page for fresh install: ${welcomeUrl}`);
                chrome.tabs.create({
                    url: welcomeUrl,
                });
                // Mark welcome as shown
                await setStorage({ welcomeShown: true });
            } else {
                consoleLog('Welcome already shown previously');
            }
        } catch (error) {
            consoleError('[background] Error checking fresh install:', error);
        }
    }
}
