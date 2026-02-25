import {
    getContainerCheckerState,
    saveContainerCheckerWatchlist,
    saveContainerCheckerSettings,
    touchContainerCheckerLastRunAt,
} from '../../../src/containerChecker/storage';
import type { WatchlistItem, ContainerCheckerSettings } from '../../../src/containerChecker/types';
import { DEFAULT_CONTAINER_CHECKER_SETTINGS } from '../../../src/containerChecker/types';

const chromeMock = require('../mocks/chrome').chromeMock;

describe('Container Checker Storage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        chromeMock.storage.local.get.mockClear();
        chromeMock.storage.local.set.mockClear();
    });

    describe('getContainerCheckerState', () => {
        it('should return default state when storage is empty', async () => {
            chromeMock.storage.local.get.mockImplementation(
                (_keys: unknown, callback: (r: object) => void) => {
                    callback({});
                },
            );

            const result = await getContainerCheckerState();

            expect(result).toEqual({
                watchlist: [],
                settings: DEFAULT_CONTAINER_CHECKER_SETTINGS,
                lastRunAt: null,
            });
            expect(chromeMock.storage.local.get).toHaveBeenCalledWith(
                [
                    'containerCheckerWatchlist',
                    'containerCheckerSettings',
                    'containerCheckerLastRunAt',
                ],
                expect.any(Function),
            );
        });

        it('should return stored watchlist when present', async () => {
            const watchlist: WatchlistItem[] = [
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
            ];
            chromeMock.storage.local.get.mockImplementation(
                (_keys: unknown, callback: (r: object) => void) => {
                    callback({
                        containerCheckerWatchlist: watchlist,
                        containerCheckerSettings: undefined,
                        containerCheckerLastRunAt: undefined,
                    });
                },
            );

            const result = await getContainerCheckerState();

            expect(result.watchlist).toEqual(watchlist);
            expect(result.settings).toEqual(DEFAULT_CONTAINER_CHECKER_SETTINGS);
            expect(result.lastRunAt).toBeNull();
        });

        it('should merge stored settings with defaults', async () => {
            const partialSettings: Partial<ContainerCheckerSettings> = { pollingMinutes: 15 };
            chromeMock.storage.local.get.mockImplementation(
                (_keys: unknown, callback: (r: object) => void) => {
                    callback({
                        containerCheckerWatchlist: undefined,
                        containerCheckerSettings: partialSettings,
                        containerCheckerLastRunAt: '2024-01-15T10:00:00.000Z',
                    });
                },
            );

            const result = await getContainerCheckerState();

            expect(result.settings).toEqual({ pollingMinutes: 15 });
            expect(result.lastRunAt).toBe('2024-01-15T10:00:00.000Z');
        });
    });

    describe('saveContainerCheckerWatchlist', () => {
        it('should save watchlist to storage', async () => {
            chromeMock.storage.local.set.mockImplementation(
                (_data: object, callback: () => void) => {
                    callback();
                },
            );

            const watchlist: WatchlistItem[] = [
                {
                    containerNumber: 'TEST123',
                    port: 'BCT',
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
            ];

            await saveContainerCheckerWatchlist(watchlist);

            expect(chromeMock.storage.local.set).toHaveBeenCalledWith(
                { containerCheckerWatchlist: watchlist },
                expect.any(Function),
            );
        });
    });

    describe('saveContainerCheckerSettings', () => {
        it('should merge new settings with existing and save', async () => {
            chromeMock.storage.local.get.mockImplementation(
                (keys: unknown, callback: (r: object) => void) => {
                    callback({
                        containerCheckerSettings: { pollingMinutes: 10 },
                    });
                },
            );
            chromeMock.storage.local.set.mockImplementation(
                (_data: object, callback: () => void) => {
                    callback();
                },
            );

            await saveContainerCheckerSettings({ pollingMinutes: 20 });

            expect(chromeMock.storage.local.get).toHaveBeenCalledWith(
                'containerCheckerSettings',
                expect.any(Function),
            );
            expect(chromeMock.storage.local.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    containerCheckerSettings: expect.objectContaining({ pollingMinutes: 20 }),
                }),
                expect.any(Function),
            );
        });

        it('should use defaults when no existing settings', async () => {
            chromeMock.storage.local.get.mockImplementation(
                (_keys: unknown, callback: (r: object) => void) => {
                    callback({});
                },
            );
            chromeMock.storage.local.set.mockImplementation(
                (_data: object, callback: () => void) => {
                    callback();
                },
            );

            await saveContainerCheckerSettings({ pollingMinutes: 5 });

            expect(chromeMock.storage.local.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    containerCheckerSettings: expect.objectContaining({ pollingMinutes: 5 }),
                }),
                expect.any(Function),
            );
        });
    });

    describe('touchContainerCheckerLastRunAt', () => {
        it('should save last run timestamp', async () => {
            chromeMock.storage.local.set.mockImplementation(
                (_data: object, callback: () => void) => {
                    callback();
                },
            );

            const isoTime = '2024-02-25T12:00:00.000Z';
            await touchContainerCheckerLastRunAt(isoTime);

            expect(chromeMock.storage.local.set).toHaveBeenCalledWith(
                { containerCheckerLastRunAt: isoTime },
                expect.any(Function),
            );
        });
    });
});
