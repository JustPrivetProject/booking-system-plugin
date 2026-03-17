import { getStorage, setStorage } from '../utils/storage';
import type { GctState, GctWatchGroup, GctWatcherSettings } from './types';
import { DEFAULT_GCT_STATE, GCT_STORAGE_KEYS, GCT_WATCHER_DEFAULTS } from './types';

export async function getGctState(): Promise<GctState> {
    const data = await getStorage([
        GCT_STORAGE_KEYS.GROUPS,
        GCT_STORAGE_KEYS.SETTINGS,
        GCT_STORAGE_KEYS.LAST_TICK_AT,
    ] as const);

    const groups = (data.gctGroups as GctWatchGroup[] | undefined) || DEFAULT_GCT_STATE.groups;
    const settings = (data.gctSettings as Partial<GctWatcherSettings> | undefined) || {};
    const lastTickAt = (data.gctLastTickAt as string | undefined) || null;

    return {
        groups,
        settings: {
            ...GCT_WATCHER_DEFAULTS,
            ...settings,
        },
        lastTickAt,
    };
}

export async function saveGctGroups(groups: GctWatchGroup[]): Promise<void> {
    await setStorage({ [GCT_STORAGE_KEYS.GROUPS]: groups });
}

export async function saveGctSettings(settings: Partial<GctWatcherSettings>): Promise<void> {
    const current = await getStorage(GCT_STORAGE_KEYS.SETTINGS);
    const existing = current.gctSettings as Partial<GctWatcherSettings> | undefined;

    await setStorage({
        [GCT_STORAGE_KEYS.SETTINGS]: {
            ...GCT_WATCHER_DEFAULTS,
            ...(existing || {}),
            ...settings,
        },
    });
}

export async function touchGctLastTickAt(isoTime: string): Promise<void> {
    await setStorage({ [GCT_STORAGE_KEYS.LAST_TICK_AT]: isoTime });
}
