import { urls } from '../data';
import { fetchRequest, consoleError, consoleLog, setStorage, getStorage } from '../utils';
import { isEbramaLoginPageResponse } from '../utils/baltichub.helper';

const EBRAMA_KEEPALIVE_INTERVAL_MS = 8 * 60 * 1000;

export async function shouldRunEbramaKeepAlive(): Promise<boolean> {
    const { retryEnabled, retryQueue, unauthorized } = await getStorage([
        'retryEnabled',
        'retryQueue',
        'unauthorized',
    ] as const);

    return (
        Boolean(retryEnabled) && Array.isArray(retryQueue) && retryQueue.length > 0 && !unauthorized
    );
}

export async function keepEbramaSessionAlive(): Promise<void> {
    if (!(await shouldRunEbramaKeepAlive())) {
        return;
    }

    try {
        const response = await fetchRequest(urls.tvApps, {
            method: 'GET',
            headers: {
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                Referer: urls.tvApps,
            },
            credentials: 'include',
        });

        const bodyText = await response.text();
        const finalUrl = 'url' in response ? response.url : undefined;

        if (isEbramaLoginPageResponse(bodyText, finalUrl)) {
            await setStorage({ unauthorized: true });
            consoleLog('[background] eBrama keepalive detected expired session');
            return;
        }

        consoleLog('[background] eBrama keepalive ping successful');
    } catch (error) {
        consoleError('[background] eBrama keepalive failed:', error);
    }
}

export function getEbramaKeepAliveIntervalMs(): number {
    return EBRAMA_KEEPALIVE_INTERVAL_MS;
}
