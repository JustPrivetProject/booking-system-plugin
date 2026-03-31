import { getStorage, setStorage } from '../utils/storage';
import type { GctState, GctWatchGroup, GctWatcherSettings } from './types';
import { DEFAULT_GCT_STATE, GCT_STORAGE_KEYS, GCT_WATCHER_DEFAULTS } from './types';

function normalizeGctSettings(settings?: Partial<GctWatcherSettings>): GctWatcherSettings {
    const merged = {
        ...GCT_WATCHER_DEFAULTS,
        ...(settings || {}),
    };
    const jitterMinMs = Math.max(0, merged.jitterMinMs);
    const jitterMaxMs = Math.max(jitterMinMs, merged.jitterMaxMs);

    return {
        pollMinMs: GCT_WATCHER_DEFAULTS.pollMinMs,
        pollMaxMs: GCT_WATCHER_DEFAULTS.pollMaxMs,
        jitterMinMs,
        jitterMaxMs,
    };
}

function areGctSettingsEqual(
    left: GctWatcherSettings,
    right?: Partial<GctWatcherSettings>,
): boolean {
    return (
        right?.pollMinMs === left.pollMinMs &&
        right?.pollMaxMs === left.pollMaxMs &&
        right?.jitterMinMs === left.jitterMinMs &&
        right?.jitterMaxMs === left.jitterMaxMs
    );
}

export async function getGctState(): Promise<GctState> {
    const data = (await getStorage([
        GCT_STORAGE_KEYS.GROUPS,
        GCT_STORAGE_KEYS.SETTINGS,
        GCT_STORAGE_KEYS.LAST_TICK_AT,
    ] as const)) as
        | {
              gctGroups?: GctWatchGroup[];
              gctSettings?: Partial<GctWatcherSettings>;
              gctLastTickAt?: string | null;
          }
        | undefined;

    const groups = data?.gctGroups || DEFAULT_GCT_STATE.groups;
    const settings = normalizeGctSettings(data?.gctSettings);
    const lastTickAt = data?.gctLastTickAt || null;

    if (data?.gctSettings && !areGctSettingsEqual(settings, data.gctSettings)) {
        await setStorage({ [GCT_STORAGE_KEYS.SETTINGS]: settings });
    }

    return {
        groups,
        settings,
        lastTickAt,
    };
}

export async function saveGctGroups(groups: GctWatchGroup[]): Promise<void> {
    await setStorage({ [GCT_STORAGE_KEYS.GROUPS]: groups });
}

export async function saveGctSettings(settings: Partial<GctWatcherSettings>): Promise<void> {
    const current = await getStorage(GCT_STORAGE_KEYS.SETTINGS);
    const existing = current?.gctSettings as Partial<GctWatcherSettings> | undefined;
    const normalizedSettings = normalizeGctSettings({
        ...(existing || {}),
        ...settings,
    });

    await setStorage({
        [GCT_STORAGE_KEYS.SETTINGS]: normalizedSettings,
    });
}

export async function touchGctLastTickAt(isoTime: string): Promise<void> {
    await setStorage({ [GCT_STORAGE_KEYS.LAST_TICK_AT]: isoTime });
}
