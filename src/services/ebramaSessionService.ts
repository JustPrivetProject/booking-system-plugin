import { urls } from '../data';
import { fetchRequest, consoleError, consoleLog } from '../utils';
import { isEbramaLoginPageResponse } from '../utils/baltichub.helper';
import { BOOKING_TERMINALS, type BookingTerminal } from '../types/terminal';
import {
    getTerminalStorageValue,
    setTerminalStorageValue,
    TERMINAL_STORAGE_NAMESPACES,
} from '../utils/storage';

const EBRAMA_KEEPALIVE_INTERVAL_MS = 8 * 60 * 1000;

const EBRAMA_TERMINAL_URLS: Record<BookingTerminal, string> = {
    [BOOKING_TERMINALS.DCT]: urls.tvApps,
    [BOOKING_TERMINALS.BCT]: 'https://ebrama.bct.ictsi.com/tv-apps',
};

export async function shouldRunEbramaKeepAlive(
    terminal: BookingTerminal = BOOKING_TERMINALS.DCT,
): Promise<boolean> {
    const [{ retryEnabled }, retryQueue, unauthorized] = await Promise.all([
        chrome.storage.local.get('retryEnabled'),
        getTerminalStorageValue(TERMINAL_STORAGE_NAMESPACES.RETRY_QUEUE, terminal, []),
        getTerminalStorageValue(TERMINAL_STORAGE_NAMESPACES.UNAUTHORIZED, terminal, false),
    ]);

    return (
        Boolean(retryEnabled) && Array.isArray(retryQueue) && retryQueue.length > 0 && !unauthorized
    );
}

export async function keepEbramaSessionAlive(
    terminal: BookingTerminal = BOOKING_TERMINALS.DCT,
): Promise<void> {
    if (!(await shouldRunEbramaKeepAlive(terminal))) {
        return;
    }

    try {
        const targetUrl = EBRAMA_TERMINAL_URLS[terminal];
        const response = await fetchRequest(targetUrl, {
            method: 'GET',
            headers: {
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                Referer: targetUrl,
            },
            credentials: 'include',
        });

        const bodyText = await response.text();
        const finalUrl = 'url' in response ? response.url : undefined;

        if (isEbramaLoginPageResponse(bodyText, finalUrl)) {
            await setTerminalStorageValue(TERMINAL_STORAGE_NAMESPACES.UNAUTHORIZED, terminal, true);
            consoleLog(`[background] eBrama keepalive detected expired session for ${terminal}`);
            return;
        }

        consoleLog(`[background] eBrama keepalive ping successful for ${terminal}`);
    } catch (error) {
        consoleError(`[background] eBrama keepalive failed for ${terminal}:`, error);
    }
}

export function getEbramaKeepAliveIntervalMs(): number {
    return EBRAMA_KEEPALIVE_INTERVAL_MS;
}
