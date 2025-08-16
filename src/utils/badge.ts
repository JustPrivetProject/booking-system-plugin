import { StatusIconMap } from '../data';

import { consoleLog, sortStatusesByPriority } from './index';

class BadgeManager {
    private lastStatus: string = '';

    async updateBadge(statuses: string[]): Promise<void> {
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
        if (this.lastStatus === '') return;

        consoleLog('Clearing badge');
        this.lastStatus = '';

        try {
            await this.setBadgeText('');
        } catch (error) {
            consoleLog('Failed to clear badge:', error);
        }
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

    // Метод для тестирования - сброс состояния
    reset(): void {
        this.lastStatus = '';
    }

    // Метод для тестирования - получение текущего статуса
    getLastStatus(): string {
        return this.lastStatus;
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

// Экспортируем для тестирования
export function resetBadge(): void {
    badgeManager.reset();
}

export function getLastBadgeStatus(): string {
    return badgeManager.getLastStatus();
}
