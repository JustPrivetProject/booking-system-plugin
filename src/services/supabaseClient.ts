import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://turebvzifnlgmewqgdxv.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'your-anon';
const SUPABASE_AUTH_STORAGE_KEY = 'portsloty.supabase.auth.token';
const memoryStorage = new Map<string, string>();

function hasChromeStorageLocal(): boolean {
    return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

function getSupabaseAuthStorage() {
    if (hasChromeStorageLocal()) {
        return {
            getItem: async (key: string): Promise<string | null> => {
                const result = await chrome.storage.local.get(key);
                const value = result[key];

                if (typeof value === 'string') {
                    return value;
                }

                return value == null ? null : JSON.stringify(value);
            },
            setItem: async (key: string, value: string): Promise<void> => {
                await chrome.storage.local.set({ [key]: value });
            },
            removeItem: async (key: string): Promise<void> => {
                await chrome.storage.local.remove(key);
            },
        };
    }

    if (typeof localStorage !== 'undefined') {
        return {
            getItem: (key: string): string | null => localStorage.getItem(key),
            setItem: (key: string, value: string): void => {
                localStorage.setItem(key, value);
            },
            removeItem: (key: string): void => {
                localStorage.removeItem(key);
            },
        };
    }

    return {
        getItem: (key: string): string | null => memoryStorage.get(key) || null,
        setItem: (key: string, value: string): void => {
            memoryStorage.set(key, value);
        },
        removeItem: (key: string): void => {
            memoryStorage.delete(key);
        },
    };
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        storageKey: SUPABASE_AUTH_STORAGE_KEY,
        storage: getSupabaseAuthStorage(),
    },
});
