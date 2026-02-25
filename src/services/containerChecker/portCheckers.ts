import type { PortCheckResult, SupportedPort } from '../../containerChecker/types';
import { SUPPORTED_PORTS } from '../../containerChecker/types';

function normalizeContainerId(containerId: string): string {
    return containerId.trim().toUpperCase();
}

function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isTransientFetchError(error: unknown): boolean {
    const message = String((error as Error)?.message || '').toLowerCase();
    return (
        (error as Error)?.name === 'AbortError' ||
        message.includes('failed to fetch') ||
        message.includes('network error') ||
        message.includes('networkerror') ||
        message.includes('load failed') ||
        message.includes('timed out') ||
        message.includes('timeout') ||
        message.includes('net::err')
    );
}

interface RetryOptions {
    attempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
}

async function fetchWithRetry({
    url,
    options,
    retry,
}: {
    url: string;
    options: RequestInit;
    retry?: RetryOptions;
}): Promise<Response> {
    const attempts = Math.max(1, Number(retry?.attempts) || 1);
    const baseDelayMs = Math.max(0, Number(retry?.baseDelayMs) || 0);
    const maxDelayMs = Math.max(baseDelayMs, Number(retry?.maxDelayMs) || baseDelayMs);
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            const response = await fetch(url, options);
            return response;
        } catch (error) {
            lastError = error;
            const canRetry = attempt < attempts && isTransientFetchError(error);
            if (!canRetry) {
                throw error;
            }
            const delayMs = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
            if (delayMs > 0) {
                await wait(delayMs);
            }
        }
    }

    throw lastError || new Error('Request failed');
}

function stripHtml(value: string): string {
    return value
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeFieldKey(value: string): string {
    return (value || '')
        .toLowerCase()
        .replace(/\*/g, '')
        .replace(/:/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function getFieldValue(fields: Record<string, string>, aliases: string[]): string {
    const entries = Object.entries(fields || {});
    for (const alias of aliases) {
        const normalizedAlias = normalizeFieldKey(alias);
        for (const [key, value] of entries) {
            if (normalizeFieldKey(key) === normalizedAlias) {
                return value || '';
            }
        }
    }
    return '';
}

function asDash(value: string): string {
    const cleaned = (value || '').trim();
    return cleaned ? cleaned : '-';
}

function parseFlexibleDate(value: string): Date | null {
    const raw = (value || '').trim();
    if (!raw || raw === '-') {
        return null;
    }

    const normalized = raw.replace(/\//g, '.').replace(/\s+/g, ' ').trim();

    const isoLike = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/;
    if (isoLike.test(normalized)) {
        const iso = normalized.includes('T') ? normalized : normalized.replace(' ', 'T');
        const parsed = new Date(iso);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const plLike = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
    const match = normalized.match(plLike);
    if (match) {
        const day = Number(match[1]);
        const month = Number(match[2]);
        const year = Number(match[3]);
        const hour = Number(match[4] || 0);
        const minute = Number(match[5] || 0);
        const second = Number(match[6] || 0);
        const parsed = new Date(year, month - 1, day, hour, minute, second);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const fallback = new Date(normalized);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function latestTimestamp(...values: string[]): Date | null {
    const dates = values.map(parseFlexibleDate).filter((d): d is Date => d !== null);
    if (!dates.length) {
        return null;
    }
    return new Date(Math.max(...dates.map(d => d.getTime())));
}

function parseBctModalFields(html: string): Record<string, string> {
    const fields: Record<string, string> = {};
    const rowRegex =
        /<tr>\s*<td[^>]*class="container-card-table-title"[^>]*>\s*([^<]+?)\s*<\/td>\s*<td[^>]*class="container-card-table-data"[^>]*>\s*([\s\S]*?)\s*<\/td>\s*<\/tr>/gi;
    for (const match of html.matchAll(rowRegex)) {
        fields[stripHtml(match[1])] = stripHtml(match[2]);
    }
    return fields;
}

function parseDctFields(html: string): Record<string, string> {
    const fields: Record<string, string> = {};
    const rowRegex =
        /<tr>\s*<th[^>]*>\s*([\s\S]*?)\s*<\/th>\s*<td[^>]*>\s*([\s\S]*?)\s*<\/td>\s*<\/tr>/gi;
    for (const match of html.matchAll(rowRegex)) {
        const key = stripHtml(match[1]);
        const value = stripHtml(match[2]);
        if (key) {
            fields[key] = value;
        }
    }

    if (!Object.keys(fields).length) {
        const fallbackRegex =
            /<div[^>]*class="title"[^>]*>\s*([^<]+?)\s*<\/div>\s*<div[^>]*class="number"[^>]*>\s*([^<]+?)\s*<\/div>/gi;
        for (const match of html.matchAll(fallbackRegex)) {
            fields[stripHtml(match[1])] = stripHtml(match[2]);
        }
    }

    return fields;
}

interface GctRow {
    containerNumber: string;
    isoType: string;
    status: string;
    customsStatus: string;
    voyage: string;
    timeIn: string;
    timeOut: string;
}

function parseGctRow(html: string, containerId: string): GctRow | null {
    const normalized = normalizeContainerId(containerId);
    const rowRegex =
        /<tr[^>]*>\s*<td[^>]*>\s*\d+\s*<\/td>\s*<td[^>]*>\s*([^<]+?)\s*<\/td>\s*<td[^>]*>\s*([^<]+?)\s*<\/td>\s*<td[^>]*>\s*([\s\S]*?)\s*<\/td>\s*<td[^>]*>\s*([\s\S]*?)\s*<\/td>\s*<td[^>]*>\s*([\s\S]*?)\s*<\/td>\s*<td[^>]*>\s*([\s\S]*?)\s*<\/td>\s*<td[^>]*>\s*([\s\S]*?)\s*<\/td>\s*<\/tr>/gi;

    for (const match of html.matchAll(rowRegex)) {
        const rowContainer = stripHtml(match[1]).toUpperCase();
        if (rowContainer === normalized) {
            return {
                containerNumber: rowContainer,
                isoType: stripHtml(match[2]),
                status: stripHtml(match[3]),
                customsStatus: stripHtml(match[4]),
                voyage: stripHtml(match[5]),
                timeIn: stripHtml(match[6]),
                timeOut: stripHtml(match[7]),
            };
        }
    }

    return null;
}

function isNonInformativeStatus(statusText: string): boolean {
    const normalized = (statusText || '').toLowerCase().trim();
    return (
        normalized.includes('brak informacji') ||
        normalized.includes('brak danych') ||
        normalized === 'no information'
    );
}

function hasImageRetrievalNoise(text: string): boolean {
    const normalized = (text || '').toLowerCase().trim();
    return (
        normalized.includes('unable to retrieve all specified images') ||
        normalized.includes('unable to retrieve all specifies images') ||
        normalized.includes('unable to retrieve all specif') ||
        normalized.includes('unable to download all specified images') ||
        normalized.includes('unable to download all specifies images') ||
        normalized.includes('unable to download all specif')
    );
}

function hasTechnicalErrorNoise(text: string): boolean {
    const normalized = (text || '').toLowerCase().trim();
    if (!normalized || normalized === '-' || normalized === '--') {
        return false;
    }

    const technicalMarkers = [
        'unable to',
        'failed',
        'error',
        'exception',
        'timeout',
        'timed out',
        'service unavailable',
        'internal server',
        'not available',
        'brak danych',
        'brak informacji',
        'błąd',
        'blad',
    ];

    const transportOrMediaMarkers = [
        'image',
        'images',
        'download',
        'retrieve',
        'request',
        'server',
        'gateway',
        'api',
        'http',
    ];

    const hasTechnicalMarker = technicalMarkers.some(marker => normalized.includes(marker));
    const hasTransportOrMediaMarker = transportOrMediaMarkers.some(marker =>
        normalized.includes(marker),
    );

    return hasTechnicalMarker && hasTransportOrMediaMarker;
}

function hasUnexpectedVerboseText(text: string): boolean {
    const normalized = (text || '').trim();
    if (!normalized || normalized === '-' || normalized === '--') {
        return false;
    }

    const words = normalized.split(/\s+/).filter(Boolean);
    return words.length >= 5;
}

function isNonInformativePortStatus(statusText: string, stateText: string): boolean {
    return (
        isNonInformativeStatus(statusText) ||
        hasImageRetrievalNoise(statusText) ||
        hasImageRetrievalNoise(stateText) ||
        hasTechnicalErrorNoise(statusText) ||
        hasTechnicalErrorNoise(stateText) ||
        hasUnexpectedVerboseText(statusText) ||
        hasUnexpectedVerboseText(stateText)
    );
}

function hasDctNoResults(html: string, containerId: string): boolean {
    const normalizedHtml = (html || '').toLowerCase();
    const normalizedContainer = (containerId || '').toLowerCase();
    return (
        normalizedHtml.includes('brak wynik') ||
        normalizedHtml.includes('no results') ||
        normalizedHtml.includes(`data-wrong="${normalizedContainer}"`) ||
        normalizedHtml.includes(`brak wyników dla: ${normalizedContainer}`)
    );
}

export function toMilestone(statusText: string): string {
    const status = (statusText || '').toLowerCase();
    if (!status) {
        return 'UNKNOWN';
    }
    if (
        status.includes('gate out') ||
        status.includes('podjęcia') ||
        status.includes('time out') ||
        status.includes('wyjazd')
    ) {
        return 'GATE_OUT';
    }
    if (
        status.includes('yard') ||
        status.includes('terminal') ||
        status.includes('na terminalu') ||
        status.includes('time in')
    ) {
        return 'IN_TERMINAL';
    }
    if (status.includes('discharg') || status.includes('wyład')) {
        return 'DISCHARGED';
    }
    if (status.includes('custom') || status.includes('celn')) {
        return 'CUSTOMS';
    }
    return 'OTHER';
}

export async function checkDct(containerId: string): Promise<PortCheckResult | null> {
    const normalized = normalizeContainerId(containerId);
    await fetchWithRetry({
        url: 'https://baltichub.com/dla-klienta/sprawdz-kontener',
        options: { credentials: 'include' },
    });
    const response = await fetchWithRetry({
        url: 'https://baltichub.com/api/multi',
        options: {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                Referer: 'https://baltichub.com/dla-klienta/sprawdz-kontener',
            },
            body: new URLSearchParams({ lang: 'pl', 'id[]': normalized }),
        },
    });

    const html = await response.text();
    if (!html || !html.toUpperCase().includes(normalized) || hasDctNoResults(html, normalized)) {
        return null;
    }

    const fields = parseDctFields(html);
    const stops = getFieldValue(fields, ['Stops', '*Stops']);
    const tState = getFieldValue(fields, ['T-State']);
    const statusText = `Stops:${asDash(stops)}`;
    const stateText = asDash(tState);
    if (isNonInformativePortStatus(statusText, stateText)) {
        return null;
    }

    const dataTimestamp = latestTimestamp(
        getFieldValue(fields, ['Time Out']),
        getFieldValue(fields, ['Time In']),
    );

    return {
        port: 'DCT',
        containerNumber: normalized,
        statusText,
        stateText,
        milestone: toMilestone(tState || statusText),
        dataTimestamp: dataTimestamp ? dataTimestamp.toISOString() : null,
        observedAt: new Date().toISOString(),
        raw: fields,
    };
}

export async function checkBct(containerId: string): Promise<PortCheckResult | null> {
    const normalized = normalizeContainerId(containerId);
    const page = await fetchWithRetry({
        url: 'https://ebrama.bct.ictsi.com/vbs-check-container',
        options: { credentials: 'include' },
        retry: {
            attempts: 3,
            baseDelayMs: 350,
            maxDelayMs: 1500,
        },
    });
    const pageHtml = await page.text();
    const tokenMatch = pageHtml.match(
        /name="__RequestVerificationToken"\s+type="hidden"\s+value="([^"]+)"/i,
    );
    if (!tokenMatch) {
        throw new Error('BCT token not found');
    }

    const body = new URLSearchParams({
        ContainerNo: normalized,
        __RequestVerificationToken: tokenMatch[1],
    });

    const result = await fetchWithRetry({
        url: 'https://ebrama.bct.ictsi.com/Tiles/TileCheckContainerSubmit',
        options: {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            },
            body,
        },
    });

    const html = await result.text();
    if (!html.toUpperCase().includes(normalized)) {
        return null;
    }

    const fields = parseBctModalFields(html);
    const stops = getFieldValue(fields, ['Stops']);
    const tState = getFieldValue(fields, ['T-State']);
    const statusText = `Stops:${asDash(stops)}`;
    const stateText = asDash(tState);
    if (isNonInformativePortStatus(statusText, stateText)) {
        return null;
    }

    const dataTimestamp = latestTimestamp(
        getFieldValue(fields, ['Time Out']),
        getFieldValue(fields, ['Time In']),
    );

    return {
        port: 'BCT',
        containerNumber: normalized,
        statusText,
        stateText,
        milestone: toMilestone(tState || statusText),
        dataTimestamp: dataTimestamp ? dataTimestamp.toISOString() : null,
        observedAt: new Date().toISOString(),
        raw: fields,
    };
}

export async function checkGct(containerId: string): Promise<PortCheckResult | null> {
    const normalized = normalizeContainerId(containerId);
    const url = 'https://terminal.gct.pl/?page=90039_PublicCntrStatus.Report90039Page&lang=pl';
    const page = await fetchWithRetry({
        url,
        options: { credentials: 'include' },
    });
    const pageHtml = await page.text();

    const stateMatch = pageHtml.match(/name="PRADO_PAGESTATE"[^>]*value="([^"]+)"/i);
    if (!stateMatch) {
        throw new Error('GCT page state missing');
    }

    const body = new URLSearchParams({
        PRADO_PAGESTATE: stateMatch[1],
        ctl0$Main$CntrIDsTextBox: normalized,
        ctl0$Main$ShowButton: 'Pokaż',
    });

    const result = await fetchWithRetry({
        url,
        options: {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body,
        },
    });

    const html = await result.text();
    const row = parseGctRow(html, normalized);
    if (!row) {
        return null;
    }

    const status = row.status || '';
    if (isNonInformativeStatus(status)) {
        return null;
    }

    const normalizedStatus = status.toLowerCase();
    const statusPartial = normalizedStatus.includes('na terminalu')
        ? 'na terminalu'
        : normalizedStatus.includes('na statku')
          ? 'na statku'
          : '';
    const customsStatus = row.customsStatus || '';
    const statusText = asDash(customsStatus);
    const stateText = asDash(statusPartial);
    const dataTimestamp = latestTimestamp(row.timeOut, row.timeIn);

    return {
        port: 'GCT',
        containerNumber: normalized,
        statusText,
        stateText,
        milestone: toMilestone(statusPartial || status),
        dataTimestamp: dataTimestamp ? dataTimestamp.toISOString() : null,
        observedAt: new Date().toISOString(),
        raw: row as unknown as Record<string, string>,
    };
}

export interface CheckPortResult {
    match: PortCheckResult | null;
    errors: string[];
}

export async function checkPort(containerId: string, port: string): Promise<CheckPortResult> {
    const normalized = normalizeContainerId(containerId);
    const selectedPort = (port || '').toUpperCase() as SupportedPort;
    if (!SUPPORTED_PORTS.includes(selectedPort)) {
        throw new Error(`Unsupported port: ${port || 'unknown'}`);
    }

    const checkers = {
        DCT: checkDct,
        BCT: checkBct,
        GCT: checkGct,
    };

    try {
        const match = await checkers[selectedPort](normalized);
        return {
            match,
            errors: [],
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown port error';
        return {
            match: null,
            errors: [message],
        };
    }
}
