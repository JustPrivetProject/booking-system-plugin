import { RetryObject } from '../types/baltichub'
import {
    generateUniqueId,
    consoleLog,
    consoleError,
    consoleLogWithoutSave,
} from '../utils/index'
import { clearBadge, updateBadge } from '../utils/badge'
import { authService } from '../services/authService'

class QueueManager {
    storageKey: string = 'retryQueue'
    static instance: QueueManager | null = null
    isProcessing: boolean = false
    updateQueue: Promise<void> = Promise.resolve()
    mutex: boolean = false

    constructor(storageKey = 'retryQueue') {
        if (QueueManager.instance) {
            return QueueManager.instance
        }

        this.storageKey = storageKey
        this.updateQueue = Promise.resolve()
        this.mutex = false
        QueueManager.instance = this
    }

    static getInstance(storageKey = 'retryQueue') {
        if (!QueueManager.instance) {
            QueueManager.instance = new QueueManager(storageKey)
        }
        return QueueManager.instance
    }

    // Safely add an item to the queue
    async addToQueue(newItem: RetryObject) {
        return this._synchronizedOperation(async () => {
            const result = (await chrome.storage.local.get(
                this.storageKey
            )) as { [key: string]: RetryObject[] }
            const queue = result[this.storageKey] || []
            const startSlot = newItem.startSlot
            const tvAppId = newItem.tvAppId
            const status = newItem.status

            if (status === 'success') {
                const hasSameTvAppId = queue.some(
                    (item) => item.tvAppId === tvAppId
                )
                if (!hasSameTvAppId) {
                    consoleLog(
                        `Item with status 'success' and new tvAppId ${tvAppId} not added to ${this.storageKey}`
                    )
                    return queue
                }
            }

            const isDuplicate = queue.some(
                (item) =>
                    item.tvAppId === tvAppId && item.startSlot === startSlot
            )

            if (isDuplicate) {
                consoleLog(
                    `Duplicate item with tvAppId ${tvAppId} and startSlot ${startSlot} not added to ${this.storageKey}`
                )
                return queue
            }

            // Add unique identifier if not present
            if (!newItem.id) {
                newItem.id = generateUniqueId()
            }

            queue.push(newItem)
            await chrome.storage.local.set({ [this.storageKey]: queue })
            consoleLog(`Item added to ${this.storageKey}:`, newItem)

            return queue
        })
    }

    // Safely remove an item from the queue
    async removeFromQueue(id: string) {
        return this._synchronizedOperation(async () => {
            const result = await chrome.storage.local.get([this.storageKey])
            let queue = result[this.storageKey] || []

            // Remove item
            queue = queue.filter((item) => item.id !== id)

            // Save updated queue
            await chrome.storage.local.set({ [this.storageKey]: queue })
            consoleLog(`Item removed from ${this.storageKey}. ID:`, id)

            return queue
        })
    }

    // Safely update an item in the queue
    async updateQueueItem(id: string, updateData: Partial<RetryObject>) {
        return this._synchronizedOperation(async () => {
            const result = await chrome.storage.local.get([this.storageKey])
            let queue = result[this.storageKey] || []

            // Find and update item
            const updatedQueue = queue.map((item) =>
                item.id === id ? { ...item, ...updateData } : item
            )

            // Save updated queue
            await chrome.storage.local.set({ [this.storageKey]: updatedQueue })
            consoleLog(`Item updated in ${this.storageKey}. ID:`, id)

            return updatedQueue
        })
    }

    // Get current queue
    async getQueue(): Promise<RetryObject[]> {
        const result = await chrome.storage.local.get([this.storageKey])
        return result[this.storageKey] || []
    }

    // Internal method to synchronize operations
    async _synchronizedOperation(operation) {
        while (this.mutex) {
            await new Promise((resolve) => setTimeout(resolve, 50))
        }

        // Set the lock
        this.mutex = true

        try {
            // Perform the operation
            const result = await operation()
            return result
        } catch (error) {
            consoleError(
                `Error in synchronized operation for ${this.storageKey}:`,
                error
            )
            throw error
        } finally {
            // Release the lock
            this.mutex = false
        }
    }

    async updateEntireQueue(newQueue: RetryObject[]) {
        return this._synchronizedOperation(async () => {
            await chrome.storage.local.set({ [this.storageKey]: newQueue })
            consoleLog(`Entire ${this.storageKey} updated`)
            return newQueue
        })
    }

    async startProcessing(
        processRequest,
        options = {
            intervalMin: 1000, // Minimum interval in milliseconds (1 seconds)
            intervalMax: 5000, // Maximum interval in milliseconds (5 seconds)
            retryEnabled: true,
        }
    ) {
        const { intervalMin, intervalMax, retryEnabled } = options

        if (this.isProcessing) {
            consoleLog('Processing is already running')
            return
        }

        this.isProcessing = true

        const processNextRequests = async () => {
            const randomInterval = Math.floor(
                Math.random() * (intervalMax - intervalMin + 1) + intervalMin
            )
            // Проверка авторизации пользователя
            const isAuthenticated = await authService.isAuthenticated()

            if (!retryEnabled) {
                this.isProcessing = false
                return
            }

            try {
                if (!isAuthenticated) {
                    consoleLogWithoutSave(
                        'User is not authenticated. Skipping this cycle.'
                    )
                    clearBadge()
                    setTimeout(processNextRequests, randomInterval)
                    return
                }

                const queue = await this.getQueue()

                updateBadge(queue.map((req) => req.status))
                // Filter requests in progress
                const inProgressRequests = queue.filter(
                    (req) => req.status === 'in-progress'
                )

                // Sequential processing
                for (const req of inProgressRequests) {
                    try {
                        consoleLogWithoutSave(`Processing request: ${req.id}`)

                        const updatedReq = await processRequest(req, queue)
                        if (updatedReq.status !== 'in-progress') {
                            await this.updateQueueItem(req.id, updatedReq)
                            consoleLog(
                                `Request ${req.id} processed successfully`,
                                updatedReq
                            )
                        }
                    } catch (error) {
                        consoleError(
                            `Error processing request ${req.id}:`,
                            error
                        )

                        // Update status in case of an error
                        await this.updateQueueItem(req.id, {
                            status: 'error',
                            status_message:
                                error instanceof Error
                                    ? error.message
                                    : 'Error on processing',
                        })
                    }
                }
            } catch (error) {
                consoleError('Error in queue processing:', error)
            }

            consoleLogWithoutSave(
                `Next processing cycle in ${randomInterval / 1000} seconds`
            )

            setTimeout(processNextRequests, randomInterval)
        }

        // Initial start
        processNextRequests()
    }
}

export default QueueManager
