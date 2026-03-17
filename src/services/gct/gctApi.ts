import type {
    GctBookRowPayload,
    GctCurrentBooking,
    GctSlotMatch,
    GctWatchGroup,
} from '../../gct/types';

const GCT_API_BASE_URL = 'https://api.gct.pl/gctgui';
const GCT_TIMEZONE = 'Europe/Warsaw';
const GCT_REQUEST_TIMEOUT_MS = 15000;
const GCT_NETWORK_RETRY_ATTEMPTS = 2;
const GCT_NETWORK_RETRY_DELAY_MS = 700;

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

function toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function compactSnippet(value: string, maxLength = 220): string {
    const compact = value.replace(/\s+/g, ' ').trim();
    if (!compact) {
        return '';
    }

    return compact.length > maxLength ? `${compact.slice(0, maxLength)}…` : compact;
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableNetworkError(error: unknown): boolean {
    const message = toErrorMessage(error).toLowerCase();
    return (
        message.includes('failed to fetch') ||
        message.includes('network') ||
        message.includes('timeout')
    );
}

async function parseJsonResponse<T>(response: Response, context: string): Promise<T> {
    const text = await response.text();

    if (!response.ok) {
        const snippet = compactSnippet(text);
        throw new Error(
            snippet
                ? `GCT request failed with status ${response.status} [${context}] ${snippet}`
                : `GCT request failed with status ${response.status} [${context}]`,
        );
    }

    if (!text) {
        return [] as T;
    }

    try {
        return JSON.parse(text) as T;
    } catch (error) {
        throw new Error(
            `Invalid JSON response from GCT [${context}] ${compactSnippet(text)} (${toErrorMessage(error)})`,
        );
    }
}

async function postJson<T>(path: string, body: unknown, bearerToken?: string): Promise<T> {
    const crud =
        typeof body === 'object' && body !== null && 'crud' in body
            ? String((body as { crud?: unknown }).crud || '')
            : '';
    const context = crud ? `${path} crud=${crud}` : path;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= GCT_NETWORK_RETRY_ATTEMPTS; attempt += 1) {
        const startedAt = Date.now();
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => {
            abortController.abort();
        }, GCT_REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(`${GCT_API_BASE_URL}${path}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json, text/plain, */*',
                    ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
                },
                body: JSON.stringify(body),
                signal: abortController.signal,
            });

            clearTimeout(timeoutId);
            return await parseJsonResponse<T>(response, context);
        } catch (error) {
            clearTimeout(timeoutId);
            const elapsedMs = Date.now() - startedAt;
            const diagnostic = new Error(
                `GCT request failed [${context}] attempt=${attempt}/${GCT_NETWORK_RETRY_ATTEMPTS} elapsed=${elapsedMs}ms ${toErrorMessage(error)}`,
            );
            lastError = diagnostic;

            if (attempt < GCT_NETWORK_RETRY_ATTEMPTS && isRetryableNetworkError(error)) {
                await delay(GCT_NETWORK_RETRY_DELAY_MS);
                continue;
            }

            throw diagnostic;
        }
    }

    throw lastError || new Error(`GCT request failed [${context}] unknown error`);
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
