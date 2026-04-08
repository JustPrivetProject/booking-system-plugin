import { consoleLog, consoleError } from './logging';
import type { LocalStorageData } from '../types/general';
import { BOOKING_TERMINALS, type BookingTerminal } from '../types/terminal';

type StorageKey<T extends string | string[]> = T extends string ? T : T[number];
type KnownStorageValue<K extends string> = K extends keyof LocalStorageData
    ? LocalStorageData[K]
    : unknown;
type StorageResult<T extends string | string[]> = {
    [K in StorageKey<T>]: KnownStorageValue<K>;
};

export const TERMINAL_STORAGE_NAMESPACES = {
    RETRY_QUEUE: 'retryQueue',
    GROUP_STATES: 'groupStates',
    REQUEST_CACHE_BODY: 'requestCacheBody',
    REQUEST_CACHE_HEADERS: 'requestCacheHeaders',
    UNAUTHORIZED: 'unauthorized',
} as const;

export type TerminalStorageNamespace =
    (typeof TERMINAL_STORAGE_NAMESPACES)[keyof typeof TERMINAL_STORAGE_NAMESPACES];

const LEGACY_DCT_STORAGE_KEYS: Record<TerminalStorageNamespace, string> = {
    [TERMINAL_STORAGE_NAMESPACES.RETRY_QUEUE]: 'retryQueue',
    [TERMINAL_STORAGE_NAMESPACES.GROUP_STATES]: 'groupStates',
    [TERMINAL_STORAGE_NAMESPACES.REQUEST_CACHE_BODY]: 'requestCacheBody',
    [TERMINAL_STORAGE_NAMESPACES.REQUEST_CACHE_HEADERS]: 'requestCacheHeaders',
    [TERMINAL_STORAGE_NAMESPACES.UNAUTHORIZED]: 'unauthorized',
};

export function getTerminalStorageKey(
    namespace: TerminalStorageNamespace,
    terminal: BookingTerminal,
): string {
    return `${namespace}:${terminal}`;
}

export async function getTerminalStorageValue<T>(
    namespace: TerminalStorageNamespace,
    terminal: BookingTerminal,
    defaultValue: T,
): Promise<T> {
    const terminalKey = getTerminalStorageKey(namespace, terminal);
    const legacyKey =
        terminal === BOOKING_TERMINALS.DCT ? LEGACY_DCT_STORAGE_KEYS[namespace] : undefined;
    const keys = legacyKey ? [terminalKey, legacyKey] : [terminalKey];
    const result = (await getStorage(keys)) as Record<string, unknown>;
    if (legacyKey) {
        const legacyValue = result[legacyKey];

        if (legacyValue !== undefined) {
            const terminalValue = result[terminalKey];

            if (terminalValue !== legacyValue) {
                await setStorage({ [terminalKey]: legacyValue });
            }

            return legacyValue as T;
        }
    }

    const terminalValue = result[terminalKey];

    if (terminalValue !== undefined) {
        return terminalValue as T;
    }

    return defaultValue;
}

export async function setTerminalStorageValue<T>(
    namespace: TerminalStorageNamespace,
    terminal: BookingTerminal,
    value: T,
): Promise<void> {
    const terminalKey = getTerminalStorageKey(namespace, terminal);
    const storageData: Record<string, unknown> = {
        [terminalKey]: value,
    };

    if (terminal === BOOKING_TERMINALS.DCT) {
        storageData[LEGACY_DCT_STORAGE_KEYS[namespace]] = value;
    }

    await setStorage(storageData);
}

/**
 * Получает значение из chrome.storage.local
 * @param {string|string[]} keys — ключ или массив ключей
 * @returns {Promise<object>}
 */
export function getStorage<T extends string | string[]>(keys: T): Promise<StorageResult<T>> {
    return new Promise(resolve => {
        chrome.storage.local.get(keys, result => {
            return resolve(result as StorageResult<T>);
        });
    });
}

/**
 * Устанавливает значение в chrome.storage.local
 * @param {object} data — объект ключ-значение
 * @returns {Promise<void>}
 */
export function setStorage(data: object): Promise<void> {
    return new Promise<void>(resolve => {
        chrome.storage.local.set(data, () => {
            resolve();
        });
    });
}

/**
 * Подписка на изменения в chrome.storage.local
 * @param {string} key — ключ, за которым следим
 * @param {(newValue: any, oldValue: any) => void} callback
 */
export function onStorageChange(
    key: string,
    callback: (newValue: unknown, oldValue: unknown) => void,
): void {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[key]) {
            callback(changes[key].newValue, changes[key].oldValue);
        }
    });
}

/**
 * Удаление значений из chrome.storage.local
 * @param {string|string[]} keys — ключ или список ключей
 * @returns {Promise<void>}
 */
export function removeStorage(keys: string | string[]): Promise<void> {
    return new Promise<void>(resolve => {
        chrome.storage.local.remove(keys, () => {
            resolve();
        });
    });
}

/**
 * Получает или создает уникальный ID устройства
 * @returns {Promise<string>} Уникальный ID устройства
 */
export async function getOrCreateDeviceId(): Promise<string> {
    try {
        // Try to get existing device ID from storage
        const result = await getStorage('deviceId');

        if (result.deviceId) {
            return result.deviceId;
        }

        // Generate new device ID if none exists
        const newDeviceId = crypto.randomUUID();

        // Save to storage
        await setStorage({ deviceId: newDeviceId });

        return newDeviceId;
    } catch (error) {
        consoleLog('Error getting or creating device ID:', error);
        // Fallback: generate temporary ID
        return crypto.randomUUID();
    }
}

/**
 * Очищает кэш запросов
 * @returns {Promise<boolean>} Успешность операции
 */
export async function cleanupCache(): Promise<boolean> {
    consoleLog('Cleaning up cache...');
    try {
        await setStorage({
            requestCacheBody: {},
            requestCacheHeaders: {},
            [getTerminalStorageKey(
                TERMINAL_STORAGE_NAMESPACES.REQUEST_CACHE_BODY,
                BOOKING_TERMINALS.DCT,
            )]: {},
            [getTerminalStorageKey(
                TERMINAL_STORAGE_NAMESPACES.REQUEST_CACHE_HEADERS,
                BOOKING_TERMINALS.DCT,
            )]: {},
            [getTerminalStorageKey(
                TERMINAL_STORAGE_NAMESPACES.REQUEST_CACHE_BODY,
                BOOKING_TERMINALS.BCT,
            )]: {},
            [getTerminalStorageKey(
                TERMINAL_STORAGE_NAMESPACES.REQUEST_CACHE_HEADERS,
                BOOKING_TERMINALS.BCT,
            )]: {},
        });
        return true;
    } catch (error) {
        consoleLog('Error cleaning up cache:', error);
        return false;
    }
}

/**
 * Получает все данные из chrome.storage.local
 * @returns {Promise<LocalStorageData>} Все данные из хранилища
 */
export async function getLocalStorageData(): Promise<LocalStorageData> {
    return new Promise<LocalStorageData>(resolve => {
        chrome.storage.local.get(null, data => {
            resolve(data as LocalStorageData);
        });
    });
}

/**
 * Получает значение по ключу из chrome.storage.local
 * @param {string} key — ключ
 * @returns {Promise<T | null>} Значение или null
 */
export async function getStorageValue<T>(key: string): Promise<T | null> {
    try {
        const result = await getStorage(key);
        return (result[key] as T | undefined) || null;
    } catch (error) {
        consoleError(`Error getting storage value for key "${key}":`, error);
        return null;
    }
}

/**
 * Устанавливает значение по ключу в chrome.storage.local
 * @param {string} key — ключ
 * @param {unknown} value — значение
 * @returns {Promise<boolean>} Успешность операции
 */
export async function setStorageValue(key: string, value: unknown): Promise<boolean> {
    try {
        await setStorage({ [key]: value });
        return true;
    } catch (error) {
        consoleError(`Error setting storage value for key "${key}":`, error);
        return false;
    }
}

/**
 * Проверяет существование ключа в chrome.storage.local
 * @param {string} key — ключ для проверки
 * @returns {Promise<boolean>} Существует ли ключ
 */
export async function hasStorageKey(key: string): Promise<boolean> {
    try {
        const result = await getStorage(key);
        return key in result && result[key] !== undefined;
    } catch (error) {
        consoleError(`Error checking storage key "${key}":`, error);
        return false;
    }
}

/**
 * Получает размер данных в chrome.storage.local
 * @returns {Promise<number>} Размер в байтах
 */
export async function getStorageSize(): Promise<number> {
    try {
        const data = await getLocalStorageData();
        const jsonString = JSON.stringify(data);
        return new Blob([jsonString]).size;
    } catch (error) {
        consoleError('Error getting storage size:', error);
        return 0;
    }
}
