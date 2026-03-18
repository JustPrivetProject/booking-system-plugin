import {
    bookGctSlot,
    buildBookPayload,
    getGctAvailableSlots,
    getGctCurrentBooking,
    getNowInGctTimezone,
    loginToGct,
    matchesCurrentBooking,
} from '../../../../src/services/gct/gctApi';

const responseWith = (body: string, ok = true, status = 200): Response =>
    ({
        ok,
        status,
        text: jest.fn().mockResolvedValue(body),
    }) as unknown as Response;

const formatWarsaw = (value: string): string =>
    new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Warsaw',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    })
        .format(new Date(value))
        .replace(',', '');

describe('gctApi', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-03-17T12:15:00.000Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('logs in and returns the csrf token', async () => {
        (global.fetch as jest.Mock).mockResolvedValue(
            responseWith(JSON.stringify({ csrf: 'token-123' })),
        );

        const token = await loginToGct({
            documentNumber: 'DOC',
            vehicleNumber: 'VEH',
            containerNumber: 'CONT',
        } as any);

        expect(token).toBe('token-123');
        expect(global.fetch).toHaveBeenCalledWith(
            'https://api.gct.pl/gctgui/kierowca/login',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    dokument: 'DOC',
                    pojazd: 'VEH',
                    kontener: 'CONT',
                }),
            }),
        );
    });

    it('throws when login does not return a token', async () => {
        (global.fetch as jest.Mock).mockResolvedValue(responseWith(JSON.stringify({})));

        await expect(loginToGct({} as any)).rejects.toThrow(
            'GCT login did not return a bearer token',
        );
    });

    it('does not immediately retry failed login requests', async () => {
        (global.fetch as jest.Mock).mockRejectedValue(new Error('timeout'));

        await expect(loginToGct({} as any)).rejects.toThrow('GCT request failed');

        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('maps available slots into local and utc fields', async () => {
        (global.fetch as jest.Mock).mockResolvedValue(
            responseWith(
                JSON.stringify([
                    [17, '2026-03-18T01:30:00.000Z', '2026-03-18T03:30:00.000Z', 12, 7],
                ]),
            ),
        );

        const result = await getGctAvailableSlots('bearer-token');

        expect(result).toEqual([
            {
                idrow: 17,
                startUtc: '2026-03-18T01:30:00.000Z',
                endUtc: '2026-03-18T03:30:00.000Z',
                startLocal: formatWarsaw('2026-03-18T01:30:00.000Z'),
                endLocal: formatWarsaw('2026-03-18T03:30:00.000Z'),
                miejsc: 12,
                zajete: 7,
            },
        ]);
        expect(global.fetch).toHaveBeenCalledWith(
            'https://api.gct.pl/gctgui/kierowca',
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: 'Bearer bearer-token' }),
            }),
        );
    });

    it('returns null when current booking response is an empty array', async () => {
        (global.fetch as jest.Mock).mockResolvedValue(responseWith(JSON.stringify([])));

        await expect(getGctCurrentBooking('token')).resolves.toBeNull();
    });

    it('returns current booking object when present', async () => {
        const booking = {
            idrow: 7,
            kontener: 'TCLU3141931',
            poczatek: '2026-03-18T01:30:00.000Z',
            koniec: '2026-03-18T03:30:00.000Z',
        };
        (global.fetch as jest.Mock).mockResolvedValue(responseWith(JSON.stringify(booking)));

        await expect(getGctCurrentBooking('token')).resolves.toEqual(booking);
    });

    it('posts booking payload for slot reservation', async () => {
        (global.fetch as jest.Mock).mockResolvedValue(responseWith(JSON.stringify([])));
        const row = {
            idrow: 11,
            poczatek: '2026-03-18 02:30',
            koniec: '2026-03-18 04:30',
            miejsc: 10,
            zajete: 4,
        };

        await bookGctSlot('token', row);

        expect(global.fetch).toHaveBeenCalledWith(
            'https://api.gct.pl/gctgui/kierowca',
            expect.objectContaining({
                body: JSON.stringify({ crud: 'przyjazd', row }),
            }),
        );
    });

    it('throws helpful error on non-ok responses with empty body', async () => {
        (global.fetch as jest.Mock).mockResolvedValue(responseWith('', false, 503));

        await expect(getGctAvailableSlots('token')).rejects.toThrow(
            'GCT request failed with status 503',
        );
    });

    it('matches bookings by local start and end timestamps', () => {
        expect(matchesCurrentBooking(null, '2026-03-18 02:30', '2026-03-18 04:30')).toBe(false);

        expect(
            matchesCurrentBooking(
                {
                    idrow: 1,
                    kontener: 'TCLU3141931',
                    poczatek: '2026-03-18T01:30:00.000Z',
                    koniec: '2026-03-18T03:30:00.000Z',
                },
                formatWarsaw('2026-03-18T01:30:00.000Z'),
                formatWarsaw('2026-03-18T03:30:00.000Z'),
            ),
        ).toBe(true);

        expect(
            matchesCurrentBooking(
                {
                    idrow: 1,
                    kontener: 'TCLU3141931',
                    poczatek: '2026-03-18T01:30:00.000Z',
                    koniec: '2026-03-18T03:30:00.000Z',
                },
                '2026-03-18 00:30',
                '2026-03-18 02:30',
            ),
        ).toBe(false);
    });

    it('builds booking payload from a slot match', () => {
        expect(
            buildBookPayload({
                idrow: 22,
                startUtc: 'start-utc',
                endUtc: 'end-utc',
                startLocal: '2026-03-18 04:30',
                endLocal: '2026-03-18 06:30',
                miejsc: 8,
                zajete: 3,
            }),
        ).toEqual({
            idrow: 22,
            poczatek: '2026-03-18 04:30',
            koniec: '2026-03-18 06:30',
            miejsc: 8,
            zajete: 3,
        });
    });

    it('formats the current time in the GCT timezone', () => {
        expect(getNowInGctTimezone()).toBe(formatWarsaw('2026-03-17T12:15:00.000Z'));
    });
});
