import type { QueueConfig, QueueEvents } from '../types/queue';

import { authService } from './authService';
import { QueueManager } from './queueManager';

export class QueueManagerFactory {
    static create(config: Partial<QueueConfig> = {}, events: QueueEvents = {}): QueueManager {
        // Create auth service adapter
        const authServiceAdapter = {
            isAuthenticated: async (): Promise<boolean> => {
                return await authService.isAuthenticated();
            },
        };

        return new QueueManager(authServiceAdapter, config, events);
    }

    static createForTesting(
        authService: any,
        config: Partial<QueueConfig> = {},
        events: QueueEvents = {},
    ): QueueManager {
        return new QueueManager(authService, config, events);
    }
}
