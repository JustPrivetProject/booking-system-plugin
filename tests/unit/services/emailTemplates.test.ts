import { EmailTemplates } from '../../../src/services/brevo/emailTemplates';
import type { BrevoEmailData } from '../../../src/types/general';

describe('EmailTemplates', () => {
    describe('generateSubject', () => {
        const baseEmailData: BrevoEmailData = {
            emails: ['test@example.com'],
            userName: 'Test User',
            oldTime: '19:00',
            tvAppId: '91037204',
            bookingTime: '19:00', // Use local time format instead of UTC
            containerNumber: 'BSIU3108038',
            driverName: 'ANDRZEJ KOLAKOWSKI',
        };

        it('should generate subject with container, driver, and time change', () => {
            const emailData = {
                ...baseEmailData,
                oldTime: '18:00', // currentSlot format
                bookingTime: '19:00', // formatted new time
            };

            const result = EmailTemplates.generateSubject(emailData);
            expect(result).toBe('BSIU3108038 / ANDRZEJ KOLAKOWSKI / 18:00 → 19:00');
        });

        it('should generate subject without driver name', () => {
            const emailData = {
                ...baseEmailData,
                driverName: undefined,
            };

            const result = EmailTemplates.generateSubject(emailData);
            expect(result).toBe('BSIU3108038 / 19:00 → 19:00');
        });

        it('should fallback to tvAppId when container number is missing', () => {
            const emailData = {
                ...baseEmailData,
                containerNumber: undefined,
            };

            const result = EmailTemplates.generateSubject(emailData);
            expect(result).toBe('91037204 / ANDRZEJ KOLAKOWSKI / 19:00 → 19:00');
        });
    });

    describe('generateHTML', () => {
        const baseEmailData: BrevoEmailData = {
            emails: ['test@example.com'],
            userName: 'Test User',
            oldTime: '19:00',
            tvAppId: '91037204',
            bookingTime: '19:00', // Use local time format instead of UTC
            containerNumber: 'BSIU3108038',
            driverName: 'ANDRZEJ KOLAKOWSKI',
        };

        it('should generate HTML with all fields', () => {
            const result = EmailTemplates.generateHTML(baseEmailData);

            expect(result).toContain('Port-Sloty');
            expect(result).toContain('91037204');
            expect(result).toMatch(/\d{2}:\d{2}/);
            expect(result).toContain('BSIU3108038');
            expect(result).toContain('ANDRZEJ KOLAKOWSKI');
            expect(result).toContain('Twoja rezerwacja w BalticHub została pomyślnie zmieniona');
        });

        it('should not include time change row when oldTime and newTime are provided', () => {
            const emailData = {
                ...baseEmailData,
                oldTime: '18:00', // currentSlot format
                bookingTime: '19:00', // formatted new time
            };

            const result = EmailTemplates.generateHTML(emailData);

            expect(result).not.toContain('Zmiana czasu');
            expect(result).not.toContain('18:00 → 19:00');
        });

        it('should not include driver row when driverName is missing', () => {
            const emailData = {
                ...baseEmailData,
                driverName: undefined,
            };

            const result = EmailTemplates.generateHTML(emailData);

            expect(result).not.toContain('Kierowca');
            expect(result).toContain('BSIU3108038'); // Container should still be there
        });
    });

    describe('generateText', () => {
        const baseEmailData: BrevoEmailData = {
            emails: ['test@example.com'],
            userName: 'Test User',
            oldTime: '19:00',
            tvAppId: '91037204',
            bookingTime: '19:00', // Use local time format instead of UTC
            containerNumber: 'BSIU3108038',
            driverName: 'ANDRZEJ KOLAKOWSKI',
        };

        it('should generate plain text with all fields', () => {
            const result = EmailTemplates.generateText(baseEmailData);

            expect(result).toContain('Port-Sloty');
            expect(result).toContain('91037204');
            expect(result).toMatch(/\d{2}:\d{2}/);
            expect(result).toContain('BSIU3108038');
            expect(result).toContain('ANDRZEJ KOLAKOWSKI');
            expect(result).toContain('Twoja rezerwacja w BalticHub została pomyślnie zmieniona');
        });

        it('should not include time change when oldTime and newTime are provided', () => {
            const emailData = {
                ...baseEmailData,
                oldTime: '18:00', // currentSlot format
                bookingTime: '19:00', // formatted new time
            };

            const result = EmailTemplates.generateText(emailData);

            expect(result).not.toMatch(/Zmiana czasu: \d{2}:\d{2} → \d{2}:\d{2}/);
        });
    });
});
