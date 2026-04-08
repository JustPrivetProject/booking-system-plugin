import { StatusIconMap } from '../data';
import { BOOKING_TERMINALS } from '../types/terminal';

import { consoleLog, sortStatusesByPriority } from './index';
import { getStorage, getTerminalStorageKey, TERMINAL_STORAGE_NAMESPACES } from './storage';

function isKnownBaseStatus(status: unknown): status is string {
    return (
        typeof status === 'string' && Object.prototype.hasOwnProperty.call(StatusIconMap, status)
    );
}

function normalizeGctBadgeStatus(status: unknown): string | null {
    if (status === 'watching' || status === 'attempting') {
        return 'in-progress';
    }

    if (status === 'completed') {
        return 'paused';
    }

    if (status === 'auth-lost') {
        return 'authorization-error';
    }

    return isKnownBaseStatus(status) ? status : null;
}

class BadgeManager {
    private lastStatus: string = '';
    private loggedOutBadgeVisible: boolean = false;

    async updateBadge(statuses: string[]): Promise<void> {
        if (this.loggedOutBadgeVisible) {
            if (!statuses.length) {
                this.lastStatus = '';
            } else {
                const sortedStatuses = sortStatusesByPriority(statuses);
                this.lastStatus = sortedStatuses[0];
            }
            return;
        }

        if (!statuses.length) {
            await this.setBadgeText('');
            return;
        }

        const sortedStatuses = sortStatusesByPriority(statuses);
        const top = sortedStatuses[0];
        if (top === this.lastStatus && this.lastStatus !== '') return;

        this.lastStatus = top;
        const icon = StatusIconMap[this.lastStatus];
        consoleLog('Updating badge to', top, icon);

        try {
            await this.setBadgeText(icon);
        } catch (error) {
            consoleLog('Failed to update badge:', error);
        }
    }

    async clearBadge(): Promise<void> {
        if (this.loggedOutBadgeVisible) {
            this.lastStatus = '';
            return;
        }

        if (this.lastStatus === '') return;

        consoleLog('Clearing badge');
        this.lastStatus = '';

        try {
            await this.setBadgeText('');
            await this.setBadgeBackgroundColor([0, 0, 0, 0]);
        } catch (error) {
            consoleLog('Failed to clear badge:', error);
        }
    }

    async showLoggedOutBadge(): Promise<void> {
        if (this.loggedOutBadgeVisible) return;

        consoleLog('Showing logged out badge');
        this.loggedOutBadgeVisible = true;

        try {
            await this.setBadgeBackgroundColor('#d93025');
            await this.setBadgeText('•');
        } catch (error) {
            consoleLog('Failed to show logged out badge:', error);
        }
    }

    async clearLoggedOutBadge(): Promise<void> {
        if (!this.loggedOutBadgeVisible) return;

        consoleLog('Clearing logged out badge');
        this.loggedOutBadgeVisible = false;

        try {
            await this.setBadgeBackgroundColor([0, 0, 0, 0]);

            if (this.lastStatus) {
                await this.setBadgeText(StatusIconMap[this.lastStatus]);
            } else {
                await this.setBadgeText('');
            }
        } catch (error) {
            consoleLog('Failed to clear logged out badge:', error);
        }
    }

    async syncAuthenticationBadge(isAuthenticated: boolean): Promise<void> {
        if (isAuthenticated) {
            await this.clearLoggedOutBadge();
            return;
        }

        await this.showLoggedOutBadge();
    }

    private async setBadgeText(text: string | undefined): Promise<void> {
        return new Promise((resolve, reject) => {
            chrome.action.setBadgeText({ text }, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });
    }

    private async setBadgeBackgroundColor(
        color: string | [number, number, number, number],
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            chrome.action.setBadgeBackgroundColor({ color }, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });
    }

    // Метод для тестирования - сброс состояния
    reset(): void {
        this.lastStatus = '';
        this.loggedOutBadgeVisible = false;
    }

    // Метод для тестирования - получение текущего статуса
    getLastStatus(): string {
        return this.lastStatus;
    }

    isLoggedOutBadgeVisible(): boolean {
        return this.loggedOutBadgeVisible;
    }
}

// Создаем единственный экземпляр
const badgeManager = new BadgeManager();

// Экспортируем функции для обратной совместимости
export function updateBadge(statuses: string[]): Promise<void> {
    return badgeManager.updateBadge(statuses);
}

export function clearBadge(): Promise<void> {
    return badgeManager.clearBadge();
}

export async function syncStatusBadgeFromStorage(): Promise<void> {
    const bctRetryQueueKey = getTerminalStorageKey(
        TERMINAL_STORAGE_NAMESPACES.RETRY_QUEUE,
        BOOKING_TERMINALS.BCT,
    );
    const state = (await getStorage(['retryQueue', bctRetryQueueKey, 'gctGroups'])) as {
        retryQueue?: Array<{ status?: unknown }>;
        [bctRetryQueueKey]?: Array<{ status?: unknown }>;
        gctGroups?: Array<{ rows?: Array<{ status?: unknown }> }>;
    };

    const retryStatuses = Array.isArray(state.retryQueue)
        ? state.retryQueue
              .map(item => item?.status)
              .filter((status): status is string => isKnownBaseStatus(status))
        : [];

    const bctRetryStatuses = Array.isArray(state[bctRetryQueueKey])
        ? state[bctRetryQueueKey]
              .map(item => item?.status)
              .filter((status): status is string => isKnownBaseStatus(status))
        : [];

    const gctStatuses = Array.isArray(state.gctGroups)
        ? state.gctGroups.flatMap(group =>
              Array.isArray(group?.rows)
                  ? group.rows
                        .map(row => normalizeGctBadgeStatus(row?.status))
                        .filter((status): status is string => status !== null)
                  : [],
          )
        : [];

    const statuses = [...retryStatuses, ...bctRetryStatuses, ...gctStatuses];

    if (!statuses.length) {
        await clearBadge();
        return;
    }

    await updateBadge(statuses);
}

export function syncAuthenticationBadge(isAuthenticated: boolean): Promise<void> {
    return badgeManager.syncAuthenticationBadge(isAuthenticated);
}

// Экспортируем для тестирования
export function resetBadge(): void {
    badgeManager.reset();
}

export function getLastBadgeStatus(): string {
    return badgeManager.getLastStatus();
}

export function isLoggedOutBadgeVisible(): boolean {
    return badgeManager.isLoggedOutBadgeVisible();
}
