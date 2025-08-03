import { Actions } from '../data'
import {
    waitElementAndSendChromeMessage,
    parseTable,
    waitForElement,
    isUserAuthenticated,
    tryClickLoginButton,
    isAppUnauthorized,
} from './utils/contentUtils'

console.log('[content] Content script is loaded')

// Check if extension is available
if (!chrome.runtime || !chrome.runtime.sendMessage) {
    console.warn(
        '[content] Chrome runtime not available - extension may not be loaded'
    )
} else {
    console.log('[content] Chrome runtime available')
}

// Start authorization check interval
console.log('[content] Starting authorization check interval (60s)')

setInterval(async () => {
    try {
        const isUnauthorized = await isAppUnauthorized()

        if (isUnauthorized) {
            console.warn('[content] Unauthorized — reloading page')
            location.reload()
        }
    } catch (error) {
        console.warn('[content] Error in authorization check:', error)
    }
}, 60_000)

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
    const enableButtons = async () => {
        const isAuth = await isUserAuthenticated()
        if (!isAuth) return
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

// Auto-login on login page
window.addEventListener('load', async () => {
    const isAuth = await isUserAuthenticated()
    if (!isAuth) return

    if (location.pathname === '/login') {
        console.log('[content] Login page detected, trying auto-login...')
        setTimeout(() => {
            tryClickLoginButton()
        }, 1000)
    }
})
