export function createConfirmationModal(message) {
    return new Promise((resolve) => {
        const initialBodyHeight = document.querySelector('body')!.style.height
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
