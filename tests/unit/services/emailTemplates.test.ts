import { EmailTemplates } from '../../../src/services/brevo/emailTemplates';
import type { BrevoEmailData } from '../../../src/types/general';

describe('EmailTemplates', () => {
    describe('generateSubject', () => {
        const baseEmailData: BrevoEmailData = {
            emails: ['test@example.com'],
            userName: 'Test User',
            tvAppId: '91037204',
            bookingTime: '19:00', // Use local time format instead of UTC
            containerNumber: 'BSIU3108038',
            driverName: 'ANDRZEJ KOLAKOWSKI',
        };

        it('should generate subject with container, driver, and time', () => {
            const emailData = {
                ...baseEmailData,
                bookingTime: '19:00', // formatted new time
            };

            const result = EmailTemplates.generateSubject(emailData);
            expect(result).toBe('[DCT] BSIU3108038 / ANDRZEJ KOLAKOWSKI / 19:00');
        });

        it('should generate subject without driver name', () => {
            const emailData = {
                ...baseEmailData,
                driverName: undefined,
            };

            const result = EmailTemplates.generateSubject(emailData);
            expect(result).toBe('[DCT] BSIU3108038 / 19:00');
        });

        it('should fallback to tvAppId when container number is missing', () => {
            const emailData = {
                ...baseEmailData,
                containerNumber: undefined,
            };

            const result = EmailTemplates.generateSubject(emailData);
            expect(result).toBe('[DCT] 91037204 / ANDRZEJ KOLAKOWSKI / 19:00');
        });

        it('should generate subject with GCT prefix when source is GCT', () => {
            const emailData = {
                ...baseEmailData,
                notificationSource: 'GCT' as const,
            };

            const result = EmailTemplates.generateSubject(emailData);
            expect(result).toBe('[GCT] BSIU3108038 / ANDRZEJ KOLAKOWSKI / 19:00');
        });

        it('should generate subject with BCT prefix when source is BCT', () => {
            const emailData = {
                ...baseEmailData,
                notificationSource: 'BCT' as const,
            };

            const result = EmailTemplates.generateSubject(emailData);
            expect(result).toBe('[BCT] BSIU3108038 / ANDRZEJ KOLAKOWSKI / 19:00');
        });
    });

    describe('generateHTML', () => {
        const baseEmailData: BrevoEmailData = {
            emails: ['test@example.com'],
            userName: 'Test User',
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

        it('should not include driver row when driverName is missing', () => {
            const emailData = {
                ...baseEmailData,
                driverName: undefined,
            };

            const result = EmailTemplates.generateHTML(emailData);

            expect(result).not.toContain('Kierowca');
            expect(result).toContain('BSIU3108038'); // Container should still be there
        });

        it('should use GCT wording in HTML body for GCT notifications', () => {
            const emailData = {
                ...baseEmailData,
                notificationSource: 'GCT' as const,
            };

            const result = EmailTemplates.generateHTML(emailData);

            expect(result).toContain('Twoja rezerwacja w GCT została pomyślnie zamieniona');
            expect(result).not.toContain(
                'Twoja rezerwacja w BalticHub została pomyślnie zmieniona',
            );
        });

        it('should use BCT wording in HTML body for BCT notifications', () => {
            const emailData = {
                ...baseEmailData,
                notificationSource: 'BCT' as const,
            };

            const result = EmailTemplates.generateHTML(emailData);

            expect(result).toContain('Twoja rezerwacja w BCT została pomyślnie zmieniona');
        });
    });

    describe('generateText', () => {
        const baseEmailData: BrevoEmailData = {
            emails: ['test@example.com'],
            userName: 'Test User',
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

        it('should use GCT wording in text body for GCT notifications', () => {
            const emailData = {
                ...baseEmailData,
                notificationSource: 'GCT' as const,
            };

            const result = EmailTemplates.generateText(emailData);

            expect(result).toContain('Twoja rezerwacja w GCT została pomyślnie zamieniona');
            expect(result).not.toContain(
                'Twoja rezerwacja w BalticHub została pomyślnie zmieniona',
            );
        });

        it('should use BCT wording in text body for BCT notifications', () => {
            const emailData = {
                ...baseEmailData,
                notificationSource: 'BCT' as const,
            };

            const result = EmailTemplates.generateText(emailData);

            expect(result).toContain('Twoja rezerwacja w BCT została pomyślnie zmieniona');
        });
    });
});
