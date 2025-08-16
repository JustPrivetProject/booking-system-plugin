import { consoleLog } from '../utils';
import { clearBadge } from '../utils/badge';

import { BackgroundController } from './BackgroundController';
export { MessageHandler } from './handlers/MessageHandler';
export { RequestHandler } from './handlers/RequestHandler';
export { StorageHandler } from './handlers/StorageHandler';

// Initialize the background controller
const backgroundController = new BackgroundController();

// Plugin installation handler
chrome.runtime.onInstalled.addListener(() => {
    consoleLog('Plugin installed!');
    clearBadge();
});

// Initialize the background controller
backgroundController.initialize().catch(error => {
    console.error('Failed to initialize background controller:', error);
});
