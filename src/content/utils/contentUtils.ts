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
