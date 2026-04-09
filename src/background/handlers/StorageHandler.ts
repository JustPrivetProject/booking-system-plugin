import { Statuses } from '../../data';
import { QueueManagerAdapter } from '../../services/queueManagerAdapter';
import { syncAuthenticationBadge } from '../../utils/badge';
import { consoleLog } from '../../utils';
import {
    getTerminalStorageKey,
    onStorageChange,
    TERMINAL_STORAGE_NAMESPACES,
} from '../../utils/storage';
import { gctWatcherService } from '../../services/gct/gctWatcherService';
import { BOOKING_TERMINALS, type BookingTerminal } from '../../types/terminal';

export class StorageHandler {
    constructor(private queueManager: QueueManagerAdapter) {}

    setupStorageListener(): void {
        onStorageChange(
            getTerminalStorageKey(TERMINAL_STORAGE_NAMESPACES.UNAUTHORIZED, BOOKING_TERMINALS.DCT),
            async (newValue, oldValue) => {
                await this.handleUnauthorizedChange(
                    Boolean(newValue),
                    Boolean(oldValue),
                    BOOKING_TERMINALS.DCT,
                );
            },
        );

        onStorageChange(
            getTerminalStorageKey(TERMINAL_STORAGE_NAMESPACES.UNAUTHORIZED, BOOKING_TERMINALS.BCT),
            async (newValue, oldValue) => {
                await this.handleUnauthorizedChange(
                    Boolean(newValue),
                    Boolean(oldValue),
                    BOOKING_TERMINALS.BCT,
                );
            },
        );

        onStorageChange('user_session', async newValue => {
            await this.handleUserSessionChange(newValue);
        });
    }

    private async handleUnauthorizedChange(
        newValue: boolean,
        oldValue: boolean,
        terminal: BookingTerminal = BOOKING_TERMINALS.DCT,
    ): Promise<void> {
        const terminalLabel = terminal === BOOKING_TERMINALS.DCT ? '' : ` [${terminal}]`;
        consoleLog(`[background] Change unauthorized${terminalLabel}:`, oldValue, '→', newValue);

        if (oldValue === true && newValue === false) {
            await this.restoreQueueAfterAuth(terminal);
        }
    }

    private async handleUserSessionChange(newValue: unknown): Promise<void> {
        await syncAuthenticationBadge(Boolean(newValue));

        if (newValue) {
            await gctWatcherService.handleExtensionAuthRestored();
            return;
        }

        await gctWatcherService.stopAllForExtensionLogout();
    }

    private async restoreQueueAfterAuth(
        terminal: BookingTerminal = BOOKING_TERMINALS.DCT,
    ): Promise<void> {
        const terminalLabel = terminal === BOOKING_TERMINALS.DCT ? '' : ` [${terminal}]`;
        consoleLog(`[background] Auth restored${terminalLabel} — starting queue restoration`);

        const queueManager = this.getQueueManagerForTerminal(terminal);
        const queue = await queueManager.getQueue();

        const authErrorItems = queue.filter(item => item.status === Statuses.AUTHORIZATION_ERROR);

        if (authErrorItems.length === 0) {
            consoleLog('[background] No entities with status auth_error');
            return;
        }

        consoleLog(`[background] Restoring ${authErrorItems.length} entities`);

        for (const item of authErrorItems) {
            await queueManager.updateQueueItem(item.id, {
                status: Statuses.IN_PROGRESS,
            });
        }

        consoleLog('[background] All statuses updated to in-progress');
    }

    private getQueueManagerForTerminal(terminal: BookingTerminal): QueueManagerAdapter {
        return terminal === BOOKING_TERMINALS.DCT
            ? this.queueManager
            : QueueManagerAdapter.getInstance(
                  getTerminalStorageKey(TERMINAL_STORAGE_NAMESPACES.RETRY_QUEUE, terminal),
              );
    }
}
