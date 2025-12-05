import {
    NotificationSettingsService,
    notificationSettingsService,
} from '../../../src/services/notificationSettingsService';
import type { NotificationSettings } from '../../../src/types/general';
import { getStorage, setStorage } from '../../../src/utils/storage';

// Mock dependencies
jest.mock('../../../src/utils/storage');
jest.mock('../../../src/utils/index', () => ({
    consoleLog: jest.fn(),
    consoleError: jest.fn(),
}));

const mockGetStorage = getStorage as jest.MockedFunction<typeof getStorage>;
const mockSetStorage = setStorage as jest.MockedFunction<typeof setStorage>;

describe('NotificationSettingsService', () => {
    let service: NotificationSettingsService;

    const defaultSettings: NotificationSettings = {
        email: {
            enabled: false,
            userEmail: '',
            additionalEmails: [],
        },
        windows: {
            enabled: true,
        },
        createdAt: expect.any(Number),
    };

    const validSettings: NotificationSettings = {
        email: {
            enabled: true,
            userEmail: 'user@example.com',
            additionalEmails: ['manager@example.com'],
        },
        windows: {
            enabled: false,
        },
        createdAt: Date.now(),
    };

    beforeEach(() => {
        service = new NotificationSettingsService();
        jest.clearAllMocks();
    });

    describe('loadSettings', () => {
        it('should return default settings when no settings exist', async () => {
            mockGetStorage.mockResolvedValue({});

            const result = await service.loadSettings();

            expect(result).toEqual(defaultSettings);
        });

        it('should return default settings when invalid settings exist', async () => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: { invalid: 'data' },
            });

            const result = await service.loadSettings();

            expect(result).toEqual(defaultSettings);
        });

        it('should return loaded settings when valid', async () => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: validSettings,
            });

            const result = await service.loadSettings();

            expect(result).toEqual(validSettings);
        });

        it('should return default settings on error', async () => {
            mockGetStorage.mockRejectedValue(new Error('Storage error'));

            const result = await service.loadSettings();

            expect(result).toEqual(defaultSettings);
        });
    });

    describe('saveSettings', () => {
        it('should save valid settings successfully', async () => {
            mockSetStorage.mockResolvedValue();

            const result = await service.saveSettings(validSettings);

            expect(result).toBe(true);
            expect(mockSetStorage).toHaveBeenCalledWith({
                notificationSettings: validSettings,
            });
        });

        it('should reject invalid settings', async () => {
            const invalidSettings = { invalid: 'data' } as any;

            const result = await service.saveSettings(invalidSettings);

            expect(result).toBe(false);
            expect(mockSetStorage).not.toHaveBeenCalled();
        });

        it('should return false on save error', async () => {
            mockSetStorage.mockRejectedValue(new Error('Save error'));

            const result = await service.saveSettings(validSettings);

            expect(result).toBe(false);
        });
    });

    describe('updateSetting', () => {
        beforeEach(() => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: validSettings,
            });
            mockSetStorage.mockResolvedValue();
        });

        it('should update email setting', async () => {
            const result = await service.updateSetting('email', 'enabled', false);

            expect(result).toBe(true);
            expect(mockSetStorage).toHaveBeenCalledWith({
                notificationSettings: {
                    ...validSettings,
                    email: {
                        ...validSettings.email,
                        enabled: false,
                    },
                },
            });
        });

        it('should update windows setting', async () => {
            const result = await service.updateSetting('windows', 'enabled', true);

            expect(result).toBe(true);
            expect(mockSetStorage).toHaveBeenCalledWith({
                notificationSettings: {
                    ...validSettings,
                    windows: {
                        ...validSettings.windows,
                        enabled: true,
                    },
                },
            });
        });

        it('should reject invalid setting type', async () => {
            const result = await service.updateSetting('invalid' as any, 'enabled', true);

            expect(result).toBe(false);
            expect(mockSetStorage).not.toHaveBeenCalled();
        });

        it('should reject invalid setting key', async () => {
            const result = await service.updateSetting('email', 'invalid', true);

            expect(result).toBe(false);
            expect(mockSetStorage).not.toHaveBeenCalled();
        });

        it('should return false on error', async () => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: validSettings,
            });
            mockSetStorage.mockRejectedValue(new Error('Storage error'));

            const result = await service.updateSetting('email', 'enabled', true);

            expect(result).toBe(false);
        });
    });

    describe('isEmailNotificationEnabled', () => {
        it('should return true when email notifications are enabled with valid email', async () => {
            const testSettings = {
                ...validSettings,
                email: {
                    ...validSettings.email,
                    enabled: true,
                    userEmail: 'valid@example.com',
                },
            };

            mockGetStorage.mockResolvedValue({
                notificationSettings: testSettings,
            });

            const result = await service.isEmailNotificationEnabled();

            expect(result).toBe(true);
        });

        it('should return false when email notifications are disabled', async () => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: {
                    ...validSettings,
                    email: { ...validSettings.email, enabled: false },
                },
            });

            const result = await service.isEmailNotificationEnabled();

            expect(result).toBe(false);
        });

        it('should return false when email is empty', async () => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: {
                    ...validSettings,
                    email: { ...validSettings.email, userEmail: '' },
                },
            });

            const result = await service.isEmailNotificationEnabled();

            expect(result).toBe(false);
        });

        it('should return false on error', async () => {
            mockGetStorage.mockRejectedValue(new Error('Storage error'));

            const result = await service.isEmailNotificationEnabled();

            expect(result).toBe(false);
        });

        it('should handle error in isEmailNotificationEnabled', async () => {
            mockGetStorage.mockRejectedValue(new Error('Storage error'));

            const result = await service.isEmailNotificationEnabled();

            expect(result).toBe(false);
        });
    });

    describe('isWindowsNotificationEnabled', () => {
        it('should return false when Windows notifications are disabled', async () => {
            const testSettings = {
                ...validSettings,
                windows: { enabled: false },
            };

            mockGetStorage.mockResolvedValue({
                notificationSettings: testSettings,
            });

            const result = await service.isWindowsNotificationEnabled();

            expect(result).toBe(false);
        });

        it('should return default true on error', async () => {
            mockGetStorage.mockRejectedValue(new Error('Storage error'));

            const result = await service.isWindowsNotificationEnabled();

            expect(result).toBe(true);
        });

        it('should handle error in isWindowsNotificationEnabled', async () => {
            mockGetStorage.mockRejectedValue(new Error('Storage error'));

            const result = await service.isWindowsNotificationEnabled();

            expect(result).toBe(true);
        });
    });

    describe('getUserEmail', () => {
        it('should return user email when available', async () => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: validSettings,
            });

            const result = await service.getUserEmail();

            expect(result).toBe('user@example.com');
        });

        it('should return null when email is empty', async () => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: defaultSettings,
            });

            const result = await service.getUserEmail();

            expect(result).toBe(null);
        });

        it('should return null on error', async () => {
            mockGetStorage.mockRejectedValue(new Error('Storage error'));

            const result = await service.getUserEmail();

            expect(result).toBe(null);
        });

        it('should handle error in getUserEmail', async () => {
            mockGetStorage.mockRejectedValue(new Error('Storage error'));

            const result = await service.getUserEmail();

            expect(result).toBe(null);
        });
    });

    describe('getUserEmailForNotifications', () => {
        it('should return user email when enabled and valid', async () => {
            const testSettings = {
                ...validSettings,
                email: {
                    ...validSettings.email,
                    enabled: true,
                    userEmail: 'valid@example.com',
                },
            };

            mockGetStorage.mockResolvedValue({
                notificationSettings: testSettings,
            });

            const result = await service.getUserEmailForNotifications();

            expect(result).toEqual(['valid@example.com']);
        });

        it('should return empty array when email notifications are disabled', async () => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: {
                    ...validSettings,
                    email: { ...validSettings.email, enabled: false },
                },
            });

            const result = await service.getUserEmailForNotifications();

            expect(result).toEqual([]);
        });

        it('should return empty array when email is invalid', async () => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: {
                    ...validSettings,
                    email: { ...validSettings.email, userEmail: 'invalid-email' },
                },
            });

            const result = await service.getUserEmailForNotifications();

            expect(result).toEqual([]);
        });

        it('should return empty array on error', async () => {
            mockGetStorage.mockRejectedValue(new Error('Storage error'));

            const result = await service.getUserEmailForNotifications();

            expect(result).toEqual([]);
        });

        it('should handle error in getUserEmailForNotifications', async () => {
            mockGetStorage.mockRejectedValue(new Error('Storage error'));

            const result = await service.getUserEmailForNotifications();

            expect(result).toEqual([]);
        });
    });

    describe('clearSettings', () => {
        it('should reset settings to default', async () => {
            mockSetStorage.mockResolvedValue();

            const result = await service.clearSettings();

            expect(result).toBe(true);
            expect(mockSetStorage).toHaveBeenCalledWith({
                notificationSettings: expect.objectContaining({
                    email: expect.objectContaining({
                        enabled: false,
                        userEmail: '',
                        additionalEmails: [],
                    }),
                    windows: expect.objectContaining({
                        enabled: true,
                    }),
                    createdAt: expect.any(Number),
                }),
            });
        });

        it('should return false on error', async () => {
            mockSetStorage.mockRejectedValue(new Error('Clear error'));

            const result = await service.clearSettings();

            expect(result).toBe(false);
        });

        it('should handle error in clearSettings', async () => {
            mockSetStorage.mockRejectedValue(new Error('Clear error'));

            const result = await service.clearSettings();

            expect(result).toBe(false);
        });
    });

    describe('getSettingsSummary', () => {
        beforeEach(() => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: validSettings,
            });
        });

        it('should return correct summary for valid settings', async () => {
            const testSettings = {
                ...validSettings,
                email: {
                    ...validSettings.email,
                    enabled: true,
                    userEmail: 'valid@example.com',
                },
                windows: {
                    enabled: false,
                },
            };

            mockGetStorage.mockResolvedValue({
                notificationSettings: testSettings,
            });

            const result = await service.getSettingsSummary();

            expect(result).toEqual({
                emailEnabled: true,
                windowsEnabled: false,
                userEmail: 'valid@example.com',
                hasValidEmail: true,
                totalValidEmails: 1,
            });
        });

        it('should return correct summary for disabled email', async () => {
            const testSettings = {
                ...validSettings,
                email: { ...validSettings.email, enabled: false },
                windows: { ...validSettings.windows, enabled: false },
            };

            mockGetStorage.mockResolvedValue({
                notificationSettings: testSettings,
            });

            const result = await service.getSettingsSummary();

            expect(result).toEqual({
                emailEnabled: false,
                windowsEnabled: false,
                userEmail: 'user@example.com',
                hasValidEmail: true,
                totalValidEmails: 0,
            });
        });

        it('should return default summary on error', async () => {
            mockGetStorage.mockRejectedValue(new Error('Storage error'));

            const result = await service.getSettingsSummary();

            expect(result).toEqual({
                emailEnabled: false,
                windowsEnabled: true,
                userEmail: '',
                hasValidEmail: false,
                totalValidEmails: 0,
            });
        });

        it('should handle error in getSettingsSummary', async () => {
            mockGetStorage.mockRejectedValue(new Error('Storage error'));

            const result = await service.getSettingsSummary();

            expect(result).toEqual({
                emailEnabled: false,
                windowsEnabled: true,
                userEmail: '',
                hasValidEmail: false,
                totalValidEmails: 0,
            });
        });
    });

    describe('setUserEmailAndEnable', () => {
        beforeEach(() => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: validSettings,
            });
            mockSetStorage.mockResolvedValue();
        });

        it('should accept valid email formats', async () => {
            const validEmails = [
                'user@example.com',
                'test.email+tag@domain.co.uk',
                'user123@test-domain.org',
                'a@b.co',
            ];

            for (const email of validEmails) {
                const result = await service.setUserEmailAndEnable(email);
                expect(result).toBe(true);
                jest.clearAllMocks();
            }
        });

        it('should reject invalid email formats', async () => {
            const invalidEmails = ['invalid-email', '@domain.com', 'user@', 'user.domain.com', ''];

            for (const email of invalidEmails) {
                const result = await service.setUserEmailAndEnable(email);
                expect(result).toBe(false);
            }
        });

        it('should return false on error in setUserEmailAndEnable', async () => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: validSettings,
            });
            mockSetStorage.mockRejectedValue(new Error('Storage error'));

            const result = await service.setUserEmailAndEnable('valid@example.com');

            expect(result).toBe(false);
        });
    });

    describe('disableEmailNotifications', () => {
        beforeEach(() => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: validSettings,
            });
            mockSetStorage.mockResolvedValue();
        });

        it('should disable email notifications successfully', async () => {
            const result = await service.disableEmailNotifications();

            expect(result).toBe(true);
            expect(mockSetStorage).toHaveBeenCalledWith({
                notificationSettings: {
                    ...validSettings,
                    email: {
                        ...validSettings.email,
                        enabled: false,
                    },
                },
            });
        });

        it('should return false on error', async () => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: validSettings,
            });
            mockSetStorage.mockRejectedValue(new Error('Storage error'));

            const result = await service.disableEmailNotifications();

            expect(result).toBe(false);
        });
    });

    describe('enableEmailNotifications', () => {
        beforeEach(() => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: {
                    ...validSettings,
                    email: {
                        ...validSettings.email,
                        enabled: false,
                    },
                },
            });
            mockSetStorage.mockResolvedValue();
        });

        it('should enable email notifications successfully', async () => {
            const result = await service.enableEmailNotifications();

            expect(result).toBe(true);
            expect(mockSetStorage).toHaveBeenCalledWith({
                notificationSettings: {
                    ...validSettings,
                    email: {
                        ...validSettings.email,
                        enabled: true,
                    },
                },
            });
        });

        it('should return false on error', async () => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: {
                    ...validSettings,
                    email: {
                        ...validSettings.email,
                        enabled: false,
                    },
                },
            });
            mockSetStorage.mockRejectedValue(new Error('Storage error'));

            const result = await service.enableEmailNotifications();

            expect(result).toBe(false);
        });
    });

    describe('singleton instance', () => {
        it('should export singleton instance', () => {
            expect(notificationSettingsService).toBeInstanceOf(NotificationSettingsService);
        });
    });
});
