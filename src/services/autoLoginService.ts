import { consoleError, consoleLog, getStorage, removeStorage, setStorage } from '../utils';
import { BOOKING_TERMINALS, type BookingTerminal } from '../types/terminal';

import { authService } from './authService';

export interface AutoLoginCredentials {
    login: string;
    password: string;
}

export interface AutoLoginData {
    login: string;
    password: string;
    enabled: boolean;
    createdAt: number;
}

const AUTO_LOGIN_STORAGE_KEY = 'autoLoginData';

export function getAutoLoginStorageKey(terminal: BookingTerminal = BOOKING_TERMINALS.DCT): string {
    return terminal === BOOKING_TERMINALS.DCT
        ? `${AUTO_LOGIN_STORAGE_KEY}:${BOOKING_TERMINALS.DCT}`
        : `${AUTO_LOGIN_STORAGE_KEY}:${terminal}`;
}

function getAutoLoginStorageKeys(terminal: BookingTerminal = BOOKING_TERMINALS.DCT): string[] {
    const terminalKey = getAutoLoginStorageKey(terminal);

    return terminal === BOOKING_TERMINALS.DCT
        ? [terminalKey, AUTO_LOGIN_STORAGE_KEY]
        : [terminalKey];
}

async function loadStoredAutoLoginData(
    terminal: BookingTerminal = BOOKING_TERMINALS.DCT,
): Promise<AutoLoginData | null> {
    const [terminalKey, legacyKey] = getAutoLoginStorageKeys(terminal);
    const result = await getStorage(getAutoLoginStorageKeys(terminal));
    const terminalData = result[terminalKey] as AutoLoginData | undefined;

    if (terminalData) {
        return terminalData;
    }

    if (legacyKey && legacyKey !== terminalKey) {
        const legacyData = result[legacyKey] as AutoLoginData | undefined;

        if (legacyData) {
            await setStorage({ [terminalKey]: legacyData });
            await removeStorage(AUTO_LOGIN_STORAGE_KEY);
            return legacyData;
        }
    }

    return null;
}

async function saveStoredAutoLoginData(
    autoLoginData: AutoLoginData,
    terminal: BookingTerminal = BOOKING_TERMINALS.DCT,
): Promise<void> {
    const terminalKey = getAutoLoginStorageKey(terminal);

    await setStorage({ [terminalKey]: autoLoginData });
}

async function clearStoredAutoLoginData(
    terminal: BookingTerminal = BOOKING_TERMINALS.DCT,
): Promise<void> {
    await removeStorage(getAutoLoginStorageKeys(terminal));
}

// Simple encryption/decryption using a secret key
// In production, you should use a more secure encryption method
const CRYPTO_SECRET_KEY = process.env.CRYPTO_SECRET_KEY || 'your-secret-key-here'; // From environment variable

// Validate that we have a proper secret key
if (CRYPTO_SECRET_KEY === 'your-secret-key-here') {
    consoleLog(
        'CRYPTO_SECRET_KEY is using default value. Please set a proper secret key in .env file',
    );
}

function encrypt(text: string): string {
    try {
        // Convert text to UTF-8 bytes
        const textEncoder = new TextEncoder();
        const textBytes = textEncoder.encode(text);

        // Convert secret key to bytes
        const keyBytes = textEncoder.encode(CRYPTO_SECRET_KEY);

        // XOR encryption with proper byte handling
        const encryptedBytes = new Uint8Array(textBytes.length);
        for (let i = 0; i < textBytes.length; i++) {
            encryptedBytes[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
        }

        // Convert to base64
        const binaryString = String.fromCharCode(...encryptedBytes);
        return btoa(binaryString);
    } catch (error) {
        consoleError('Encryption failed:', error);
        return '';
    }
}

function decrypt(encryptedText: string): string {
    try {
        // Decode from base64
        const binaryString = atob(encryptedText);
        const encryptedBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            encryptedBytes[i] = binaryString.charCodeAt(i);
        }

        // Convert secret key to bytes
        const textEncoder = new TextEncoder();
        const keyBytes = textEncoder.encode(CRYPTO_SECRET_KEY);

        // XOR decryption
        const decryptedBytes = new Uint8Array(encryptedBytes.length);
        for (let i = 0; i < encryptedBytes.length; i++) {
            decryptedBytes[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
        }

        // Convert back to string
        const textDecoder = new TextDecoder('utf-8');
        return textDecoder.decode(decryptedBytes);
    } catch (error) {
        consoleError('Failed to decrypt auto-login data:', error);
        return '';
    }
}

export const autoLoginService = {
    /**
     * Save auto-login credentials with encryption
     */
    async saveCredentials(
        credentials: AutoLoginCredentials,
        terminal: BookingTerminal = BOOKING_TERMINALS.DCT,
    ): Promise<void> {
        const autoLoginData: AutoLoginData = {
            login: encrypt(credentials.login),
            password: encrypt(credentials.password),
            enabled: true,
            createdAt: Date.now(),
        };

        await saveStoredAutoLoginData(autoLoginData, terminal);
    },

    /**
     * Load auto-login credentials with decryption
     */
    async loadCredentials(
        terminal: BookingTerminal = BOOKING_TERMINALS.DCT,
    ): Promise<AutoLoginCredentials | null> {
        try {
            const autoLoginData = await loadStoredAutoLoginData(terminal);

            if (!autoLoginData || !autoLoginData.enabled) {
                return null;
            }

            return {
                login: decrypt(autoLoginData.login),
                password: decrypt(autoLoginData.password),
            };
        } catch (error) {
            consoleError('Failed to load auto-login credentials:', error);
            return null;
        }
    },

    /**
     * Check if auto-login is enabled
     */
    async isEnabled(terminal: BookingTerminal = BOOKING_TERMINALS.DCT): Promise<boolean> {
        try {
            const autoLoginData = await loadStoredAutoLoginData(terminal);
            return !!(autoLoginData && autoLoginData.enabled);
        } catch (error) {
            consoleError('Failed to check auto-login status:', error);
            return false;
        }
    },

    /**
     * Clear auto-login credentials
     */
    async clearCredentials(terminal: BookingTerminal = BOOKING_TERMINALS.DCT): Promise<void> {
        await clearStoredAutoLoginData(terminal);
    },

    /**
     * Validate if stored credentials are readable
     */
    async validateStoredCredentials(
        terminal: BookingTerminal = BOOKING_TERMINALS.DCT,
    ): Promise<boolean> {
        try {
            const credentials = await this.loadCredentials(terminal);
            if (!credentials) {
                return false;
            }

            // Check if login and password are valid strings
            return (
                typeof credentials.login === 'string' &&
                typeof credentials.password === 'string' &&
                credentials.login.length > 0 &&
                credentials.password.length > 0
            );
        } catch (error) {
            consoleError('Failed to load auto-login credentials:', error);
            return false;
        }
    },

    /**
     * Clear credentials if they are corrupted
     */
    async clearCorruptedCredentials(
        terminal: BookingTerminal = BOOKING_TERMINALS.DCT,
    ): Promise<void> {
        try {
            const isValid = await this.validateStoredCredentials(terminal);
            if (!isValid) {
                consoleLog('Detected corrupted auto-login credentials, clearing...');
                await this.clearCredentials(terminal);
            }
        } catch (error) {
            consoleError('Failed to check for corrupted credentials:', error);
            // If we can't even check, clear anyway to be safe
            await this.clearCredentials(terminal);
        }
    },

    /**
     * Get auto-login data for UI state
     */
    async getAutoLoginData(
        terminal: BookingTerminal = BOOKING_TERMINALS.DCT,
    ): Promise<AutoLoginData | null> {
        try {
            return await loadStoredAutoLoginData(terminal);
        } catch (error) {
            consoleError('Failed to get auto-login data:', error);
            return null;
        }
    },

    /**
     * Perform automatic login using saved credentials
     */
    async performAutoLogin(terminal: BookingTerminal = BOOKING_TERMINALS.DCT): Promise<boolean> {
        try {
            // Check if user is already authenticated
            const isAuthenticated = await authService.isAuthenticated();
            if (isAuthenticated) {
                return true; // Already logged in
            }

            // Check if auto-login is enabled
            const isEnabled = await this.isEnabled(terminal);
            if (!isEnabled) {
                return false;
            }

            // Load saved credentials
            const credentials = await this.loadCredentials(terminal);
            if (!credentials) {
                return false;
            }

            // Attempt to login
            const user = await authService.login(credentials.login, credentials.password);
            return !!user;
        } catch (error) {
            consoleError('Auto-login failed:', error);
            return false;
        }
    },

    async performAutoLoginWithFallback(
        terminals: BookingTerminal[] = [BOOKING_TERMINALS.DCT, BOOKING_TERMINALS.BCT],
    ): Promise<boolean> {
        for (const terminal of terminals) {
            const success = await this.performAutoLogin(terminal);
            if (success) {
                return true;
            }
        }

        return false;
    },

    /**
     * Disable auto-login (but keep credentials)
     */
    async disableAutoLogin(terminal: BookingTerminal = BOOKING_TERMINALS.DCT): Promise<void> {
        try {
            const autoLoginData = await this.getAutoLoginData(terminal);
            if (autoLoginData) {
                autoLoginData.enabled = false;
                await saveStoredAutoLoginData(autoLoginData, terminal);
            }
        } catch (error) {
            consoleError('Failed to disable auto-login:', error);
        }
    },

    /**
     * Enable auto-login (if credentials exist)
     */
    async enableAutoLogin(terminal: BookingTerminal = BOOKING_TERMINALS.DCT): Promise<void> {
        try {
            const autoLoginData = await this.getAutoLoginData(terminal);
            if (autoLoginData) {
                autoLoginData.enabled = true;
                await saveStoredAutoLoginData(autoLoginData, terminal);
            }
        } catch (error) {
            consoleError('Failed to enable auto-login:', error);
        }
    },

    /**
     * Migrate and clean old corrupted data
     */
    async migrateAndCleanData(terminal: BookingTerminal = BOOKING_TERMINALS.DCT): Promise<void> {
        try {
            const autoLoginData = await this.getAutoLoginData(terminal);
            if (!autoLoginData) {
                return;
            }

            // Try to load credentials to check if they're valid
            const credentials = await this.loadCredentials(terminal);
            if (!credentials) {
                consoleLog('Clearing corrupted auto-login data during migration');
                await this.clearCredentials(terminal);
                return;
            }

            // Check if credentials are valid (not empty)
            if (credentials.login.length === 0 || credentials.password.length === 0) {
                consoleLog('Clearing corrupted auto-login data during migration');
                await this.clearCredentials(terminal);
                return;
            }

            // Re-encrypt with current encryption method
            await this.saveCredentials(credentials, terminal);
        } catch (error) {
            consoleError('Failed to migrate auto-login data:', error);
            await this.clearCredentials(terminal);
        }
    },

    /**
     * Test encryption/decryption (development only)
     */
    async testEncryption(terminal: BookingTerminal = BOOKING_TERMINALS.DCT): Promise<boolean> {
        if (process.env.NODE_ENV !== 'development') {
            return false;
        }

        try {
            const testCredentials: AutoLoginCredentials = {
                login: 'test@example.com',
                password: 'testPassword123',
            };

            // Test encryption
            await this.saveCredentials(testCredentials, terminal);

            // Test decryption
            const decrypted = await this.loadCredentials(terminal);

            // Clean up
            await this.clearCredentials(terminal);

            const isValid =
                decrypted &&
                decrypted.login === testCredentials.login &&
                decrypted.password === testCredentials.password;

            consoleLog('Encryption test result:', isValid);
            return !!isValid;
        } catch (error) {
            consoleError('Encryption test failed:', error);
            return false;
        }
    },
};
