import { Messages, Statuses } from '../../../../src/data';
import type { GctState, GctWatchGroup, GctWatchRow } from '../../../../src/gct/types';
import { getGctState, saveGctGroups, touchGctLastTickAt } from '../../../../src/gct/storage';
import { authService } from '../../../../src/services/authService';
import {
    GctWatcherService,
    gctWatcherService,
} from '../../../../src/services/gct/gctWatcherService';
import {
    bookGctSlot,
    buildBookPayload,
    getGctAvailableSlots,
    getGctCurrentBooking,
    getNowInGctTimezone,
    loginToGct,
    matchesCurrentBooking,
} from '../../../../src/services/gct/gctApi';
import { notificationService } from '../../../../src/services/notificationService';
import { syncStatusBadgeFromStorage } from '../../../../src/utils/badge';

jest.mock('../../../../src/gct/storage');
jest.mock('../../../../src/services/authService', () => ({
    authService: {
        isAuthenticated: jest.fn(),
    },
}));
jest.mock('../../../../src/services/notificationService', () => ({
    notificationService: {
        sendBookingSuccessNotifications: jest.fn(),
    },
}));
jest.mock('../../../../src/services/gct/gctApi');
jest.mock('../../../../src/utils/badge', () => ({
    syncStatusBadgeFromStorage: jest.fn(),
}));
jest.mock('../../../../src/utils', () => ({
    consoleError: jest.fn(),
    consoleLog: jest.fn(),
}));

const baseSettings = {
    pollMinMs: 5000,
    pollMaxMs: 10000,
    jitterMinMs: 2000,
    jitterMaxMs: 5000,
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const createRow = (overrides: Partial<GctWatchRow> = {}): GctWatchRow => ({
    id: 'row-1',
    targetDate: '2026-03-18',
    targetStartTime: '04:30',
    targetEndDate: '2026-03-18',
    targetEndTime: '06:30',
    targetStartLocal: '2026-03-18 04:30',
    targetEndLocal: '2026-03-18 06:30',
    status: Statuses.IN_PROGRESS,
    statusMessage: 'waiting',
    active: true,
    isManualPause: false,
    lastAttemptAt: null,
    lastMatchedAt: null,
    lastVerifiedAt: null,
    lastError: null,
    history: [],
    ...overrides,
});

const createGroup = (overrides: Partial<GctWatchGroup> = {}): GctWatchGroup => ({
    id: 'group-1',
    documentNumber: 'DOC123',
    vehicleNumber: 'NDZ45396',
    containerNumber: 'TCLU3141931',
    rows: [createRow()],
    createdAt: '2026-03-17T10:00:00.000Z',
    updatedAt: '2026-03-17T10:00:00.000Z',
    status: 'watching',
    statusMessage: 'watching',
    isExpanded: true,
    ...overrides,
});

describe('GctWatcherService', () => {
    let service: GctWatcherService;
    let state: GctState;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-03-17T10:00:00.000Z'));

        state = {
            groups: [],
            settings: { ...baseSettings },
            lastTickAt: null,
        };

        (getGctState as jest.Mock).mockImplementation(async () => clone(state));
        (saveGctGroups as jest.Mock).mockImplementation(async groups => {
            state = { ...state, groups: clone(groups) };
        });
        (touchGctLastTickAt as jest.Mock).mockImplementation(async isoTime => {
            state = { ...state, lastTickAt: isoTime };
        });
        (authService.isAuthenticated as jest.Mock).mockResolvedValue(true);
        (notificationService.sendBookingSuccessNotifications as jest.Mock).mockResolvedValue(
            undefined,
        );
        (syncStatusBadgeFromStorage as jest.Mock).mockResolvedValue(undefined);
        (loginToGct as jest.Mock).mockResolvedValue('csrf-token');
        (getGctAvailableSlots as jest.Mock).mockResolvedValue([]);
        (bookGctSlot as jest.Mock).mockResolvedValue([]);
        (getGctCurrentBooking as jest.Mock).mockResolvedValue(null);
        (getNowInGctTimezone as jest.Mock).mockReturnValue('2026-03-17 10:00');
        (matchesCurrentBooking as jest.Mock).mockReturnValue(false);
        (buildBookPayload as jest.Mock).mockImplementation(slot => slot);

        Object.defineProperty(globalThis, 'crypto', {
            value: {
                ...globalThis.crypto,
                randomUUID: jest.fn().mockReturnValue('uuid-123'),
            },
            configurable: true,
        });

        service = new GctWatcherService();
    });

    afterEach(() => {
        for (const timer of (service as any).timers.values()) {
            clearTimeout(timer);
        }
        jest.useRealTimers();
    });

    it('creates a normalized group and merges duplicate additions by identity', async () => {
        jest.spyOn(service, 'ensureSchedules').mockResolvedValue(undefined);

        await service.addGroup({
            documentNumber: ' DOC123 ',
            vehicleNumber: 'ndz45396',
            containerNumber: 'tclu3141931',
            slots: [{ date: '2026-03-18', startTime: '04:30' }],
        });
        await service.addGroup({
            documentNumber: 'DOC123',
            vehicleNumber: 'NDZ45396',
            containerNumber: 'TCLU3141931',
            slots: [
                { date: '2026-03-18', startTime: '04:30' },
                { date: '2026-03-18', startTime: '06:30' },
            ],
        });

        expect(state.groups).toHaveLength(1);
        expect(state.groups[0].vehicleNumber).toBe('NDZ45396');
        expect(state.groups[0].containerNumber).toBe('TCLU3141931');
        expect(state.groups[0].rows).toHaveLength(2);
    });

    it('does not create a new group when the initial login fails', async () => {
        jest.spyOn(service, 'ensureSchedules').mockResolvedValue(undefined);
        (loginToGct as jest.Mock).mockRejectedValueOnce(new Error('406 Not Acceptable'));

        await expect(
            service.addGroup({
                documentNumber: 'DOC123',
                vehicleNumber: 'NDZ45396',
                containerNumber: 'TCLU3141931',
                slots: [{ date: '2026-03-18', startTime: '04:30' }],
            }),
        ).rejects.toThrow('406 Not Acceptable');

        expect(state.groups).toEqual([]);
    });

    it('removes rows and drops empty groups', async () => {
        jest.spyOn(service, 'ensureSchedules').mockResolvedValue(undefined);
        state.groups = [createGroup({ rows: [createRow({ id: 'row-1' })] })];

        const nextState = await service.removeRow('group-1', 'row-1');

        expect(nextState.groups).toEqual([]);
    });

    it('replaces group slots while preserving matching existing rows', async () => {
        jest.spyOn(service, 'ensureSchedules').mockResolvedValue(undefined);
        state.groups = [
            createGroup({
                rows: [
                    createRow({
                        id: 'row-1',
                        targetDate: '2026-03-18',
                        targetStartTime: '04:30',
                        targetEndDate: '2026-03-18',
                        targetEndTime: '06:30',
                        targetStartLocal: '2026-03-18 04:30',
                        targetEndLocal: '2026-03-18 06:30',
                    }),
                    createRow({
                        id: 'row-2',
                        targetDate: '2026-03-18',
                        targetStartTime: '06:30',
                        targetEndDate: '2026-03-18',
                        targetEndTime: '08:30',
                        targetStartLocal: '2026-03-18 06:30',
                        targetEndLocal: '2026-03-18 08:30',
                    }),
                ],
            }),
        ];

        const nextState = await service.replaceGroupSlots('group-1', [
            { date: '2026-03-18', startTime: '06:30' },
            { date: '2026-03-18', startTime: '08:30' },
        ]);

        expect(nextState.groups[0].rows).toHaveLength(2);
        expect(nextState.groups[0].rows[0].id).toBe('row-2');
        expect(nextState.groups[0].rows[0].targetStartLocal).toBe('2026-03-18 06:30');
        expect(nextState.groups[0].rows[1].targetStartLocal).toBe('2026-03-18 08:30');
    });

    it('pauses and resumes group rows', async () => {
        jest.spyOn(service, 'ensureSchedules').mockResolvedValue(undefined);
        state.groups = [createGroup()];

        const paused = await service.pauseGroup('group-1');
        expect(paused.groups[0]).toMatchObject({
            status: 'paused',
            statusMessage: 'Wstrzymane ręcznie',
        });
        expect(paused.groups[0].rows[0]).toMatchObject({
            active: false,
            isManualPause: true,
            status: Statuses.PAUSED,
        });

        const resumed = await service.resumeGroup('group-1');
        expect(resumed.groups[0].status).toBe('watching');
        expect(resumed.groups[0].rows[0]).toMatchObject({
            active: true,
            isManualPause: false,
            status: Statuses.IN_PROGRESS,
        });
    });

    it('pauses and resumes individual rows', async () => {
        jest.spyOn(service, 'ensureSchedules').mockResolvedValue(undefined);
        state.groups = [createGroup()];

        const paused = await service.pauseRow('group-1', 'row-1');
        expect(paused.groups[0].rows[0].status).toBe(Statuses.PAUSED);

        const resumed = await service.resumeRow('group-1', 'row-1');
        expect(resumed.groups[0].rows[0].status).toBe(Statuses.IN_PROGRESS);
    });

    it('stops active rows on extension logout and restores auth-lost groups later', async () => {
        jest.spyOn(service, 'ensureSchedules').mockResolvedValue(undefined);
        state.groups = [
            createGroup({
                rows: [
                    createRow(),
                    createRow({
                        id: 'row-2',
                        status: Statuses.SUCCESS,
                        active: false,
                    }),
                ],
            }),
        ];

        await service.stopAllForExtensionLogout();

        expect(state.groups[0].status).toBe('auth-lost');
        expect(state.groups[0].rows[0]).toMatchObject({
            status: Statuses.AUTHORIZATION_ERROR,
            active: false,
        });
        expect(state.groups[0].rows[1].status).toBe(Statuses.SUCCESS);

        await service.handleExtensionAuthRestored();

        expect(state.groups[0].status).toBe('watching');
        expect(state.groups[0].rows[0]).toMatchObject({
            status: Statuses.IN_PROGRESS,
            active: true,
        });
    });

    it('schedules only watching groups', async () => {
        state.groups = [
            createGroup({ id: 'watching-group', status: 'watching' }),
            createGroup({ id: 'paused-group', status: 'paused' }),
        ];

        await service.ensureSchedules();

        expect((service as any).timers.has('watching-group')).toBe(true);
        expect((service as any).timers.has('paused-group')).toBe(false);
    });

    it('reuses a cached GCT token across consecutive cycles', async () => {
        jest.spyOn(service, 'ensureSchedules').mockResolvedValue(undefined);
        state.groups = [createGroup()];

        await (service as any).processGroup('group-1');
        await (service as any).processGroup('group-1');

        expect(loginToGct).toHaveBeenCalledTimes(1);
        expect(getGctAvailableSlots).toHaveBeenCalledTimes(2);
    });

    it('reuses the add-time login token on the first watcher cycle', async () => {
        jest.spyOn(service, 'ensureSchedules').mockResolvedValue(undefined);

        await service.addGroup({
            documentNumber: 'DOC123',
            vehicleNumber: 'NDZ45396',
            containerNumber: 'TCLU3141931',
            slots: [{ date: '2026-03-18', startTime: '04:30' }],
        });

        await (service as any).processGroup(state.groups[0].id);

        expect(loginToGct).toHaveBeenCalledTimes(1);
        expect(getGctAvailableSlots).toHaveBeenCalledTimes(1);
    });

    it('reuses a prefetched token on add without immediate re-login', async () => {
        jest.spyOn(service, 'ensureSchedules').mockResolvedValue(undefined);

        await service.addGroup(
            {
                documentNumber: 'DOC123',
                vehicleNumber: 'NDZ45396',
                containerNumber: 'TCLU3141931',
                slots: [{ date: '2026-03-18', startTime: '04:30' }],
            },
            'prefetched-token',
        );

        expect(loginToGct).not.toHaveBeenCalled();

        await (service as any).processGroup(state.groups[0].id);

        expect(getGctAvailableSlots).toHaveBeenCalledWith('prefetched-token');
        expect(loginToGct).not.toHaveBeenCalled();
    });

    it('applies timeout backoff when login hits a transport failure', async () => {
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
        (service as any).registerNetworkBackoff('group-1', new Error('ERR_CONNECTION_TIMED_OUT'));

        (service as any).scheduleGroup('group-1', state);

        const delay = setTimeoutSpy.mock.calls[setTimeoutSpy.mock.calls.length - 1]?.[1] as number;
        expect(delay).toBeGreaterThanOrEqual(9000);
        setTimeoutSpy.mockRestore();
    });

    it('applies a long cooldown when login looks temporarily blocked', async () => {
        jest.spyOn(service, 'ensureSchedules').mockResolvedValue(undefined);
        state.groups = [createGroup()];
        (loginToGct as jest.Mock).mockRejectedValueOnce(
            new Error('GCT login did not return a bearer token'),
        );

        await (service as any).processGroup('group-1');

        expect(state.groups[0].rows[0]).toMatchObject({
            status: Statuses.NETWORK_ERROR,
            active: true,
        });
        expect((service as any).loginCooldownUntil.get('group-1')).toBeGreaterThanOrEqual(
            Date.now() + 30 * 60 * 1000 - 1000,
        );
        expect((service as any).globalLoginCooldownUntil).toBeGreaterThanOrEqual(
            Date.now() + 30 * 60 * 1000 - 1000,
        );
    });

    it('serializes login attempts across different groups', async () => {
        let resolveLogin!: (token: string) => void;
        (loginToGct as jest.Mock).mockImplementationOnce(
            () =>
                new Promise<string>(resolve => {
                    resolveLogin = resolve;
                }),
        );
        jest.spyOn(service, 'ensureSchedules').mockResolvedValue(undefined);
        state.groups = [
            createGroup({ id: 'group-1', containerNumber: 'TCLU3141931' }),
            createGroup({ id: 'group-2', containerNumber: 'MSCU1234567' }),
        ];

        const firstCycle = (service as any).processGroup('group-1');
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        const secondCycle = (service as any).processGroup('group-2');
        await Promise.resolve();
        await Promise.resolve();

        expect(loginToGct).toHaveBeenCalledTimes(1);
        expect((service as any).globalLoginCooldownUntil).toBeGreaterThanOrEqual(Date.now() + 8000);

        resolveLogin('csrf-token');
        await firstCycle;
        await secondCycle;
    });

    it('stops all watchers when extension auth is missing during a cycle', async () => {
        (authService.isAuthenticated as jest.Mock).mockResolvedValue(false);
        const stopSpy = jest.spyOn(service, 'stopAllForExtensionLogout').mockResolvedValue();

        await (service as any).processGroup('group-1');

        expect(stopSpy).toHaveBeenCalled();
    });

    it('clears timers when the group is missing or no longer watching', async () => {
        state.groups = [createGroup({ status: 'paused' })];
        const clearSpy = jest.spyOn(service as any, 'clearTimer');

        await (service as any).processGroup('group-1');

        expect(clearSpy).toHaveBeenCalledWith('group-1');
    });

    it('marks rows expired or not found when slots are unavailable', async () => {
        jest.spyOn(service, 'ensureSchedules').mockResolvedValue(undefined);
        state.groups = [
            createGroup({
                rows: [
                    createRow({
                        id: 'expired-row',
                        targetDate: '2026-03-17',
                        targetStartTime: '08:30',
                        targetEndDate: '2026-03-17',
                        targetEndTime: '09:30',
                        targetStartLocal: '2026-03-17 08:30',
                        targetEndLocal: '2026-03-17 09:30',
                    }),
                    createRow({
                        id: 'future-row',
                        targetDate: '2026-03-18',
                        targetStartTime: '04:30',
                        targetEndDate: '2026-03-18',
                        targetEndTime: '06:30',
                        targetStartLocal: '2026-03-18 04:30',
                        targetEndLocal: '2026-03-18 06:30',
                    }),
                ],
            }),
        ];

        await (service as any).processGroup('group-1');

        expect(state.groups[0].rows[0]).toMatchObject({
            status: Statuses.EXPIRED,
            statusMessage: Messages.EXPIRED,
            active: false,
        });
        expect(state.groups[0].rows[1]).toMatchObject({
            status: Statuses.IN_PROGRESS,
            statusMessage: 'Szukam',
        });
    });

    it('does not expire a row before the slot end time has passed', async () => {
        jest.spyOn(service, 'ensureSchedules').mockResolvedValue(undefined);
        (getNowInGctTimezone as jest.Mock).mockReturnValue('2026-03-18 20:39');
        state.groups = [
            createGroup({
                rows: [
                    createRow({
                        id: 'active-row',
                        targetDate: '2026-03-18',
                        targetStartTime: '20:30',
                        targetEndDate: '2026-03-18',
                        targetEndTime: '22:30',
                        targetStartLocal: '2026-03-18 20:30',
                        targetEndLocal: '2026-03-18 22:30',
                    }),
                ],
            }),
        ];

        await (service as any).processGroup('group-1');

        expect(state.groups[0].rows[0]).toMatchObject({
            status: Statuses.IN_PROGRESS,
            statusMessage: 'Szukam',
            active: true,
        });
        expect(state.groups[0].status).toBe('watching');
        expect(state.groups[0].statusMessage).toBe('Szukam');
    });

    it('uses the completed group summary after the only row expires', async () => {
        jest.spyOn(service, 'ensureSchedules').mockResolvedValue(undefined);
        (getNowInGctTimezone as jest.Mock).mockReturnValue('2026-03-18 22:31');
        state.groups = [
            createGroup({
                rows: [
                    createRow({
                        id: 'expired-row',
                        targetDate: '2026-03-18',
                        targetStartTime: '20:30',
                        targetEndDate: '2026-03-18',
                        targetEndTime: '22:30',
                        targetStartLocal: '2026-03-18 20:30',
                        targetEndLocal: '2026-03-18 22:30',
                    }),
                ],
            }),
        ];

        await (service as any).processGroup('group-1');

        expect(state.groups[0].rows[0]).toMatchObject({
            status: Statuses.EXPIRED,
            statusMessage: Messages.EXPIRED,
            active: false,
        });
        expect(state.groups[0].status).toBe('completed');
        expect(state.groups[0].statusMessage).toBe('Brak aktywnych slotów');
    });

    it('marks ambiguous slot matches as errors', async () => {
        jest.spyOn(service, 'ensureSchedules').mockResolvedValue(undefined);
        state.groups = [createGroup()];
        (getGctAvailableSlots as jest.Mock).mockResolvedValue([
            {
                idrow: 1,
                startUtc: 'a',
                endUtc: 'b',
                startLocal: '2026-03-18 04:30',
                endLocal: '2026-03-18 06:30',
                miejsc: 1,
                zajete: 0,
            },
            {
                idrow: 2,
                startUtc: 'c',
                endUtc: 'd',
                startLocal: '2026-03-18 04:30',
                endLocal: '2026-03-18 06:30',
                miejsc: 1,
                zajete: 0,
            },
        ]);

        await (service as any).processGroup('group-1');

        expect(state.groups[0].rows[0]).toMatchObject({
            status: Statuses.ERROR,
            statusMessage: 'Niejednoznaczny slot',
            lastError: 'Ambiguous slot match (2)',
        });
    });

    it('verifies booking success and stops sibling rows', async () => {
        (syncStatusBadgeFromStorage as jest.Mock).mockClear();
        const successRow = createRow({ id: 'success-row' });
        const siblingRow = createRow({
            id: 'sibling-row',
            targetStartTime: '06:30',
            targetEndTime: '08:30',
            targetStartLocal: '2026-03-18 06:30',
            targetEndLocal: '2026-03-18 08:30',
        });
        state.groups = [createGroup({ rows: [successRow, siblingRow] })];
        (getGctAvailableSlots as jest.Mock).mockResolvedValue([
            {
                idrow: 99,
                startUtc: '2026-03-18T03:30:00.000Z',
                endUtc: '2026-03-18T05:30:00.000Z',
                startLocal: '2026-03-18 04:30',
                endLocal: '2026-03-18 06:30',
                miejsc: 10,
                zajete: 4,
            },
        ]);
        (buildBookPayload as jest.Mock).mockReturnValue({ idrow: 99 });
        (matchesCurrentBooking as jest.Mock).mockReturnValue(true);
        (getGctCurrentBooking as jest.Mock).mockResolvedValue({ idrow: 99 });

        await (service as any).processGroup('group-1');

        expect(bookGctSlot).toHaveBeenCalledWith('csrf-token', { idrow: 99 });
        expect(state.groups[0].status).toBe('success');
        expect(state.groups[0].statusMessage).toBe('Slot zarezerwowany');
        expect(state.groups[0].rows[0]).toMatchObject({
            status: Statuses.SUCCESS,
            active: false,
        });
        expect(state.groups[0].rows[1]).toMatchObject({
            status: 'completed',
            active: false,
        });
        expect(notificationService.sendBookingSuccessNotifications).toHaveBeenCalledWith(
            expect.objectContaining({
                tvAppId: 'TCLU3141931',
                bookingTime: '2026-03-18 04:30',
            }),
        );
        expect(syncStatusBadgeFromStorage).toHaveBeenCalled();
    });

    it('keeps monitoring when booking verification fails', async () => {
        jest.spyOn(service, 'ensureSchedules').mockResolvedValue(undefined);
        state.groups = [createGroup()];
        (getGctAvailableSlots as jest.Mock).mockResolvedValue([
            {
                idrow: 88,
                startUtc: '2026-03-18T03:30:00.000Z',
                endUtc: '2026-03-18T05:30:00.000Z',
                startLocal: '2026-03-18 04:30',
                endLocal: '2026-03-18 06:30',
                miejsc: 10,
                zajete: 5,
            },
        ]);
        (matchesCurrentBooking as jest.Mock).mockReturnValue(false);

        await (service as any).processGroup('group-1');

        expect(state.groups[0].rows[0]).toMatchObject({
            status: Statuses.IN_PROGRESS,
            statusMessage: 'Brak potwierdzenia, próbuję dalej',
            lastError: expect.stringContaining('Booking verification failed'),
        });
        expect(state.groups[0].status).toBe('watching');
    });

    it('classifies login and booking errors correctly', async () => {
        jest.spyOn(service, 'ensureSchedules').mockResolvedValue(undefined);
        state.groups = [createGroup()];

        (loginToGct as jest.Mock).mockRejectedValueOnce(new Error('401 unauthorized'));
        await (service as any).processGroup('group-1');
        expect(state.groups[0].rows[0].status).toBe(Statuses.AUTHORIZATION_ERROR);

        (service as any).globalLoginCooldownUntil = 0;
        (service as any).activeLoginGroupId = null;
        (service as any).loginCooldownUntil.clear();
        state.groups = [createGroup()];
        (loginToGct as jest.Mock).mockResolvedValue('csrf-token');
        (getGctAvailableSlots as jest.Mock).mockResolvedValue([
            {
                idrow: 1,
                startUtc: 'u1',
                endUtc: 'u2',
                startLocal: '2026-03-18 04:30',
                endLocal: '2026-03-18 06:30',
                miejsc: 1,
                zajete: 0,
            },
        ]);
        (bookGctSlot as jest.Mock).mockRejectedValueOnce(new Error('400 bad request'));
        await (service as any).processGroup('group-1');
        expect(state.groups[0].rows[0]).toMatchObject({
            status: Statuses.ERROR,
            active: false,
        });

        state.groups = [createGroup()];
        (bookGctSlot as jest.Mock).mockRejectedValueOnce(new Error('503 network error'));
        await (service as any).processGroup('group-1');
        expect(state.groups[0].rows[0]).toMatchObject({
            status: Statuses.NETWORK_ERROR,
            statusMessage: 'Błąd sieci, ponowię',
        });
    });

    it('exports a singleton watcher instance', () => {
        expect(gctWatcherService).toBeInstanceOf(GctWatcherService);
    });
});
