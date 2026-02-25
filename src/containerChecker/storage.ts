import { getStorage, setStorage } from '../utils/storage';
import type { ContainerCheckerState, ContainerCheckerSettings, WatchlistItem } from './types';
import { DEFAULT_CONTAINER_CHECKER_SETTINGS } from './types';

const STORAGE_KEYS = {
    WATCHLIST: 'containerCheckerWatchlist',
    SETTINGS: 'containerCheckerSettings',
    LAST_RUN_AT: 'containerCheckerLastRunAt',
} as const;

export async function getContainerCheckerState(): Promise<ContainerCheckerState> {
    const data = await getStorage([
        STORAGE_KEYS.WATCHLIST,
        STORAGE_KEYS.SETTINGS,
        STORAGE_KEYS.LAST_RUN_AT,
    ] as const);

    const watchlist = data.containerCheckerWatchlist as WatchlistItem[] | undefined;
    const settings = data.containerCheckerSettings as Partial<ContainerCheckerSettings> | undefined;
    const lastRunAt = data.containerCheckerLastRunAt as string | undefined;

    return {
        watchlist: watchlist || [],
        settings: {
            ...DEFAULT_CONTAINER_CHECKER_SETTINGS,
            ...(settings || {}),
        },
        lastRunAt: lastRunAt || null,
    };
}

export async function saveContainerCheckerWatchlist(watchlist: WatchlistItem[]): Promise<void> {
    await setStorage({ [STORAGE_KEYS.WATCHLIST]: watchlist });
}

export async function saveContainerCheckerSettings(
    settings: Partial<ContainerCheckerSettings>,
): Promise<void> {
    const current = await getStorage(STORAGE_KEYS.SETTINGS);
    const existing = current.containerCheckerSettings as
        | Partial<ContainerCheckerSettings>
        | undefined;
    const merged = {
        ...DEFAULT_CONTAINER_CHECKER_SETTINGS,
        ...(existing || {}),
        ...settings,
    };
    await setStorage({ [STORAGE_KEYS.SETTINGS]: merged });
}

export async function touchContainerCheckerLastRunAt(isoTime: string): Promise<void> {
    await setStorage({ [STORAGE_KEYS.LAST_RUN_AT]: isoTime });
}
