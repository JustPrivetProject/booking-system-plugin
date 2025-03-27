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

        // Группировка по TvAppId
        const groupedData = retryQueue.reduce((acc, req) => {
            const tvAppId = req.tvAppId;
            if (!acc[tvAppId]) acc[tvAppId] = [];
            acc[tvAppId].push(req);
            return acc;
        }, {});
        console.log(groupedData)

        let tableBody = document.getElementById('queueTableBody')
        tableBody.innerHTML = '' // Clear the table

        // Populate the table with data from the queue
        Object.entries(groupedData).forEach(([tvAppId, items]) => {
        // Добавляем строку-заголовок группы
        const groupRow = document.createElement("tr");
        groupRow.innerHTML = `<td colspan="5" class="group-header">TvAppId: ${tvAppId}, Nr kontenera: ${items[0].containerNumber ? items[0].containerNumber : '-'}</td>`;
        tableBody.appendChild(groupRow);

        items.forEach((req, index) => {
            let containerInfo = normalizeFormData(req.body).formData
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${containerInfo.SlotStart[0].split(' ')[1].slice(0, 5)} - ${containerInfo.SlotEnd[0].split(' ')[1].slice(0, 5)}</td>
                <td class="status ${req.status}" title="${req.status_message}">
                    <span class="status-icon material-icons" style="font-size: 28px;">
                        ${getStatusIcon(req.status)}
                    </span>
                </td>
                <td class="actions">
                    <button class="resume-button" data-index="${index}" title="Wznów" ${isPlayDisabled(req.status)}>
                        <span class="material-icons icon">play_arrow</span>
                    </button>
                    <button class="pause-button" data-index="${index}" title="Wstrzymaj" ${isPauseDisabled(req.status)}>
                        <span class="material-icons icon">pause</span>
                    </button>
                    <button class="remove-button" data-index="${index}" title="Usuń">
                        <span class="material-icons icon">delete</span>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    });

        // Add button handlers
        document.querySelectorAll('.remove-button').forEach((btn) => {
            btn.addEventListener('click', () =>
                removeRequestFromRetryQueue(btn.dataset.index)
            )
        })
        document.querySelectorAll('.pause-button').forEach((btn) => {
            btn.addEventListener('click', () =>
                setStatusRequest(
                    btn.dataset.index,
                    'paused',
                    'Zadanie jest wstrzymane'
                )
            )
        })
        document.querySelectorAll('.resume-button').forEach((btn) => {
            btn.addEventListener('click', () =>
                setStatusRequest(
                    btn.dataset.index,
                    'in-progress',
                    'Zadanie jest w trakcie realizacji'
                )
            )
        })
    } catch (error) {
        console.error('Error updating queue display:', error)
    }
}

async function removeRequestFromRetryQueue(index) {
    try {
        // Get the retry queue from storage
        const { retryQueue } = await new Promise((resolve) =>
            chrome.storage.local.get({ retryQueue: [] }, resolve)
        )

        let req = retryQueue[index]

        if (!req) {
            console.log('Request not found at index:', index)
            return
        }

        // Remove the request from the queue
        retryQueue.splice(index, 1)

        // Update storage after removal
        await new Promise((resolve) =>
            chrome.storage.local.set({ retryQueue: retryQueue }, resolve)
        )

        console.log('Request removed from retry queue:', req.url)
        updateQueueDisplay() // Update the queue display
    } catch (error) {
        console.error('Error removing request from queue:', error)
    }
}

async function setStatusRequest(index, status, status_message) {
    try {
        // Get the retry queue from storage
        const { retryQueue } = await new Promise((resolve) =>
            chrome.storage.local.get({ retryQueue: [] }, resolve)
        )

        let req = retryQueue[index]

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

// Update the queue when the popup is opened
document.addEventListener('DOMContentLoaded', updateQueueDisplay)
