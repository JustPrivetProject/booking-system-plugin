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
        createdAt: Date.now(),
    };

    const validSettings: NotificationSettings = {
        email: {
            enabled: true,
            userEmail: 'user@example.com',
            additionalEmails: ['manager@example.com'],
        },
        windows: {
            enabled: true,
        },
        createdAt: Date.now(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        service = new NotificationSettingsService();

        // Reset all mocks to default state - no automatic resolution
        mockGetStorage.mockReset();
        mockSetStorage.mockReset();
    });

    describe('loadSettings', () => {
        it('should return stored settings when valid', async () => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: validSettings,
            });

            const result = await service.loadSettings();

            expect(result).toEqual(validSettings);
            expect(mockGetStorage).toHaveBeenCalledWith('notificationSettings');
        });

        it('should return default settings when no settings exist', async () => {
            mockGetStorage.mockResolvedValue({});

            const result = await service.loadSettings();

            expect(result).toMatchObject({
                email: {
                    enabled: false,
                    userEmail: '',
                    additionalEmails: [],
                },
                windows: {
                    enabled: true,
                },
            });
            expect(result.createdAt).toBeGreaterThan(0);
        });

        it('should return default settings when stored settings are invalid', async () => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: { invalid: 'data' },
            });

            const result = await service.loadSettings();

            expect(result).toMatchObject({
                email: {
                    enabled: false,
                    userEmail: '',
                    additionalEmails: [],
                },
                windows: {
                    enabled: true,
                },
            });
        });

        it('should return default settings on storage error', async () => {
            mockGetStorage.mockRejectedValue(new Error('Storage error'));

            const result = await service.loadSettings();

            expect(result).toMatchObject({
                email: {
                    enabled: false,
                    userEmail: '',
                    additionalEmails: [],
                },
                windows: {
                    enabled: true,
                },
            });
        });
    });

    describe('saveSettings', () => {
        it('should save valid settings successfully', async () => {
            mockSetStorage.mockResolvedValue();

            const result = await service.saveSettings(validSettings);

            expect(result).toBe(true);
            expect(mockSetStorage).toHaveBeenCalledWith({
                notificationSettings: expect.objectContaining({
                    ...validSettings,
                    createdAt: expect.any(Number),
                }),
            });
        });

        it('should reject invalid settings', async () => {
            const invalidSettings = { invalid: 'data' } as any;

            const result = await service.saveSettings(invalidSettings);

            expect(result).toBe(false);
            expect(mockSetStorage).not.toHaveBeenCalled();
        });

        it('should handle storage error', async () => {
            mockSetStorage.mockRejectedValue(new Error('Storage error'));

            const result = await service.saveSettings(validSettings);

            expect(result).toBe(false);
        });

        it('should update createdAt timestamp', async () => {
            mockSetStorage.mockResolvedValue();
            const oldTimestamp = validSettings.createdAt;

            await service.saveSettings(validSettings);

            const savedData = mockSetStorage.mock.calls[0][0] as {
                notificationSettings: NotificationSettings;
            };
            expect(savedData.notificationSettings.createdAt).toBeGreaterThan(oldTimestamp);
        });
    });

    describe('updateSetting', () => {
        beforeEach(() => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: validSettings,
            });
            mockSetStorage.mockResolvedValue();
        });

        it('should update email enabled setting', async () => {
            const result = await service.updateSetting('email', 'enabled', false);

            expect(result).toBe(true);
            const savedData = mockSetStorage.mock.calls[0][0] as {
                notificationSettings: NotificationSettings;
            };
            expect(savedData.notificationSettings.email.enabled).toBe(false);
        });

        it('should update email userEmail setting', async () => {
            const result = await service.updateSetting('email', 'userEmail', 'new@example.com');

            expect(result).toBe(true);
            const savedData = mockSetStorage.mock.calls[0][0] as {
                notificationSettings: NotificationSettings;
            };
            expect(savedData.notificationSettings.email.userEmail).toBe('new@example.com');
        });

        it('should update windows enabled setting', async () => {
            const result = await service.updateSetting('windows', 'enabled', false);

            expect(result).toBe(true);
            const savedData = mockSetStorage.mock.calls[0][0] as {
                notificationSettings: NotificationSettings;
            };
            expect(savedData.notificationSettings.windows.enabled).toBe(false);
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
    });

    describe('isEmailNotificationEnabled', () => {
        it('should return true when email is enabled and email is set', async () => {
            const testSettings = {
                email: {
                    enabled: true,
                    userEmail: 'user@example.com',
                    additionalEmails: [],
                },
                windows: {
                    enabled: true,
                },
                createdAt: Date.now(),
            };

            mockGetStorage.mockResolvedValue({
                notificationSettings: testSettings,
            });

            const result = await service.isEmailNotificationEnabled();

            expect(result).toBe(true);
        });

        it('should return false when email is disabled', async () => {
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
    });

    describe('isWindowsNotificationEnabled', () => {
        it('should return true when windows notifications are enabled', async () => {
            const testSettings = {
                email: {
                    enabled: false,
                    userEmail: '',
                    additionalEmails: [],
                },
                windows: {
                    enabled: true,
                },
                createdAt: Date.now(),
            };

            mockGetStorage.mockResolvedValue({
                notificationSettings: testSettings,
            });

            const result = await service.isWindowsNotificationEnabled();

            expect(result).toBe(true);
        });

        it('should return false when windows notifications are disabled', async () => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: {
                    ...validSettings,
                    windows: { enabled: false },
                },
            });

            const result = await service.isWindowsNotificationEnabled();

            expect(result).toBe(false);
        });

        it('should return true on error (default)', async () => {
            mockGetStorage.mockRejectedValue(new Error('Storage error'));

            const result = await service.isWindowsNotificationEnabled();

            expect(result).toBe(true);
        });
    });

    describe('getUserEmail', () => {
        it('should return user email when set', async () => {
            const testSettings = {
                email: {
                    enabled: true,
                    userEmail: 'user@example.com',
                    additionalEmails: [],
                },
                windows: {
                    enabled: true,
                },
                createdAt: Date.now(),
            };

            mockGetStorage.mockResolvedValue({
                notificationSettings: testSettings,
            });

            const result = await service.getUserEmail();

            expect(result).toBe('user@example.com');
        });

        it('should return null when email is empty', async () => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: {
                    ...validSettings,
                    email: { ...validSettings.email, userEmail: '' },
                },
            });

            const result = await service.getUserEmail();

            expect(result).toBeNull();
        });

        it('should return null on error', async () => {
            mockGetStorage.mockRejectedValue(new Error('Storage error'));

            const result = await service.getUserEmail();

            expect(result).toBeNull();
        });
    });

    describe('clearSettings', () => {
        it('should reset settings to defaults', async () => {
            mockSetStorage.mockResolvedValue();

            const result = await service.clearSettings();

            expect(result).toBe(true);
            const savedData = mockSetStorage.mock.calls[0][0] as {
                notificationSettings: NotificationSettings;
            };
            expect(savedData.notificationSettings).toMatchObject({
                email: {
                    enabled: false,
                    userEmail: '',
                    additionalEmails: [],
                },
                windows: {
                    enabled: true,
                },
            });
        });

        it('should handle storage error', async () => {
            mockSetStorage.mockRejectedValue(new Error('Storage error'));

            const result = await service.clearSettings();

            expect(result).toBe(false);
        });
    });

    describe('getSettingsSummary', () => {
        it('should return complete settings summary', async () => {
            const testSettings = {
                email: {
                    enabled: true,
                    userEmail: 'user@example.com',
                    additionalEmails: ['manager@example.com'],
                },
                windows: {
                    enabled: true,
                },
                createdAt: Date.now(),
            };

            // Mock both calls - one for getSettingsSummary, one for getAllEmailAddresses
            mockGetStorage.mockResolvedValue({
                notificationSettings: testSettings,
            });

            const result = await service.getSettingsSummary();

            expect(result).toEqual({
                emailEnabled: true,
                windowsEnabled: true,
                userEmail: 'user@example.com',
                additionalEmails: ['manager@example.com'],
                hasValidEmail: true,
                totalValidEmails: 2,
            });
        });

        it('should return default summary on error', async () => {
            mockGetStorage.mockRejectedValue(new Error('Storage error'));

            const result = await service.getSettingsSummary();

            expect(result).toEqual({
                emailEnabled: false,
                windowsEnabled: true,
                userEmail: '',
                additionalEmails: [],
                hasValidEmail: false,
                totalValidEmails: 0,
            });
        });
    });

    describe('setUserEmailAndEnable', () => {
        beforeEach(() => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: defaultSettings,
            });
            mockSetStorage.mockResolvedValue();
        });

        it('should set valid email and enable notifications', async () => {
            const result = await service.setUserEmailAndEnable('new@example.com');

            expect(result).toBe(true);
            const savedData = mockSetStorage.mock.calls[0][0] as {
                notificationSettings: NotificationSettings;
            };
            expect(savedData.notificationSettings.email.userEmail).toBe('new@example.com');
            expect(savedData.notificationSettings.email.enabled).toBe(true);
        });

        it('should reject invalid email', async () => {
            const result = await service.setUserEmailAndEnable('invalid-email');

            expect(result).toBe(false);
            expect(mockSetStorage).not.toHaveBeenCalled();
        });
    });

    describe('enableEmailNotifications', () => {
        it('should enable email notifications when valid email exists', async () => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: {
                    ...defaultSettings,
                    email: { ...defaultSettings.email, userEmail: 'user@example.com' },
                },
            });
            mockSetStorage.mockResolvedValue();

            const result = await service.enableEmailNotifications();

            expect(result).toBe(true);
        });

        it('should fail when no valid email exists', async () => {
            const testSettings = {
                email: {
                    enabled: false,
                    userEmail: '', // Empty email
                    additionalEmails: [],
                },
                windows: {
                    enabled: true,
                },
                createdAt: Date.now(),
            };

            mockGetStorage.mockResolvedValue({
                notificationSettings: testSettings,
            });

            const result = await service.enableEmailNotifications();

            expect(result).toBe(false);
            expect(mockSetStorage).not.toHaveBeenCalled();
        });
    });

    describe('disableEmailNotifications', () => {
        it('should disable email notifications', async () => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: validSettings,
            });
            mockSetStorage.mockResolvedValue();

            const result = await service.disableEmailNotifications();

            expect(result).toBe(true);
        });
    });

    describe('getAllEmailAddresses', () => {
        it('should return all valid email addresses', async () => {
            const testSettings = {
                email: {
                    enabled: true,
                    userEmail: 'user@example.com',
                    additionalEmails: ['manager@example.com'],
                },
                windows: {
                    enabled: true,
                },
                createdAt: Date.now(),
            };

            mockGetStorage.mockResolvedValue({
                notificationSettings: testSettings,
            });

            const result = await service.getAllEmailAddresses();

            expect(result).toEqual(['user@example.com', 'manager@example.com']);
        });

        it('should filter out invalid emails', async () => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: {
                    ...validSettings,
                    email: {
                        ...validSettings.email,
                        userEmail: 'valid@example.com',
                        additionalEmails: ['valid2@example.com', 'invalid-email', ''],
                    },
                },
            });

            const result = await service.getAllEmailAddresses();

            expect(result).toEqual(['valid@example.com', 'valid2@example.com']);
        });

        it('should remove duplicates', async () => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: {
                    ...validSettings,
                    email: {
                        ...validSettings.email,
                        userEmail: 'same@example.com',
                        additionalEmails: ['same@example.com', 'other@example.com'],
                    },
                },
            });

            const result = await service.getAllEmailAddresses();

            expect(result).toEqual(['same@example.com', 'other@example.com']);
        });

        it('should return empty array on error', async () => {
            mockGetStorage.mockRejectedValue(new Error('Storage error'));

            const result = await service.getAllEmailAddresses();

            expect(result).toEqual([]);
        });
    });

    describe('addAdditionalEmail', () => {
        it('should add valid additional email', async () => {
            const testSettings = {
                email: {
                    enabled: true,
                    userEmail: 'user@example.com',
                    additionalEmails: ['manager@example.com'],
                },
                windows: {
                    enabled: true,
                },
                createdAt: Date.now(),
            };

            mockGetStorage.mockResolvedValue({
                notificationSettings: testSettings,
            });
            mockSetStorage.mockResolvedValue();

            const result = await service.addAdditionalEmail('new@example.com');

            expect(result).toBe(true);
            const savedData = mockSetStorage.mock.calls[0][0] as {
                notificationSettings: NotificationSettings;
            };
            expect(savedData.notificationSettings.email.additionalEmails).toContain(
                'new@example.com',
            );
        });

        it('should reject invalid email format', async () => {
            const result = await service.addAdditionalEmail('invalid-email');

            expect(result).toBe(false);
            expect(mockSetStorage).not.toHaveBeenCalled();
        });

        it('should reject duplicate email (primary)', async () => {
            const testSettings = {
                email: {
                    enabled: true,
                    userEmail: 'user@example.com',
                    additionalEmails: ['manager@example.com'],
                },
                windows: {
                    enabled: true,
                },
                createdAt: Date.now(),
            };

            mockGetStorage.mockResolvedValue({
                notificationSettings: testSettings,
            });

            const result = await service.addAdditionalEmail('user@example.com');

            expect(result).toBe(false);
            expect(mockSetStorage).not.toHaveBeenCalled();
        });

        it('should reject duplicate email (additional)', async () => {
            const testSettings = {
                email: {
                    enabled: true,
                    userEmail: 'user@example.com',
                    additionalEmails: ['manager@example.com'],
                },
                windows: {
                    enabled: true,
                },
                createdAt: Date.now(),
            };

            mockGetStorage.mockResolvedValue({
                notificationSettings: testSettings,
            });

            const result = await service.addAdditionalEmail('manager@example.com');

            expect(result).toBe(false);
            expect(mockSetStorage).not.toHaveBeenCalled();
        });
    });

    describe('removeAdditionalEmail', () => {
        beforeEach(() => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: validSettings,
            });
            mockSetStorage.mockResolvedValue();
        });

        it('should remove existing additional email', async () => {
            const result = await service.removeAdditionalEmail('manager@example.com');

            expect(result).toBe(true);
            const savedData = mockSetStorage.mock.calls[0][0] as {
                notificationSettings: NotificationSettings;
            };
            expect(savedData.notificationSettings.email.additionalEmails).not.toContain(
                'manager@example.com',
            );
        });

        it('should return false for non-existing email', async () => {
            const result = await service.removeAdditionalEmail('nonexisting@example.com');

            expect(result).toBe(false);
            expect(mockSetStorage).not.toHaveBeenCalled();
        });
    });

    describe('email validation', () => {
        beforeEach(() => {
            mockGetStorage.mockResolvedValue({
                notificationSettings: defaultSettings,
            });
        });

        it('should validate correct email formats', async () => {
            const validEmails = [
                'user@example.com',
                'test.email+tag@domain.co.uk',
                'user123@test-domain.com',
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
    });

    describe('singleton instance', () => {
        it('should export singleton instance', () => {
            expect(notificationSettingsService).toBeInstanceOf(NotificationSettingsService);
        });
    });
});
