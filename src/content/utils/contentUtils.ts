import { Actions } from '../../data';

import type { AutoLoginCredentials } from './autoLoginHelper';
import { autoLoginHelper } from './autoLoginHelper';

/**
 * Waits for the appearance of an element, then its disappearance, and sends an action to the background.
 * @param {string} selector - CSS selector of the element
 * @param {string} action - Name of the action for the background
 * @param {any|Function} messageOrFn - Data to send or a function that returns data
 * @param {Function} [callback] - Необязательный callback для обработки ответа
 */
export function sendActionAfterElementDisappears(selector, action, messageOrFn, callback) {
    // First, wait for the appearance of the element
    contentUtils.waitForElement(selector, () => {
        // Then wait for the disappearance
        contentUtils.waitForElementToDisappear(selector, () => {
            const message = typeof messageOrFn === 'function' ? messageOrFn() : messageOrFn;
            contentUtils.sendActionToBackground(action, message, callback);
        });
    });
}

/**
 * Universal function to send an action and message to the background script.
 * @param {string} action - Name of the action
 * @param {any} message - Data to send
 * @param {Function} [callback] - Optional callback for processing the response
 */
export function sendActionToBackground(action, message, callback) {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        console.log('Chrome runtime API is not available');
        return;
    }
    chrome.runtime.sendMessage({ action, message }, response => {
        if (chrome.runtime.lastError) {
            console.log(`Error sending ${action} message:`, chrome.runtime.lastError);
        }
        if (typeof callback === 'function') {
            callback(response);
        }
    });
}

export function waitForElement(selector, callback) {
    const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);

        if (element) {
            callback(element);

            // Wait for the element to disappear before continuing
            const checkRemoval = new MutationObserver(() => {
                if (!document.querySelector(selector)) {
                    checkRemoval.disconnect(); // Stop observing disappearance
                    observer.observe(document.body, {
                        childList: true,
                        subtree: true,
                    }); // Re-enable observer
                }
            });

            checkRemoval.observe(document.body, {
                childList: true,
                subtree: true,
            });
            observer.disconnect(); // Temporarily stop observing until element disappears
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

export function waitElementAndSendChromeMessage(selector, action, actionFunction) {
    contentUtils.waitForElement(selector, () => {
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
            console.log('Chrome runtime API is not available');
            return;
        }

        try {
            const parsedData = actionFunction();
            contentUtils.sendActionToBackground(action, parsedData, undefined);
        } catch (error) {
            console.log(`Error processing ${action}:`, error);
        }
    });
}

export function parseTable(): string[][] {
    const table = document.querySelector('#Grid table');
    if (!table) return [];

    const data: string[][] = [];
    table.querySelectorAll<HTMLElement>('tr').forEach((row, _rowIndex) => {
        const cells = row.querySelectorAll<HTMLElement>('td, th');
        const rowData: string[] = [];
        cells.forEach((cell: HTMLElement) => rowData.push(cell.innerText.trim()));
        data.push(rowData);
    });

    return data;
}

/**
 * Waits for the disappearance of an element by selector, then calls the callback.
 * @param {string} selector - CSS selector of the modal window or any element
 * @param {Function} callback - Function called after the element disappears
 */
export function waitForElementToDisappear(selector, callback) {
    if (!document.querySelector(selector)) {
        callback();
        return;
    }
    const observer = new MutationObserver(() => {
        if (!document.querySelector(selector)) {
            observer.disconnect();
            callback();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

export function isUserAuthenticated(): Promise<boolean> {
    return new Promise(resolve => {
        try {
            if (!chrome.runtime || !chrome.runtime.sendMessage) {
                console.log('[content] Chrome runtime not available');
                return resolve(false);
            }

            // Add timeout to prevent hanging
            const timeout = setTimeout(() => {
                console.log('[content] isUserAuthenticated timeout');
                resolve(false);
            }, 5000);

            chrome.runtime.sendMessage({ action: Actions.IS_AUTHENTICATED }, response => {
                clearTimeout(timeout);

                if (chrome.runtime.lastError) {
                    console.log('[content] Runtime error:', chrome.runtime.lastError);
                    return resolve(false);
                }

                if (!response) {
                    console.log('[content] No response from background');
                    return resolve(false);
                }

                resolve(response.isAuthenticated === true);
            });
        } catch (error) {
            console.log('[content] Error in isUserAuthenticated:', error);
            resolve(false);
        }
    });
}

export function isAppUnauthorized(): Promise<boolean> {
    return new Promise(resolve => {
        try {
            if (!chrome.runtime || !chrome.runtime.sendMessage) {
                console.log('[content] Chrome runtime not available');
                return resolve(false);
            }

            // Add timeout to prevent hanging
            const timeout = setTimeout(() => {
                console.log('[content] isAppUnauthorized timeout');
                resolve(false);
            }, 5000);

            chrome.runtime.sendMessage({ action: Actions.GET_AUTH_STATUS }, response => {
                clearTimeout(timeout);

                if (chrome.runtime.lastError) {
                    console.log('[content] Runtime error:', chrome.runtime.lastError);
                    return resolve(false);
                }

                if (!response) {
                    console.log('[content] No response from background');
                    return resolve(false);
                }

                resolve(response.unauthorized);
            });
        } catch (error) {
            console.log('[content] Error in isAppUnauthorized:', error);
            resolve(false);
        }
    });
}

export function isAutoLoginEnabled(): Promise<boolean> {
    return new Promise(resolve => {
        contentUtils.sendActionToBackground(Actions.IS_AUTO_LOGIN_ENABLED, null, response => {
            resolve(response.isEnabled);
        });
    });
}

export async function tryClickLoginButton() {
    const LOGIN_FORM_SELECTOR = '.loginscreen';
    const LOGIN_BUTTON_SELECTOR = '#loginBtn';

    // Step 1: Focus the form if available
    const form = document.querySelector<HTMLElement>(LOGIN_FORM_SELECTOR);
    if (form) {
        form.focus();
    }

    // Step 2: Try auto-login first
    let autoLoginCredentials: AutoLoginCredentials | null = null;

    try {
        autoLoginCredentials = await autoLoginHelper.loadCredentials();
        if (autoLoginCredentials) {
            autoLoginHelper.fillLoginForm(autoLoginCredentials);
        }
    } catch (error) {
        console.log('[content] Error loading auto-login credentials:', error);
    }

    // Step 3: Find and click login button
    const button = document.querySelector<HTMLButtonElement>(LOGIN_BUTTON_SELECTOR);
    if (!button) {
        console.log('[content] Login button not found');
        return;
    }

    button.click();

    console.log('[content] Manual login successful');
    contentUtils.sendActionToBackground(Actions.LOGIN_SUCCESS, { success: true }, null);
}

export function clickLoginButton() {
    const LOGIN_BUTTON_SELECTOR = 'a.product-box[href="/login"]';
    const button = document.querySelector<HTMLButtonElement>(LOGIN_BUTTON_SELECTOR);
    if (!button) {
        console.log('[content] Login button not found');
        return;
    }

    console.log('[content] Clicking login button...');
    button.click();
}

/**
 * Checks if extension connection is available
 * @returns {Promise<boolean>} True if connection is available, false otherwise
 */
export function checkExtensionConnection(): Promise<boolean> {
    return new Promise(resolve => {
        try {
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
                console.log('[content] Chrome runtime API is not available');
                return resolve(false);
            }

            // Add timeout to prevent hanging
            const timeout = setTimeout(() => {
                console.log('[content] Extension connection check timeout');
                resolve(false);
            }, 5000);

            // Use existing action that we know works instead of PING
            chrome.runtime.sendMessage({ action: Actions.IS_AUTHENTICATED }, response => {
                clearTimeout(timeout);

                if (chrome.runtime.lastError) {
                    console.log('[content] Extension connection error:', chrome.runtime.lastError);
                    return resolve(false);
                }

                // Check if we got any response at all
                // Even if user is not authenticated, we should get a response object
                // Only show warning if there's no response (connection issue)
                if (response === undefined || response === null) {
                    console.log('[content] No response from extension - connection issue');
                    return resolve(false);
                }

                // If we got a response (even with isAuthenticated: false), connection is OK
                console.log(
                    '[content] Extension connection OK, auth status:',
                    response.isAuthenticated,
                );
                resolve(true);
            });
        } catch (error) {
            console.log('[content] Error checking extension connection:', error);
            resolve(false);
        }
    });
}

/**
 * Checks extension connection and shows warning modal if connection is lost
 * Warning appears only once per session and can be dismissed permanently for that session
 * @returns {Promise<boolean>} True if connection is available, false if warning was shown
 */
export async function checkConnectionAndShowWarning(): Promise<boolean> {
    const isConnected = await contentUtils.checkExtensionConnection();

    if (!isConnected) {
        console.log('[content] Extension connection lost, showing warning modal');

        // Dynamically import the modal to avoid circular dependencies
        try {
            const { showExtensionWarningModal } = await import('../modals/extensionWarningModal');
            await showExtensionWarningModal();
        } catch (error) {
            console.log('[content] Error loading extension warning modal:', error);
        }

        return false;
    }

    return true;
}

// Create contentUtils object for internal function calls to enable easier testing
export const contentUtils = {
    sendActionToBackground,
    waitForElement,
    waitForElementToDisappear,
    sendActionAfterElementDisappears,
    waitElementAndSendChromeMessage,
    parseTable,
    isUserAuthenticated,
    isAppUnauthorized,
    isAutoLoginEnabled,
    tryClickLoginButton,
    clickLoginButton,
    checkExtensionConnection,
    checkConnectionAndShowWarning,
};
