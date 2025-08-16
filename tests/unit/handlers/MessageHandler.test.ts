import { MessageHandler } from '../../../src/background/handlers/MessageHandler'
import { QueueManagerAdapter } from '../../../src/services/queueManagerAdapter'
import { Actions, Statuses } from '../../../src/data'
import { authService } from '../../../src/services/authService'
import { sessionService } from '../../../src/services/sessionService'
import { autoLoginService } from '../../../src/services/autoLoginService'
import { errorLogService } from '../../../src/services/errorLogService'

// Mock dependencies
jest.mock('../../../src/services/queueManagerAdapter')
jest.mock('../../../src/services/authService')
jest.mock('../../../src/services/sessionService')
jest.mock('../../../src/services/autoLoginService')
jest.mock('../../../src/services/errorLogService')
jest.mock('../../../src/utils/storage')
jest.mock('../../../src/utils')
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
}))

const mockQueueManager = {
    addToQueue: jest.fn(),
    removeFromQueue: jest.fn(),
    updateQueueItem: jest.fn(),
    getQueue: jest.fn(),
}

const mockSendResponse = jest.fn()

describe('MessageHandler', () => {
    let messageHandler: MessageHandler

    beforeEach(() => {
        jest.clearAllMocks()
        ;(QueueManagerAdapter.getInstance as jest.Mock).mockReturnValue(mockQueueManager)
        messageHandler = new MessageHandler(mockQueueManager as any)
    })

    describe('handleMessage', () => {
        it('should handle SHOW_ERROR action', async () => {
            const message = { action: Actions.SHOW_ERROR }
            const sender = {} as chrome.runtime.MessageSender

            // Mock storage data
            const mockStorageData = {
                requestCacheHeaders: {
                    'request-1': {
                        url: 'test-url',
                        headers: [{ name: 'test', value: 'test' }],
                        timestamp: Date.now(),
                    },
                },
            }

            // Mock auth service
            ;(authService.getCurrentUser as jest.Mock).mockResolvedValue({
                id: 'user-1',
                email: 'test@example.com',
            })

            // Mock storage
            const { getStorage } = require('../../../src/utils/storage')
            getStorage.mockResolvedValue(mockStorageData)

            const result = messageHandler.handleMessage(message, sender, mockSendResponse)

            expect(result).toBe(true)
            // Note: Due to async nature, we need to wait for the promise to resolve
            await new Promise(resolve => setTimeout(resolve, 0))
        })

        it('should handle SUCCEED_BOOKING action', async () => {
            const message = { action: Actions.SUCCEED_BOOKING }
            const sender = {} as chrome.runtime.MessageSender

            // Mock auth service
            ;(authService.getCurrentUser as jest.Mock).mockResolvedValue({
                id: 'user-1',
                email: 'test@example.com',
            })

            const result = messageHandler.handleMessage(message, sender, mockSendResponse)

            expect(result).toBe(true)
        })

        it('should handle PARSED_TABLE action', async () => {
            const message = { action: Actions.PARSED_TABLE, message: [['data']] }
            const sender = {} as chrome.runtime.MessageSender

            const { setStorage } = require('../../../src/utils/storage')
            setStorage.mockResolvedValue(undefined)

            const result = messageHandler.handleMessage(message, sender, mockSendResponse)

            expect(result).toBe(true)
            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 0))
            expect(mockSendResponse).toHaveBeenCalledWith({ success: true })
        })

        it('should handle IS_AUTHENTICATED action', () => {
            const message = { action: Actions.IS_AUTHENTICATED }
            const sender = {} as chrome.runtime.MessageSender

            ;(sessionService.isAuthenticated as jest.Mock).mockResolvedValue(true)

            const result = messageHandler.handleMessage(message, sender, mockSendResponse)

            expect(result).toBe(true)
        })

        it('should handle GET_AUTH_STATUS action', () => {
            const message = { action: Actions.GET_AUTH_STATUS }
            const sender = {} as chrome.runtime.MessageSender

            const { getStorage } = require('../../../src/utils/storage')
            getStorage.mockResolvedValue({ unauthorized: false })

            const result = messageHandler.handleMessage(message, sender, mockSendResponse)

            expect(result).toBe(true)
        })

        it('should handle LOGIN_SUCCESS action', () => {
            const message = { action: Actions.LOGIN_SUCCESS, message: { success: true } }
            const sender = {} as chrome.runtime.MessageSender

            const result = messageHandler.handleMessage(message, sender, mockSendResponse)

            expect(result).toBe(true)
        })

        it('should handle AUTO_LOGIN_ATTEMPT action', () => {
            const message = { action: Actions.AUTO_LOGIN_ATTEMPT, message: { success: true } }
            const sender = {} as chrome.runtime.MessageSender

            const result = messageHandler.handleMessage(message, sender, mockSendResponse)

            expect(result).toBe(true)
        })

        it('should handle LOAD_AUTO_LOGIN_CREDENTIALS action', () => {
            const message = { action: Actions.LOAD_AUTO_LOGIN_CREDENTIALS }
            const sender = {} as chrome.runtime.MessageSender

            ;(autoLoginService.loadCredentials as jest.Mock).mockResolvedValue({
                login: 'test@example.com',
                password: 'password123',
            })

            const result = messageHandler.handleMessage(message, sender, mockSendResponse)

            expect(result).toBe(true)
        })

        it('should handle IS_AUTO_LOGIN_ENABLED action', () => {
            const message = { action: Actions.IS_AUTO_LOGIN_ENABLED }
            const sender = {} as chrome.runtime.MessageSender

            ;(autoLoginService.isEnabled as jest.Mock).mockResolvedValue(true)

            const result = messageHandler.handleMessage(message, sender, mockSendResponse)

            expect(result).toBe(true)
        })

        describe('background target actions', () => {
            it('should handle REMOVE_REQUEST action', () => {
                const message = {
                    target: 'background',
                    action: Actions.REMOVE_REQUEST,
                    data: { id: 'request-1' },
                }
                const sender = {} as chrome.runtime.MessageSender

                mockQueueManager.removeFromQueue.mockResolvedValue(undefined)

                const result = messageHandler.handleMessage(message, sender, mockSendResponse)

                expect(result).toBe(true)
                expect(mockQueueManager.removeFromQueue).toHaveBeenCalledWith('request-1')
            })

            it('should handle UPDATE_REQUEST_STATUS action', () => {
                const message = {
                    target: 'background',
                    action: Actions.UPDATE_REQUEST_STATUS,
                    data: {
                        id: 'request-1',
                        status: Statuses.SUCCESS,
                        status_message: 'Success',
                    },
                }
                const sender = {} as chrome.runtime.MessageSender

                mockQueueManager.updateQueueItem.mockResolvedValue(undefined)

                const result = messageHandler.handleMessage(message, sender, mockSendResponse)

                expect(result).toBe(true)
                expect(mockQueueManager.updateQueueItem).toHaveBeenCalledWith('request-1', {
                    status: Statuses.SUCCESS,
                    status_message: 'Success',
                })
            })

            it('should handle SEND_LOGS action', () => {
                const message = {
                    target: 'background',
                    action: Actions.SEND_LOGS,
                    data: { description: 'Test logs' },
                }
                const sender = {} as chrome.runtime.MessageSender

                ;(authService.getCurrentUser as jest.Mock).mockResolvedValue({
                    id: 'user-1',
                    email: 'test@example.com',
                })

                const result = messageHandler.handleMessage(message, sender, mockSendResponse)

                expect(result).toBe(true)
            })

            it('should handle unknown action', () => {
                const message = {
                    target: 'background',
                    action: 'UNKNOWN_ACTION',
                }
                const sender = {} as chrome.runtime.MessageSender

                const result = messageHandler.handleMessage(message, sender, mockSendResponse)

                expect(result).toBe(true)
                expect(mockSendResponse).toHaveBeenCalledWith({ success: false })
            })
        })

        it('should return true for unknown actions', () => {
            const message = { action: 'UNKNOWN_ACTION' }
            const sender = {} as chrome.runtime.MessageSender

            const result = messageHandler.handleMessage(message, sender, mockSendResponse)

            expect(result).toBe(true)
        })
    })

    describe('error handling', () => {
        it('should handle authentication errors gracefully', async () => {
            const message = { action: Actions.SHOW_ERROR }
            const sender = {} as chrome.runtime.MessageSender

            ;(authService.getCurrentUser as jest.Mock).mockResolvedValue(null)

            const result = messageHandler.handleMessage(message, sender, mockSendResponse)

            expect(result).toBe(true)
            await new Promise(resolve => setTimeout(resolve, 0))
            expect(mockSendResponse).toHaveBeenCalledWith({
                success: true,
                error: 'Not authorized',
            })
        })

        it('should handle storage errors gracefully', async () => {
            const message = { action: Actions.SHOW_ERROR }
            const sender = {} as chrome.runtime.MessageSender

            ;(authService.getCurrentUser as jest.Mock).mockResolvedValue({
                id: 'user-1',
                email: 'test@example.com',
            })

            const { getStorage } = require('../../../src/utils/storage')
            getStorage.mockRejectedValue(new Error('Storage error'))

            const result = messageHandler.handleMessage(message, sender, mockSendResponse)

            expect(result).toBe(true)
            await new Promise(resolve => setTimeout(resolve, 0))
            expect(mockSendResponse).toHaveBeenCalledWith({
                success: false,
                error: 'Failed to process booking action',
            })
        })
    })
})
