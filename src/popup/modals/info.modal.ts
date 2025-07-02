export function showInfoModal(message: string): Promise<void> {
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

        const closeButton = document.createElement('button')
        closeButton.textContent = 'Zamknij'
        closeButton.style.padding = '10px 20px'
        closeButton.style.backgroundColor = '#1976d2'
        closeButton.style.color = 'white'
        closeButton.style.border = 'none'
        closeButton.style.borderRadius = '4px'

        closeButton.addEventListener('click', () => {
            document.body.removeChild(overlay)
            document.body.style.height = initialBodyHeight
            resolve()
        })

        modal.appendChild(messageEl)
        modal.appendChild(closeButton)
        overlay.appendChild(modal)
        document.body.appendChild(overlay)
    })
}
