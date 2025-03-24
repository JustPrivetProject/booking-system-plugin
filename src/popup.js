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
    if (status === "in-progress") return "loop";
    if (status === "success") return "check_circle";
    if (status === "another-task") return "check_circle";
    if (status === "paused") return "pause_circle";
    return "report";
  }

async function updateQueueDisplay() {
    try {
        // Get the queue from storage
        const { retryQueue } = await new Promise((resolve) =>
            chrome.storage.local.get({ retryQueue: [] }, resolve)
        )

        let tableBody = document.getElementById('queueTableBody')
        tableBody.innerHTML = '' // Clear the table

        // Populate the table with data from the queue
        retryQueue.forEach((req, index) => {
            let containerInfo = normalizeFormData(req.body).formData
            let row = document.createElement('tr')
            /**
            *   <th>#</th>
                <th>Tv App Id</th>
                <th>Oczekiwany czas</th>
                <th>Stan</th>
                <th>Action</th>
             */
            row.innerHTML = `
        <td>${index + 1}</td>
        <td>${containerInfo.TvAppId[0]}</td>
        <td>${containerInfo.SlotStart[0]}</td>
        <td class="status ${req.status}" title="${req.status_message}"><span class="status-icon material-icons" style="font-size: 36px;">${getStatusIcon(req.status)}</span></td>
        <td class="actions">
            <button class="resume-button" data-index="${index}" title="Wznów">
                <span class="material-icons icon">play_arrow</span>
            </button>
            <button class="pause-button" data-index="${index}" title="Wstrzymaj">
                <span class="material-icons icon">pause</span>
            </button>
            <button class="remove-button" data-index="${index}" title="Usuń">
                <span class="material-icons icon">delete</span>
            </button>
        </td>
      `
            tableBody.appendChild(row)
        })

        // Add button handlers
        document.querySelectorAll('.remove-button').forEach((btn) => {
            btn.addEventListener('click', () =>
                removeRequestFromRetryQueue(btn.dataset.index)
            )
        })
        document.querySelectorAll('.pause-button').forEach((btn) => {
            btn.addEventListener('click', () =>
                setStatusRequest(btn.dataset.index, 'paused', 'Zadanie jest wstrzymane')
            )
        })
        document.querySelectorAll('.resume-button').forEach((btn) => {
            btn.addEventListener('click', () =>
                setStatusRequest(btn.dataset.index, 'in-progress', 'Zadanie jest w trakcie realizacji')
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

        // Remove the request from the queue
        req.status = status,
        req.status_message = status_message,

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

// Update the queue when the popup is opened
document.addEventListener('DOMContentLoaded', updateQueueDisplay)
