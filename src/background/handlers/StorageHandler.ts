import { QueueManagerAdapter } from '../../services/queueManagerAdapter'
import { Statuses } from '../../data'
import { consoleLog } from '../../utils'
import { onStorageChange } from '../../utils/storage'

export class StorageHandler {
    constructor(private queueManager: QueueManagerAdapter) {}

    setupStorageListener(): void {
        onStorageChange('unauthorized', async (newValue, oldValue) => {
            await this.handleUnauthorizedChange(newValue, oldValue)
        })
    }

    private async handleUnauthorizedChange(
        newValue: boolean,
        oldValue: boolean
    ): Promise<void> {
        consoleLog('[background] Change unauthorized:', oldValue, '→', newValue)

        if (oldValue === true && newValue === false) {
            await this.restoreQueueAfterAuth()
        }
    }

    private async restoreQueueAfterAuth(): Promise<void> {
        consoleLog('[background] Auth restored — starting queue restoration')

        const queue = await this.queueManager.getQueue()

        const authErrorItems = queue.filter(
            (item) => item.status === Statuses.AUTHORIZATION_ERROR
        )

        if (authErrorItems.length === 0) {
            consoleLog('[background] No entities with status auth_error')
            return
        }

        consoleLog(`[background] Restoring ${authErrorItems.length} entities`)

        for (const item of authErrorItems) {
            await this.queueManager.updateQueueItem(item.id, {
                status: Statuses.IN_PROGRESS,
            })
        }

        consoleLog('[background] All statuses updated to in-progress')
    }
}
