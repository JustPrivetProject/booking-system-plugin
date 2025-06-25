import { Actions } from './data'

console.log('Content script is loaded')

const waitForElement = (selector, callback) => {
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

function waitElementAndSendChromeMessage(selector, action, actionFunction) {
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

function parseTable(): string[][] {
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

waitElementAndSendChromeMessage('#toast-container', Actions.SHOW_ERROR, () => {
    return 'An error occurred!'
})

waitElementAndSendChromeMessage(
    '.swal2-icon-success[role="dialog"]',
    Actions.SUCCEED_BOOKING,
    () => {
        return 'Successful booking found!'
    }
)

waitElementAndSendChromeMessage('#Grid table', Actions.PARSED_TABLE, () => {
    return parseTable()
})

waitForElement('#slotsDisplay', (targetNode) => {
    const enableButtons = () => {
        targetNode.querySelectorAll('button[disabled]').forEach((button) => {
            button.removeAttribute('disabled')
            button.classList.remove('disabled')
            button.style.pointerEvents = 'auto'
        })
    }

    enableButtons()

    const observer = new MutationObserver(enableButtons)
    observer.observe(targetNode, { childList: true, subtree: true })
})

// Reset session counter every 10 minutes
// setInterval(
//     () => {
//         const resetButton = document.querySelector(
//             '[data-ajax-success="resetSessionCounter"]'
//         )
//         if (resetButton) {
//             // @ts-expect-error
//             resetButton.click()
//             console.log('Session counter reset')
//         }
//     },
//     15 * 60 * 1000
// )

/**
 * Ожидает исчезновения элемента по селектору, затем вызывает callback.
 * @param {string} selector - CSS-селектор модального окна или любого элемента
 * @param {Function} callback - Функция, вызываемая после исчезновения элемента
 */
function waitForElementToDisappear(selector, callback) {
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

/**
 * Универсальная функция для отправки экшена и сообщения в background script.
 * @param {string} action - Имя экшена
 * @param {any} message - Данные для отправки
 * @param {Function} [callback] - Необязательный callback для обработки ответа
 */
function sendActionToBackground(action, message, callback) {
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

/**
 * Ждёт появления элемента, затем его исчезновения, и отправляет экшен в background.
 * @param {string} selector - CSS-селектор элемента
 * @param {string} action - Имя экшена для background
 * @param {any|Function} messageOrFn - Данные для отправки или функция, возвращающая данные
 * @param {Function} [callback] - Необязательный callback для обработки ответа
 */
function sendActionAfterElementDisappears(
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

// sendActionAfterElementDisappears(
//     '#vbsBgModal[style="display: block;"]',
//     Actions.PARSED_TABLE,
//     () => parseTable(),
//     undefined
// )

waitElementAndSendChromeMessage(
    '#vbsBgModal[style="display: block;"]',
    Actions.PARSED_TABLE,
    () => parseTable()
)
