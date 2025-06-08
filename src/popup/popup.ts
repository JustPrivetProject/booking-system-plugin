import './popup.css'
import { normalizeFormData } from '../utils/utils-function'
import { createConfirmationModal } from './modals/confirmation.modal'
import { Statuses, Actions } from '../data'
import { RetryObjectArray } from '../types/baltichub'

function sortStatusesByPriority(statuses) {
    // Define the priority of statuses from the most critical to the least critical
    const priorityOrder = [
        Statuses.SUCCESS, // Highest priority
        Statuses.ERROR, // High priority
        Statuses.AUTHORIZATION_ERROR, // Medium priority
        Statuses.ANOTHER_TASK, // Low priority
        Statuses.IN_PROGRESS, // In progress
        Statuses.PAUSED, // Lowest priority
    ]

    // Sort statuses according to the defined priority order
    return statuses.sort((a, b) => {
        const priorityA = priorityOrder.indexOf(a)
        const priorityB = priorityOrder.indexOf(b)

        // If the status is not found in the priority list, place it at the end
        return priorityA - priorityB
    })
}

function sendMessageToBackground(action, data) {
    chrome.runtime.sendMessage(
        {
            target: 'background',
            action: action,
            data: data,
        },
        (response) => {
            if (chrome.runtime.lastError) {
                console.error(
                    'Error sending message:',
                    chrome.runtime.lastError
                )
                return
            }

            // Обработка ответа от background.js
            if (response && response.success) {
                console.log(`Action ${action} completed successfully`)
                updateQueueDisplay() // Обновление отображения очереди
            } else {
                console.error(`Action ${action} failed`)
            }
        }
    )
}

async function removeRequestFromRetryQueue(id) {
    return sendMessageToBackground(Actions.REMOVE_REQUEST, { id: id })
}

async function setStatusRequest(id, status, status_message) {
    return sendMessageToBackground(Actions.UPDATE_REQUEST_STATUS, {
        id: id,
        status: status,
        status_message: status_message,
    })
}

async function restoreGroupStates() {
    try {
        const { groupStates = {} } =
            await chrome.storage.local.get('groupStates')

        document
            .querySelectorAll<HTMLElement>('.group-header.toggle-cell')
            .forEach((header) => {
                const groupRow: HTMLElement = header.closest('.group-row')!
                if (!groupRow) return

                const groupId = groupRow.dataset.groupId!
                const isOpen = groupStates[groupId] || false
                groupRow.dataset.isOpen = isOpen
                // Update header state
                header.classList.toggle('open', isOpen)
                const toggleIcon = header.querySelector('.toggle-icon')
                if (toggleIcon) {
                    toggleIcon.textContent = isOpen
                        ? 'expand_less'
                        : 'expand_more'
                }

                // Toggle visibility of child rows
                let nextRow = groupRow.nextElementSibling
                while (
                    nextRow &&
                    !nextRow.querySelector('.group-header.toggle-cell')
                ) {
                    ;(nextRow as HTMLElement).style.display = isOpen
                        ? 'table-row'
                        : 'none'
                    nextRow = nextRow.nextElementSibling
                }
            })
    } catch (error) {
        console.error('Error restoring group states:', error)
    }
}

/**
 * Delete a group state by ID from Chrome storage
 * @param {string|number} groupId - The ID of the group state to delete
 * @returns {Promise<Object>} - The updated group states object
 */
async function deleteGroupStateById(groupId) {
    // Get current groupStates from storage
    const { groupStates = {} } = await chrome.storage.local.get('groupStates')

    // Delete the specified group ID if it exists
    if (groupId in groupStates) {
        delete groupStates[groupId]

        // Save the updated groupStates back to storage
        await chrome.storage.local.set({ groupStates })
        console.log(`Group state with ID ${groupId} was deleted`)
    } else {
        console.log(`Group state with ID ${groupId} does not exist`)
    }

    return groupStates
}

async function clearStateGroups() {
    // Get current groupStates from storage
    const { groupStates = {} } = await chrome.storage.local.get('groupStates')

    if (!!Object.entries(groupStates).length) {
        await chrome.storage.local.set({ groupStates: {} })
        console.log(`Group state was cleared`)
    }

    return groupStates
}

// set up google icons
function getStatusIcon(status) {
    if (status === Statuses.IN_PROGRESS) return 'loop'
    if (status === Statuses.SUCCESS) return 'check_circle'
    if (status === Statuses.ANOTHER_TASK) return 'check_circle'
    if (status === Statuses.PAUSED) return 'pause_circle'
    if (status === Statuses.AUTHORIZATION_ERROR) return 'report'
    return 'report'
}

function isDisabled(status) {
    if (
        status === Statuses.ANOTHER_TASK ||
        status === Statuses.SUCCESS ||
        status === Statuses.ERROR
    )
        return 'disabled'
    return ''
}

function isPlayDisabled(status) {
    if (status === Statuses.IN_PROGRESS) return 'disabled'
    return isDisabled(status)
}

function isPauseDisabled(status) {
    if (status === Statuses.PAUSED || status === Statuses.AUTHORIZATION_ERROR)
        return 'disabled'
    return isDisabled(status)
}

async function updateQueueDisplay() {
    try {
        // Get the queue from storage
        const { retryQueue } = await new Promise<{
            retryQueue: RetryObjectArray
        }>((resolve) => chrome.storage.local.get({ retryQueue: [] }, resolve))

        // Grouping by TvAppId
        const groupedData = retryQueue.reduce(
            (acc: Record<string, RetryObjectArray>, req) => {
                const tvAppId = req.tvAppId
                if (!acc[tvAppId]) acc[tvAppId] = []
                acc[tvAppId].push(req)
                return acc
            },
            {}
        )

        let tableBody = document.getElementById('queueTableBody')!
        tableBody.innerHTML = '' // Clear the table

        const data = Object.entries(groupedData) as [string, RetryObjectArray][]
        // clear states on empty grid
        if (!data.length) {
            clearStateGroups()
        }
        // Populate the table with data from the queue
        data.forEach(([tvAppId, items]) => {
            const statusForGroup = sortStatusesByPriority(
                items.map((item: RetryObjectArray[0]) => item.status)
            )[0]
            const statusIconForGroup = getStatusIcon(statusForGroup)
            const groupRow = document.createElement('tr')
            groupRow.dataset.groupId = tvAppId
            groupRow.classList.add('group-row')
            groupRow.innerHTML = `
        <td class="group-header toggle-cell"><span class="toggle-icon material-icons">expand_more</span></td>
        <td class="group-header status ${statusForGroup}" title="Status kontenera">
                    <span class="status-icon material-icons" style="font-size: 28px;">
                        ${statusIconForGroup}
                    </span></td>
        <td class="group-header">${items[0].driverName ? items[0].driverName : 'Brak nazwy kierowcy'}</td>
        <td class="group-header" title="Nr kontenera">${items[0].containerNumber ? items[0].containerNumber : '-'}</td>
        <td class="group-header actions">
            <button class="group-remove-button remove-button" title="Usuń grupę">
                <span class="material-icons">delete</span>
            </button>
        </td>`
            tableBody.appendChild(groupRow)

            items.forEach((req: RetryObjectArray[0]) => {
                let containerInfo = normalizeFormData(req.body).formData
                const row = document.createElement('tr')
                row.innerHTML = `
                <td></td>
                <td class="status ${req.status}" title="${req.status_message}">
                    <span class="status-icon material-icons" style="font-size: 28px;">
                        ${getStatusIcon(req.status)}
                    </span>
                </td>
                <td>${containerInfo.SlotStart[0].split(' ')[0]}</td>
                <td>${containerInfo.SlotStart[0].split(' ')[1].slice(0, 5)} - ${containerInfo.SlotEnd[0].split(' ')[1].slice(0, 5)}</td>
                <td class="actions">
                    <button class="resume-button" data-id="${req.id}" title="Wznów" ${isPlayDisabled(req.status)}>
                        <span class="material-icons icon">play_arrow</span>
                    </button>
                    <button class="pause-button" data-id="${req.id}" title="Wstrzymaj" ${isPauseDisabled(req.status)}>
                        <span class="material-icons icon">pause</span>
                    </button>
                    <button class="remove-button" data-id="${req.id}" title="Usuń">
                        <span class="material-icons icon">delete</span>
                    </button>
                </td>
            `
                tableBody.appendChild(row)
            })
        })
        // Spellcheck suppression for Polish words
        // kontenera, Brak, nazwy, kierowcy, Usuń, grupę, Wznów, Wstrzymaj

        restoreGroupStates()

        // Add button handlers
        document
            .querySelectorAll<HTMLElement>(
                '.remove-button:not(.group-remove-button)'
            )
            .forEach((btn) => {
                btn.addEventListener('click', () =>
                    removeRequestFromRetryQueue(btn.dataset.id)
                )
            })
        document
            .querySelectorAll<HTMLElement>('.pause-button')
            .forEach((btn) => {
                btn.addEventListener('click', () =>
                    setStatusRequest(
                        btn.dataset.id,
                        'paused',
                        'Zadanie jest wstrzymane'
                    )
                )
            })
        document
            .querySelectorAll<HTMLElement>('.resume-button')
            .forEach((btn) => {
                btn.addEventListener('click', () =>
                    setStatusRequest(
                        btn.dataset.id,
                        'in-progress',
                        'Zadanie jest w trakcie realizacji'
                    )
                )
            })
        document
            .querySelectorAll<HTMLElement>('.group-header.toggle-cell')
            .forEach((header) => {
                header.addEventListener('click', async function () {
                    const groupRow = this.closest<HTMLElement>('.group-row')
                    if (!groupRow) return

                    const groupId = groupRow.dataset.groupId!
                    const toggleIcon = this.querySelector('.toggle-icon')

                    // Toggle open state
                    const isCurrentlyOpen = this.classList.contains('open')
                    this.classList.toggle('open')

                    if (toggleIcon) {
                        toggleIcon.textContent = isCurrentlyOpen
                            ? 'expand_more'
                            : 'expand_less'
                    }

                    // Toggle child rows visibility
                    let nextRow = groupRow.nextElementSibling as HTMLElement
                    while (
                        nextRow &&
                        !nextRow.querySelector<HTMLElement>('.group-header')
                    ) {
                        nextRow.style.display = isCurrentlyOpen
                            ? 'none'
                            : 'table-row'
                        nextRow = nextRow.nextElementSibling as HTMLElement
                    }
                    groupRow.dataset.isOpen = (!isCurrentlyOpen).toString()
                    // Save group state
                    try {
                        const { groupStates = {} } =
                            await chrome.storage.local.get('groupStates')
                        groupStates[groupId] = !isCurrentlyOpen
                        await chrome.storage.local.set({ groupStates })
                    } catch (error) {
                        console.error('Error saving group state:', error)
                    }
                })
            })
        document
            .querySelectorAll<HTMLElement>('.group-row .group-remove-button')
            .forEach((removeButton) => {
                removeButton.addEventListener('click', async function (event) {
                    event.stopPropagation()

                    const confirmed = await createConfirmationModal(
                        'Na pewno chcesz usunąć całą grupę zadań?'
                    )

                    if (!confirmed) return

                    const groupHeaderRow =
                        this.closest<HTMLElement>('.group-row')
                    if (!groupHeaderRow) return
                    const idsToDelete: string[] = []

                    let nextRow = groupHeaderRow.nextElementSibling
                    while (
                        nextRow &&
                        !nextRow.classList.contains('group-row')
                    ) {
                        const removeBtn =
                            nextRow.querySelector<HTMLElement>('.remove-button')
                        if (removeBtn?.dataset?.id) {
                            idsToDelete.push(removeBtn.dataset.id)
                        }
                        nextRow = nextRow.nextElementSibling
                    }

                    for (const id of idsToDelete) {
                        await removeRequestFromRetryQueue(id)
                    }

                    idsToDelete.forEach((id) => {
                        const row = document
                            .querySelector(`.remove-button[data-id="${id}"]`)
                            ?.closest('tr')
                        if (row) row.remove()
                    })

                    groupHeaderRow.remove()
                    deleteGroupStateById(groupHeaderRow.dataset.groupId)
                })
            })
    } catch (error) {
        console.error('Error updating queue display:', error)
    }
}

// Listen for storage changes and update UI when retryQueue changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.retryQueue) {
        console.log('Queue data changed, updating UI')
        updateQueueDisplay()
    }
})

// Update the queue when the popup is opened
document.addEventListener('DOMContentLoaded', () => {
    restoreGroupStates()
    updateQueueDisplay()
})
