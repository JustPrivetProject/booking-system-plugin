import {
    NotificationService,
    notificationService,
    BookingNotificationData,
} from '../../../src/services/notificationService';
import { authService } from '../../../src/services/authService';
import { brevoEmailService } from '../../../src/services/brevo/brevoEmailService';
import { notificationSettingsService } from '../../../src/services/notificationSettingsService';

// Mock dependencies
jest.mock('../../../src/services/authService');
jest.mock('../../../src/services/brevo/brevoEmailService');
jest.mock('../../../src/services/notificationSettingsService');
jest.mock('../../../src/utils/index', () => ({
    consoleLog: jest.fn(),
    consoleError: jest.fn(),
}));

// Chrome API is already mocked in setup.ts

describe('NotificationService', () => {
    let service: NotificationService;
    const mockAuthService = authService as jest.Mocked<typeof authService>;
    const mockBrevoEmailService = brevoEmailService as jest.Mocked<typeof brevoEmailService>;
    const mockNotificationSettingsService = notificationSettingsService as jest.Mocked<
        typeof notificationSettingsService
    >;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new NotificationService();
    });

    const mockBookingData: BookingNotificationData = {
        tvAppId: 'TV123456',
        bookingTime: '2024-01-15 10:30:00',
        driverName: 'Test Driver',
        containerNumber: 'CONT123',
    };

    describe('sendBookingSuccessNotifications', () => {
        it('should send both Windows and email notifications when enabled', async () => {
            mockNotificationSettingsService.isWindowsNotificationEnabled.mockResolvedValue(true);
            mockNotificationSettingsService.isEmailNotificationEnabled.mockResolvedValue(true);
            mockNotificationSettingsService.getUserEmailForNotifications.mockResolvedValue([
                'user@example.com',
            ]);
            mockAuthService.getCurrentUser.mockResolvedValue({
                id: 'user-123',
                email: 'user@example.com',
                deviceId: 'device-123',
            });
            mockBrevoEmailService.sendBookingConfirmationEmail.mockResolvedValue(true);

            await service.sendBookingSuccessNotifications(mockBookingData);

            expect(chrome.notifications.create).toHaveBeenCalledWith({
                type: 'basic',
                iconUrl: './icon-144x144.png',
                title: 'Zmiana czasu',
                message: '✅ Zmiana czasu dla nr TV123456 - zakończyła się pomyślnie - 10:30',
                priority: 2,
            });
            expect(mockBrevoEmailService.sendBookingConfirmationEmail).toHaveBeenCalled();
        });

        it('should skip Windows notification when disabled', async () => {
            mockNotificationSettingsService.isWindowsNotificationEnabled.mockResolvedValue(false);
            mockNotificationSettingsService.isEmailNotificationEnabled.mockResolvedValue(false);

            await service.sendBookingSuccessNotifications(mockBookingData);

            expect(chrome.notifications.create).not.toHaveBeenCalled();
        });

        it('should skip email notification when disabled', async () => {
            mockNotificationSettingsService.isWindowsNotificationEnabled.mockResolvedValue(false);
            mockNotificationSettingsService.isEmailNotificationEnabled.mockResolvedValue(false);

            await service.sendBookingSuccessNotifications(mockBookingData);

            expect(mockBrevoEmailService.sendBookingConfirmationEmail).not.toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            mockNotificationSettingsService.isWindowsNotificationEnabled.mockRejectedValue(
                new Error('Storage error'),
            );
            mockNotificationSettingsService.isEmailNotificationEnabled.mockRejectedValue(
                new Error('Settings error'),
            );

            // Should not throw
            await expect(
                service.sendBookingSuccessNotifications(mockBookingData),
            ).resolves.toBeUndefined();
        });
    });

    describe('Windows notification', () => {
        beforeEach(() => {
            mockNotificationSettingsService.isEmailNotificationEnabled.mockResolvedValue(false);
        });

        it('should format time correctly for ISO string', async () => {
            mockNotificationSettingsService.isWindowsNotificationEnabled.mockResolvedValue(true);

            await service.sendBookingSuccessNotifications({
                ...mockBookingData,
                bookingTime: '2024-01-15T10:30:00.000Z',
            });

            expect(chrome.notifications.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringMatching(/\d{2}:\d{2}/),
                }),
            );
        });

        it('should handle time slot already in HH:MM format', async () => {
            mockNotificationSettingsService.isWindowsNotificationEnabled.mockResolvedValue(true);

            await service.sendBookingSuccessNotifications({
                ...mockBookingData,
                bookingTime: '19:00',
            });

            expect(chrome.notifications.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('19:00'),
                }),
            );
        });

        it('should fallback to current time for invalid time format', async () => {
            mockNotificationSettingsService.isWindowsNotificationEnabled.mockResolvedValue(true);

            await service.sendBookingSuccessNotifications({
                ...mockBookingData,
                bookingTime: 'invalid-time',
            });

            expect(chrome.notifications.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringMatching(/\d{2}:\d{2}/),
                }),
            );
        });

        it('should use current time when bookingTime is empty', async () => {
            mockNotificationSettingsService.isWindowsNotificationEnabled.mockResolvedValue(true);

            await service.sendBookingSuccessNotifications({
                ...mockBookingData,
                bookingTime: '',
            });

            expect(chrome.notifications.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringMatching(/\d{2}:\d{2}/),
                }),
            );
        });
    });

    describe('Email notification', () => {
        beforeEach(() => {
            mockNotificationSettingsService.isWindowsNotificationEnabled.mockResolvedValue(false);
            mockNotificationSettingsService.isEmailNotificationEnabled.mockResolvedValue(true);
            mockAuthService.getCurrentUser.mockResolvedValue({
                id: 'user-123',
                email: 'user@example.com',
                deviceId: 'device-123',
            });
        });

        it('should send email with correct data structure', async () => {
            mockNotificationSettingsService.getUserEmailForNotifications.mockResolvedValue([
                'user@example.com',
                'manager@example.com',
            ]);
            mockBrevoEmailService.sendBookingConfirmationEmail.mockResolvedValue(true);

            await service.sendBookingSuccessNotifications(mockBookingData);

            expect(mockBrevoEmailService.sendBookingConfirmationEmail).toHaveBeenCalledWith({
                emails: ['user@example.com', 'manager@example.com'],
                userName: 'user',
                tvAppId: 'TV123456',
                bookingTime: expect.stringMatching(/^\d{2}\.\d{2} \d{2}:\d{2}$/),
                newTime: expect.stringMatching(/^\d{2}\.\d{2} \d{2}:\d{2}$/),
                oldTime: undefined,
                driverName: 'Test Driver',
                containerNumber: 'CONT123',
            });
        });

        it('should skip email when no email addresses configured', async () => {
            mockNotificationSettingsService.getUserEmailForNotifications.mockResolvedValue([]);

            await service.sendBookingSuccessNotifications(mockBookingData);

            expect(mockBrevoEmailService.sendBookingConfirmationEmail).not.toHaveBeenCalled();
        });

        it('should format booking time for email correctly', async () => {
            mockNotificationSettingsService.getUserEmailForNotifications.mockResolvedValue([
                'user@example.com',
            ]);
            mockBrevoEmailService.sendBookingConfirmationEmail.mockResolvedValue(true);

            await service.sendBookingSuccessNotifications({
                ...mockBookingData,
                bookingTime: '2024-01-15T10:30:00.000Z',
            });

            const callArgs = mockBrevoEmailService.sendBookingConfirmationEmail.mock.calls[0][0];
            expect(callArgs.bookingTime).toMatch(/^\d{2}\.\d{2} \d{2}:\d{2}$/);
        });

        it('should handle invalid booking time for email', async () => {
            mockNotificationSettingsService.getUserEmailForNotifications.mockResolvedValue([
                'user@example.com',
            ]);
            mockBrevoEmailService.sendBookingConfirmationEmail.mockResolvedValue(true);

            await service.sendBookingSuccessNotifications({
                ...mockBookingData,
                bookingTime: 'invalid-time',
            });

            const callArgs = mockBrevoEmailService.sendBookingConfirmationEmail.mock.calls[0][0];
            expect(callArgs.bookingTime).toBe('invalid-time');
        });

        it('should use fallback username when user not found', async () => {
            mockNotificationSettingsService.getUserEmailForNotifications.mockResolvedValue([
                'user@example.com',
            ]);
            mockAuthService.getCurrentUser.mockResolvedValue(null);
            mockBrevoEmailService.sendBookingConfirmationEmail.mockResolvedValue(true);

            await service.sendBookingSuccessNotifications(mockBookingData);

            const callArgs = mockBrevoEmailService.sendBookingConfirmationEmail.mock.calls[0][0];
            expect(callArgs.userName).toBe('Użytkownik');
        });

        it('should handle email sending failure gracefully', async () => {
            mockNotificationSettingsService.getUserEmailForNotifications.mockResolvedValue([
                'user@example.com',
            ]);
            mockBrevoEmailService.sendBookingConfirmationEmail.mockResolvedValue(false);

            // Should not throw
            await expect(
                service.sendBookingSuccessNotifications(mockBookingData),
            ).resolves.toBeUndefined();
        });
    });

    describe('sendTestNotifications', () => {
        it('should send test notifications with test data', async () => {
            mockNotificationSettingsService.isWindowsNotificationEnabled.mockResolvedValue(true);
            mockNotificationSettingsService.isEmailNotificationEnabled.mockResolvedValue(true);
            mockNotificationSettingsService.getUserEmailForNotifications.mockResolvedValue([
                'test@example.com',
            ]);
            mockAuthService.getCurrentUser.mockResolvedValue({
                id: 'user-123',
                email: 'test@example.com',
                deviceId: 'device-123',
            });
            mockBrevoEmailService.sendBookingConfirmationEmail.mockResolvedValue(true);

            await service.sendTestNotifications();

            expect(chrome.notifications.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('TEST123'),
                }),
            );
            expect(mockBrevoEmailService.sendBookingConfirmationEmail).toHaveBeenCalledWith(
                expect.objectContaining({
                    tvAppId: 'TEST123',
                    driverName: 'Test Driver',
                    containerNumber: 'TEST456',
                }),
            );
        });
    });

    describe('getNotificationStatus', () => {
        it('should return current notification status', async () => {
            mockNotificationSettingsService.isWindowsNotificationEnabled.mockResolvedValue(true);
            mockNotificationSettingsService.isEmailNotificationEnabled.mockResolvedValue(false);
            mockNotificationSettingsService.getUserEmail.mockResolvedValue('user@example.com');

            const status = await service.getNotificationStatus();

            expect(status).toEqual({
                windowsEnabled: true,
                emailEnabled: false,
                userEmail: 'user@example.com',
            });
        });

        it('should return default values on error', async () => {
            mockNotificationSettingsService.isWindowsNotificationEnabled.mockRejectedValue(
                new Error('Error'),
            );
            mockNotificationSettingsService.isEmailNotificationEnabled.mockRejectedValue(
                new Error('Error'),
            );
            mockNotificationSettingsService.getUserEmail.mockRejectedValue(new Error('Error'));

            const status = await service.getNotificationStatus();

            expect(status).toEqual({
                windowsEnabled: false,
                emailEnabled: false,
                userEmail: null,
            });
        });
    });

    describe('time formatting edge cases', () => {
        beforeEach(() => {
            mockNotificationSettingsService.isWindowsNotificationEnabled.mockResolvedValue(true);
            mockNotificationSettingsService.isEmailNotificationEnabled.mockResolvedValue(false);
        });

        it('should handle null booking time', async () => {
            await service.sendBookingSuccessNotifications({
                ...mockBookingData,
                bookingTime: null as any,
            });

            expect(chrome.notifications.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringMatching(/\d{2}:\d{2}/),
                }),
            );
        });

        it('should handle undefined booking time', async () => {
            await service.sendBookingSuccessNotifications({
                ...mockBookingData,
                bookingTime: undefined as any,
            });

            expect(chrome.notifications.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringMatching(/\d{2}:\d{2}/),
                }),
            );
        });
    });

    describe('singleton instance', () => {
        it('should export singleton instance', () => {
            expect(notificationService).toBeInstanceOf(NotificationService);
        });
    });
});
