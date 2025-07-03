export function createConfirmationModal(message, withInput = false) {
    return new Promise((resolve) => {
        const initialBodyHeight = document.querySelector('body')!.style.height
        if (withInput) document.body.style.height = '200px'
        else document.body.style.height = '100px'

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

        let inputEl: HTMLTextAreaElement | null = null
        let errorEl: HTMLDivElement | null = null
        if (withInput) {
            inputEl = document.createElement('textarea')
            inputEl.style.width = '100%'
            inputEl.style.minHeight = '60px'
            inputEl.style.marginBottom = '10px'
            inputEl.style.resize = 'vertical'
            inputEl.placeholder = 'Opisz problem...'
            errorEl = document.createElement('div')
            errorEl.style.color = 'red'
            errorEl.style.fontSize = '13px'
            errorEl.style.marginBottom = '10px'
            errorEl.style.display = 'none'
        }

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
            if (withInput && inputEl) {
                const value = inputEl.value.trim()
                if (!value) {
                    if (errorEl) {
                        errorEl.textContent = 'Proszę opisać problem.'
                        errorEl.style.display = 'block'
                    }
                    inputEl.focus()
                    return
                }
                document.body.removeChild(overlay)
                document.body.style.height = initialBodyHeight
                resolve(value)
            } else {
                document.body.removeChild(overlay)
                document.body.style.height = initialBodyHeight
                resolve(true)
            }
        })

        buttonsContainer.appendChild(cancelButton)
        buttonsContainer.appendChild(confirmButton)

        modal.appendChild(messageEl)
        if (inputEl) modal.appendChild(inputEl)
        if (errorEl) modal.appendChild(errorEl)
        modal.appendChild(buttonsContainer)

        overlay.appendChild(modal)
        document.body.appendChild(overlay)
    })
}
