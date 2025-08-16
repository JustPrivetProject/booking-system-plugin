import { sortStatusesByPriority } from '../../../src/utils/status-utils'

// Mock StatusesPriority
jest.mock('../../../src/data', () => ({
    StatusesPriority: ['error', 'success', 'in-progress', 'paused'],
}))

describe('Status Utils Functions', () => {
    describe('sortStatusesByPriority', () => {
        it('should sort statuses according to priority order', () => {
            const statuses = ['success', 'error', 'in-progress', 'paused']
            const result = sortStatusesByPriority(statuses)

            expect(result).toEqual([
                'error',
                'success',
                'in-progress',
                'paused',
            ])
        })

        it('should handle statuses not in priority list', () => {
            const statuses = ['success', 'unknown', 'error', 'custom']
            const result = sortStatusesByPriority([...statuses]) // Создаем копию массива

            // Unknown statuses should be at the beginning (index -1)
            expect(result[0]).toBe('unknown')
            expect(result[1]).toBe('custom')
            expect(result[2]).toBe('error')
            expect(result[3]).toBe('success')
        })

        it('should handle empty array', () => {
            const result = sortStatusesByPriority([])
            expect(result).toEqual([])
        })

        it('should handle single status', () => {
            const statuses = ['error']
            const result = sortStatusesByPriority(statuses)
            expect(result).toEqual(['error'])
        })

        it('should handle duplicate statuses', () => {
            const statuses = ['success', 'error', 'success', 'error']
            const result = sortStatusesByPriority(statuses)

            expect(result).toEqual(['error', 'error', 'success', 'success'])
        })

        it('should handle all unknown statuses', () => {
            const statuses = ['unknown1', 'unknown2', 'unknown3']
            const result = sortStatusesByPriority(statuses)

            // All should be at the beginning since they have index -1
            expect(result).toEqual(['unknown1', 'unknown2', 'unknown3'])
        })

        it('should preserve original array order for unknown statuses', () => {
            const statuses = ['unknown1', 'unknown2', 'unknown3']
            const result = sortStatusesByPriority(statuses)

            // Unknown statuses should maintain their relative order
            expect(result[0]).toBe('unknown1')
            expect(result[1]).toBe('unknown2')
            expect(result[2]).toBe('unknown3')
        })

        it('should handle mixed known and unknown statuses', () => {
            const statuses = [
                'unknown1',
                'success',
                'unknown2',
                'error',
                'unknown3',
            ]
            const result = sortStatusesByPriority(statuses)

            // Unknown statuses first, then known ones in priority order
            expect(result[0]).toBe('unknown1')
            expect(result[1]).toBe('unknown2')
            expect(result[2]).toBe('unknown3')
            expect(result[3]).toBe('error')
            expect(result[4]).toBe('success')
        })
    })
})
