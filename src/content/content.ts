import { Actions } from '../data'
import {
    waitElementAndSendChromeMessage,
    parseTable,
    waitForElement,
    isUserAuthenticated,
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
