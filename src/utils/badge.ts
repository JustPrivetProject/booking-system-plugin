import { StatusIconMap } from '../data';

import { consoleLog, sortStatusesByPriority } from './index';

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
