// Mock Supabase client before importing date-utils
jest.mock('../../../src/services/supabaseClient', () => ({
    supabase: {
        from: jest.fn(() => ({
            insert: jest.fn(),
        })),
    },
}))

// Mock errorLogService
jest.mock('../../../src/services/errorLogService', () => ({
    errorLogService: {
        logError: jest.fn(),
        logRequestError: jest.fn(),
    },
}))

import {
    parseDateTimeFromDMY,
    formatDateToDMY,
    getTodayFormatted,
} from '../../../src/utils/date-utils'

describe('Date Utils Functions', () => {
    describe('parseDateTimeFromDMY', () => {
        it('should parse date with seconds', () => {
            const result = parseDateTimeFromDMY('26.06.2025 00:59:00')
            expect(result).toEqual(new Date('2025-06-26T00:59:00'))
        })

        it('should parse date without seconds', () => {
            const result = parseDateTimeFromDMY('26.06.2025 00:59')
            expect(result).toEqual(new Date('2025-06-26T00:59:00'))
        })

        it('should handle invalid date format', () => {
            const result = parseDateTimeFromDMY('invalid-date')
            expect(isNaN(result.getTime())).toBe(true)
        })

        it('should handle missing time part', () => {
            const result = parseDateTimeFromDMY('26.06.2025')
            expect(isNaN(result.getTime())).toBe(true)
        })

        it('should handle missing date part', () => {
            const result = parseDateTimeFromDMY('00:59:00')
            expect(isNaN(result.getTime())).toBe(true)
        })

        it('should handle invalid day', () => {
            const result = parseDateTimeFromDMY('32.06.2025 00:59:00')
            expect(isNaN(result.getTime())).toBe(true)
        })

        it('should handle invalid month', () => {
            const result = parseDateTimeFromDMY('26.13.2025 00:59:00')
            expect(isNaN(result.getTime())).toBe(true)
        })

        it('should handle invalid year', () => {
            const result = parseDateTimeFromDMY('26.06.0000 00:59:00')
            expect(isNaN(result.getTime())).toBe(true)
        })
    })

    describe('formatDateToDMY', () => {
        it('should format current date correctly', () => {
            const mockDate = new Date('2025-08-07T12:30:45')
            jest.spyOn(global, 'Date').mockImplementation(() => mockDate)

            const result = formatDateToDMY()

            expect(result).toBe('07.08.2025')
            jest.restoreAllMocks()
        })

        it('should format provided date correctly', () => {
            const date = new Date('2025-12-25T15:30:00')
            const result = formatDateToDMY(date)

            expect(result).toBe('25.12.2025')
        })

        it('should handle single digit day and month', () => {
            const date = new Date('2025-01-05T10:15:00')
            const result = formatDateToDMY(date)

            expect(result).toBe('05.01.2025')
        })

        it('should handle leap year', () => {
            const date = new Date('2024-02-29T12:00:00')
            const result = formatDateToDMY(date)

            expect(result).toBe('29.02.2024')
        })
    })

    describe('getTodayFormatted', () => {
        it('should return today date in correct format', () => {
            const mockDate = new Date('2025-08-07T12:30:45')
            jest.spyOn(global, 'Date').mockImplementation(() => mockDate)

            const result = getTodayFormatted()

            expect(result).toBe('07.08.2025')
            jest.restoreAllMocks()
        })

        it('should use current date when no date provided', () => {
            const mockDate = new Date('2025-12-25T15:30:00')
            jest.spyOn(global, 'Date').mockImplementation(() => mockDate)

            const result = getTodayFormatted()

            expect(result).toBe('25.12.2025')
            jest.restoreAllMocks()
        })
    })
})
