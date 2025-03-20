async function updateQueueDisplay() {
    try {
        // Get the queue from storage
        const { retryQueue } = await new Promise((resolve) =>
            chrome.storage.local.get({ retryQueue: [] }, resolve)
        )

        let table = document.getElementById('queueTable')
        table.innerHTML = '' // Clear the table

        // Populate the table with data from the queue
        retryQueue.forEach((req, index) => {
            let row = document.createElement('tr')
            row.innerHTML = `
        <td>${index + 1}</td>
        <td>${req.url}</td>
        <td><button class="remove-button" data-index="${index}"><span class="material-icons icon">delete</span></button></td>
      `
            table.appendChild(row)
        })

        // Add button handlers
        document.querySelectorAll('.remove-button').forEach((btn) => {
            btn.addEventListener('click', () =>
                removeRequestFromRetryQueue(btn.dataset.index)
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

// Update the queue when the popup is opened
document.addEventListener('DOMContentLoaded', updateQueueDisplay)

document.getElementById('stopRetry').addEventListener('click', () => {
    chrome.storage.local.set({ retryEnabled: false }, () => {
        console.log('Retrying stopped.')
        alert('Retrying stopped.')
    })
})

document.getElementById('startRetry').addEventListener('click', () => {
    chrome.storage.local.set({ retryEnabled: true }, () => {
        console.log('Retrying enabled.')
        alert('Retrying enabled.')
    })
})
