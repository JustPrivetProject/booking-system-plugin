import type { NotificationSettings } from '../types/general';
import { getStorage, setStorage } from '../utils/storage';
import { consoleLog, consoleError } from '../utils/index';

const STORAGE_KEY = 'notificationSettings';

/**
 * Service for managing notification preferences
 */
export class NotificationSettingsService {
    /**
     * Get default notification settings
     */
    private getDefaultSettings(): NotificationSettings {
        return {
            email: {
                enabled: false,
                userEmail: '',
                additionalEmails: [],
            },
            windows: {
                enabled: true, // Windows notifications enabled by default
            },
            createdAt: Date.now(),
        };
    }

    /**
     * Load notification settings from storage
     */
    async loadSettings(): Promise<NotificationSettings> {
        try {
            const result = await getStorage(STORAGE_KEY);
            const settings = result[STORAGE_KEY] as NotificationSettings;

            if (settings && this.isValidSettings(settings)) {
                return settings;
            }

            // Return default settings if none exist or invalid
            return this.getDefaultSettings();
        } catch (error) {
            consoleError('Error loading notification settings:', error);
            return this.getDefaultSettings();
        }
    }

    /**
     * Save notification settings to storage
     */
    async saveSettings(settings: NotificationSettings): Promise<boolean> {
        try {
            if (!this.isValidSettings(settings)) {
                consoleError('Invalid notification settings provided');
                return false;
            }

            settings.createdAt = Date.now();
            await setStorage({ [STORAGE_KEY]: settings });
            consoleLog('Notification settings saved successfully');
            return true;
        } catch (error) {
            consoleError('Error saving notification settings:', error);
            return false;
        }
    }

    /**
     * Update specific notification setting
     */
    async updateSetting(
        type: 'email' | 'windows',
        key: string,
        value: boolean | string,
    ): Promise<boolean> {
        try {
            const currentSettings = await this.loadSettings();

            if (type === 'email' && key === 'enabled') {
                currentSettings.email.enabled = value as boolean;
            } else if (type === 'email' && key === 'userEmail') {
                currentSettings.email.userEmail = value as string;
            } else if (type === 'windows' && key === 'enabled') {
                currentSettings.windows.enabled = value as boolean;
            } else {
                consoleError('Invalid setting type or key');
                return false;
            }

            return await this.saveSettings(currentSettings);
        } catch (error) {
            consoleError('Error updating notification setting:', error);
            return false;
        }
    }

    /**
     * Check if email notifications are enabled
     */
    async isEmailNotificationEnabled(): Promise<boolean> {
        try {
            consoleLog('⚙️ Checking email notification status...');
            const settings = await this.loadSettings();
            const isEnabled = settings.email.enabled && !!settings.email.userEmail;
            consoleLog('⚙️ Email notification status:', {
                enabled: settings.email.enabled,
                hasEmail: !!settings.email.userEmail,
                userEmail: settings.email.userEmail ? settings.email.userEmail : 'No email',
                finalResult: isEnabled,
            });
            return isEnabled;
        } catch (error) {
            consoleError('❌ Error checking email notification status:', error);
            return false;
        }
    }

    /**
     * Check if Windows notifications are enabled
     */
    async isWindowsNotificationEnabled(): Promise<boolean> {
        try {
            consoleLog('⚙️ Checking Windows notification status...');
            const settings = await this.loadSettings();
            const isEnabled = settings.windows.enabled;
            consoleLog('⚙️ Windows notification status:', {
                enabled: isEnabled,
                settings: settings.windows,
            });
            return isEnabled;
        } catch (error) {
            consoleError('❌ Error checking Windows notification status:', error);
            return true; // Default to enabled
        }
    }

    /**
     * Get user email for notifications
     */
    async getUserEmail(): Promise<string | null> {
        try {
            consoleLog('⚙️ Getting user email for notifications...');
            const settings = await this.loadSettings();
            const userEmail = settings.email.userEmail || null;
            consoleLog('⚙️ User email result:', userEmail ? userEmail : 'No email configured');
            return userEmail;
        } catch (error) {
            consoleError('❌ Error getting user email:', error);
            return null;
        }
    }

    /**
     * Clear notification settings
     */
    async clearSettings(): Promise<boolean> {
        try {
            const defaultSettings = this.getDefaultSettings();
            await setStorage({ [STORAGE_KEY]: defaultSettings });
            consoleLog('Notification settings cleared and reset to defaults');
            return true;
        } catch (error) {
            consoleError('Error clearing notification settings:', error);
            return false;
        }
    }

    /**
     * Validate notification settings structure
     */
    private isValidSettings(settings: any): settings is NotificationSettings {
        return (
            settings &&
            typeof settings === 'object' &&
            typeof settings.email === 'object' &&
            typeof settings.email.enabled === 'boolean' &&
            typeof settings.email.userEmail === 'string' &&
            typeof settings.windows === 'object' &&
            typeof settings.windows.enabled === 'boolean' &&
            typeof settings.createdAt === 'number'
        );
    }

    /**
     * Get notification settings summary for display
     */
    async getSettingsSummary(): Promise<{
        emailEnabled: boolean;
        windowsEnabled: boolean;
        userEmail: string;
        additionalEmails: string[];
        hasValidEmail: boolean;
        totalValidEmails: number;
    }> {
        try {
            const settings = await this.loadSettings();
            const allEmails = await this.getAllEmailAddresses();

            return {
                emailEnabled: settings.email.enabled,
                windowsEnabled: settings.windows.enabled,
                userEmail: settings.email.userEmail,
                additionalEmails: settings.email.additionalEmails || [],
                hasValidEmail: this.isValidEmail(settings.email.userEmail),
                totalValidEmails: allEmails.length,
            };
        } catch (error) {
            consoleError('Error getting settings summary:', error);
            return {
                emailEnabled: false,
                windowsEnabled: true,
                userEmail: '',
                additionalEmails: [],
                hasValidEmail: false,
                totalValidEmails: 0,
            };
        }
    }

    /**
     * Simple email validation
     */
    private isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Set user email and enable email notifications
     */
    async setUserEmailAndEnable(email: string): Promise<boolean> {
        if (!this.isValidEmail(email)) {
            consoleError('Invalid email address provided');
            return false;
        }

        try {
            const settings = await this.loadSettings();
            settings.email.userEmail = email;
            settings.email.enabled = true;

            return await this.saveSettings(settings);
        } catch (error) {
            consoleError('Error setting user email:', error);
            return false;
        }
    }

    /**
     * Disable email notifications but keep email address
     */
    async disableEmailNotifications(): Promise<boolean> {
        try {
            return await this.updateSetting('email', 'enabled', false);
        } catch (error) {
            consoleError('Error disabling email notifications:', error);
            return false;
        }
    }

    /**
     * Enable email notifications (if email is set)
     */
    async enableEmailNotifications(): Promise<boolean> {
        try {
            const settings = await this.loadSettings();
            if (!settings.email.userEmail || !this.isValidEmail(settings.email.userEmail)) {
                consoleError('Cannot enable email notifications: no valid email address');
                return false;
            }

            return await this.updateSetting('email', 'enabled', true);
        } catch (error) {
            consoleError('Error enabling email notifications:', error);
            return false;
        }
    }

    /**
     * Get all email addresses for notifications (primary + additional)
     */
    async getAllEmailAddresses(): Promise<string[]> {
        try {
            consoleLog('⚙️ Getting all email addresses...');
            const settings = await this.loadSettings();
            const emails: string[] = [];

            // Add primary email if valid
            if (settings.email.userEmail && this.isValidEmail(settings.email.userEmail)) {
                emails.push(settings.email.userEmail);
            }

            // Add additional emails if valid
            if (settings.email.additionalEmails) {
                const validAdditionalEmails = settings.email.additionalEmails.filter(
                    email => email && this.isValidEmail(email),
                );
                emails.push(...validAdditionalEmails);
            }

            // Remove duplicates
            const uniqueEmails = [...new Set(emails)];
            consoleLog('⚙️ All valid email addresses:', uniqueEmails);

            return uniqueEmails;
        } catch (error) {
            consoleError('❌ Error getting all email addresses:', error);
            return [];
        }
    }

    /**
     * Add additional email address
     */
    async addAdditionalEmail(email: string): Promise<boolean> {
        try {
            if (!this.isValidEmail(email)) {
                consoleError('❌ Invalid email format:', email);
                return false;
            }

            const settings = await this.loadSettings();

            // Check if email already exists
            const allEmails = [settings.email.userEmail, ...settings.email.additionalEmails];
            if (allEmails.includes(email)) {
                consoleLog('⚙️ Email already exists in the list:', email);
                return false;
            }

            settings.email.additionalEmails.push(email);
            const result = await this.saveSettings(settings);

            if (result) {
                consoleLog('✅ Additional email added successfully:', email);
            }

            return result;
        } catch (error) {
            consoleError('❌ Error adding additional email:', error);
            return false;
        }
    }

    /**
     * Remove additional email address
     */
    async removeAdditionalEmail(email: string): Promise<boolean> {
        try {
            const settings = await this.loadSettings();
            const initialLength = settings.email.additionalEmails.length;

            settings.email.additionalEmails = settings.email.additionalEmails.filter(
                e => e !== email,
            );

            if (settings.email.additionalEmails.length === initialLength) {
                consoleLog('⚙️ Email not found in additional emails list:', email);
                return false;
            }

            const result = await this.saveSettings(settings);

            if (result) {
                consoleLog('✅ Additional email removed successfully:', email);
            }

            return result;
        } catch (error) {
            consoleError('❌ Error removing additional email:', error);
            return false;
        }
    }
}

// Create singleton instance
export const notificationSettingsService = new NotificationSettingsService();
