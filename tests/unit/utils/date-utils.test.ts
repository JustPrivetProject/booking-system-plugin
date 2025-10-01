import {
    formatTimeForEmail,
    formatDateToDMY,
    parseDateTimeFromDMY,
    getTodayFormatted,
} from '../../../src/utils/date-utils';

describe('date-utils', () => {
    describe('formatTimeForEmail', () => {
        it('should format ISO time string to HH:MM format', () => {
            const result = formatTimeForEmail('2024-01-15T19:00:00Z');
            // Note: This will be converted to local time, so we check the format instead of exact time
            expect(result).toMatch(/^\d{2}:\d{2}$/);
        });

        it('should format date string to HH:MM format', () => {
            const result = formatTimeForEmail('2024-01-15 19:00:00');
            expect(result).toBe('19:00');
        });

        it('should return time string as-is if not parseable date', () => {
            const result = formatTimeForEmail('19:00');
            expect(result).toBe('19:00');
        });

        it('should return empty string for empty input', () => {
            const result = formatTimeForEmail('');
            expect(result).toBe('');
        });

        it('should handle partial ISO strings', () => {
            const result = formatTimeForEmail('2024-01-15T19:00');
            expect(result).toBe('19:00');
        });

        it('should handle currentSlot format', () => {
            const result = formatTimeForEmail('2025-07-30 18:00');
            expect(result).toBe('18:00');
        });

        it('should handle different time zones', () => {
            const result = formatTimeForEmail('2024-12-25T23:59:59.999Z');
            // Note: This will be converted to local time, so we check the format instead of exact time
            expect(result).toMatch(/^\d{2}:\d{2}$/);
        });

        it('should remove seconds from HH:MM:SS format', () => {
            const result = formatTimeForEmail('20:00:00');
            expect(result).toBe('20:00');
        });

        it('should handle date-time string with seconds', () => {
            const result = formatTimeForEmail('2025-07-30 18:00:00');
            expect(result).toBe('18:00');
        });

        it('should handle date-time string without seconds', () => {
            const result = formatTimeForEmail('2025-07-30 18:00');
            expect(result).toBe('18:00');
        });
    });

    describe('formatDateToDMY', () => {
        it('should format date to DD.MM.YYYY', () => {
            const date = new Date('2024-01-15');
            const result = formatDateToDMY(date);
            expect(result).toBe('15.01.2024');
        });

        it('should use current date if no date provided', () => {
            const result = formatDateToDMY();
            expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
        });
    });

    describe('parseDateTimeFromDMY', () => {
        it('should parse date string correctly', () => {
            const result = parseDateTimeFromDMY('26.06.2025 00:59:00');
            expect(result.getFullYear()).toBe(2025);
            expect(result.getMonth()).toBe(5); // June is month 5 (0-indexed)
            expect(result.getDate()).toBe(26);
            expect(result.getHours()).toBe(0);
            expect(result.getMinutes()).toBe(59);
        });

        it('should handle time without seconds', () => {
            const result = parseDateTimeFromDMY('26.06.2025 00:59');
            expect(result.getMinutes()).toBe(59);
            expect(result.getSeconds()).toBe(0);
        });

        it('should return Invalid Date for malformed input', () => {
            const result = parseDateTimeFromDMY('invalid-date');
            expect(isNaN(result.getTime())).toBe(true);
        });
    });

    describe('getTodayFormatted', () => {
        it('should return today date in DD.MM.YYYY format', () => {
            const result = getTodayFormatted();
            expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
        });
    });
});
