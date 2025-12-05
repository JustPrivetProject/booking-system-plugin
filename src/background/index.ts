import { consoleError } from '../utils';
import { BackgroundController } from './BackgroundController';
export { MessageHandler } from './handlers/MessageHandler';
export { RequestHandler } from './handlers/RequestHandler';
export { StorageHandler } from './handlers/StorageHandler';

// Initialize the background controller
const backgroundController = new BackgroundController();

// Installation handler is now managed by BackgroundController
backgroundController.initialize().catch(error => {
    consoleError('Failed to initialize background controller:', error);
});
