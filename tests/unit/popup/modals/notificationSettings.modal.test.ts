jest.mock('../../../../src/services/notificationSettingsService', () => ({
    notificationSettingsService: {
        loadSettings: jest.fn(),
        saveSettings: jest.fn(),
        clearSettings: jest.fn(),
    },
}));

jest.mock('../../../../src/services/notificationService', () => ({
    notificationService: {
        sendBookingSuccessNotifications: jest.fn(),
    },
}));

jest.mock('../../../../src/utils', () => ({
    consoleLog: jest.fn(),
}));

// Now import the module and get mocked functions
import {
    showNotificationSettingsModal,
    isValidEmail,
} from '../../../../src/popup/modals/notificationSettings.modal';

import { notificationSettingsService } from '../../../../src/services/notificationSettingsService';
import { notificationService } from '../../../../src/services/notificationService';
import { consoleLog } from '../../../../src/utils';

// Get mocked functions
const mockLoadSettings = notificationSettingsService.loadSettings as jest.MockedFunction<any>;
const mockSaveSettings = notificationSettingsService.saveSettings as jest.MockedFunction<any>;
const mockClearSettings = notificationSettingsService.clearSettings as jest.MockedFunction<any>;
const mockSendBookingSuccessNotifications =
    notificationService.sendBookingSuccessNotifications as jest.MockedFunction<any>;
const mockConsoleLog = consoleLog as jest.MockedFunction<any>;

// Mock console to avoid noise in tests
const originalConsole = { ...console };
(global as any).console = {
    ...originalConsole,
    error: jest.fn(),
};

describe('notificationSettings.modal', () => {
    let originalBodyStyle: string;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup DOM
        document.body.innerHTML = '';
        originalBodyStyle = document.body.style.height;

        // Default mock implementations
        mockLoadSettings.mockResolvedValue({
            email: {
                enabled: false,
                userEmail: '',
                additionalEmails: [],
            },
            windows: {
                enabled: false,
            },
            createdAt: Date.now(),
        });

        mockSaveSettings.mockResolvedValue(true);
        mockClearSettings.mockResolvedValue(true);
        mockSendBookingSuccessNotifications.mockResolvedValue(undefined);
        mockConsoleLog.mockImplementation(() => {});

        // Mock timers for statusMessage auto-hide
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        document.body.style.height = originalBodyStyle;
        document.body.innerHTML = '';

        // Remove any remaining event listeners
        const escapeHandler = document.onkeydown;
        if (escapeHandler) {
            document.removeEventListener('keydown', escapeHandler);
        }
    });

    describe('showNotificationSettingsModal', () => {
        it('should return a Promise', () => {
            const result = showNotificationSettingsModal();
            expect(result).toBeInstanceOf(Promise);
        });

        it('should create modal elements in DOM immediately', async () => {
            // Call the function to create the modal
            const modalPromise = showNotificationSettingsModal();

            // Elements should be created synchronously, no need to wait

            // Check if modal elements were created
            const emailCheckbox = document.getElementById('emailNotifications');
            const emailInput = document.getElementById('userEmail');
            const windowsCheckbox = document.getElementById('windowsNotifications');

            expect(emailCheckbox).toBeTruthy();
            expect(emailInput).toBeTruthy();
            expect(windowsCheckbox).toBeTruthy();

            // Close modal immediately to avoid timeout
            const cancelButton = Array.from(document.querySelectorAll('button')).find(btn =>
                btn.textContent?.includes('Anuluj'),
            ) as HTMLElement;
            expect(cancelButton).toBeTruthy();
            cancelButton.click();

            // Wait for modal to resolve
            await modalPromise;
        });
    });

    describe('isValidEmail', () => {
        it('should validate email addresses correctly', () => {
            // Import isValidEmail function - note: this might need to be exported from the module
            // For now, we'll test it indirectly through the modal functionality

            // Valid emails
            expect(isValidEmail('test@example.com')).toBe(true);
            expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
            expect(isValidEmail('test123@test-domain.com')).toBe(true);

            // Invalid emails
            expect(isValidEmail('')).toBe(false);
            expect(isValidEmail('invalid-email')).toBe(false);
            expect(isValidEmail('@domain.com')).toBe(false);
            expect(isValidEmail('test@')).toBe(false);
            expect(isValidEmail('test.domain.com')).toBe(false);
            expect(isValidEmail('test @domain.com')).toBe(false);
        });
    });
});
