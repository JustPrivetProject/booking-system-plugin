import type { SupportedPort } from '../../containerChecker/types';
import { SUPPORTED_PORTS } from '../../containerChecker/types';
import { DEFAULT_CONTAINER_CHECKER_SETTINGS } from '../../containerChecker/types';
import {
    saveContainerCheckerWatchlist,
    saveContainerCheckerSettings,
} from '../../containerChecker/storage';
import {
    getNormalizedContainerCheckerState,
    updateContainerCheckerAlarm,
    runContainerCheckCycle,
    acknowledgeContainerCheckerUiChanges,
} from '../../services/containerChecker/containerCheckerService';
import { analyticsService } from '../../services/analyticsService';

function normalizeContainerId(containerId: string): string {
    return containerId.trim().toUpperCase();
}

function normalizePort(portValue: string | undefined): SupportedPort | null {
    const port = (portValue || '').trim().toUpperCase();
    return SUPPORTED_PORTS.includes(port as SupportedPort) ? (port as SupportedPort) : null;
}

export type ContainerCheckerMessageType =
    | 'GET_STATE'
    | 'ACK_UI_CHANGES'
    | 'ADD_CONTAINER'
    | 'REMOVE_CONTAINER'
    | 'CHECK_NOW'
    | 'SAVE_SETTINGS';

export interface ContainerCheckerMessage {
    target: 'containerChecker';
    type: ContainerCheckerMessageType;
    containerNumber?: string;
    port?: string;
    settings?: { pollingMinutes?: number };
}

export class ContainerCheckerHandler {
    async handleMessage(message: ContainerCheckerMessage): Promise<unknown> {
        const { type } = message;

        switch (type) {
            case 'GET_STATE':
                return getNormalizedContainerCheckerState();

            case 'ACK_UI_CHANGES':
                return acknowledgeContainerCheckerUiChanges();

            case 'ADD_CONTAINER': {
                const state = await getNormalizedContainerCheckerState();
                const containerNumber = normalizeContainerId(message.containerNumber || '');
                const port = normalizePort(message.port);

                if (!containerNumber) {
                    throw new Error('Container number is required');
                }
                if (!port) {
                    throw new Error('Port is required');
                }
                if (
                    state.watchlist.some(
                        item =>
                            item.containerNumber === containerNumber &&
                            normalizePort(item.port) === port,
                    )
                ) {
                    return getNormalizedContainerCheckerState();
                }

                const watchlist = [
                    ...state.watchlist,
                    {
                        containerNumber,
                        port,
                        status: '-',
                        state: '-',
                        statusChanged: false,
                        stateChanged: false,
                        hasErrors: false,
                        lastNotifiedSignature: null,
                        lastUpdate: null,
                        lastChangeAt: null,
                        lastCheckedAt: null,
                        snapshot: null,
                        errors: [],
                    },
                ];

                await saveContainerCheckerWatchlist(watchlist);
                await analyticsService.trackContainerAdded('container_monitor', port);
                return getNormalizedContainerCheckerState();
            }

            case 'REMOVE_CONTAINER': {
                const state = await getNormalizedContainerCheckerState();
                const port = normalizePort(message.port);
                const nextWatchlist = state.watchlist.filter(item => {
                    const sameContainer = item.containerNumber === message.containerNumber;
                    const samePort = !port || normalizePort(item.port) === port;
                    return !(sameContainer && samePort);
                });
                await saveContainerCheckerWatchlist(nextWatchlist);
                return getNormalizedContainerCheckerState();
            }

            case 'CHECK_NOW':
                await runContainerCheckCycle();
                return getNormalizedContainerCheckerState();

            case 'SAVE_SETTINGS': {
                const state = await getNormalizedContainerCheckerState();
                const settings = {
                    ...state.settings,
                    pollingMinutes:
                        Number(message.settings?.pollingMinutes) ||
                        DEFAULT_CONTAINER_CHECKER_SETTINGS.pollingMinutes,
                };
                await saveContainerCheckerSettings(settings);
                await updateContainerCheckerAlarm(settings.pollingMinutes);
                return getNormalizedContainerCheckerState();
            }

            default:
                throw new Error(`Unknown Container Checker message type: ${type}`);
        }
    }
}
