import { StatusColorMap } from '../data'
import { consoleLog, sortStatusesByPriority } from '../utils/utils-function'

let lastStatus = ''

export function updateBadge(statuses: string[]) {
    if (!statuses.length) {
        chrome.action.setBadgeText({ text: '' })
        return
    }

    const sortedStatuses = sortStatusesByPriority(statuses)
    const top = sortedStatuses[0]
    if (top === lastStatus) return

    const color = StatusColorMap[top] || '#9E9E9E'
    lastStatus = top
    consoleLog('Updating badge to', top, color)
    chrome.action
        .setBadgeText({ text: '●' })
        .then(() => chrome.action.setBadgeBackgroundColor({ color }))
        .catch(console.error)
}
