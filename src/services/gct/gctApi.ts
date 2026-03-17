import type {
    GctBookRowPayload,
    GctCurrentBooking,
    GctSlotMatch,
    GctWatchGroup,
} from '../../gct/types';

const GCT_API_BASE_URL = 'https://api.gct.pl/gctgui';
const GCT_TIMEZONE = 'Europe/Warsaw';

type GctAvailableSlotTuple = [number, string, string, number, number];

interface GctLoginResponse {
    csrf?: string;
}

const localDateTimeFormatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: GCT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
});

function formatLocalDateTime(value: string): string {
    return localDateTimeFormatter.format(new Date(value)).replace(',', '');
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
    const text = await response.text();

    if (!response.ok) {
        throw new Error(text || `GCT request failed with status ${response.status}`);
    }

    if (!text) {
        return [] as T;
    }

    return JSON.parse(text) as T;
}

async function postJson<T>(path: string, body: unknown, bearerToken?: string): Promise<T> {
    const response = await fetch(`${GCT_API_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
        },
        body: JSON.stringify(body),
    });

    return parseJsonResponse<T>(response);
}

export async function loginToGct(group: GctWatchGroup): Promise<string> {
    const response = await postJson<GctLoginResponse>('/kierowca/login', {
        dokument: group.documentNumber,
        pojazd: group.vehicleNumber,
        kontener: group.containerNumber,
    });

    if (!response.csrf) {
        throw new Error('GCT login did not return a bearer token');
    }

    return response.csrf;
}

export async function getGctAvailableSlots(token: string): Promise<GctSlotMatch[]> {
    const slots = await postJson<GctAvailableSlotTuple[]>('/kierowca', { crud: 'wolne' }, token);

    return slots.map(([idrow, startUtc, endUtc, miejsc, zajete]) => ({
        idrow,
        startUtc,
        endUtc,
        startLocal: formatLocalDateTime(startUtc),
        endLocal: formatLocalDateTime(endUtc),
        miejsc,
        zajete,
    }));
}

export async function getGctCurrentBooking(token: string): Promise<GctCurrentBooking | null> {
    const response = await postJson<GctCurrentBooking | []>(
        '/kierowca',
        { crud: 'momentawizacji' },
        token,
    );

    if (Array.isArray(response)) {
        return null;
    }

    return response;
}

export async function bookGctSlot(token: string, row: GctBookRowPayload): Promise<unknown> {
    return postJson<unknown>('/kierowca', { crud: 'przyjazd', row }, token);
}

export function matchesCurrentBooking(
    booking: GctCurrentBooking | null,
    targetStartLocal: string,
    targetEndLocal: string,
): boolean {
    if (!booking) {
        return false;
    }

    return (
        formatLocalDateTime(booking.poczatek) === targetStartLocal &&
        formatLocalDateTime(booking.koniec) === targetEndLocal
    );
}

export function buildBookPayload(slot: GctSlotMatch): GctBookRowPayload {
    return {
        idrow: slot.idrow,
        poczatek: slot.startLocal,
        koniec: slot.endLocal,
        miejsc: slot.miejsc,
        zajete: slot.zajete,
    };
}

export function getNowInGctTimezone(): string {
    return localDateTimeFormatter.format(new Date()).replace(',', '');
}
