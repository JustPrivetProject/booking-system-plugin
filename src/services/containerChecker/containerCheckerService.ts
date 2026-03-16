import type { PortCheckResult, SupportedPort, WatchlistItem } from '../../containerChecker/types';
import { SUPPORTED_PORTS } from '../../containerChecker/types';
import {
    getContainerCheckerState,
    saveContainerCheckerWatchlist,
    touchContainerCheckerLastRunAt,
} from '../../containerChecker/storage';
import { checkPort } from './portCheckers';
import { authService } from '../authService';
import { notificationService } from '../notificationService';
import { consoleLog } from '../../utils/index';

const ALARM_NAME = 'container-check';

function nowIso(): string {
    return new Date().toISOString();
}

function statusSignature(match: PortCheckResult): string {
    return [
        match?.port || '',
        match?.statusText || '',
        match?.stateText || '',
        match?.milestone || '',
    ].join('|');
}

function normalizePort(portValue: string | undefined): SupportedPort | null {
    const port = (portValue || '').trim().toUpperCase();
    return SUPPORTED_PORTS.includes(port as SupportedPort) ? (port as SupportedPort) : null;
}

function normalizeWatchItem(item: WatchlistItem): WatchlistItem {
    const normalizedPort =
        normalizePort(item?.port) ||
        normalizePort(item?.snapshot?.port) ||
        ('DCT' as SupportedPort);
    return {
        ...item,
        port: normalizedPort,
    };
}

export async function getNormalizedContainerCheckerState() {
    const state = await getContainerCheckerState();
    const normalizedWatchlist = (state.watchlist || []).map(normalizeWatchItem);
    const changed = normalizedWatchlist.some(
        (entry, index) => entry.port !== state.watchlist[index]?.port,
    );
    if (changed) {
        await saveContainerCheckerWatchlist(normalizedWatchlist);
    }
    return {
        ...state,
        watchlist: normalizedWatchlist,
    };
}

export async function updateContainerCheckerAlarm(minutes: number): Promise<void> {
    const isAuthenticated = await authService.isAuthenticated();
    if (!isAuthenticated) {
        await chrome.alarms.clear(ALARM_NAME);
        consoleLog('Container Checker alarm disabled - user is not authenticated');
        return;
    }

    const period = Number(minutes) || 5;
    const existingAlarm = await chrome.alarms.get(ALARM_NAME);

    if (existingAlarm?.periodInMinutes === period) {
        consoleLog('Container Checker alarm already set to', period, 'minutes');
        return;
    }

    await chrome.alarms.clear(ALARM_NAME);

    if (period > 0) {
        await chrome.alarms.create(ALARM_NAME, { periodInMinutes: period });
        consoleLog('Container Checker alarm set to', period, 'minutes');
    }
}

async function evaluateContainer(item: WatchlistItem): Promise<WatchlistItem> {
    const trackedPort = normalizePort(item.port) || ('DCT' as SupportedPort);
    const result = await checkPort(item.containerNumber, trackedPort);
    const best = result.match;
    const previous = item.snapshot || null;
    const hasErrors = (result.errors || []).length > 0;
    const clearedErrorBase: WatchlistItem = {
        ...item,
        port: trackedPort,
        errors: [],
        hasErrors: false,
    };

    if (!best) {
        if (result.errors?.length) {
            return {
                ...item,
                port: trackedPort,
                hasErrors: true,
                errors: result.errors,
                lastCheckedAt: nowIso(),
            };
        }

        if (previous) {
            return {
                ...clearedErrorBase,
                status: item.status || previous.statusText || '-',
                state: item.state || previous.stateText || '-',
                statusChanged: item.statusChanged,
                stateChanged: item.stateChanged,
                lastUpdate: item.lastUpdate || previous.dataTimestamp || null,
                lastCheckedAt: nowIso(),
                lastChangeAt: item.lastChangeAt || null,
                snapshot: previous,
                lastNotifiedSignature: item.lastNotifiedSignature || statusSignature(previous),
            };
        }

        const previousStatus = (item.status || '').trim();
        const previousState = (item.state || '').trim();
        const statusChanged = previousStatus !== '' && previousStatus !== '-';
        const stateChanged = previousState !== '' && previousState !== '-';
        const hasNewChange = statusChanged || stateChanged;

        return {
            ...clearedErrorBase,
            status: '-',
            state: '-',
            statusChanged: item.statusChanged || statusChanged,
            stateChanged: item.stateChanged || stateChanged,
            lastUpdate: null,
            lastCheckedAt: nowIso(),
            lastChangeAt: hasNewChange ? nowIso() : item.lastChangeAt || null,
        };
    }

    if (hasErrors && previous) {
        return {
            ...item,
            errors: result.errors,
            hasErrors: true,
            statusChanged: item.statusChanged,
            stateChanged: item.stateChanged,
            lastUpdate: previous.dataTimestamp || null,
            lastCheckedAt: nowIso(),
            port: trackedPort,
        };
    }

    const statusChanged =
        !hasErrors && previous ? (previous.statusText || '') !== (best.statusText || '') : false;
    const stateChanged =
        !hasErrors && previous ? (previous.stateText || '') !== (best.stateText || '') : false;
    const changed = !hasErrors && previous ? statusChanged || stateChanged : false;
    const persistedStatusChanged = item.statusChanged || statusChanged;
    const persistedStateChanged = item.stateChanged || stateChanged;
    const currentSignature = statusSignature(best);
    const shouldNotify = changed && item.lastNotifiedSignature !== currentSignature;

    const updated: WatchlistItem = {
        ...clearedErrorBase,
        status: best.statusText || '-',
        state: best.stateText || '-',
        statusChanged: persistedStatusChanged,
        stateChanged: persistedStateChanged,
        lastUpdate: best.dataTimestamp || null,
        lastCheckedAt: nowIso(),
        lastChangeAt: changed ? nowIso() : item.lastChangeAt || null,
        snapshot: best,
        lastNotifiedSignature: shouldNotify ? currentSignature : item.lastNotifiedSignature || null,
    };

    if (shouldNotify) {
        try {
            await notificationService.sendContainerChangeNotification({
                containerNumber: item.containerNumber,
                port: trackedPort,
                previousMilestone: previous?.milestone || 'n/a',
                currentMilestone: best.milestone,
                previousStatusText: previous?.statusText || 'n/a',
                currentStatusText: best.statusText,
                previousStateText: previous?.stateText || '-',
                currentStateText: best.stateText || '-',
                dataTimestamp: best.dataTimestamp,
            });
        } catch {
            // notification failed; silently continue
        }
    }

    return updated;
}

export async function runContainerCheckCycle(): Promise<void> {
    const isAuthenticated = await authService.isAuthenticated();
    if (!isAuthenticated) {
        consoleLog('Skipping Container Checker cycle - user is not authenticated');
        return;
    }

    const state = await getNormalizedContainerCheckerState();
    const updated: WatchlistItem[] = [];

    for (const item of state.watchlist) {
        try {
            const next = await evaluateContainer(item);
            updated.push(next);
        } catch (error) {
            updated.push({
                ...item,
                errors: [(error as Error)?.message || 'Check failed'],
                lastUpdate: item.snapshot?.dataTimestamp || null,
                lastCheckedAt: nowIso(),
            });
        }
    }

    await saveContainerCheckerWatchlist(updated);
    await touchContainerCheckerLastRunAt(nowIso());
}

export async function acknowledgeContainerCheckerUiChanges() {
    const state = await getNormalizedContainerCheckerState();
    let changed = false;
    const nextWatchlist = state.watchlist.map(item => {
        if (item.statusChanged || item.stateChanged) {
            changed = true;
            return {
                ...item,
                statusChanged: false,
                stateChanged: false,
            };
        }
        return item;
    });

    if (changed) {
        await saveContainerCheckerWatchlist(nextWatchlist);
    }

    return getNormalizedContainerCheckerState();
}
