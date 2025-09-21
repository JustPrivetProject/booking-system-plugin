import { Actions } from '../data';

import { showCountdownModal } from './modals/countdownModal';
import { showSessionExpireModal } from './modals/sesssionExpireModal';
import {
    waitElementAndSendChromeMessage,
    parseTable,
    waitForElement,
    isUserAuthenticated,
    tryClickLoginButton,
    isAppUnauthorized,
    sendActionToBackground,
    isAutoLoginEnabled,
    checkConnectionAndShowWarning,
} from './utils/contentUtils';

console.log('[content] Content script is loaded');

// Check extension connection on page load
checkConnectionAndShowWarning()
    .then(isConnected => {
        if (!isConnected) {
            console.log('[content] Extension connection issues detected');
        }
    })
    .catch(error => {
        console.log('[content] Error checking extension connection:', error);
    });

setInterval(async () => {
    try {
        // First check extension connection
        const isConnected = await checkConnectionAndShowWarning();
        if (!isConnected) {
            console.log('[content] Extension connection lost during interval check');
            return; // Skip other checks if extension is not connected
        }

        const isAutoLoginEnabledResult = await isAutoLoginEnabled();
        if (!isAutoLoginEnabledResult) return;

        const isUnauthorized = await isAppUnauthorized();

        if (isUnauthorized) {
            console.log('[content] Unauthorized — showing session expire modal');
            showSessionExpireModal();
        }
    } catch (error) {
        console.log('[content] Error in authorization check:', error);
        // If there's an error, it might be due to extension disconnection
        // Try to show warning modal
        await checkConnectionAndShowWarning();
    }
}, 65_000);

waitElementAndSendChromeMessage('#toast-container', Actions.SHOW_ERROR, () => {
    return 'An error occurred!';
});

waitElementAndSendChromeMessage(
    '.swal2-icon-success[role="dialog"]',
    Actions.SUCCEED_BOOKING,
    () => {
        return 'Successful booking found!';
    },
);

waitElementAndSendChromeMessage('#Grid table', Actions.PARSED_TABLE, () => {
    return parseTable();
});

waitForElement('#slotsDisplay', targetNode => {
    const enableButtons = async () => {
        const isAuth = await isUserAuthenticated();
        if (!isAuth) return;
        targetNode.querySelectorAll('button[disabled]').forEach(button => {
            button.removeAttribute('disabled');
            button.classList.remove('disabled');
            button.style.pointerEvents = 'auto';
        });
    };

    enableButtons();

    const observer = new MutationObserver(enableButtons);
    observer.observe(targetNode, { childList: true, subtree: true });
});

waitElementAndSendChromeMessage('#vbsBgModal[style="display: block;"]', Actions.PARSED_TABLE, () =>
    parseTable(),
);

// Auto-login on login page
window.addEventListener('load', async () => {
    const isAuth = await isUserAuthenticated();
    if (!isAuth) return;

    const isAutoLoginEnabled = await isAppUnauthorized();
    if (!isAutoLoginEnabled) return;

    if (location.pathname === '/') {
        console.log('[content] Home page detected, showing countdown modal...');
        showCountdownModal();
        return;
    }

    if (location.pathname === '/login') {
        console.log('[content] Login page detected, trying auto-login...');
        setTimeout(() => {
            tryClickLoginButton();
        }, 1000);
        return;
    }

    sendActionToBackground(Actions.LOGIN_SUCCESS, { success: true }, null);
});
