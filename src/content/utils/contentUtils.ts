import { Actions } from '../../data'
import { autoLoginHelper, AutoLoginCredentials } from './autoLoginHelper'

/**
 * Ждёт появления элемента, затем его исчезновения, и отправляет экшен в background.
 * @param {string} selector - CSS-селектор элемента
 * @param {string} action - Имя экшена для background
 * @param {any|Function} messageOrFn - Данные для отправки или функция, возвращающая данные
 * @param {Function} [callback] - Необязательный callback для обработки ответа
 */
export function sendActionAfterElementDisappears(
    selector,
    action,
    messageOrFn,
    callback
) {
    // Сначала ждём появления элемента
    waitForElement(selector, () => {
        // Затем ждём исчезновения
        waitForElementToDisappear(selector, () => {
            const message =
                typeof messageOrFn === 'function' ? messageOrFn() : messageOrFn
            sendActionToBackground(action, message, callback)
        })
    })
}

/**
 * Универсальная функция для отправки экшена и сообщения в background script.
 * @param {string} action - Имя экшена
 * @param {any} message - Данные для отправки
 * @param {Function} [callback] - Необязательный callback для обработки ответа
 */
export function sendActionToBackground(action, message, callback) {
    if (
        typeof chrome === 'undefined' ||
        !chrome.runtime ||
        !chrome.runtime.sendMessage
    ) {
        console.error('Chrome runtime API is not available')
        return
    }
    chrome.runtime.sendMessage({ action, message }, (response) => {
        if (chrome.runtime.lastError) {
            console.error(
                `Error sending ${action} message:`,
                chrome.runtime.lastError
            )
        }
        if (typeof callback === 'function') {
            callback(response)
        }
    })
}

export function waitForElement(selector, callback) {
    const observer = new MutationObserver(() => {
        const element = document.querySelector(selector)

        if (element) {
            callback(element)

            // Wait for the element to disappear before continuing
            const checkRemoval = new MutationObserver(() => {
                if (!document.querySelector(selector)) {
                    checkRemoval.disconnect() // Stop observing disappearance
                    observer.observe(document.body, {
                        childList: true,
                        subtree: true,
                    }) // Re-enable observer
                }
            })

            checkRemoval.observe(document.body, {
                childList: true,
                subtree: true,
            })
            observer.disconnect() // Temporarily stop observing until element disappears
        }
    })

    observer.observe(document.body, { childList: true, subtree: true })
}

export function waitElementAndSendChromeMessage(
    selector,
    action,
    actionFunction
) {
    waitForElement(selector, () => {
        if (
            typeof chrome === 'undefined' ||
            !chrome.runtime ||
            !chrome.runtime.sendMessage
        ) {
            console.error('Chrome runtime API is not available')
            return
        }

        try {
            const parsedData = actionFunction()
            sendActionToBackground(action, parsedData, undefined)
        } catch (error) {
            console.error(`Error processing ${action}:`, error)
        }
    })
}

export function parseTable(): string[][] {
    const table = document.querySelector('#Grid table')
    if (!table) return []

    const data: string[][] = []
    table.querySelectorAll<HTMLElement>('tr').forEach((row, rowIndex) => {
        const cells = row.querySelectorAll<HTMLElement>('td, th')
        const rowData: string[] = []
        cells.forEach((cell: HTMLElement) =>
            rowData.push(cell.innerText.trim())
        )
        data.push(rowData)
    })

    return data
}

/**
 * Ожидает исчезновения элемента по селектору, затем вызывает callback.
 * @param {string} selector - CSS-селектор модального окна или любого элемента
 * @param {Function} callback - Функция, вызываемая после исчезновения элемента
 */
export function waitForElementToDisappear(selector, callback) {
    // Если элемент уже отсутствует, сразу вызываем callback
    if (!document.querySelector(selector)) {
        callback()
        return
    }
    const observer = new MutationObserver(() => {
        if (!document.querySelector(selector)) {
            observer.disconnect()
            callback()
        }
    })
    observer.observe(document.body, { childList: true, subtree: true })
}

export function isUserAuthenticated(): Promise<boolean> {
    return new Promise((resolve) => {
        try {
            if (!chrome.runtime || !chrome.runtime.sendMessage) {
                console.warn('[content] Chrome runtime not available')
                return resolve(false)
            }

            // Add timeout to prevent hanging
            const timeout = setTimeout(() => {
                console.warn('[content] isUserAuthenticated timeout')
                resolve(false)
            }, 5000)

            chrome.runtime.sendMessage(
                { action: Actions.IS_AUTHENTICATED },
                (response) => {
                    clearTimeout(timeout)

                    if (chrome.runtime.lastError) {
                        console.warn(
                            '[content] Runtime error:',
                            chrome.runtime.lastError
                        )
                        return resolve(false)
                    }

                    if (!response) {
                        console.warn('[content] No response from background')
                        return resolve(false)
                    }

                    resolve(response.isAuthenticated === true)
                }
            )
        } catch (error) {
            console.warn('[content] Error in isUserAuthenticated:', error)
            resolve(false)
        }
    })
}

export function isAppUnauthorized(): Promise<boolean> {
    return new Promise((resolve) => {
        try {
            if (!chrome.runtime || !chrome.runtime.sendMessage) {
                console.warn('[content] Chrome runtime not available')
                return resolve(false)
            }

            // Add timeout to prevent hanging
            const timeout = setTimeout(() => {
                console.warn('[content] isAppUnauthorized timeout')
                resolve(false)
            }, 5000)

            chrome.runtime.sendMessage(
                { action: Actions.GET_AUTH_STATUS },
                (response) => {
                    clearTimeout(timeout)

                    if (chrome.runtime.lastError) {
                        console.warn(
                            '[content] Runtime error:',
                            chrome.runtime.lastError
                        )
                        return resolve(false)
                    }

                    if (!response) {
                        console.warn('[content] No response from background')
                        return resolve(false)
                    }

                    // Check if login form is present on the page
                    const loginForm = document.querySelector('.loginscreen')
                    const loginButton = document.querySelector('#loginBtn')
                    const hasLoginForm = !!(loginForm || loginButton)

                    // Simple logic: user is unauthorized if login form is present
                    const isUnauthorized = hasLoginForm

                    resolve(isUnauthorized)
                }
            )
        } catch (error) {
            console.warn('[content] Error in isAppUnauthorized:', error)
            resolve(false)
        }
    })
}

export async function tryClickLoginButton() {
    const LOGIN_FORM_SELECTOR = '.loginscreen'
    const LOGIN_BUTTON_SELECTOR = '#loginBtn'

    // Step 1: Focus the form if available
    const form = document.querySelector<HTMLElement>(LOGIN_FORM_SELECTOR)
    if (form) {
        form.focus()
    }

    // Step 2: Try auto-login first
    let autoLoginCredentials: AutoLoginCredentials | null = null

    try {
        autoLoginCredentials = await autoLoginHelper.loadCredentials()
        if (autoLoginCredentials) {
            autoLoginHelper.fillLoginForm(autoLoginCredentials)
        }
    } catch (error) {
        console.warn('[content] Error loading auto-login credentials:', error)
    }

    // Step 3: Find and click login button
    const button = document.querySelector<HTMLButtonElement>(
        LOGIN_BUTTON_SELECTOR
    )
    if (!button) {
        console.warn('[content] Login button not found')
        return
    }

    button.click()

    console.warn('[content] Manual login successful')
    sendActionToBackground(Actions.LOGIN_SUCCESS, { success: true }, null)
}

export function clickLoginButton() {
    const LOGIN_BUTTON_SELECTOR = 'a.product-box[href="/login"]'
    const button = document.querySelector<HTMLButtonElement>(
        LOGIN_BUTTON_SELECTOR
    )
    if (!button) {
        console.warn('[content] Login button not found')
        return
    }

    console.log('[content] Clicking login button...')
    button.click()
}
