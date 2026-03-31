import { Messages, Statuses } from '../../data';
import {
    type GctGroupDraft,
    type GctGroupStatus,
    type GctHistoryEvent,
    type GctHistoryEventType,
    type GctSlotMatch,
    type GctState,
    type GctTargetSlotDraft,
    type GctWatchGroup,
    type GctWatchRow,
} from '../../gct/types';
import { getGctState, saveGctGroups, touchGctLastTickAt } from '../../gct/storage';
import { authService } from '../authService';
import { notificationService } from '../notificationService';
import { syncStatusBadgeFromStorage } from '../../utils/badge';
import { consoleError, consoleLog } from '../../utils';
import {
    bookGctSlot,
    buildBookPayload,
    getGctAvailableSlots,
    getGctCurrentBooking,
    getNowInGctTimezone,
    loginToGct,
    matchesCurrentBooking,
} from './gctApi';

const MAX_HISTORY_EVENTS = 25;
const MIN_GCT_POLL_MS = 8000;
const GCT_TOKEN_CACHE_TTL_MS = 2 * 60 * 1000;
const GCT_NETWORK_BACKOFF_BASE_MS = 8000;
const GCT_NETWORK_BACKOFF_MAX_MS = 5 * 60 * 1000;
const GCT_RETRY_JITTER_MIN_MS = 1000;
const GCT_RETRY_JITTER_MAX_MS = 2500;
const GCT_LOGIN_BLOCK_COOLDOWN_MS = 30 * 60 * 1000;

interface GctCachedToken {
    token: string;
    identityKey: string;
    expiresAt: number;
}

function nowIso(): string {
    return new Date().toISOString();
}

function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomInt(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1));
}

function getRetryJitterMs(): number {
    return randomInt(GCT_RETRY_JITTER_MIN_MS, GCT_RETRY_JITTER_MAX_MS);
}

function getBaseRetryDelayMs(): number {
    return GCT_NETWORK_BACKOFF_BASE_MS + getRetryJitterMs();
}

function createId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
}

function pad(value: number): string {
    return String(value).padStart(2, '0');
}

function buildSlotWindow(date: string, startTime: string) {
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = startTime.split(':').map(Number);
    const start = new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0, 0);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

    const targetDate = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
    const targetEndDate = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
    const targetStartTime = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
    const targetEndTime = `${pad(end.getHours())}:${pad(end.getMinutes())}`;

    return {
        targetDate,
        targetStartTime,
        targetEndDate,
        targetEndTime,
        targetStartLocal: `${targetDate} ${targetStartTime}`,
        targetEndLocal: `${targetEndDate} ${targetEndTime}`,
    };
}

function addHistory(row: GctWatchRow, type: GctHistoryEventType, message: string): GctWatchRow {
    const entry: GctHistoryEvent = {
        at: nowIso(),
        type,
        message,
    };

    return {
        ...row,
        history: [...row.history, entry].slice(-MAX_HISTORY_EVENTS),
    };
}

function createRow(slot: GctTargetSlotDraft): GctWatchRow {
    const window = buildSlotWindow(slot.date, slot.startTime);

    return {
        id: createId('gct-row'),
        ...window,
        status: Statuses.IN_PROGRESS,
        statusMessage: 'Szukam',
        active: true,
        isManualPause: false,
        lastAttemptAt: null,
        lastMatchedAt: null,
        lastVerifiedAt: null,
        lastError: null,
        history: [
            {
                at: nowIso(),
                type: 'created',
                message: `Dodano cel ${window.targetStartLocal} - ${window.targetEndTime}`,
            },
        ],
    };
}

function mergeSlots(existingRows: GctWatchRow[], slots: GctTargetSlotDraft[]): GctWatchRow[] {
    const rows = [...existingRows];
    const existingKeys = new Set(rows.map(row => row.targetStartLocal));

    for (const slot of slots) {
        const nextRow = createRow(slot);
        if (!existingKeys.has(nextRow.targetStartLocal)) {
            rows.push(nextRow);
            existingKeys.add(nextRow.targetStartLocal);
        }
    }

    return rows;
}

function normalizeSlots(slots: GctTargetSlotDraft[]): GctTargetSlotDraft[] {
    const uniqueSlots = new Map<string, GctTargetSlotDraft>();

    for (const slot of slots) {
        uniqueSlots.set(`${slot.date} ${slot.startTime}`, slot);
    }

    return [...uniqueSlots.values()].sort((left, right) => {
        const leftKey = `${left.date} ${left.startTime}`;
        const rightKey = `${right.date} ${right.startTime}`;
        return leftKey.localeCompare(rightKey);
    });
}

function isTerminalRow(row: GctWatchRow): boolean {
    return [Statuses.SUCCESS, Statuses.EXPIRED, 'completed'].includes(row.status);
}

function hasActiveRows(group: GctWatchGroup): boolean {
    return group.rows.some(row => row.active && !isTerminalRow(row));
}

function summarizeGroupStatus(
    group: GctWatchGroup,
): Pick<GctWatchGroup, 'status' | 'statusMessage'> {
    if (group.rows.some(row => row.isManualPause)) {
        return {
            status: 'paused',
            statusMessage: 'Wstrzymane ręcznie',
        };
    }

    if (hasActiveRows(group)) {
        return {
            status: 'watching',
            statusMessage: 'Szukam',
        };
    }

    if (group.rows.some(row => row.status === Statuses.SUCCESS)) {
        return {
            status: 'success',
            statusMessage: 'Slot zarezerwowany',
        };
    }

    if (group.rows.some(row => row.status === Statuses.AUTHORIZATION_ERROR)) {
        return {
            status: 'auth-lost',
            statusMessage: 'Wymagane logowanie',
        };
    }

    if (group.rows.every(row => isTerminalRow(row) || row.status === Statuses.ERROR)) {
        return {
            status: 'completed',
            statusMessage: 'Brak aktywnych slotów',
        };
    }

    return {
        status: 'error',
        statusMessage: 'Wymaga uwagi',
    };
}

function nextDelayMs(state: GctState): number {
    const min = Math.max(MIN_GCT_POLL_MS, state.settings.pollMinMs);
    const max = Math.max(min, state.settings.pollMaxMs);
    const jitterMin = Math.max(0, state.settings.jitterMinMs);
    const jitterMax = Math.max(jitterMin, state.settings.jitterMaxMs);
    const base = randomInt(min, max);
    const jitter = randomInt(jitterMin, jitterMax);
    const direction = Math.random() >= 0.5 ? 1 : -1;
    const total = Math.max(1000, base + direction * jitter);

    consoleLog(
        '[GCT] Next polling delay selected:',
        `base=${base}ms`,
        `jitter=${direction * jitter}ms`,
        `total=${total}ms`,
    );

    return total;
}

function isTimeoutLikeNetworkError(error: unknown): boolean {
    const message = errorText(error).toLowerCase();
    return (
        message.includes('failed to fetch') ||
        message.includes('timeout') ||
        message.includes('timed out') ||
        message.includes('err_connection_timed_out')
    );
}

function isLikelyLoginBlockError(error: unknown): boolean {
    const message = errorText(error).toLowerCase();

    return (
        message.includes('too many') ||
        message.includes('rate limit') ||
        message.includes('429') ||
        message.includes('blocked') ||
        message.includes('forbidden') ||
        message.includes('did not return a bearer token')
    );
}

function buildGroupIdentityKey(group: GctWatchGroup): string {
    return `${group.documentNumber}|${group.vehicleNumber}|${group.containerNumber}`;
}

function classifyError(error: unknown): 'auth' | 'network' | 'terminal' {
    const message =
        error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    if (message.includes('401') || message.includes('403') || message.includes('jwt')) {
        return 'auth';
    }

    if (
        message.includes('failed to fetch') ||
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('503') ||
        message.includes('502')
    ) {
        return 'network';
    }

    if (
        message.includes('400') ||
        message.includes('406') ||
        message.includes('404') ||
        message.includes('not acceptable') ||
        message.includes('required') ||
        message.includes('did not return a bearer token')
    ) {
        return 'terminal';
    }

    return 'network';
}

function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function buildDiagnosticError(
    group: GctWatchGroup,
    row: GctWatchRow,
    phase: string,
    error: unknown,
): string {
    return `[${phase}] ${errorText(error)} | group=${group.id} | row=${row.id} | target=${row.targetStartLocal}`;
}

function buildSuccessNotificationPayload(group: GctWatchGroup, row: GctWatchRow) {
    return {
        emails: [],
        notificationSource: 'GCT' as const,
        userName: group.documentNumber,
        tvAppId: group.containerNumber,
        bookingTime: row.targetStartLocal,
        driverName: group.vehicleNumber,
        containerNumber: group.containerNumber,
    };
}

export class GctWatcherService {
    private static instance: GctWatcherService | null = null;
    private timers = new Map<string, ReturnType<typeof setTimeout>>();
    private processingGroups = new Set<string>();
    private tokenCache = new Map<string, GctCachedToken>();
    private networkBackoffLevel = new Map<string, number>();
    private networkBackoffUntil = new Map<string, number>();
    private loginCooldownUntil = new Map<string, number>();
    private globalLoginCooldownUntil = 0;
    private activeLoginGroupId: string | null = null;

    static getInstance(): GctWatcherService {
        if (!GctWatcherService.instance) {
            GctWatcherService.instance = new GctWatcherService();
        }

        return GctWatcherService.instance;
    }

    async getState(): Promise<GctState> {
        return getGctState();
    }

    async ensureSchedules(): Promise<void> {
        const state = await this.getState();

        for (const group of state.groups) {
            if (group.status === 'watching') {
                this.scheduleGroup(group.id, state);
            } else {
                this.clearTimer(group.id);
            }
        }
    }

    async addGroup(draft: GctGroupDraft, prefetchedToken?: string): Promise<GctState> {
        const state = await this.getState();
        const normalizedDraft = {
            documentNumber: draft.documentNumber.trim(),
            vehicleNumber: draft.vehicleNumber.trim().toUpperCase(),
            containerNumber: draft.containerNumber.trim().toUpperCase(),
            slots: draft.slots,
        };

        const existingGroup = state.groups.find(
            group =>
                group.documentNumber === normalizedDraft.documentNumber &&
                group.vehicleNumber === normalizedDraft.vehicleNumber &&
                group.containerNumber === normalizedDraft.containerNumber,
        );

        const now = nowIso();
        let nextGroups: GctWatchGroup[];

        if (existingGroup) {
            const mergedGroup: GctWatchGroup = {
                ...existingGroup,
                rows: mergeSlots(existingGroup.rows, normalizedDraft.slots),
                updatedAt: now,
            };
            const summary = summarizeGroupStatus(mergedGroup);
            nextGroups = state.groups.map(group =>
                group.id === existingGroup.id ? { ...mergedGroup, ...summary } : group,
            );
        } else {
            const createdGroup: GctWatchGroup = {
                id: createId('gct-group'),
                documentNumber: normalizedDraft.documentNumber,
                vehicleNumber: normalizedDraft.vehicleNumber,
                containerNumber: normalizedDraft.containerNumber,
                rows: mergeSlots([], normalizedDraft.slots),
                createdAt: now,
                updatedAt: now,
                status: 'watching',
                statusMessage: 'Szukam',
                isExpanded: true,
            };

            if (prefetchedToken && prefetchedToken.trim().length > 0) {
                this.storeCachedToken(createdGroup, prefetchedToken.trim());
                this.clearLoginCooldown(createdGroup.id);
            } else {
                await this.loginAndCacheToken(createdGroup, getBaseRetryDelayMs() + 1000);
            }
            nextGroups = [...state.groups, createdGroup];
        }

        await this.saveGroups(nextGroups);
        const nextState = await this.getState();
        await this.ensureSchedules();
        return nextState;
    }

    async removeGroup(groupId: string): Promise<GctState> {
        const state = await this.getState();
        this.clearTimer(groupId);
        this.clearCachedToken(groupId);
        this.clearNetworkBackoff(groupId);
        this.clearLoginCooldown(groupId);
        await this.saveGroups(state.groups.filter(group => group.id !== groupId));
        return this.getState();
    }

    async removeRow(groupId: string, rowId: string): Promise<GctState> {
        const state = await this.getState();
        const nextGroups = state.groups
            .map(group => {
                if (group.id !== groupId) return group;
                const rows = group.rows.filter(row => row.id !== rowId);
                const nextGroup = {
                    ...group,
                    rows,
                    updatedAt: nowIso(),
                };
                return { ...nextGroup, ...summarizeGroupStatus(nextGroup) };
            })
            .filter(group => group.rows.length > 0);

        await this.saveGroups(nextGroups);
        await this.ensureSchedules();
        return this.getState();
    }

    async replaceGroupSlots(groupId: string, slots: GctTargetSlotDraft[]): Promise<GctState> {
        const normalizedSlots = normalizeSlots(slots);
        if (normalizedSlots.length === 0) {
            throw new Error('At least one slot is required');
        }

        const state = await this.getState();
        const nextGroups = state.groups.map(group => {
            if (group.id !== groupId) {
                return group;
            }

            const existingRowsByStartLocal = new Map(
                group.rows.map(row => [row.targetStartLocal, row] as const),
            );
            const rows = normalizedSlots.map(slot => {
                const slotWindow = buildSlotWindow(slot.date, slot.startTime);
                return existingRowsByStartLocal.get(slotWindow.targetStartLocal) || createRow(slot);
            });

            const nextGroup = {
                ...group,
                rows,
                updatedAt: nowIso(),
            };

            return { ...nextGroup, ...summarizeGroupStatus(nextGroup) };
        });

        await this.saveGroups(nextGroups);
        await this.ensureSchedules();
        return this.getState();
    }

    async toggleGroupExpanded(groupId: string): Promise<GctState> {
        const state = await this.getState();
        const nextGroups = state.groups.map(group =>
            group.id === groupId ? { ...group, isExpanded: !group.isExpanded } : group,
        );
        await this.saveGroups(nextGroups);
        return this.getState();
    }

    async pauseGroup(groupId: string): Promise<GctState> {
        const state = await this.getState();
        const nextGroups = state.groups.map(group => {
            if (group.id !== groupId) return group;

            const rows = group.rows.map(row =>
                isTerminalRow(row)
                    ? row
                    : addHistory(
                          {
                              ...row,
                              active: false,
                              isManualPause: true,
                              status: Statuses.PAUSED,
                              statusMessage: 'Wstrzymane ręcznie',
                          },
                          'stopped',
                          'Wstrzymano monitorowanie ręcznie',
                      ),
            );

            return {
                ...group,
                rows,
                updatedAt: nowIso(),
                status: 'paused' as GctGroupStatus,
                statusMessage: 'Wstrzymane ręcznie',
            };
        });

        await this.saveGroups(nextGroups);
        this.clearTimer(groupId);
        return this.getState();
    }

    async resumeGroup(groupId: string): Promise<GctState> {
        const state = await this.getState();
        const nextGroups = state.groups.map(group => {
            if (group.id !== groupId) return group;

            const rows = group.rows.map(row => {
                if (isTerminalRow(row)) {
                    return row;
                }

                return addHistory(
                    {
                        ...row,
                        active: true,
                        isManualPause: false,
                        status: Statuses.IN_PROGRESS,
                        statusMessage: 'Szukam',
                        lastError: null,
                    },
                    'watching',
                    'Wznowiono monitorowanie',
                );
            });

            const nextGroup = {
                ...group,
                rows,
                updatedAt: nowIso(),
            };
            return { ...nextGroup, ...summarizeGroupStatus(nextGroup) };
        });

        await this.saveGroups(nextGroups);
        await this.ensureSchedules();
        return this.getState();
    }

    async pauseRow(groupId: string, rowId: string): Promise<GctState> {
        return this.updateRow(groupId, rowId, row =>
            addHistory(
                {
                    ...row,
                    active: false,
                    isManualPause: true,
                    status: Statuses.PAUSED,
                    statusMessage: 'Wstrzymane ręcznie',
                },
                'stopped',
                'Wstrzymano monitorowanie ręcznie',
            ),
        );
    }

    async resumeRow(groupId: string, rowId: string): Promise<GctState> {
        const state = await this.updateRow(groupId, rowId, row =>
            addHistory(
                {
                    ...row,
                    active: true,
                    isManualPause: false,
                    status: Statuses.IN_PROGRESS,
                    statusMessage: 'Szukam',
                    lastError: null,
                },
                'watching',
                'Wznowiono monitorowanie slotu',
            ),
        );

        await this.ensureSchedules();
        return state;
    }

    async stopAllForExtensionLogout(): Promise<void> {
        const state = await this.getState();
        const nextGroups = state.groups.map(group => {
            const rows = group.rows.map(row => {
                if (isTerminalRow(row)) {
                    return row;
                }

                return addHistory(
                    {
                        ...row,
                        active: false,
                        isManualPause: false,
                        status: Statuses.AUTHORIZATION_ERROR,
                        statusMessage: 'Zatrzymane po wylogowaniu',
                    },
                    'auth-lost',
                    'Rozszerzenie zostało wylogowane',
                );
            });

            return {
                ...group,
                rows,
                updatedAt: nowIso(),
                status: 'auth-lost' as GctGroupStatus,
                statusMessage: 'Wylogowano',
            };
        });

        await this.saveGroups(nextGroups);
        this.tokenCache.clear();
        this.networkBackoffLevel.clear();
        this.networkBackoffUntil.clear();
        this.loginCooldownUntil.clear();
        this.globalLoginCooldownUntil = 0;
        this.activeLoginGroupId = null;
        for (const group of nextGroups) {
            this.clearTimer(group.id);
        }
    }

    async handleExtensionAuthRestored(): Promise<void> {
        const state = await this.getState();
        const nextGroups = state.groups.map(group => {
            if (group.status !== 'auth-lost') {
                return group;
            }

            const rows = group.rows.map(row => {
                if (isTerminalRow(row) || row.isManualPause) {
                    return row;
                }

                return addHistory(
                    {
                        ...row,
                        active: true,
                        status: Statuses.IN_PROGRESS,
                        statusMessage: 'Szukam',
                        lastError: null,
                    },
                    'watching',
                    'Przywrócono monitorowanie po odzyskaniu sesji',
                );
            });

            const nextGroup = {
                ...group,
                rows,
                updatedAt: nowIso(),
            };

            return { ...nextGroup, ...summarizeGroupStatus(nextGroup) };
        });

        await this.saveGroups(nextGroups);
        await this.ensureSchedules();
    }

    private async updateRow(
        groupId: string,
        rowId: string,
        updater: (row: GctWatchRow) => GctWatchRow,
    ): Promise<GctState> {
        const state = await this.getState();
        const nextGroups = state.groups.map(group => {
            if (group.id !== groupId) return group;

            const rows = group.rows.map(row => (row.id === rowId ? updater(row) : row));
            const nextGroup = {
                ...group,
                rows,
                updatedAt: nowIso(),
            };

            return { ...nextGroup, ...summarizeGroupStatus(nextGroup) };
        });

        await this.saveGroups(nextGroups);
        await this.ensureSchedules();
        return this.getState();
    }

    private clearTimer(groupId: string): void {
        const existing = this.timers.get(groupId);
        if (existing) {
            clearTimeout(existing);
            this.timers.delete(groupId);
        }
    }

    private getCachedToken(group: GctWatchGroup): string | null {
        const cachedToken = this.tokenCache.get(group.id);
        if (!cachedToken) {
            return null;
        }

        if (
            cachedToken.expiresAt <= Date.now() ||
            cachedToken.identityKey !== buildGroupIdentityKey(group)
        ) {
            this.tokenCache.delete(group.id);
            return null;
        }

        return cachedToken.token;
    }

    private storeCachedToken(group: GctWatchGroup, token: string): void {
        this.tokenCache.set(group.id, {
            token,
            identityKey: buildGroupIdentityKey(group),
            expiresAt: Date.now() + GCT_TOKEN_CACHE_TTL_MS,
        });
    }

    private clearCachedToken(groupId: string): void {
        this.tokenCache.delete(groupId);
    }

    private registerNetworkBackoff(groupId: string, error: unknown): void {
        if (!isTimeoutLikeNetworkError(error)) {
            return;
        }

        const nextLevel = (this.networkBackoffLevel.get(groupId) || 0) + 1;
        const jitterMs = getRetryJitterMs();
        const delayMs = Math.min(
            GCT_NETWORK_BACKOFF_MAX_MS,
            GCT_NETWORK_BACKOFF_BASE_MS * 2 ** (nextLevel - 1) + jitterMs,
        );
        this.networkBackoffLevel.set(groupId, nextLevel);
        this.networkBackoffUntil.set(groupId, Date.now() + delayMs);
        consoleLog('[GCT] Applied network backoff', `group=${groupId}`, `delay=${delayMs}ms`);
    }

    private clearNetworkBackoff(groupId: string): void {
        this.networkBackoffLevel.delete(groupId);
        this.networkBackoffUntil.delete(groupId);
    }

    private registerLoginCooldown(groupId: string, error: unknown): void {
        const delayMs = isLikelyLoginBlockError(error)
            ? GCT_LOGIN_BLOCK_COOLDOWN_MS
            : getBaseRetryDelayMs();
        const nextAllowedAt = Date.now() + delayMs;
        const current = this.loginCooldownUntil.get(groupId) || 0;

        this.loginCooldownUntil.set(groupId, Math.max(current, nextAllowedAt));
        this.globalLoginCooldownUntil = Math.max(this.globalLoginCooldownUntil, nextAllowedAt);
        consoleLog('[GCT] Applied login cooldown', `group=${groupId}`, `delay=${delayMs}ms`);
    }

    private clearLoginCooldown(groupId: string): void {
        this.loginCooldownUntil.delete(groupId);
    }

    private async acquireLoginSlot(groupId: string, maxWaitMs = 0): Promise<boolean> {
        const deadline = Date.now() + Math.max(0, maxWaitMs);

        do {
            if (this.tryAcquireLoginSlot(groupId)) {
                return true;
            }

            if (Date.now() >= deadline) {
                return false;
            }

            const loginCooldownUntil = this.loginCooldownUntil.get(groupId) || 0;
            const waitUntil = Math.max(this.globalLoginCooldownUntil, loginCooldownUntil);
            const waitMs = Math.max(50, Math.min(deadline - Date.now(), waitUntil - Date.now()));

            await wait(waitMs);
        } while (Date.now() <= deadline);

        return false;
    }

    private async loginAndCacheToken(group: GctWatchGroup, maxWaitMs = 0): Promise<string> {
        const acquired = await this.acquireLoginSlot(group.id, maxWaitMs);
        if (!acquired) {
            this.registerLoginCooldown(group.id, new Error('GCT login throttled'));
            throw new Error('GCT login throttled');
        }

        try {
            const token = await loginToGct(group);
            this.storeCachedToken(group, token);
            this.clearLoginCooldown(group.id);
            return token;
        } catch (error) {
            this.registerLoginCooldown(group.id, error);
            throw error;
        } finally {
            this.releaseLoginSlot(group.id);
        }
    }

    private tryAcquireLoginSlot(groupId: string): boolean {
        const now = Date.now();

        if (this.activeLoginGroupId && this.activeLoginGroupId !== groupId) {
            return false;
        }

        if (this.globalLoginCooldownUntil > now) {
            return false;
        }

        this.activeLoginGroupId = groupId;
        this.globalLoginCooldownUntil = Math.max(
            this.globalLoginCooldownUntil,
            now + getBaseRetryDelayMs(),
        );

        return true;
    }

    private releaseLoginSlot(groupId: string): void {
        if (this.activeLoginGroupId === groupId) {
            this.activeLoginGroupId = null;
        }
    }

    private scheduleGroup(groupId: string, state: GctState): void {
        if (this.timers.has(groupId)) {
            return;
        }

        const baseDelay = nextDelayMs(state);
        const backoffUntil = this.networkBackoffUntil.get(groupId) || 0;
        const loginCooldownUntil = this.loginCooldownUntil.get(groupId) || 0;
        const globalLoginCooldownUntil = this.globalLoginCooldownUntil;
        const delay = Math.max(
            baseDelay,
            Math.max(0, backoffUntil - Date.now()),
            Math.max(0, loginCooldownUntil - Date.now()),
            Math.max(0, globalLoginCooldownUntil - Date.now()),
        );
        const timeout = setTimeout(() => {
            this.timers.delete(groupId);
            this.processGroup(groupId).catch(error => {
                consoleError('[GCT] Group cycle failed:', error);
            });
        }, delay);

        this.timers.set(groupId, timeout);
    }

    private async processGroup(groupId: string): Promise<void> {
        if (this.processingGroups.has(groupId)) {
            return;
        }

        this.processingGroups.add(groupId);

        try {
            const isAuthenticated = await authService.isAuthenticated();
            if (!isAuthenticated) {
                await this.stopAllForExtensionLogout();
                return;
            }

            const state = await this.getState();
            const group = state.groups.find(entry => entry.id === groupId);

            if (!group || group.status !== 'watching') {
                this.clearTimer(groupId);
                return;
            }

            const groupClone: GctWatchGroup = {
                ...group,
                rows: group.rows.map(row => ({ ...row, history: [...row.history] })),
            };

            const nowLocal = getNowInGctTimezone();
            touchGctLastTickAt(nowIso()).catch(consoleError);

            let token = this.getCachedToken(groupClone);
            if (!token) {
                try {
                    token = await this.loginAndCacheToken(groupClone);
                } catch (error) {
                    const classification = isLikelyLoginBlockError(error)
                        ? 'network'
                        : classifyError(error);
                    if (classification === 'network') {
                        this.registerNetworkBackoff(groupClone.id, error);
                    }
                    this.applyErrorToActiveRows(groupClone, classification, error, 'login');
                    consoleError('[GCT] Login failed for group', groupClone.id, error);
                    await this.persistAndReschedule(groupClone);
                    return;
                }
            }

            let availableSlots: GctSlotMatch[];
            try {
                availableSlots = await getGctAvailableSlots(token);
            } catch (error) {
                const classification = classifyError(error);
                if (classification === 'auth') {
                    this.clearCachedToken(groupClone.id);
                }
                if (classification === 'network') {
                    this.registerNetworkBackoff(groupClone.id, error);
                }
                this.applyErrorToActiveRows(groupClone, classification, error, 'slots-fetch');
                consoleError('[GCT] Slots fetch failed for group', groupClone.id, error);
                await this.persistAndReschedule(groupClone);
                return;
            }

            this.clearNetworkBackoff(groupClone.id);

            let shouldStopGroup = false;

            for (const row of groupClone.rows) {
                if (!row.active || row.isManualPause || isTerminalRow(row)) {
                    continue;
                }

                if (nowLocal >= row.targetEndLocal) {
                    row.status = Statuses.EXPIRED;
                    row.statusMessage = Messages.EXPIRED;
                    row.active = false;
                    row.lastError = null;
                    const expiredRow = addHistory(
                        row,
                        'expired',
                        `Target ${row.targetStartLocal} wygasł`,
                    );
                    Object.assign(row, expiredRow);
                    continue;
                }

                const matches = availableSlots.filter(
                    slot => slot.startLocal === row.targetStartLocal,
                );

                if (matches.length === 0) {
                    row.status = Statuses.IN_PROGRESS;
                    row.statusMessage = 'Szukam';
                    const watchingRow = addHistory(
                        row,
                        'not-found',
                        `Brak slotu ${row.targetStartLocal}`,
                    );
                    Object.assign(row, watchingRow);
                    continue;
                }

                if (matches.length > 1) {
                    row.status = Statuses.ERROR;
                    row.statusMessage = 'Niejednoznaczny slot';
                    row.lastError = `Ambiguous slot match (${matches.length})`;
                    const ambiguousRow = addHistory(
                        row,
                        'ambiguous',
                        `Wiele dopasowań dla ${row.targetStartLocal}`,
                    );
                    Object.assign(row, ambiguousRow);
                    continue;
                }

                const slot = matches[0];
                row.status = 'attempting';
                row.statusMessage = `Rezerwuję ${slot.startLocal}`;
                row.lastAttemptAt = nowIso();
                row.lastMatchedAt = nowIso();
                const attemptRow = addHistory(
                    row,
                    'attempt',
                    `Próba rezerwacji slotu ${slot.startLocal}`,
                );
                Object.assign(row, attemptRow);

                try {
                    await bookGctSlot(token, buildBookPayload(slot));
                    const booking = await getGctCurrentBooking(token);

                    if (matchesCurrentBooking(booking, row.targetStartLocal, row.targetEndLocal)) {
                        row.status = Statuses.SUCCESS;
                        row.statusMessage = 'Slot zarezerwowany';
                        row.active = false;
                        row.lastVerifiedAt = nowIso();
                        row.lastError = null;
                        const successRow = addHistory(
                            row,
                            'verified',
                            `Potwierdzono rezerwację ${row.targetStartLocal}`,
                        );
                        Object.assign(row, successRow);

                        for (const sibling of groupClone.rows) {
                            if (sibling.id === row.id || isTerminalRow(sibling)) {
                                continue;
                            }
                            sibling.active = false;
                            sibling.isManualPause = false;
                            sibling.status = 'completed';
                            sibling.statusMessage = '';
                            const siblingRow = addHistory(
                                sibling,
                                'stopped',
                                `Zatrzymano po sukcesie targetu ${row.targetStartLocal}`,
                            );
                            Object.assign(sibling, siblingRow);
                        }

                        shouldStopGroup = true;
                        break;
                    }

                    row.status = Statuses.IN_PROGRESS;
                    row.statusMessage = 'Brak potwierdzenia, próbuję dalej';
                    row.lastError = `Booking verification failed | group=${groupClone.id} | row=${row.id} | target=${row.targetStartLocal}`;
                    const takenRow = addHistory(
                        row,
                        'taken',
                        `Nie potwierdzono rezerwacji slotu ${row.targetStartLocal}`,
                    );
                    Object.assign(row, takenRow);
                } catch (error) {
                    const classification = classifyError(error);
                    const diagnosticError = buildDiagnosticError(groupClone, row, 'booking', error);
                    consoleError('[GCT] Booking cycle failed', diagnosticError);

                    if (classification === 'terminal') {
                        row.status = Statuses.ERROR;
                        row.statusMessage = error instanceof Error ? error.message : String(error);
                        row.lastError = diagnosticError;
                        row.active = false;
                        const errorRow = addHistory(row, 'error', row.statusMessage);
                        Object.assign(row, errorRow);
                    } else if (classification === 'auth') {
                        this.clearCachedToken(groupClone.id);
                        row.status = Statuses.AUTHORIZATION_ERROR;
                        row.statusMessage = 'Błąd logowania, ponowię';
                        row.lastError = diagnosticError;
                        const authRow = addHistory(row, 'auth-lost', row.statusMessage);
                        Object.assign(row, authRow);
                    } else {
                        row.status = Statuses.NETWORK_ERROR;
                        row.statusMessage = 'Błąd sieci, ponowię';
                        row.lastError = diagnosticError;
                        const networkRow = addHistory(row, 'network-error', row.lastError);
                        Object.assign(row, networkRow);
                    }
                }
            }

            const summary = summarizeGroupStatus(groupClone);
            groupClone.status = shouldStopGroup ? 'success' : summary.status;
            groupClone.statusMessage = shouldStopGroup
                ? 'Slot zarezerwowany'
                : summary.statusMessage;
            groupClone.updatedAt = nowIso();

            await this.persistGroup(groupClone);

            if (shouldStopGroup) {
                await notificationService.sendBookingSuccessNotifications(
                    buildSuccessNotificationPayload(
                        groupClone,
                        groupClone.rows.find(row => row.status === Statuses.SUCCESS) ||
                            groupClone.rows[0],
                    ),
                );
                this.clearTimer(groupId);
                return;
            }

            await this.ensureSchedules();
        } finally {
            this.processingGroups.delete(groupId);
        }
    }

    private applyErrorToActiveRows(
        group: GctWatchGroup,
        classification: 'auth' | 'network' | 'terminal',
        error: unknown,
        phase: string,
    ): void {
        for (const row of group.rows) {
            if (!row.active || row.isManualPause || isTerminalRow(row)) {
                continue;
            }

            const errorMessage = errorText(error);
            const diagnosticError = buildDiagnosticError(group, row, phase, error);

            if (classification === 'auth') {
                row.status = Statuses.AUTHORIZATION_ERROR;
                row.statusMessage = 'Błąd logowania, ponowię';
                row.lastError = diagnosticError;
                const authRow = addHistory(row, 'auth-lost', errorMessage);
                Object.assign(row, authRow);
            } else if (classification === 'terminal') {
                row.status = Statuses.ERROR;
                row.statusMessage = errorMessage;
                row.lastError = diagnosticError;
                row.active = false;
                const terminalRow = addHistory(row, 'error', errorMessage);
                Object.assign(row, terminalRow);
            } else {
                row.status = Statuses.NETWORK_ERROR;
                row.statusMessage = 'Błąd sieci, ponowię';
                row.lastError = diagnosticError;
                const networkRow = addHistory(row, 'network-error', errorMessage);
                Object.assign(row, networkRow);
            }
        }

        const summary = summarizeGroupStatus(group);
        group.status = summary.status;
        group.statusMessage = summary.statusMessage;
        group.updatedAt = nowIso();
    }

    private async persistGroup(group: GctWatchGroup): Promise<void> {
        const state = await this.getState();
        const nextGroups = state.groups.map(entry =>
            entry.id === group.id ? { ...group } : entry,
        );
        await this.saveGroups(nextGroups);
    }

    private async persistAndReschedule(group: GctWatchGroup): Promise<void> {
        await this.persistGroup(group);
        await this.ensureSchedules();
    }

    private async saveGroups(nextGroups: GctWatchGroup[]): Promise<void> {
        await saveGctGroups(nextGroups);
        await syncStatusBadgeFromStorage();
    }
}

export const gctWatcherService = GctWatcherService.getInstance();
