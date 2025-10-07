import type { BrevoEmailData } from '../types/general';
import { authService } from './authService';
import { brevoEmailService } from './brevo';
import { notificationSettingsService } from './notificationSettingsService';
import { consoleLog, consoleError } from '../utils/index';
import { formatTimeForEmail } from '../utils/date-utils';

/**
 * Centralized notification service for handling all types of booking notifications
 */
export class NotificationService {
    /**
     * Send all enabled notifications for successful booking
     */
    async sendBookingSuccessNotifications(data: BrevoEmailData): Promise<void> {
        try {
            consoleLog('🔔 Sending notifications for booking:', data.tvAppId);

            // Send both Windows and Email notifications in parallel
            await Promise.allSettled([
                this.sendWindowsNotification(data),
                this.sendEmailNotification(data),
            ]);
        } catch (error) {
            consoleError('❌ Error in sendBookingSuccessNotifications:', error);
        }
    }

    /**
     * Send Windows notification if enabled
     */
    private async sendWindowsNotification(data: BrevoEmailData): Promise<void> {
        try {
            const isEnabled = await notificationSettingsService.isWindowsNotificationEnabled();

            if (!isEnabled) {
                return;
            }

            // Format time for display (show only time part)
            const timeDisplay = this.formatTimeForWindows(data.bookingTime);

            const notificationData = {
                type: 'basic' as const,
                iconUrl: './icon-144x144.png',
                title: 'Zmiana czasu',
                message: `✅ Zmiana czasu dla nr ${data.tvAppId} - zakończyła się pomyślnie - ${timeDisplay}`,
                priority: 2,
            };

            // Send Windows notification using Chrome API
            chrome.notifications.create(notificationData);

            consoleLog('✅ Windows notification sent for:', data.tvAppId);
        } catch (error) {
            consoleError('❌ Error sending Windows notification:', error);
        }
    }

    /**
     * Send email notification if enabled
     */
    private async sendEmailNotification(data: BrevoEmailData): Promise<void> {
        try {
            // Check if email notifications are enabled
            const isEmailEnabled = await notificationSettingsService.isEmailNotificationEnabled();
            if (!isEmailEnabled) {
                return;
            }

            // Get user email address for notifications
            const emailAddresses = await notificationSettingsService.getUserEmailForNotifications();
            if (emailAddresses.length === 0) {
                return;
            }

            // Get current user for additional info
            const currentUser = await authService.getCurrentUser();

            // Prepare email data with formatted time
            const emailData: BrevoEmailData = {
                emails: emailAddresses,
                userName: currentUser?.email.split('@')[0] || 'Użytkownik',
                tvAppId: data.tvAppId,
                bookingTime: data.bookingTime,
                oldTime: data.oldTime,
                driverName: data.driverName,
                containerNumber: data.containerNumber,
            };

            // Send email notification
            const emailSent = await brevoEmailService.sendBookingConfirmationEmail(emailData);

            if (emailSent) {
                consoleLog(
                    '✅ Booking confirmation email sent to:',
                    emailAddresses.length,
                    'recipients',
                );
            } else {
                consoleLog('❌ Failed to send booking confirmation email');
            }
        } catch (error) {
            consoleError('❌ Error sending email notification:', error);
        }
    }

    /**
     * Format time for Windows notification display (show only time part like "19:00")
     */
    private formatTimeForWindows(timeSlot: string): string {
        if (!timeSlot) {
            return new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
        }

        try {
            // Try to parse and format the time slot to show only time
            const date = new Date(timeSlot);
            if (!isNaN(date.getTime())) {
                return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
            }

            // If timeSlot is already in format like "19:00", extract first 5 characters
            if (timeSlot.includes(':')) {
                return timeSlot.slice(0, 5);
            }
        } catch (error) {
            consoleLog('Error parsing booking time for Windows notification:', error);
        }

        // Fallback to current time
        return new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * Format booking time for email display
     * (Short format DD.MM HH:MM)
     * Supports formats: ISO strings, "2025-07-30 19:00", etc.
     */
    private formatBookingTimeForEmail(timeSlot: string): string {
        return formatTimeForEmail(timeSlot);
    }

    /**
     * Send test notifications (for debugging)
     */
    async sendTestNotifications(): Promise<void> {
        const testData: BrevoEmailData = {
            emails: ['test@example.com'],
            userName: 'Test User',
            oldTime: new Date().toISOString(),
            tvAppId: 'TEST123',
            bookingTime: new Date().toISOString(),
            driverName: 'Test Driver',
            containerNumber: 'TEST456',
        };

        await this.sendBookingSuccessNotifications(testData);
    }

    /**
     * Check notification settings status
     */
    async getNotificationStatus(): Promise<{
        windowsEnabled: boolean;
        emailEnabled: boolean;
        userEmail: string | null;
    }> {
        try {
            const [windowsEnabled, emailEnabled, userEmail] = await Promise.all([
                notificationSettingsService.isWindowsNotificationEnabled(),
                notificationSettingsService.isEmailNotificationEnabled(),
                notificationSettingsService.getUserEmail(),
            ]);

            return {
                windowsEnabled,
                emailEnabled,
                userEmail,
            };
        } catch (error) {
            consoleError('Error getting notification status:', error);
            return {
                windowsEnabled: false,
                emailEnabled: false,
                userEmail: null,
            };
        }
    }
}

// Create singleton instance
export const notificationService = new NotificationService();
