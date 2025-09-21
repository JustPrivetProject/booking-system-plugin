// Mock Supabase client before importing storage
jest.mock('../../../src/services/supabaseClient', () => ({
    supabase: {
        from: jest.fn(() => ({
            insert: jest.fn(),
        })),
    },
}));

// Mock errorLogService
jest.mock('../../../src/services/errorLogService', () => ({
    errorLogService: {
        logError: jest.fn(),
        logRequestError: jest.fn(),
    },
}));

import {
    getStorage,
    setStorage,
    onStorageChange,
    removeStorage,
    getOrCreateDeviceId,
    cleanupCache,
    getLocalStorageData,
    getStorageValue,
    setStorageValue,
    hasStorageKey,
    getStorageSize,
} from '../../../src/utils/storage';

// Mock chrome storage
const chromeMock = require('../mocks/chrome').chromeMock;

// Mock crypto for generateUniqueId
Object.defineProperty(global, 'crypto', {
    value: {
        randomUUID: jest.fn(() => 'test-uuid-12345'),
    },
});

describe('Storage Functions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        chromeMock.storage.local.get.mockClear();
        chromeMock.storage.local.set.mockClear();
        chromeMock.storage.local.remove.mockClear();
        chromeMock.storage.onChanged.addListener.mockClear();
    });

    describe('getStorage', () => {
        it('should get single key from storage', async () => {
            const mockData = { deviceId: 'test-device-id' };
            chromeMock.storage.local.get.mockImplementation((_keys, callback) => {
                callback(mockData);
            });

            const result = await getStorage('deviceId');

            expect(result).toEqual(mockData);
            expect(chromeMock.storage.local.get).toHaveBeenCalledWith(
                'deviceId',
                expect.any(Function),
            );
        });

        it('should get multiple keys from storage', async () => {
            const mockData = {
                deviceId: 'test-device-id',
                userSettings: { theme: 'dark' },
            };
            chromeMock.storage.local.get.mockImplementation((_keys, callback) => {
                callback(mockData);
            });

            const result = await getStorage(['deviceId', 'userSettings']);

            expect(result).toEqual(mockData);
            expect(chromeMock.storage.local.get).toHaveBeenCalledWith(
                ['deviceId', 'userSettings'],
                expect.any(Function),
            );
        });
    });

    describe('setStorage', () => {
        it('should set data in storage', async () => {
            chromeMock.storage.local.set.mockImplementation((_data, callback) => {
                callback();
            });

            const testData = { deviceId: 'new-device-id' };
            await setStorage(testData);

            expect(chromeMock.storage.local.set).toHaveBeenCalledWith(
                testData,
                expect.any(Function),
            );
        });
    });

    describe('onStorageChange', () => {
        it('should add listener for storage changes', () => {
            const callback = jest.fn();
            onStorageChange('deviceId', callback);

            expect(chromeMock.storage.onChanged.addListener).toHaveBeenCalledWith(
                expect.any(Function),
            );
        });

        it('should call callback when storage changes', () => {
            const callback = jest.fn();
            onStorageChange('deviceId', callback);

            // Get the listener function that was registered
            const listener = chromeMock.storage.onChanged.addListener.mock.calls[0][0];

            // Simulate storage change
            const changes = {
                deviceId: {
                    newValue: 'new-value',
                    oldValue: 'old-value',
                },
            };
            listener(changes, 'local');

            expect(callback).toHaveBeenCalledWith('new-value', 'old-value');
        });

        it('should not call callback for different area', () => {
            const callback = jest.fn();
            onStorageChange('deviceId', callback);

            const listener = chromeMock.storage.onChanged.addListener.mock.calls[0][0];

            // Simulate storage change in different area
            const changes = {
                deviceId: {
                    newValue: 'new-value',
                    oldValue: 'old-value',
                },
            };
            listener(changes, 'session');

            expect(callback).not.toHaveBeenCalled();
        });

        it('should not call callback for different key', () => {
            const callback = jest.fn();
            onStorageChange('deviceId', callback);

            const listener = chromeMock.storage.onChanged.addListener.mock.calls[0][0];

            // Simulate storage change for different key
            const changes = {
                userSettings: {
                    newValue: 'new-value',
                    oldValue: 'old-value',
                },
            };
            listener(changes, 'local');

            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('removeStorage', () => {
        it('should remove single key from storage', async () => {
            chromeMock.storage.local.remove.mockImplementation((_keys, callback) => {
                callback();
            });

            await removeStorage('deviceId');

            expect(chromeMock.storage.local.remove).toHaveBeenCalledWith(
                'deviceId',
                expect.any(Function),
            );
        });

        it('should remove multiple keys from storage', async () => {
            chromeMock.storage.local.remove.mockImplementation((_keys, callback) => {
                callback();
            });

            await removeStorage(['deviceId', 'userSettings']);

            expect(chromeMock.storage.local.remove).toHaveBeenCalledWith(
                ['deviceId', 'userSettings'],
                expect.any(Function),
            );
        });
    });

    describe('getOrCreateDeviceId', () => {
        it('should return existing device ID from storage', async () => {
            chromeMock.storage.local.get.mockImplementation((_keys, callback) => {
                callback({ deviceId: 'existing-device-id' });
            });

            const result = await getOrCreateDeviceId();

            expect(result).toBe('existing-device-id');
            expect(chromeMock.storage.local.get).toHaveBeenCalledWith(
                'deviceId',
                expect.any(Function),
            );
        });

        it('should create and save new device ID if none exists', async () => {
            chromeMock.storage.local.get.mockImplementation((_keys, callback) => {
                callback({ deviceId: undefined });
            });

            chromeMock.storage.local.set.mockImplementation((_data, callback) => {
                callback();
            });

            const result = await getOrCreateDeviceId();

            expect(result).toBe('test-uuid-12345');
            expect(chromeMock.storage.local.set).toHaveBeenCalledWith(
                { deviceId: 'test-uuid-12345' },
                expect.any(Function),
            );
        });

        it('should handle errors and return fallback ID', async () => {
            chromeMock.storage.local.get.mockImplementation((_keys, _callback) => {
                throw new Error('Storage error');
            });

            const result = await getOrCreateDeviceId();

            expect(result).toBe('test-uuid-12345');
        });
    });

    describe('cleanupCache', () => {
        it('should clear cache successfully', async () => {
            chromeMock.storage.local.set.mockImplementation((_data, callback) => {
                callback();
            });

            const result = await cleanupCache();

            expect(result).toBe(true);
            expect(chromeMock.storage.local.set).toHaveBeenCalledWith(
                {
                    requestCacheBody: {},
                    requestCacheHeaders: {},
                },
                expect.any(Function),
            );
        });

        it('should handle errors and return false', async () => {
            chromeMock.storage.local.set.mockImplementation((_data, _callback) => {
                throw new Error('Storage error');
            });

            const result = await cleanupCache();

            expect(result).toBe(false);
        });
    });

    describe('getLocalStorageData', () => {
        it('should retrieve all data from local storage', async () => {
            const mockData = {
                deviceId: 'test-device-id',
                userSettings: { theme: 'dark' },
                cache: { key: 'value' },
            };

            chromeMock.storage.local.get.mockImplementation((_keys, callback) => {
                callback(mockData);
            });

            const result = await getLocalStorageData();

            expect(result).toEqual(mockData);
            expect(chromeMock.storage.local.get).toHaveBeenCalledWith(null, expect.any(Function));
        });
    });

    describe('getStorageValue', () => {
        it('should get value by key', async () => {
            chromeMock.storage.local.get.mockImplementation((_keys, callback) => {
                callback({ deviceId: 'test-device-id' });
            });

            const result = await getStorageValue('deviceId');

            expect(result).toBe('test-device-id');
        });

        it('should return null for non-existent key', async () => {
            chromeMock.storage.local.get.mockImplementation((_keys, callback) => {
                callback({});
            });

            const result = await getStorageValue('non-existent');

            expect(result).toBeNull();
        });

        it('should handle errors and return null', async () => {
            chromeMock.storage.local.get.mockImplementation((_keys, _callback) => {
                throw new Error('Storage error');
            });

            const result = await getStorageValue('deviceId');

            expect(result).toBeNull();
        });
    });

    describe('setStorageValue', () => {
        it('should set value by key successfully', async () => {
            chromeMock.storage.local.set.mockImplementation((_data, callback) => {
                callback();
            });

            const result = await setStorageValue('deviceId', 'new-device-id');

            expect(result).toBe(true);
            expect(chromeMock.storage.local.set).toHaveBeenCalledWith(
                { deviceId: 'new-device-id' },
                expect.any(Function),
            );
        });

        it('should handle errors and return false', async () => {
            chromeMock.storage.local.set.mockImplementation((_data, _callback) => {
                throw new Error('Storage error');
            });

            const result = await setStorageValue('deviceId', 'new-device-id');

            expect(result).toBe(false);
        });
    });

    describe('hasStorageKey', () => {
        it('should return true for existing key', async () => {
            chromeMock.storage.local.get.mockImplementation((_keys, callback) => {
                callback({ deviceId: 'test-device-id' });
            });

            const result = await hasStorageKey('deviceId');

            expect(result).toBe(true);
        });

        it('should return false for non-existent key', async () => {
            chromeMock.storage.local.get.mockImplementation((_keys, callback) => {
                callback({});
            });

            const result = await hasStorageKey('non-existent');

            expect(result).toBe(false);
        });

        it('should return false for undefined value', async () => {
            chromeMock.storage.local.get.mockImplementation((_keys, callback) => {
                callback({ deviceId: undefined });
            });

            const result = await hasStorageKey('deviceId');

            expect(result).toBe(false);
        });

        it('should handle errors and return false', async () => {
            chromeMock.storage.local.get.mockImplementation((_keys, _callback) => {
                throw new Error('Storage error');
            });

            const result = await hasStorageKey('deviceId');

            expect(result).toBe(false);
        });
    });

    describe('getStorageSize', () => {
        it('should calculate storage size correctly', async () => {
            const mockData = {
                deviceId: 'test-device-id',
                userSettings: { theme: 'dark' },
            };

            chromeMock.storage.local.get.mockImplementation((_keys, callback) => {
                callback(mockData);
            });

            const result = await getStorageSize();

            expect(result).toBeGreaterThan(0);
            expect(typeof result).toBe('number');
        });

        it('should handle errors and return 0', async () => {
            chromeMock.storage.local.get.mockImplementation((_keys, _callback) => {
                throw new Error('Storage error');
            });

            const result = await getStorageSize();

            expect(result).toBe(0);
        });
    });
});
