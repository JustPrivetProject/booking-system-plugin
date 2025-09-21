import { StorageHandler } from '../../../src/background/handlers/StorageHandler';
import { QueueManagerAdapter } from '../../../src/services/queueManagerAdapter';
import { Statuses } from '../../../src/data';
import { onStorageChange } from '../../../src/utils/storage';
import { consoleLog } from '../../../src/utils';

// Mock dependencies
jest.mock('../../../src/services/queueManagerAdapter');
jest.mock('../../../src/utils/storage');
jest.mock('../../../src/utils');
jest.mock('../../../src/services/supabaseClient', () => ({
    supabase: {
        auth: {
            getUser: jest.fn(),
            signInWithPassword: jest.fn(),
            signOut: jest.fn(),
        },
        from: jest.fn(() => ({
            select: jest.fn(),
            insert: jest.fn(),
            update: jest.fn(),
            eq: jest.fn(),
            single: jest.fn(),
        })),
    },
}));

const mockQueueManager = {
    getQueue: jest.fn(),
    updateQueueItem: jest.fn(),
};

describe('StorageHandler', () => {
    let storageHandler: StorageHandler;

    beforeEach(() => {
        jest.clearAllMocks();
        storageHandler = new StorageHandler(mockQueueManager as any);
    });

    describe('setupStorageListener', () => {
        it('should setup storage change listener', () => {
            storageHandler.setupStorageListener();

            expect(onStorageChange).toHaveBeenCalledWith('unauthorized', expect.any(Function));
        });
    });

    describe('handleUnauthorizedChange', () => {
        it('should restore queue when auth is restored', async () => {
            const newValue = false;
            const oldValue = true;

            const mockQueue = [
                {
                    id: 'item-1',
                    status: Statuses.AUTHORIZATION_ERROR,
                    status_message: 'Auth error',
                },
                {
                    id: 'item-2',
                    status: Statuses.IN_PROGRESS,
                    status_message: 'In progress',
                },
                {
                    id: 'item-3',
                    status: Statuses.AUTHORIZATION_ERROR,
                    status_message: 'Auth error',
                },
            ];

            mockQueueManager.getQueue.mockResolvedValue(mockQueue);
            mockQueueManager.updateQueueItem.mockResolvedValue(undefined);

            await storageHandler['handleUnauthorizedChange'](newValue, oldValue);

            expect(consoleLog).toHaveBeenCalledWith(
                '[background] Change unauthorized:',
                true,
                '→',
                false,
            );
            expect(consoleLog).toHaveBeenCalledWith(
                '[background] Auth restored — starting queue restoration',
            );
            expect(mockQueueManager.getQueue).toHaveBeenCalled();
            expect(mockQueueManager.updateQueueItem).toHaveBeenCalledTimes(2);
            expect(mockQueueManager.updateQueueItem).toHaveBeenCalledWith('item-1', {
                status: Statuses.IN_PROGRESS,
            });
            expect(mockQueueManager.updateQueueItem).toHaveBeenCalledWith('item-3', {
                status: Statuses.IN_PROGRESS,
            });
            expect(consoleLog).toHaveBeenCalledWith(
                '[background] All statuses updated to in-progress',
            );
        });

        it('should not restore queue when auth is not restored', async () => {
            const newValue = true;
            const oldValue = false;

            await storageHandler['handleUnauthorizedChange'](newValue, oldValue);

            expect(consoleLog).toHaveBeenCalledWith(
                '[background] Change unauthorized:',
                false,
                '→',
                true,
            );
            expect(mockQueueManager.getQueue).not.toHaveBeenCalled();
            expect(mockQueueManager.updateQueueItem).not.toHaveBeenCalled();
        });

        it('should handle case when no auth error items exist', async () => {
            const newValue = false;
            const oldValue = true;

            const mockQueue = [
                {
                    id: 'item-1',
                    status: Statuses.IN_PROGRESS,
                    status_message: 'In progress',
                },
                {
                    id: 'item-2',
                    status: Statuses.SUCCESS,
                    status_message: 'Success',
                },
            ];

            mockQueueManager.getQueue.mockResolvedValue(mockQueue);

            await storageHandler['handleUnauthorizedChange'](newValue, oldValue);

            expect(consoleLog).toHaveBeenCalledWith(
                '[background] No entities with status auth_error',
            );
            expect(mockQueueManager.updateQueueItem).not.toHaveBeenCalled();
        });

        it('should handle empty queue', async () => {
            const newValue = false;
            const oldValue = true;

            mockQueueManager.getQueue.mockResolvedValue([]);

            await storageHandler['handleUnauthorizedChange'](newValue, oldValue);

            expect(consoleLog).toHaveBeenCalledWith(
                '[background] No entities with status auth_error',
            );
            expect(mockQueueManager.updateQueueItem).not.toHaveBeenCalled();
        });

        it('should handle queue manager errors gracefully', async () => {
            const newValue = false;
            const oldValue = true;

            mockQueueManager.getQueue.mockRejectedValue(new Error('Queue error'));

            await expect(
                storageHandler['handleUnauthorizedChange'](newValue, oldValue),
            ).rejects.toThrow('Queue error');

            expect(consoleLog).toHaveBeenCalledWith(
                '[background] Auth restored — starting queue restoration',
            );
            expect(mockQueueManager.getQueue).toHaveBeenCalled();
        });

        it('should handle update queue item errors gracefully', async () => {
            const newValue = false;
            const oldValue = true;

            const mockQueue = [
                {
                    id: 'item-1',
                    status: Statuses.AUTHORIZATION_ERROR,
                    status_message: 'Auth error',
                },
            ];

            mockQueueManager.getQueue.mockResolvedValue(mockQueue);
            mockQueueManager.updateQueueItem.mockRejectedValue(new Error('Update error'));

            await expect(
                storageHandler['handleUnauthorizedChange'](newValue, oldValue),
            ).rejects.toThrow('Update error');

            expect(mockQueueManager.updateQueueItem).toHaveBeenCalled();
        });
    });

    describe('restoreQueueAfterAuth', () => {
        it('should restore all auth error items to in-progress', async () => {
            const mockQueue = [
                {
                    id: 'item-1',
                    status: Statuses.AUTHORIZATION_ERROR,
                    status_message: 'Auth error',
                },
                {
                    id: 'item-2',
                    status: Statuses.IN_PROGRESS,
                    status_message: 'In progress',
                },
                {
                    id: 'item-3',
                    status: Statuses.AUTHORIZATION_ERROR,
                    status_message: 'Auth error',
                },
            ];

            mockQueueManager.getQueue.mockResolvedValue(mockQueue);
            mockQueueManager.updateQueueItem.mockResolvedValue(undefined);

            await storageHandler['restoreQueueAfterAuth']();

            expect(consoleLog).toHaveBeenCalledWith(
                '[background] Auth restored — starting queue restoration',
            );
            expect(mockQueueManager.getQueue).toHaveBeenCalled();
            expect(consoleLog).toHaveBeenCalledWith('[background] Restoring 2 entities');
            expect(mockQueueManager.updateQueueItem).toHaveBeenCalledTimes(2);
            expect(mockQueueManager.updateQueueItem).toHaveBeenCalledWith('item-1', {
                status: Statuses.IN_PROGRESS,
            });
            expect(mockQueueManager.updateQueueItem).toHaveBeenCalledWith('item-3', {
                status: Statuses.IN_PROGRESS,
            });
            expect(consoleLog).toHaveBeenCalledWith(
                '[background] All statuses updated to in-progress',
            );
        });

        it('should handle no auth error items', async () => {
            const mockQueue = [
                {
                    id: 'item-1',
                    status: Statuses.IN_PROGRESS,
                    status_message: 'In progress',
                },
                {
                    id: 'item-2',
                    status: Statuses.SUCCESS,
                    status_message: 'Success',
                },
            ];

            mockQueueManager.getQueue.mockResolvedValue(mockQueue);

            await storageHandler['restoreQueueAfterAuth']();

            expect(consoleLog).toHaveBeenCalledWith(
                '[background] No entities with status auth_error',
            );
            expect(mockQueueManager.updateQueueItem).not.toHaveBeenCalled();
        });

        it('should handle empty queue', async () => {
            mockQueueManager.getQueue.mockResolvedValue([]);

            await storageHandler['restoreQueueAfterAuth']();

            expect(consoleLog).toHaveBeenCalledWith(
                '[background] No entities with status auth_error',
            );
            expect(mockQueueManager.updateQueueItem).not.toHaveBeenCalled();
        });

        it('should handle queue manager errors', async () => {
            mockQueueManager.getQueue.mockRejectedValue(new Error('Queue error'));

            await expect(storageHandler['restoreQueueAfterAuth']()).rejects.toThrow('Queue error');
        });

        it('should handle update errors gracefully', async () => {
            const mockQueue = [
                {
                    id: 'item-1',
                    status: Statuses.AUTHORIZATION_ERROR,
                    status_message: 'Auth error',
                },
            ];

            mockQueueManager.getQueue.mockResolvedValue(mockQueue);
            mockQueueManager.updateQueueItem.mockRejectedValue(new Error('Update error'));

            await expect(storageHandler['restoreQueueAfterAuth']()).rejects.toThrow('Update error');

            expect(mockQueueManager.updateQueueItem).toHaveBeenCalled();
        });
    });

    describe('integration', () => {
        it('should handle complete auth restoration flow', async () => {
            // Setup storage listener
            storageHandler.setupStorageListener();

            // Simulate auth restoration
            const newValue = false;
            const oldValue = true;

            const mockQueue = [
                {
                    id: 'item-1',
                    status: Statuses.AUTHORIZATION_ERROR,
                    status_message: 'Auth error',
                },
            ];

            mockQueueManager.getQueue.mockResolvedValue(mockQueue);
            mockQueueManager.updateQueueItem.mockResolvedValue(undefined);

            // Get the callback function that was registered
            const storageCallback = (onStorageChange as jest.Mock).mock.calls[0][1];

            // Call the callback
            await storageCallback(newValue, oldValue);

            expect(consoleLog).toHaveBeenCalledWith(
                '[background] Change unauthorized:',
                true,
                '→',
                false,
            );
            expect(consoleLog).toHaveBeenCalledWith(
                '[background] Auth restored — starting queue restoration',
            );
            expect(mockQueueManager.getQueue).toHaveBeenCalled();
            expect(mockQueueManager.updateQueueItem).toHaveBeenCalledWith('item-1', {
                status: Statuses.IN_PROGRESS,
            });
        });
    });
});
