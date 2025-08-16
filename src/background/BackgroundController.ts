import { autoLoginService } from '../services/autoLoginService';
import { QueueManagerAdapter } from '../services/queueManagerAdapter';
import { consoleLog } from '../utils';
import { setStorage } from '../utils/storage';

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

        // Initialize settings
        await this.initializeSettings();

        // Start queue processing
        await this.startQueueProcessing();

        // Setup event listeners
        this.setupEventListeners();

        // Services initialized successfully

        consoleLog('Background Controller initialized successfully');
    }

    private async initializeSettings(): Promise<void> {
        await setStorage({ retryEnabled: true });
        await setStorage({ testEnv: false });
    }

    private async startQueueProcessing(): Promise<void> {
        const { processRequest } = await import('../services/baltichub');

        await this.queueManager.startProcessing(processRequest, {
            intervalMin: 1000,
            intervalMax: 2000,
            retryEnabled: true,
        });
    }

    private setupEventListeners(): void {
        // Installation listener
        chrome.runtime.onInstalled.addListener(details => {
            this.handleInstallation(details);
        });

        // Message listener
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            return this.messageHandler.handleMessage(message, sender, sendResponse);
        });

        // Web request listeners
        this.requestHandler.setupRequestListeners();

        // Storage change listener
        this.storageHandler.setupStorageListener();
    }

    private handleInstallation(details: chrome.runtime.InstalledDetails): void {
        if (details.reason === 'install') {
            chrome.tabs.create({
                url: chrome.runtime.getURL('welcome.html'),
            });
        }

        // Migrate auto-login data to fix encoding issues
        autoLoginService.migrateAndCleanData().catch(error => {
            console.error('[background] Failed to migrate auto-login data:', error);
        });
    }
}
