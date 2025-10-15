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
                additionalEmails: [], // Keep for compatibility but not used
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

            await setStorage({ [STORAGE_KEY]: settings });
            consoleLog('✅ Notification settings saved successfully');
            return true;
        } catch (error) {
            consoleError('Error saving notification settings:', error);
            return false;
        }
    }

    /**
     * Update a specific notification setting
     */
    async updateSetting(
        type: 'email' | 'windows',
        key: string,
        value: boolean | string,
    ): Promise<boolean> {
        try {
            const settings = await this.loadSettings();

            if (type === 'email' && key in settings.email) {
                (settings.email as any)[key] = value;
            } else if (type === 'windows' && key in settings.windows) {
                (settings.windows as any)[key] = value;
            } else {
                consoleError('Invalid setting type or key:', type, key);
                return false;
            }

            return await this.saveSettings(settings);
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
            const settings = await this.loadSettings();
            return settings.email.enabled && !!settings.email.userEmail;
        } catch (error) {
            consoleError('Error checking email notification status:', error);
            return false;
        }
    }

    /**
     * Check if Windows notifications are enabled
     */
    async isWindowsNotificationEnabled(): Promise<boolean> {
        try {
            const settings = await this.loadSettings();
            return settings.windows.enabled;
        } catch (error) {
            consoleError('Error checking Windows notification status:', error);
            return true; // Default to enabled
        }
    }

    /**
     * Get user email address
     */
    async getUserEmail(): Promise<string | null> {
        try {
            const settings = await this.loadSettings();
            return settings.email.userEmail || null;
        } catch (error) {
            consoleError('Error getting user email:', error);
            return null;
        }
    }

    /**
     * Get user email address for notifications
     */
    async getUserEmailForNotifications(): Promise<string[]> {
        try {
            const settings = await this.loadSettings();
            const emails: string[] = [];

            // Add primary email if valid and enabled
            if (
                settings.email.enabled &&
                settings.email.userEmail &&
                this.isValidEmail(settings.email.userEmail)
            ) {
                emails.push(settings.email.userEmail);
            }

            return emails;
        } catch (error) {
            consoleError('❌ Error getting user email for notifications:', error);
            return [];
        }
    }

    /**
     * Clear all notification settings (reset to default)
     */
    async clearSettings(): Promise<boolean> {
        try {
            const defaultSettings = this.getDefaultSettings();
            return await this.saveSettings(defaultSettings);
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
            Array.isArray(settings.email.additionalEmails) &&
            typeof settings.windows === 'object' &&
            typeof settings.windows.enabled === 'boolean' &&
            typeof settings.createdAt === 'number'
        );
    }

    /**
     * Get settings summary for UI display
     */
    async getSettingsSummary(): Promise<{
        emailEnabled: boolean;
        windowsEnabled: boolean;
        userEmail: string;
        hasValidEmail: boolean;
        totalValidEmails: number;
    }> {
        try {
            const settings = await this.loadSettings();
            const userEmails = await this.getUserEmailForNotifications();

            return {
                emailEnabled: settings.email.enabled,
                windowsEnabled: settings.windows.enabled,
                userEmail: settings.email.userEmail,
                hasValidEmail: this.isValidEmail(settings.email.userEmail),
                totalValidEmails: userEmails.length,
            };
        } catch (error) {
            consoleError('Error getting settings summary:', error);
            return {
                emailEnabled: false,
                windowsEnabled: true,
                userEmail: '',
                hasValidEmail: false,
                totalValidEmails: 0,
            };
        }
    }

    /**
     * Validate email address format
     */
    private isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Set user email and enable email notifications
     */
    async setUserEmailAndEnable(email: string): Promise<boolean> {
        try {
            if (!this.isValidEmail(email)) {
                consoleError('Invalid email format:', email);
                return false;
            }

            const settings = await this.loadSettings();
            settings.email.enabled = true;
            settings.email.userEmail = email;

            return await this.saveSettings(settings);
        } catch (error) {
            consoleError('Error setting user email and enabling notifications:', error);
            return false;
        }
    }

    /**
     * Disable email notifications
     */
    async disableEmailNotifications(): Promise<boolean> {
        try {
            const settings = await this.loadSettings();
            settings.email.enabled = false;
            return await this.saveSettings(settings);
        } catch (error) {
            consoleError('Error disabling email notifications:', error);
            return false;
        }
    }

    /**
     * Enable email notifications
     */
    async enableEmailNotifications(): Promise<boolean> {
        try {
            const settings = await this.loadSettings();
            settings.email.enabled = true;
            return await this.saveSettings(settings);
        } catch (error) {
            consoleError('Error enabling email notifications:', error);
            return false;
        }
    }
}

export const notificationSettingsService = new NotificationSettingsService();
