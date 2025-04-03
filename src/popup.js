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
        const initialBodyHeight = document.querySelector('body').style.height
        document.body.style.height = '100px'
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
            document.body.style.height = initialBodyHeight
            resolve(false)
        })

        confirmButton.addEventListener('click', () => {
            document.body.removeChild(overlay)
            document.body.style.height = initialBodyHeight
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
        'success', // Highest priority
        'error', // High priority
        'authorization-error', // Medium priority
        'another-task', // Low priority
        'in-progress',
        'paused', // Lowest priority
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
    return sendMessageToBackground('removeRequest', { id: id })
}

async function setStatusRequest(id, status, status_message) {
    return sendMessageToBackground('updateRequestStatus', {
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

        const data = Object.entries(groupedData)
        // clear states on empty grid
        if (!data.length) {
            clearStateGroups()
        }
        // Populate the table with data from the queue
        data.forEach(([tvAppId, items]) => {
            const statusForGroup = sortStatusesByPriority(
                items.map((item) => item.status)
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
        <td class="group-header">${items[0].driverName ? items[0].driverName : 'No driver'}</td>
        <td class="group-header" title="Nr kontenera">${items[0].containerNumber ? items[0].containerNumber : '-'}</td>
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
                        'Na pewno chcesz usunąć całą grupę zadań?'
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
                    deleteGroupStateById(groupHeaderRow.dataset.groupId)
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
