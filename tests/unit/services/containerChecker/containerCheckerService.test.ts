import {
    getNormalizedContainerCheckerState,
    updateContainerCheckerAlarm,
    runContainerCheckCycle,
    acknowledgeContainerCheckerUiChanges,
} from '../../../../src/services/containerChecker/containerCheckerService';
import { authService } from '../../../../src/services/authService';
import * as storage from '../../../../src/containerChecker/storage';
import * as portCheckers from '../../../../src/services/containerChecker/portCheckers';

jest.mock('../../../../src/containerChecker/storage');
jest.mock('../../../../src/services/containerChecker/portCheckers');
jest.mock('../../../../src/services/notificationService');
jest.mock('../../../../src/services/authService', () => ({
    authService: {
        isAuthenticated: jest.fn(),
    },
}));
jest.mock('../../../../src/utils/index', () => ({
    consoleLog: jest.fn(),
    consoleError: jest.fn(),
}));

const chromeMock = require('../../mocks/chrome').chromeMock;

const TEST_WATCHLIST_ITEM = {
    containerNumber: 'ABCD1234567',
    port: 'DCT' as const,
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
};

describe('Container Checker Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        chromeMock.storage.local.get.mockImplementation((_keys: unknown, cb: (r: object) => void) =>
            cb({}),
        );
        chromeMock.storage.local.set.mockImplementation((_data: object, cb: () => void) => cb());
        chromeMock.alarms.clear.mockResolvedValue(undefined);
        chromeMock.alarms.create.mockResolvedValue(undefined);
        chromeMock.alarms.get.mockResolvedValue(undefined);
        (authService.isAuthenticated as jest.Mock).mockResolvedValue(true);

        (storage.getContainerCheckerState as jest.Mock).mockResolvedValue({
            watchlist: [],
            settings: { pollingMinutes: 10 },
            lastRunAt: null,
        });
        (storage.saveContainerCheckerWatchlist as jest.Mock).mockResolvedValue(undefined);
        (storage.touchContainerCheckerLastRunAt as jest.Mock).mockResolvedValue(undefined);
    });

    describe('getNormalizedContainerCheckerState', () => {
        it('should return normalized state from storage', async () => {
            const mockState = {
                watchlist: [TEST_WATCHLIST_ITEM],
                settings: { pollingMinutes: 10 },
                lastRunAt: null,
            };
            (storage.getContainerCheckerState as jest.Mock).mockResolvedValue(mockState);

            const result = await getNormalizedContainerCheckerState();

            expect(result).toEqual(mockState);
            expect(storage.getContainerCheckerState).toHaveBeenCalled();
        });

        it('should save watchlist when port normalization changes', async () => {
            const itemWithInvalidPort = {
                ...TEST_WATCHLIST_ITEM,
                port: 'invalid' as any,
            };
            (storage.getContainerCheckerState as jest.Mock).mockResolvedValue({
                watchlist: [itemWithInvalidPort],
                settings: { pollingMinutes: 10 },
                lastRunAt: null,
            });

            await getNormalizedContainerCheckerState();

            expect(storage.saveContainerCheckerWatchlist).toHaveBeenCalled();
        });
    });

    describe('updateContainerCheckerAlarm', () => {
        it('should clear existing alarm and create new one', async () => {
            await updateContainerCheckerAlarm(15);

            expect(chromeMock.alarms.clear).toHaveBeenCalledWith('container-check');
            expect(chromeMock.alarms.get).toHaveBeenCalledWith('container-check');
            expect(chromeMock.alarms.create).toHaveBeenCalledWith('container-check', {
                periodInMinutes: 15,
            });
        });

        it('should not recreate alarm when the same polling period is already set', async () => {
            chromeMock.alarms.get.mockResolvedValue({
                name: 'container-check',
                periodInMinutes: 15,
            });

            await updateContainerCheckerAlarm(15);

            expect(chromeMock.alarms.clear).not.toHaveBeenCalled();
            expect(chromeMock.alarms.create).not.toHaveBeenCalled();
        });

        it('should use default 5 when minutes is 0 or invalid', async () => {
            await updateContainerCheckerAlarm(0);

            expect(chromeMock.alarms.create).toHaveBeenCalledWith('container-check', {
                periodInMinutes: 5,
            });
        });

        it('should not create alarm when user is not authenticated', async () => {
            (authService.isAuthenticated as jest.Mock).mockResolvedValue(false);

            await updateContainerCheckerAlarm(15);

            expect(chromeMock.alarms.clear).toHaveBeenCalledWith('container-check');
            expect(chromeMock.alarms.create).not.toHaveBeenCalled();
        });

        it('should not create alarm when period is 0', async () => {
            await updateContainerCheckerAlarm(0);

            expect(chromeMock.alarms.create).toHaveBeenCalled();
        });
    });

    describe('runContainerCheckCycle', () => {
        it('should process watchlist and save results', async () => {
            (storage.getContainerCheckerState as jest.Mock).mockResolvedValue({
                watchlist: [TEST_WATCHLIST_ITEM],
                settings: { pollingMinutes: 10 },
                lastRunAt: null,
            });
            (portCheckers.checkPort as jest.Mock).mockResolvedValue({
                match: {
                    port: 'DCT',
                    containerNumber: 'ABCD1234567',
                    statusText: 'Stops:1',
                    stateText: 'In Terminal',
                    milestone: 'IN_TERMINAL',
                    dataTimestamp: '2024-01-15T10:00:00.000Z',
                    observedAt: new Date().toISOString(),
                },
                errors: [],
            });

            await runContainerCheckCycle();

            expect(portCheckers.checkPort).toHaveBeenCalledWith('ABCD1234567', 'DCT');
            expect(storage.saveContainerCheckerWatchlist).toHaveBeenCalled();
            expect(storage.touchContainerCheckerLastRunAt).toHaveBeenCalled();
        });

        it('should not run cycle when user is not authenticated', async () => {
            (authService.isAuthenticated as jest.Mock).mockResolvedValue(false);

            await runContainerCheckCycle();

            expect(storage.getContainerCheckerState).not.toHaveBeenCalled();
            expect(portCheckers.checkPort).not.toHaveBeenCalled();
            expect(storage.saveContainerCheckerWatchlist).not.toHaveBeenCalled();
            expect(storage.touchContainerCheckerLastRunAt).not.toHaveBeenCalled();
        });

        it('should handle check errors and add to item errors', async () => {
            (storage.getContainerCheckerState as jest.Mock).mockResolvedValue({
                watchlist: [TEST_WATCHLIST_ITEM],
                settings: { pollingMinutes: 10 },
                lastRunAt: null,
            });
            (portCheckers.checkPort as jest.Mock).mockResolvedValue({
                match: null,
                errors: ['Network error'],
            });

            await runContainerCheckCycle();

            expect(storage.saveContainerCheckerWatchlist).toHaveBeenCalled();
            const savedWatchlist = (storage.saveContainerCheckerWatchlist as jest.Mock).mock
                .calls[0][0];
            expect(savedWatchlist[0].errors).toContain('Network error');
            expect(savedWatchlist[0].hasErrors).toBe(true);
        });

        it('should preserve last known status and state when check returns no match without errors', async () => {
            const previousSnapshot = {
                port: 'DCT',
                containerNumber: 'ABCD1234567',
                statusText: 'Stops:1',
                stateText: 'In Terminal',
                milestone: 'IN_TERMINAL',
                dataTimestamp: '2024-01-15T10:00:00.000Z',
                observedAt: new Date().toISOString(),
            };

            (storage.getContainerCheckerState as jest.Mock).mockResolvedValue({
                watchlist: [
                    {
                        ...TEST_WATCHLIST_ITEM,
                        status: 'Stops:1',
                        state: 'In Terminal',
                        lastUpdate: previousSnapshot.dataTimestamp,
                        snapshot: previousSnapshot,
                    },
                ],
                settings: { pollingMinutes: 10 },
                lastRunAt: null,
            });
            (portCheckers.checkPort as jest.Mock).mockResolvedValue({
                match: null,
                errors: [],
            });

            await runContainerCheckCycle();

            const savedWatchlist = (storage.saveContainerCheckerWatchlist as jest.Mock).mock
                .calls[0][0];
            expect(savedWatchlist[0].status).toBe('Stops:1');
            expect(savedWatchlist[0].state).toBe('In Terminal');
            expect(savedWatchlist[0].snapshot).toEqual(previousSnapshot);
            expect(savedWatchlist[0].hasErrors).toBe(false);
        });

        it('should handle thrown errors during check', async () => {
            (storage.getContainerCheckerState as jest.Mock).mockResolvedValue({
                watchlist: [TEST_WATCHLIST_ITEM],
                settings: { pollingMinutes: 10 },
                lastRunAt: null,
            });
            (portCheckers.checkPort as jest.Mock).mockRejectedValue(new Error('Check failed'));

            await runContainerCheckCycle();

            expect(storage.saveContainerCheckerWatchlist).toHaveBeenCalled();
            const savedWatchlist = (storage.saveContainerCheckerWatchlist as jest.Mock).mock
                .calls[0][0];
            expect(savedWatchlist[0].errors).toContain('Check failed');
        });

        it('should keep changed flags true across no-change cycles until ACK', async () => {
            const baseSnapshot = {
                port: 'DCT',
                containerNumber: 'ABCD1234567',
                statusText: 'Stops:1',
                stateText: 'In Terminal',
                milestone: 'IN_TERMINAL',
                dataTimestamp: '2024-01-15T10:00:00.000Z',
                observedAt: new Date().toISOString(),
            };

            const changedItem = {
                ...TEST_WATCHLIST_ITEM,
                status: 'Stops:2',
                state: 'In Terminal',
                statusChanged: true,
                stateChanged: false,
                snapshot: {
                    ...baseSnapshot,
                    statusText: 'Stops:2',
                },
            };

            (storage.getContainerCheckerState as jest.Mock).mockResolvedValue({
                watchlist: [changedItem],
                settings: { pollingMinutes: 10 },
                lastRunAt: null,
            });

            (portCheckers.checkPort as jest.Mock).mockResolvedValue({
                match: {
                    ...baseSnapshot,
                    statusText: 'Stops:2',
                },
                errors: [],
            });

            await runContainerCheckCycle();

            const savedWatchlist = (storage.saveContainerCheckerWatchlist as jest.Mock).mock
                .calls[0][0];
            expect(savedWatchlist[0].statusChanged).toBe(true);
            expect(savedWatchlist[0].stateChanged).toBe(false);
        });
    });

    describe('acknowledgeContainerCheckerUiChanges', () => {
        it('should reset statusChanged and stateChanged flags and save', async () => {
            const itemWithChanges = {
                ...TEST_WATCHLIST_ITEM,
                statusChanged: true,
                stateChanged: true,
            };
            (storage.getContainerCheckerState as jest.Mock).mockResolvedValue({
                watchlist: [itemWithChanges],
                settings: { pollingMinutes: 10 },
                lastRunAt: null,
            });

            await acknowledgeContainerCheckerUiChanges();

            expect(storage.saveContainerCheckerWatchlist).toHaveBeenCalled();
            const savedWatchlist = (storage.saveContainerCheckerWatchlist as jest.Mock).mock
                .calls[0][0];
            expect(savedWatchlist[0].statusChanged).toBe(false);
            expect(savedWatchlist[0].stateChanged).toBe(false);
        });

        it('should not save when no changes to acknowledge', async () => {
            (storage.getContainerCheckerState as jest.Mock).mockResolvedValue({
                watchlist: [TEST_WATCHLIST_ITEM],
                settings: { pollingMinutes: 10 },
                lastRunAt: null,
            });

            await acknowledgeContainerCheckerUiChanges();

            expect(storage.saveContainerCheckerWatchlist).not.toHaveBeenCalled();
        });
    });
});
