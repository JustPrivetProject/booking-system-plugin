import { autoLoginService } from '../services/autoLoginService';
import { QueueManagerAdapter } from '../services/queueManagerAdapter';
import { consoleLog, consoleError } from '../utils';
import { getStorage, setStorage } from '../utils/storage';
import { clearBadge } from '../utils/badge';

import { MessageHandler } from './handlers/MessageHandler';
import { RequestHandler } from './handlers/RequestHandler';
import { StorageHandler } from './handlers/StorageHandler';

export class BackgroundController {
    private messageHandler: MessageHandler;
    private requestHandler: RequestHandler;
    private storageHandler: StorageHandler;
    private queueManager: QueueManagerAdapter;

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
        // Basic settings
        await setStorage({ retryEnabled: true });
        await setStorage({ testEnv: false });
        await setStorage({ unauthorized: false });
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
            await setStorage({ notificationSettings: defaultNotificationSettings });
        }

        // Initialize table data if not exist
        const { tableData } = await getStorage('tableData');
        if (!tableData) {
            await setStorage({ tableData: [] });
        }

        // Initialize retry queue if not exist
        const { retryQueue } = await getStorage('retryQueue');
        if (!retryQueue) {
            await setStorage({ retryQueue: [] });
        }

        // Initialize group states if not exist
        const { groupStates } = await getStorage('groupStates');
        if (!groupStates) {
            await setStorage({ groupStates: {} });
        }

        // Initialize request cache if not exist
        const { requestCacheBody } = await getStorage('requestCacheBody');
        if (!requestCacheBody) {
            await setStorage({ requestCacheBody: {} });
        }

        const { requestCacheHeaders } = await getStorage('requestCacheHeaders');
        if (!requestCacheHeaders) {
            await setStorage({ requestCacheHeaders: {} });
        }
    }

    private async startQueueProcessing(): Promise<void> {
        await this.queueManager.startProcessing({
            intervalMin: 200,
            intervalMax: 500,
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
    }

    private handleInstallation(_details: chrome.runtime.InstalledDetails): void {
        consoleLog('Plugin installed!');
        clearBadge();

        // Welcome page is now handled by checkIfFreshInstall()
        // This method only handles installation-specific tasks

        // Migrate auto-login data to fix encoding issues
        autoLoginService.migrateAndCleanData().catch(error => {
            consoleError('[background] Failed to migrate auto-login data:', error);
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
