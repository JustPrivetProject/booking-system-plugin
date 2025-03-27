function normalizeFormData(formData) {
    const result = {}

    for (const key in formData) {
        // If it's an array with only one item, use that item directly
        if (Array.isArray(formData[key]) && formData[key].length === 1) {
            result[key] = formData[key][0]
        } else {
            result[key] = formData[key]
        }
    }

    return result
}

function createConfirmationModal(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div')
        overlay.style.position = 'fixed'
        overlay.style.top = '0'
        overlay.style.left = '0'
        overlay.style.width = '100%'
        overlay.style.height = '100%'
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
        overlay.style.display = 'flex'
        overlay.style.justifyContent = 'center'
        overlay.style.alignItems = 'center'
        overlay.style.zIndex = '1000'

        const modal = document.createElement('div')
        modal.style.backgroundColor = 'white'
        modal.style.padding = '20px'
        modal.style.borderRadius = '8px'
        modal.style.textAlign = 'center'
        modal.style.maxWidth = '400px'
        modal.style.width = '90%'

        const messageEl = document.createElement('p')
        messageEl.textContent = message
        messageEl.style.marginBottom = '20px'

        const buttonsContainer = document.createElement('div')
        buttonsContainer.style.display = 'flex'
        buttonsContainer.style.justifyContent = 'center'
        buttonsContainer.style.gap = '10px'

        const cancelButton = document.createElement('button')
        cancelButton.textContent = 'Anuluj'
        cancelButton.style.padding = '10px 20px'
        cancelButton.style.backgroundColor = '#f0f0f0'
        cancelButton.style.border = 'none'
        cancelButton.style.borderRadius = '4px'

        const confirmButton = document.createElement('button')
        confirmButton.textContent = 'Potwierdź'
        confirmButton.style.padding = '10px 20px'
        confirmButton.style.backgroundColor = '#ff4d4d'
        confirmButton.style.color = 'white'
        confirmButton.style.border = 'none'
        confirmButton.style.borderRadius = '4px'

        cancelButton.addEventListener('click', () => {
            document.body.removeChild(overlay)
            resolve(false)
        })

        confirmButton.addEventListener('click', () => {
            document.body.removeChild(overlay)
            resolve(true)
        })

        buttonsContainer.appendChild(cancelButton)
        buttonsContainer.appendChild(confirmButton)

        modal.appendChild(messageEl)
        modal.appendChild(buttonsContainer)

        overlay.appendChild(modal)
        document.body.appendChild(overlay)
    })
}

function sortStatusesByPriority(statuses) {
    // Define the priority of statuses from the most critical to the least critical
    const priorityOrder = [
        'success', // Highest priority (critical error)
        'error', // High priority (paused tasks)
        'authorization-error', // Medium priority (tasks in progress)
        'another-task', // Low priority
        'in-progress',
        'paused', // Lowest priority (completed tasks)
    ]

    // Sort statuses according to the defined priority order
    return statuses.sort((a, b) => {
        const priorityA = priorityOrder.indexOf(a)
        const priorityB = priorityOrder.indexOf(b)

        // If the status is not found in the priority list, place it at the end
        return priorityA - priorityB
    })
}

async function removeRequestFromRetryQueue(id) {
    try {
        const { retryQueue } = await new Promise((resolve) =>
            chrome.storage.local.get({ retryQueue: [] }, resolve)
        )

        const index = retryQueue.findIndex((req) => req.id === id)

        if (index === -1) {
            console.log('Request not found:', tvAppId, slotStart)
            return
        }

        let req = retryQueue.splice(index, 1)[0]

        await new Promise((resolve) =>
            chrome.storage.local.set({ retryQueue: retryQueue }, resolve)
        )

        console.log('Request removed:', req.url)
        updateQueueDisplay()
    } catch (error) {
        console.error('Error removing request:', error)
    }
}

async function setStatusRequest(id, status, status_message) {
    try {
        // Get the retry queue from storage
        const { retryQueue } = await new Promise((resolve) =>
            chrome.storage.local.get({ retryQueue: [] }, resolve)
        )

        let req = retryQueue.find((req) => req.id === id)

        if (!req) {
            console.log('Request not found at index:', index)
            return
        }

        req.status = status
        req.status_message = status_message
        // Update storage after updated status
        await new Promise((resolve) =>
            chrome.storage.local.set({ retryQueue: retryQueue }, resolve)
        )

        console.log('Request was updated new status:', status)
        updateQueueDisplay() // Update the queue display
    } catch (error) {
        console.error('Error removing request from queue:', error)
    }
}

async function restoreGroupStates() {
    try {
        const { groupStates = {} } =
            await chrome.storage.local.get('groupStates')

        document
            .querySelectorAll('.group-header.toggle-cell')
            .forEach((header) => {
                const groupRow = header.closest('.group-row')
                if (!groupRow) return

                const groupId = groupRow.dataset.groupId
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
                    nextRow.style.display = isOpen ? 'table-row' : 'none'
                    nextRow = nextRow.nextElementSibling
                }
            })
    } catch (error) {
        console.error('Error restoring group states:', error)
    }
}

// set up google icons
function getStatusIcon(status) {
    if (status === 'in-progress') return 'loop'
    if (status === 'success') return 'check_circle'
    if (status === 'another-task') return 'check_circle'
    if (status === 'paused') return 'pause_circle'
    if (status === 'authorization-error') return 'report'
    return 'report'
}

function isDisabled(status) {
    if (status === 'another-task') return 'disabled'
    if (status === 'success') return 'disabled'
    if (status === 'error') return 'disabled'
    return ''
}

function isPlayDisabled(status) {
    if (status === 'in-progress') return 'disabled'
    return isDisabled(status)
}

function isPauseDisabled(status) {
    if (status === 'paused') return 'disabled'
    if (status === 'authorization-error') return 'disabled'
    return isDisabled(status)
}

async function updateQueueDisplay() {
    try {
        // Get the queue from storage
        const { retryQueue } = await new Promise((resolve) =>
            chrome.storage.local.get({ retryQueue: [] }, resolve)
        )

        // Grouping by TvAppId
        const groupedData = retryQueue.reduce((acc, req) => {
            const tvAppId = req.tvAppId
            if (!acc[tvAppId]) acc[tvAppId] = []
            acc[tvAppId].push(req)
            return acc
        }, {})

        let tableBody = document.getElementById('queueTableBody')
        tableBody.innerHTML = '' // Clear the table

        // Populate the table with data from the queue
        Object.entries(groupedData).forEach(([tvAppId, items]) => {
            const statusForGroup = sortStatusesByPriority(
                items.map((item) => item.status)
            )[0]
            const statusIconForGroup = getStatusIcon(statusForGroup)
            const groupRow = document.createElement('tr')
            groupRow.dataset.groupId = tvAppId
            groupRow.classList.add('group-row')
            groupRow.innerHTML = `
        <td class="group-header toggle-cell"><span class="toggle-icon material-icons">expand_more</span></td>
        <td class="group-header" title="Nr kontenera">
        ${items[0].containerNumber ? items[0].containerNumber : '-'}
        </td>
        <td class="group-header ${statusForGroup}" title="Group Status">
                    <span class="status-icon material-icons" style="font-size: 28px;">
                        ${statusIconForGroup}
                    </span></td>
        <td class="group-header actions">
            <button class="group-remove-button remove-button" title="Usuń grupę">
                <span class="material-icons">delete</span>
            </button>
        </td>`
            tableBody.appendChild(groupRow)

            items.forEach((req, index) => {
                let containerInfo = normalizeFormData(req.body).formData
                const row = document.createElement('tr')
                row.innerHTML = `
                <td></td>
                <td>${containerInfo.SlotStart[0].split(' ')[1].slice(0, 5)} - ${containerInfo.SlotEnd[0].split(' ')[1].slice(0, 5)}</td>
                <td class="status ${req.status}" title="${req.status_message}">
                    <span class="status-icon material-icons" style="font-size: 28px;">
                        ${getStatusIcon(req.status)}
                    </span>
                </td>
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

        restoreGroupStates()

        // Add button handlers
        document
            .querySelectorAll('.remove-button:not(.group-remove-button)')
            .forEach((btn) => {
                btn.addEventListener('click', () =>
                    removeRequestFromRetryQueue(btn.dataset.id)
                )
            })
        document.querySelectorAll('.pause-button').forEach((btn) => {
            btn.addEventListener('click', () =>
                setStatusRequest(
                    btn.dataset.id,
                    'paused',
                    'Zadanie jest wstrzymane'
                )
            )
        })
        document.querySelectorAll('.resume-button').forEach((btn) => {
            btn.addEventListener('click', () =>
                setStatusRequest(
                    btn.dataset.id,
                    'in-progress',
                    'Zadanie jest w trakcie realizacji'
                )
            )
        })
        document
            .querySelectorAll('.group-header.toggle-cell')
            .forEach((header) => {
                header.addEventListener('click', async function () {
                    const groupRow = this.closest('.group-row')
                    if (!groupRow) return

                    const groupId = groupRow.dataset.groupId
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
                    let nextRow = groupRow.nextElementSibling
                    while (nextRow && !nextRow.querySelector('.group-header')) {
                        nextRow.style.display = isCurrentlyOpen
                            ? 'none'
                            : 'table-row'
                        nextRow = nextRow.nextElementSibling
                    }
                    groupRow.dataset.isOpen = !isCurrentlyOpen
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
            .querySelectorAll('.group-row .group-remove-button')
            .forEach((removeButton) => {
                removeButton.addEventListener('click', async function (event) {
                    event.stopPropagation()

                    const confirmed = await createConfirmationModal(
                        'Czy na pewno chcesz usunąć tę grupę?'
                    )

                    if (!confirmed) return

                    const groupHeaderRow = this.closest('.group-row')
                    if (!groupHeaderRow) return
                    const idsToDelete = []

                    let nextRow = groupHeaderRow.nextElementSibling
                    while (
                        nextRow &&
                        !nextRow.classList.contains('group-row')
                    ) {
                        const removeBtn =
                            nextRow.querySelector('.remove-button')
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
                })
            })
    } catch (error) {
        console.error('Error updating queue display:', error)
    }
}

// Update the queue when the popup is opened
document.addEventListener('DOMContentLoaded', () => {
    restoreGroupStates()
    updateQueueDisplay()
})
