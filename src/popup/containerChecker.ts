/**
 * Container Checker popup UI logic
 */
import type { ContainerCheckerState } from '../containerChecker/types';
import { consoleError } from '../utils/index';

function byId(id: string): HTMLElement | null {
    return document.getElementById(id);
}

function formatDateTime(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const twoDigit = (num: number) => String(num).padStart(2, '0');
    return `${twoDigit(date.getDate())}-${twoDigit(date.getMonth() + 1)}-${date.getFullYear()}, ${twoDigit(date.getHours())}:${twoDigit(date.getMinutes())}:${twoDigit(date.getSeconds())}`;
}

function relativeFromNow(value: string | null, compact = true): string {
    if (!value) return '';
    const deltaMs = Date.now() - new Date(value).getTime();
    const minutes = Math.max(0, Math.floor(deltaMs / 60000));
    if (minutes < 1) return compact ? '1m' : 'przed chwilą';
    if (minutes < 60) return compact ? `${minutes}m` : `${minutes} min temu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return compact ? `${hours}h` : `${hours} h temu`;
    const days = Math.floor(hours / 24);
    return compact ? `${days}d` : `${days} dni temu`;
}

async function sendContainerCheckerMessage(
    type: string,
    data?: { containerNumber?: string; port?: string; settings?: { pollingMinutes?: number } },
): Promise<ContainerCheckerState> {
    const response = await new Promise<{
        ok: boolean;
        result?: ContainerCheckerState;
        error?: string;
    }>(resolve => {
        chrome.runtime.sendMessage(
            { target: 'containerChecker', type, ...data },
            (resp: { ok: boolean; result?: ContainerCheckerState; error?: string }) => {
                if (chrome.runtime.lastError) {
                    resolve({ ok: false, error: chrome.runtime.lastError.message });
                } else {
                    resolve(resp || { ok: false });
                }
            },
        );
    });
    if (!response?.ok) {
        throw new Error(response?.error || 'Unknown error');
    }
    if (!response.result) throw new Error(response?.error || 'No result');
    return response.result;
}

let hasAcknowledgedUiChanges = false;
let suppressNextStorageRefresh = false;
let liveRefreshIntervalId: number | null = null;

function autoResizeContainerInput(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
}

function clampPollingMinutes(value: number): number {
    if (Number.isNaN(value)) return 10;
    return Math.min(99, Math.max(1, value));
}

function getLastCheckedTimestamp(state: ContainerCheckerState): string | null {
    if (state.lastRunAt) return state.lastRunAt;
    const timestamps = state.watchlist
        .map(item => item.lastCheckedAt)
        .filter((value): value is string => Boolean(value));
    if (!timestamps.length) return null;
    const sortedTimestamps = timestamps.sort();
    return sortedTimestamps[sortedTimestamps.length - 1] || null;
}

function renderWatchlist(state: ContainerCheckerState): void {
    const watchlistBody = byId('watchlistBody');
    const pollingMinutes = byId('pollingMinutes') as HTMLInputElement;
    const lastCheckedLabel = byId('lastCheckedLabel');

    if (!watchlistBody) return;

    const buildCell = (
        text: string,
        changed: boolean,
        options: { truncate?: boolean; titlePrefix?: string } = {},
    ): HTMLTableCellElement => {
        const td = document.createElement('td');
        if (changed) td.classList.add('changed-cell');
        const normalized = (text || '-').trim() || '-';

        const content = document.createElement('span');
        content.textContent = normalized;

        if (options.truncate) {
            content.className = 'status-truncate';
            td.title = options.titlePrefix ? `${options.titlePrefix}: ${normalized}` : normalized;
        }

        td.append(content);
        return td;
    };

    watchlistBody.innerHTML = '';
    if (state.watchlist.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'watchlist-empty-row';
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 6;
        emptyCell.className = 'watchlist-empty-cell';
        emptyCell.textContent = 'Dodaj kontenery do śledzenia';
        emptyRow.appendChild(emptyCell);
        watchlistBody.appendChild(emptyRow);
    }
    for (const item of state.watchlist) {
        const tr = document.createElement('tr');

        const containerCell = document.createElement('td');
        containerCell.textContent = item.containerNumber || '-';
        if ((item.errors || []).length) {
            const err = document.createElement('span');
            err.className = 'error-indicator';
            err.textContent = '!';
            err.title = (item.errors || []).join('\n');
            containerCell.append(err);
        }

        const portCell = document.createElement('td');
        portCell.textContent = item.port || '-';

        const statusCell = buildCell(item.status || '-', !!item.statusChanged, {
            truncate: true,
            titlePrefix: 'Status',
        });
        const stateCell = buildCell(item.state || '-', !!item.stateChanged);

        const lastChangeCell = document.createElement('td');
        lastChangeCell.textContent = relativeFromNow(item.lastChangeAt);
        if (item.lastChangeAt) {
            lastChangeCell.title = `Zmiana: ${relativeFromNow(item.lastChangeAt, false)}`;
        }

        const actionsCell = document.createElement('td');
        actionsCell.className = 'actions';
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-button';
        removeBtn.title = 'Usuń';
        removeBtn.innerHTML = '<span class="material-icons icon">delete</span>';
        removeBtn.addEventListener('click', () => handleRemove(item.containerNumber, item.port));
        actionsCell.append(removeBtn);

        tr.append(containerCell, portCell, statusCell, stateCell, lastChangeCell, actionsCell);
        watchlistBody.appendChild(tr);
    }

    if (lastCheckedLabel) {
        const lastChecked = getLastCheckedTimestamp(state);
        lastCheckedLabel.textContent = `Ostatnio sprawdziłem: ${formatDateTime(lastChecked) || '-'}`;
    }

    if (pollingMinutes) pollingMinutes.value = String(state.settings.pollingMinutes);
}

async function refreshState(): Promise<void> {
    try {
        const state = await sendContainerCheckerMessage('GET_STATE');
        renderWatchlist(state);

        if (!hasAcknowledgedUiChanges) {
            const hasChangedCells = state.watchlist.some(
                item => item.statusChanged || item.stateChanged,
            );
            if (hasChangedCells) {
                hasAcknowledgedUiChanges = true;
                suppressNextStorageRefresh = true;
                sendContainerCheckerMessage('ACK_UI_CHANGES').catch(error => {
                    suppressNextStorageRefresh = false;
                    consoleError('Acknowledge UI changes:', error);
                });
            }
        }
    } catch (error) {
        consoleError('Container checker refresh:', error);
        /* Empty row stays from HTML fallback when renderWatchlist never runs */
    }
}

async function handleAdd(): Promise<void> {
    const containerInput = byId('containerInput') as HTMLTextAreaElement;
    const portInput = byId('portInput') as HTMLSelectElement;
    if (!containerInput || !portInput) return;

    const rawInput = (containerInput.value || '').trim();
    const port = (portInput.value || '').trim().toUpperCase();
    if (!rawInput || !port) return;

    const tokens = rawInput
        .split(/[\s,;]+/g)
        .map(entry => entry.trim().toUpperCase())
        .filter(Boolean);
    const uniqueContainers = [...new Set(tokens)];
    if (!uniqueContainers.length) return;

    try {
        for (const containerNumber of uniqueContainers) {
            await sendContainerCheckerMessage('ADD_CONTAINER', { containerNumber, port });
        }
        containerInput.value = '';
        autoResizeContainerInput(containerInput);
        await refreshState();
    } catch (error) {
        consoleError('Add container:', error);
    }
}

async function handleRemove(containerNumber: string, port: string): Promise<void> {
    try {
        await sendContainerCheckerMessage('REMOVE_CONTAINER', { containerNumber, port });
        await refreshState();
    } catch (error) {
        consoleError('Remove container:', error);
    }
}

async function handleCheckNow(): Promise<void> {
    const checkNowBtn = byId('checkNowBtn') as HTMLButtonElement;
    if (checkNowBtn) checkNowBtn.disabled = true;
    try {
        await sendContainerCheckerMessage('CHECK_NOW');
        await refreshState();
    } catch (error) {
        consoleError('Check now:', error);
    } finally {
        if (checkNowBtn) checkNowBtn.disabled = false;
    }
}

async function handleSaveSettings(): Promise<void> {
    const pollingMinutes = byId('pollingMinutes') as HTMLInputElement;
    const value = pollingMinutes?.value || '10';
    try {
        await sendContainerCheckerMessage('SAVE_SETTINGS', {
            settings: { pollingMinutes: Number(value) },
        });
        await refreshState();
    } catch (error) {
        consoleError('Save settings:', error);
    }
}

let containerCheckerUIInitialized = false;

export function initContainerCheckerUI(): void {
    if (containerCheckerUIInitialized) {
        refreshState().catch(consoleError);
        return;
    }
    containerCheckerUIInitialized = true;

    const addBtn = byId('addContainerBtn');
    const checkNowBtn = byId('checkNowBtn');
    const containerInput = byId('containerInput') as HTMLTextAreaElement | null;
    const pollingMinutes = byId('pollingMinutes') as HTMLInputElement | null;
    const pollingMinusBtn = byId('pollingMinusBtn');
    const pollingPlusBtn = byId('pollingPlusBtn');

    addBtn?.addEventListener('click', () => handleAdd().catch(consoleError));
    checkNowBtn?.addEventListener('click', () => handleCheckNow().catch(consoleError));

    containerInput?.addEventListener('keydown', (e: Event) => {
        const ev = e as KeyboardEvent;
        if (ev.key === 'Enter') {
            ev.preventDefault();
            handleAdd().catch(consoleError);
        }
    });

    containerInput?.addEventListener('input', () => {
        autoResizeContainerInput(containerInput);
    });

    if (containerInput) {
        autoResizeContainerInput(containerInput);
    }

    pollingMinutes?.addEventListener('change', () => handleSaveSettings().catch(consoleError));

    const adjustPollingMinutes = (delta: number): void => {
        if (!pollingMinutes) return;
        const current = Number(pollingMinutes.value || '10');
        const nextValue = clampPollingMinutes(current + delta);
        if (nextValue === current) return;
        pollingMinutes.value = String(nextValue);
        pollingMinutes.dispatchEvent(new Event('change', { bubbles: true }));
    };

    pollingMinusBtn?.addEventListener('click', () => {
        adjustPollingMinutes(-1);
    });

    pollingPlusBtn?.addEventListener('click', () => {
        adjustPollingMinutes(1);
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;

        if (suppressNextStorageRefresh && changes.containerCheckerWatchlist) {
            suppressNextStorageRefresh = false;
            return;
        }

        if (
            changes.containerCheckerWatchlist ||
            changes.containerCheckerLastRunAt ||
            changes.containerCheckerSettings
        ) {
            refreshState().catch(consoleError);
        }
    });

    if (liveRefreshIntervalId === null) {
        liveRefreshIntervalId = window.setInterval(() => {
            refreshState().catch(consoleError);
        }, 30000);
    }

    window.addEventListener('beforeunload', () => {
        if (liveRefreshIntervalId !== null) {
            window.clearInterval(liveRefreshIntervalId);
            liveRefreshIntervalId = null;
        }
    });

    refreshState().catch(consoleError);
}
