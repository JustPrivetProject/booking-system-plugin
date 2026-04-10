import { ContainerCheckerHandler } from '../../../src/background/handlers/ContainerCheckerHandler';
import * as storage from '../../../src/containerChecker/storage';
import * as containerCheckerService from '../../../src/services/containerChecker/containerCheckerService';

jest.mock('../../../src/containerChecker/storage');
jest.mock('../../../src/services/containerChecker/containerCheckerService');
jest.mock('../../../src/services/analyticsService', () => ({
    analyticsService: {
        trackContainerAdded: jest.fn(),
    },
}));

const mockState = {
    watchlist: [],
    settings: { pollingMinutes: 10 },
    lastRunAt: null,
};

describe('ContainerCheckerHandler', () => {
    let handler: ContainerCheckerHandler;

    beforeEach(() => {
        jest.clearAllMocks();
        handler = new ContainerCheckerHandler();
        (containerCheckerService.getNormalizedContainerCheckerState as jest.Mock).mockResolvedValue(
            mockState,
        );
        (
            containerCheckerService.acknowledgeContainerCheckerUiChanges as jest.Mock
        ).mockResolvedValue(mockState);
        (containerCheckerService.runContainerCheckCycle as jest.Mock).mockResolvedValue(undefined);
        (containerCheckerService.updateContainerCheckerAlarm as jest.Mock).mockResolvedValue(
            undefined,
        );
        (storage.saveContainerCheckerWatchlist as jest.Mock).mockResolvedValue(undefined);
        (storage.saveContainerCheckerSettings as jest.Mock).mockResolvedValue(undefined);
    });

    describe('GET_STATE', () => {
        it('should return normalized state', async () => {
            const message = { target: 'containerChecker' as const, type: 'GET_STATE' as const };
            const result = await handler.handleMessage(message);

            expect(result).toEqual(mockState);
            expect(containerCheckerService.getNormalizedContainerCheckerState).toHaveBeenCalled();
        });
    });

    describe('ACK_UI_CHANGES', () => {
        it('should call acknowledgeContainerCheckerUiChanges', async () => {
            const message = {
                target: 'containerChecker' as const,
                type: 'ACK_UI_CHANGES' as const,
            };
            const result = await handler.handleMessage(message);

            expect(result).toEqual(mockState);
            expect(containerCheckerService.acknowledgeContainerCheckerUiChanges).toHaveBeenCalled();
        });
    });

    describe('ADD_CONTAINER', () => {
        it('should add container to watchlist', async () => {
            const message = {
                target: 'containerChecker' as const,
                type: 'ADD_CONTAINER' as const,
                containerNumber: 'ABCD1234567',
                port: 'DCT',
            };
            (containerCheckerService.getNormalizedContainerCheckerState as jest.Mock)
                .mockResolvedValueOnce({ ...mockState, watchlist: [] })
                .mockResolvedValueOnce({
                    ...mockState,
                    watchlist: [
                        {
                            containerNumber: 'ABCD1234567',
                            port: 'DCT',
                            status: '-',
                            state: '-',
                            statusChanged: false,
                            stateChanged: false,
                            hasErrors: false,
                            errors: [],
                            lastNotifiedSignature: null,
                            lastUpdate: null,
                            lastChangeAt: null,
                            lastCheckedAt: null,
                            snapshot: null,
                        },
                    ],
                });

            const result = await handler.handleMessage(message);

            expect(storage.saveContainerCheckerWatchlist).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        containerNumber: 'ABCD1234567',
                        port: 'DCT',
                    }),
                ]),
            );
            expect(
                require('../../../src/services/analyticsService').analyticsService
                    .trackContainerAdded,
            ).toHaveBeenCalledWith('container_monitor', 'DCT');
            expect(result).toBeDefined();
        });

        it('should throw when container number is missing', async () => {
            const message = {
                target: 'containerChecker' as const,
                type: 'ADD_CONTAINER' as const,
                port: 'DCT',
            };

            await expect(handler.handleMessage(message)).rejects.toThrow(
                'Container number is required',
            );
        });

        it('should throw when port is invalid', async () => {
            const message = {
                target: 'containerChecker' as const,
                type: 'ADD_CONTAINER' as const,
                containerNumber: 'ABCD1234567',
                port: 'INVALID',
            };

            await expect(handler.handleMessage(message)).rejects.toThrow('Port is required');
        });

        it('should return state without adding when container already in watchlist', async () => {
            const existingWatchlist = [
                {
                    containerNumber: 'ABCD1234567',
                    port: 'DCT',
                    status: '-',
                    state: '-',
                    statusChanged: false,
                    stateChanged: false,
                    hasErrors: false,
                    errors: [] as string[],
                    lastNotifiedSignature: null,
                    lastUpdate: null,
                    lastChangeAt: null,
                    lastCheckedAt: null,
                    snapshot: null,
                },
            ];
            (
                containerCheckerService.getNormalizedContainerCheckerState as jest.Mock
            ).mockResolvedValue({ ...mockState, watchlist: existingWatchlist });

            const message = {
                target: 'containerChecker' as const,
                type: 'ADD_CONTAINER' as const,
                containerNumber: 'ABCD1234567',
                port: 'DCT',
            };
            const result = await handler.handleMessage(message);

            expect(storage.saveContainerCheckerWatchlist).not.toHaveBeenCalled();
            expect(
                require('../../../src/services/analyticsService').analyticsService
                    .trackContainerAdded,
            ).not.toHaveBeenCalled();
            expect(result).toEqual({ ...mockState, watchlist: existingWatchlist });
        });
    });

    describe('REMOVE_CONTAINER', () => {
        it('should remove container from watchlist', async () => {
            const watchlist = [
                {
                    containerNumber: 'ABCD1234567',
                    port: 'DCT',
                    status: '-',
                    state: '-',
                    statusChanged: false,
                    stateChanged: false,
                    hasErrors: false,
                    errors: [] as string[],
                    lastNotifiedSignature: null,
                    lastUpdate: null,
                    lastChangeAt: null,
                    lastCheckedAt: null,
                    snapshot: null,
                },
            ];
            (
                containerCheckerService.getNormalizedContainerCheckerState as jest.Mock
            ).mockResolvedValue({ ...mockState, watchlist });

            const message = {
                target: 'containerChecker' as const,
                type: 'REMOVE_CONTAINER' as const,
                containerNumber: 'ABCD1234567',
                port: 'DCT',
            };
            await handler.handleMessage(message);

            expect(storage.saveContainerCheckerWatchlist).toHaveBeenCalledWith([]);
            expect(
                require('../../../src/services/analyticsService').analyticsService
                    .trackContainerAdded,
            ).not.toHaveBeenCalled();
        });
    });

    describe('CHECK_NOW', () => {
        it('should run check cycle and return state', async () => {
            const message = { target: 'containerChecker' as const, type: 'CHECK_NOW' as const };
            const result = await handler.handleMessage(message);

            expect(containerCheckerService.runContainerCheckCycle).toHaveBeenCalled();
            expect(result).toEqual(mockState);
        });
    });

    describe('SAVE_SETTINGS', () => {
        it('should save settings and update alarm', async () => {
            const message = {
                target: 'containerChecker' as const,
                type: 'SAVE_SETTINGS' as const,
                settings: { pollingMinutes: 15 },
            };
            const result = await handler.handleMessage(message);

            expect(storage.saveContainerCheckerSettings).toHaveBeenCalledWith(
                expect.objectContaining({ pollingMinutes: 15 }),
            );
            expect(containerCheckerService.updateContainerCheckerAlarm).toHaveBeenCalledWith(15);
            expect(result).toEqual(mockState);
        });
    });

    describe('unknown message type', () => {
        it('should throw for unknown type', async () => {
            const message = {
                target: 'containerChecker' as const,
                type: 'UNKNOWN_TYPE' as any,
            };

            await expect(handler.handleMessage(message)).rejects.toThrow(
                'Unknown Container Checker message type',
            );
        });
    });
});
