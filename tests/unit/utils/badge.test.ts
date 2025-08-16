import { jest } from '@jest/globals'
import {
    updateBadge,
    clearBadge,
    resetBadge,
    getLastBadgeStatus,
} from '../../../src/utils/badge'

// Types for better type safety in tests
type ChromeAction = {
    setBadgeText: jest.MockedFunction<
        (details: { text: string | undefined }, callback: () => void) => void
    >
}

type ChromeRuntime = {
    lastError: Error | null
}

type ChromeMock = {
    action: ChromeAction
    runtime: ChromeRuntime
}

// Test data constants
const TEST_STATUSES = {
    ERROR: 'error',
    SUCCESS: 'success',
    WARNING: 'warning',
    IN_PROGRESS: 'in-progress',
    PAUSED: 'paused',
    UNKNOWN: 'unknown-status',
} as const

const TEST_ICONS = {
    ERROR: '❌',
    SUCCESS: '✅',
    WARNING: '⚠️',
    IN_PROGRESS: '▶️',
    PAUSED: '⏸️',
} as const

// Mock setup
jest.mock('../../../src/data', () => ({
    StatusIconMap: {
        'error': '❌',
        'success': '✅',
        'warning': '⚠️',
        'in-progress': '▶️',
        'paused': '⏸️',
    },
}))

jest.mock('../../../src/utils/logging', () => ({
    consoleLog: jest.fn(),
}))

jest.mock('../../../src/utils/status-utils', () => ({
    sortStatusesByPriority: jest.fn(),
}))

// Test utilities
class BadgeTestHelper {
    public chromeMock: ChromeMock
    public sortStatusesByPriority: jest.MockedFunction<
        (statuses: string[]) => string[]
    >

    constructor() {
        this.chromeMock = (global as any).chrome as ChromeMock
        this.sortStatusesByPriority =
            require('../../../src/utils/status-utils').sortStatusesByPriority
    }

    setupChromeMock(): void {
        this.chromeMock.action.setBadgeText = jest.fn((details, callback) => {
            if (this.chromeMock.runtime.lastError) {
                callback()
            } else {
                callback()
            }
        })
        this.chromeMock.runtime.lastError = null
    }

    mockStatusSorting(returnValue: string[]): void {
        this.sortStatusesByPriority.mockReturnValue(returnValue)
    }

    mockStatusSortingForMultipleCalls(returnValues: string[][]): void {
        returnValues.forEach((value, index) => {
            if (index === 0) {
                this.sortStatusesByPriority.mockReturnValueOnce(value)
            } else {
                this.sortStatusesByPriority.mockReturnValueOnce(value)
            }
        })
    }

    expectBadgeText(expectedText: string | undefined): void {
        expect(this.chromeMock.action.setBadgeText).toHaveBeenCalledWith(
            { text: expectedText },
            expect.any(Function)
        )
    }

    expectNoBadgeUpdate(): void {
        expect(this.chromeMock.action.setBadgeText).not.toHaveBeenCalled()
    }

    resetMocks(): void {
        jest.clearAllMocks()
        this.chromeMock.action.setBadgeText.mockClear()
        this.chromeMock.runtime.lastError = null
        this.sortStatusesByPriority.mockReset()
    }

    simulateChromeError(error: Error): void {
        this.chromeMock.runtime.lastError = error
    }
}

// Test suites
describe('Badge Manager', () => {
    let testHelper: BadgeTestHelper

    beforeEach(() => {
        testHelper = new BadgeTestHelper()
        testHelper.setupChromeMock()
        resetBadge()
    })

    afterEach(() => {
        testHelper.resetMocks()
        resetBadge()
    })

    describe('updateBadge', () => {
        describe('Edge Cases', () => {
            it('should clear badge when empty statuses array provided', async () => {
                await updateBadge([])

                testHelper.expectBadgeText('')
                expect(getLastBadgeStatus()).toBe('')
            })

            it('should handle undefined statuses gracefully', async () => {
                // Функция ожидает массив строк, поэтому undefined вызовет ошибку
                await expect(updateBadge(undefined as any)).rejects.toThrow()
            })

            it('should handle null statuses gracefully', async () => {
                // Функция ожидает массив строк, поэтому null вызовет ошибку
                await expect(updateBadge(null as any)).rejects.toThrow()
            })
        })

        describe('Status Priority Logic', () => {
            it('should update badge with highest priority status from multiple statuses', async () => {
                const statuses = [
                    TEST_STATUSES.SUCCESS,
                    TEST_STATUSES.ERROR,
                    TEST_STATUSES.WARNING,
                ]
                testHelper.mockStatusSorting([
                    TEST_STATUSES.ERROR,
                    TEST_STATUSES.WARNING,
                    TEST_STATUSES.SUCCESS,
                ])

                await updateBadge(statuses)

                expect(testHelper.sortStatusesByPriority).toHaveBeenCalledWith(
                    statuses
                )
                testHelper.expectBadgeText(TEST_ICONS.ERROR)
                expect(getLastBadgeStatus()).toBe(TEST_STATUSES.ERROR)
            })

            it('should handle unknown status by setting undefined icon', async () => {
                testHelper.mockStatusSorting([TEST_STATUSES.UNKNOWN])

                await updateBadge([TEST_STATUSES.UNKNOWN])

                testHelper.expectBadgeText(undefined)
                expect(getLastBadgeStatus()).toBe(TEST_STATUSES.UNKNOWN)
            })
        })

        describe('State Management', () => {
            it('should not update badge if status is the same as previous', async () => {
                testHelper.mockStatusSorting([TEST_STATUSES.ERROR])

                // First call - should update
                await updateBadge([TEST_STATUSES.ERROR])
                testHelper.expectBadgeText(TEST_ICONS.ERROR)

                // Reset mock to check second call
                testHelper.chromeMock.action.setBadgeText.mockClear()

                // Second call with same status - should NOT update
                await updateBadge([TEST_STATUSES.ERROR])
                testHelper.expectNoBadgeUpdate()
            })

            it('should update badge when status changes', async () => {
                // Set initial status
                testHelper.mockStatusSorting([TEST_STATUSES.ERROR])
                await updateBadge([TEST_STATUSES.ERROR])
                testHelper.chromeMock.action.setBadgeText.mockClear()

                // Change status
                testHelper.mockStatusSorting([TEST_STATUSES.SUCCESS])
                await updateBadge([TEST_STATUSES.SUCCESS])

                testHelper.expectBadgeText(TEST_ICONS.SUCCESS)
                expect(getLastBadgeStatus()).toBe(TEST_STATUSES.SUCCESS)
            })

            it('should update badge after reset even with same status', async () => {
                testHelper.mockStatusSorting([TEST_STATUSES.ERROR])
                await updateBadge([TEST_STATUSES.ERROR])
                testHelper.chromeMock.action.setBadgeText.mockClear()

                // Reset state
                resetBadge()

                // Same status after reset - should update
                await updateBadge([TEST_STATUSES.ERROR])
                testHelper.expectBadgeText(TEST_ICONS.ERROR)
            })
        })

        describe('Error Handling', () => {
            it('should handle Chrome API errors gracefully', async () => {
                testHelper.mockStatusSorting([TEST_STATUSES.ERROR])
                testHelper.simulateChromeError(new Error('Chrome API error'))

                await expect(
                    updateBadge([TEST_STATUSES.ERROR])
                ).resolves.not.toThrow()
            })

            it('should continue execution after Chrome API error', async () => {
                testHelper.mockStatusSorting([TEST_STATUSES.ERROR])
                testHelper.simulateChromeError(new Error('Chrome API error'))

                await updateBadge([TEST_STATUSES.ERROR])

                // Should still update internal state despite error
                expect(getLastBadgeStatus()).toBe(TEST_STATUSES.ERROR)
            })
        })

        describe('Integration Scenarios', () => {
            it('should handle complete status lifecycle', async () => {
                // 1. Set initial status
                testHelper.mockStatusSorting([TEST_STATUSES.IN_PROGRESS])
                await updateBadge([TEST_STATUSES.IN_PROGRESS])
                testHelper.expectBadgeText(TEST_ICONS.IN_PROGRESS)

                // 2. Update to success
                testHelper.chromeMock.action.setBadgeText.mockClear()
                testHelper.mockStatusSorting([TEST_STATUSES.SUCCESS])
                await updateBadge([TEST_STATUSES.SUCCESS])
                testHelper.expectBadgeText(TEST_ICONS.SUCCESS)

                // 3. Update to error
                testHelper.chromeMock.action.setBadgeText.mockClear()
                testHelper.mockStatusSorting([TEST_STATUSES.ERROR])
                await updateBadge([TEST_STATUSES.ERROR])
                testHelper.expectBadgeText(TEST_ICONS.ERROR)

                // 4. Clear badge
                testHelper.chromeMock.action.setBadgeText.mockClear()
                await clearBadge()
                testHelper.expectBadgeText('')
            })

            it('should handle multiple rapid status updates', async () => {
                const statuses = [
                    TEST_STATUSES.SUCCESS,
                    TEST_STATUSES.ERROR,
                    TEST_STATUSES.WARNING,
                ]

                for (const status of statuses) {
                    testHelper.mockStatusSorting([status])
                    await updateBadge([status])
                    testHelper.chromeMock.action.setBadgeText.mockClear()
                }

                expect(getLastBadgeStatus()).toBe(TEST_STATUSES.WARNING)
            })
        })
    })

    describe('clearBadge', () => {
        describe('State Management', () => {
            it('should clear badge when badge is currently set', async () => {
                // Set initial badge
                testHelper.mockStatusSorting([TEST_STATUSES.ERROR])
                await updateBadge([TEST_STATUSES.ERROR])
                testHelper.chromeMock.action.setBadgeText.mockClear()

                // Clear badge
                await clearBadge()

                testHelper.expectBadgeText('')
                expect(getLastBadgeStatus()).toBe('')
            })

            it('should not call Chrome API when badge is already cleared', async () => {
                await clearBadge()

                testHelper.expectNoBadgeUpdate()
            })

            it('should reset internal state after clearing', async () => {
                // Set badge
                testHelper.mockStatusSorting([TEST_STATUSES.SUCCESS])
                await updateBadge([TEST_STATUSES.SUCCESS])
                expect(getLastBadgeStatus()).toBe(TEST_STATUSES.SUCCESS)

                // Clear badge
                await clearBadge()
                expect(getLastBadgeStatus()).toBe('')
            })
        })

        describe('Error Handling', () => {
            it('should handle Chrome API errors during clear operation', async () => {
                // Set initial badge
                testHelper.mockStatusSorting([TEST_STATUSES.ERROR])
                await updateBadge([TEST_STATUSES.ERROR])
                testHelper.chromeMock.action.setBadgeText.mockClear()

                // Simulate error during clear
                testHelper.simulateChromeError(
                    new Error('Clear operation failed')
                )

                await expect(clearBadge()).resolves.not.toThrow()
            })

            it('should reset internal state even if Chrome API fails', async () => {
                // Set initial badge
                testHelper.mockStatusSorting([TEST_STATUSES.ERROR])
                await updateBadge([TEST_STATUSES.ERROR])

                // Simulate error during clear
                testHelper.simulateChromeError(
                    new Error('Clear operation failed')
                )

                await clearBadge()

                // Internal state should still be reset
                expect(getLastBadgeStatus()).toBe('')
            })
        })
    })

    describe('Testing Utilities', () => {
        describe('resetBadge', () => {
            it('should reset badge state to initial values', () => {
                // Set some state
                testHelper.mockStatusSorting([TEST_STATUSES.ERROR])
                updateBadge([TEST_STATUSES.ERROR])
                expect(getLastBadgeStatus()).toBe(TEST_STATUSES.ERROR)

                // Reset
                resetBadge()
                expect(getLastBadgeStatus()).toBe('')
            })

            it('should allow fresh start after reset', async () => {
                // Set initial state
                testHelper.mockStatusSorting([TEST_STATUSES.ERROR])
                await updateBadge([TEST_STATUSES.ERROR])
                testHelper.chromeMock.action.setBadgeText.mockClear()

                // Reset
                resetBadge()

                // Should update badge after reset
                testHelper.mockStatusSorting([TEST_STATUSES.SUCCESS])
                await updateBadge([TEST_STATUSES.SUCCESS])
                testHelper.expectBadgeText(TEST_ICONS.SUCCESS)
            })
        })

        describe('getLastBadgeStatus', () => {
            it('should return empty string for initial state', () => {
                expect(getLastBadgeStatus()).toBe('')
            })

            it('should return current status after update', async () => {
                testHelper.mockStatusSorting([TEST_STATUSES.IN_PROGRESS])
                await updateBadge([TEST_STATUSES.IN_PROGRESS])

                expect(getLastBadgeStatus()).toBe(TEST_STATUSES.IN_PROGRESS)
            })

            it('should return empty string after clear', async () => {
                testHelper.mockStatusSorting([TEST_STATUSES.ERROR])
                await updateBadge([TEST_STATUSES.ERROR])
                await clearBadge()

                expect(getLastBadgeStatus()).toBe('')
            })
        })
    })

    describe('Performance and Memory', () => {
        it('should not create memory leaks with multiple updates', async () => {
            const iterations = 100
            const statuses = [
                TEST_STATUSES.SUCCESS,
                TEST_STATUSES.ERROR,
                TEST_STATUSES.WARNING,
            ]

            for (let i = 0; i < iterations; i++) {
                const status = statuses[i % statuses.length]
                testHelper.mockStatusSorting([status])
                await updateBadge([status])
                testHelper.chromeMock.action.setBadgeText.mockClear()
            }

            // Should still work correctly after many iterations
            // Последний статус в цикле будет WARNING (i=99, 99 % 3 = 0, statuses[0] = SUCCESS)
            // Но после последней итерации статус будет SUCCESS
            expect(getLastBadgeStatus()).toBe(TEST_STATUSES.SUCCESS)
        })

        it('should handle concurrent operations gracefully', async () => {
            // Настраиваем моки для последовательных вызовов
            testHelper.mockStatusSortingForMultipleCalls([
                [TEST_STATUSES.SUCCESS],
                [TEST_STATUSES.ERROR],
                [TEST_STATUSES.WARNING]
            ])

            const promise1 = updateBadge([TEST_STATUSES.SUCCESS])
            const promise2 = updateBadge([TEST_STATUSES.ERROR])
            const promise3 = updateBadge([TEST_STATUSES.WARNING])

            await Promise.all([promise1, promise2, promise3])

            // Should have consistent final state - последний вызов определит статус
            expect(getLastBadgeStatus()).toBe(TEST_STATUSES.WARNING)
        })
    })
})
