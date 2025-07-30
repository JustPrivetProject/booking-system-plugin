import { StatusIconMap } from '../data'
import { consoleLog, sortStatusesByPriority } from './utils-function'

let lastStatus = ''

export function updateBadge(statuses: string[]) {
    if (!statuses.length) {
        chrome.action.setBadgeText({ text: '' })
        return
    }

    const sortedStatuses = sortStatusesByPriority(statuses)
    const top = sortedStatuses[0]
    if (top === lastStatus && lastStatus != '') return

    lastStatus = top
    const icon = StatusIconMap[lastStatus]
    consoleLog('Updating badge to', top, icon)
    chrome.action
        .setBadgeText({ text: icon })
        // .then(() => chrome.action.setBadgeBackgroundColor({ color }))
        .catch(console.error)
}

export function clearBadge() {
    if (lastStatus === '') return
    consoleLog('Clearing badge')
    lastStatus = ''
    chrome.action.setBadgeText({ text: lastStatus })
}
