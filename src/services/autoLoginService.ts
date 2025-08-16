import { getStorage, setStorage, removeStorage } from '../utils';

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

// Simple encryption/decryption using a secret key
// In production, you should use a more secure encryption method
const CRYPTO_SECRET_KEY = process.env.CRYPTO_SECRET_KEY || 'your-secret-key-here'; // From environment variable

// Validate that we have a proper secret key
if (CRYPTO_SECRET_KEY === 'your-secret-key-here') {
    console.log(
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
        console.log('Encryption failed:', error);
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
        console.log('Failed to decrypt auto-login data:', error);
        return '';
    }
}

export const autoLoginService = {
    /**
     * Save auto-login credentials with encryption
     */
    async saveCredentials(credentials: AutoLoginCredentials): Promise<void> {
        const autoLoginData: AutoLoginData = {
            login: encrypt(credentials.login),
            password: encrypt(credentials.password),
            enabled: true,
            createdAt: Date.now(),
        };

        await setStorage({ [AUTO_LOGIN_STORAGE_KEY]: autoLoginData });
    },

    /**
     * Load auto-login credentials with decryption
     */
    async loadCredentials(): Promise<AutoLoginCredentials | null> {
        try {
            const result = await getStorage([AUTO_LOGIN_STORAGE_KEY]);
            const autoLoginData = result[AUTO_LOGIN_STORAGE_KEY] as AutoLoginData | undefined;

            if (!autoLoginData || !autoLoginData.enabled) {
                return null;
            }

            return {
                login: decrypt(autoLoginData.login),
                password: decrypt(autoLoginData.password),
            };
        } catch (error) {
            console.log('Failed to load auto-login credentials:', error);
            return null;
        }
    },

    /**
     * Check if auto-login is enabled
     */
    async isEnabled(): Promise<boolean> {
        try {
            const result = await getStorage([AUTO_LOGIN_STORAGE_KEY]);
            const autoLoginData = result[AUTO_LOGIN_STORAGE_KEY] as AutoLoginData | undefined;
            return !!(autoLoginData && autoLoginData.enabled);
        } catch (error) {
            console.log('Failed to check auto-login status:', error);
            return false;
        }
    },

    /**
     * Clear auto-login credentials
     */
    async clearCredentials(): Promise<void> {
        await removeStorage(AUTO_LOGIN_STORAGE_KEY);
    },

    /**
     * Validate if stored credentials are readable
     */
    async validateStoredCredentials(): Promise<boolean> {
        try {
            const credentials = await this.loadCredentials();
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
            console.log('Failed to validate stored credentials:', error);
            return false;
        }
    },

    /**
     * Clear credentials if they are corrupted
     */
    async clearCorruptedCredentials(): Promise<void> {
        try {
            const isValid = await this.validateStoredCredentials();
            if (!isValid) {
                console.log('Detected corrupted auto-login credentials, clearing...');
                await this.clearCredentials();
            }
        } catch (error) {
            console.log('Failed to check for corrupted credentials:', error);
            // If we can't even check, clear anyway to be safe
            await this.clearCredentials();
        }
    },

    /**
     * Get auto-login data for UI state
     */
    async getAutoLoginData(): Promise<AutoLoginData | null> {
        try {
            const result = await getStorage([AUTO_LOGIN_STORAGE_KEY]);
            return (result[AUTO_LOGIN_STORAGE_KEY] as AutoLoginData | undefined) || null;
        } catch (error) {
            console.log('Failed to get auto-login data:', error);
            return null;
        }
    },

    /**
     * Perform automatic login using saved credentials
     */
    async performAutoLogin(): Promise<boolean> {
        try {
            // Check if user is already authenticated
            const isAuthenticated = await authService.isAuthenticated();
            if (isAuthenticated) {
                return true; // Already logged in
            }

            // Check if auto-login is enabled
            const isEnabled = await this.isEnabled();
            if (!isEnabled) {
                return false;
            }

            // Load saved credentials
            const credentials = await this.loadCredentials();
            if (!credentials) {
                return false;
            }

            // Attempt to login
            const user = await authService.login(credentials.login, credentials.password);
            return !!user;
        } catch (error) {
            console.log('Auto-login failed:', error);
            return false;
        }
    },

    /**
     * Disable auto-login (but keep credentials)
     */
    async disableAutoLogin(): Promise<void> {
        try {
            const autoLoginData = await this.getAutoLoginData();
            if (autoLoginData) {
                autoLoginData.enabled = false;
                await setStorage({ [AUTO_LOGIN_STORAGE_KEY]: autoLoginData });
            }
        } catch (error) {
            console.log('Failed to disable auto-login:', error);
        }
    },

    /**
     * Enable auto-login (if credentials exist)
     */
    async enableAutoLogin(): Promise<void> {
        try {
            const autoLoginData = await this.getAutoLoginData();
            if (autoLoginData) {
                autoLoginData.enabled = true;
                await setStorage({ [AUTO_LOGIN_STORAGE_KEY]: autoLoginData });
            }
        } catch (error) {
            console.log('Failed to enable auto-login:', error);
        }
    },

    /**
     * Migrate and clean old corrupted data
     */
    async migrateAndCleanData(): Promise<void> {
        try {
            const autoLoginData = await this.getAutoLoginData();
            if (!autoLoginData) {
                return;
            }

            // Try to decrypt and validate
            const credentials = await this.loadCredentials();
            if (!credentials) {
                // If we can't load credentials, clear the data
                console.log('Clearing corrupted auto-login data during migration');
                await this.clearCredentials();
                return;
            }

            // Check for corruption indicators
            const isCorrupted =
                credentials.login.includes('□') ||
                credentials.login.includes('\\') ||
                credentials.login.length === 0 ||
                credentials.password.length === 0;

            if (isCorrupted) {
                console.log('Detected corrupted data during migration, clearing...');
                await this.clearCredentials();
                return;
            }

            await this.saveCredentials(credentials);
        } catch (error) {
            console.log('Failed to migrate auto-login data:', error);
            // Clear data on migration failure
            await this.clearCredentials();
        }
    },

    /**
     * Test encryption/decryption (development only)
     */
    async testEncryption(): Promise<boolean> {
        if (process.env.NODE_ENV !== 'development') {
            return false;
        }

        try {
            const testCredentials: AutoLoginCredentials = {
                login: 'test@example.com',
                password: 'testPassword123',
            };

            // Test encryption
            await this.saveCredentials(testCredentials);

            // Test decryption
            const decrypted = await this.loadCredentials();

            // Clean up
            await this.clearCredentials();

            const isValid =
                decrypted &&
                decrypted.login === testCredentials.login &&
                decrypted.password === testCredentials.password;

            console.log('Encryption test result:', isValid);
            return !!isValid;
        } catch (error) {
            console.error('Encryption test failed:', error);
            return false;
        }
    },
};
