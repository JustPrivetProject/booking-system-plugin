import { Actions } from '../data'
import { showSessionExpireModal } from './modals/sessionExpireModal'
import {
    waitElementAndSendChromeMessage,
    parseTable,
    waitForElement,
} from './utils/contentUtils'

console.log('Content script is loaded')

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

waitElementAndSendChromeMessage(
    '#vbsBgModal[style="display: block;"]',
    Actions.PARSED_TABLE,
    () => parseTable()
)

// ===== Session Timer Modal Logic =====

let modalShown = false // Сделать на уровне модуля

function monitorSessionTimer() {
    const timerSpan = document.getElementById('sessionTime')
    if (!timerSpan) return

    let lastValue = timerSpan.textContent
    setInterval(() => {
        const value = timerSpan.textContent
        if (value && value !== lastValue) {
            lastValue = value

            const [minStr, secStr] = value.split(':')
            const min = Number(minStr)
            const sec = Number(secStr)
            if (
                !modalShown &&
                !isNaN(min) &&
                !isNaN(sec) &&
                (min < 5 || (min === 5 && sec === 0))
            ) {
                modalShown = true
                showSessionExpireModal({
                    onModalClosed: () => {
                        modalShown = true // Не показывать больше до перезагрузки
                    },
                })
            }
        }
    }, 1000)
}

waitForElement('#sessionTime', monitorSessionTimer)
