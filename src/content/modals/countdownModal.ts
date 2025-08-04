import { clickLoginButton } from '../utils/contentUtils'

export async function showCountdownModal() {
    if (document.getElementById('countdown-modal')) return
    const countdownSeconds = 60

    const modal = document.createElement('div')
    modal.id = 'countdown-modal'
    modal.style = `position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;`

    // Содержимое модального окна
    modal.innerHTML = `
      <div id="modal-content" style="
        background: var(--color-white, #fff);
        padding: var(--spacing-large, 24px) var(--spacing-large, 24px);
        border-radius: var(--border-radius, 8px);
        text-align: center;
        min-width: 320px;
        box-shadow: var(--shadow-card, 0 4px 10px rgba(0,0,0,0.1));
        font-family: Arial, sans-serif;
        color: var(--color-primary, #00aacc);
        max-width: 90vw;
      ">
        <h2 style='margin-bottom: var(--spacing-medium, 12px); font-size: var(--font-size-large, 18px); color: var(--color-primary, #00aacc);'>Automatyczne logowanie</h2>
        <p id="modal-desc" style='margin-bottom: var(--spacing-large, 24px); color: var(--color-text-light, #888); font-size: var(--font-size-medium, 14px);'>Kliknięcie przycisku logowania za <span id="modal-timer" style="font-weight:bold; color:var(--color-primary,#00aacc);">${countdownSeconds}</span> sekund</p>
        <div id="modal-btns" style="display:flex;gap:var(--spacing-medium,12px);justify-content:center;">
          <button id="login-now" style='
            padding: var(--spacing-medium, 12px) var(--spacing-large, 24px);
            background: var(--color-primary, #00aacc);
            color: var(--color-white, #fff);
            border: none;
            border-radius: 4px;
            font-size: var(--font-size-medium, 14px);
            box-shadow: var(--shadow-button, 0 0 2px rgba(0,0,0,0.2));
            cursor: pointer;
            transition: background 0.2s;
          '>Zaloguj teraz</button>
          <button id="cancel-login" style='
            padding: var(--spacing-medium, 12px) var(--spacing-large, 24px);
            background: var(--color-background-light, #f9f9f9ec);
            color: var(--color-primary, #00aacc);
            border: 1px solid var(--color-border-light, #ccc);
            border-radius: 4px;
            font-size: var(--font-size-medium, 14px);
            box-shadow: var(--shadow-button, 0 0 2px rgba(0,0,0,0.2));
            cursor: pointer;
            transition: background 0.2s;
          '>Anuluj</button>
        </div>
      </div>
    `
    document.body.appendChild(modal)

    let countdown = countdownSeconds
    let interval: number | undefined = undefined

    const timerSpan = document.getElementById('modal-timer')
    const desc = document.getElementById('modal-desc')
    const btns = document.getElementById('modal-btns')
    const loginNowBtn = document.getElementById('login-now')
    const cancelLoginBtn = document.getElementById('cancel-login')

    function closeModal() {
        const modal = document.getElementById('countdown-modal')
        if (modal) modal.remove()
    }

    function startCountdown() {
        countdown = countdownSeconds
        if (timerSpan) timerSpan.textContent = countdown.toString()
        if (desc)
            desc.innerHTML = `Kliknięcie przycisku logowania za <span id="modal-timer" style="font-weight:bold; color:var(--color-primary,#00aacc);">${countdown}</span> sekund`
        if (btns) btns.style.display = 'flex'

        if (interval !== undefined) clearInterval(interval)
        interval = window.setInterval(() => {
            countdown--
            const timerEl = document.getElementById('modal-timer')
            if (timerEl) timerEl.textContent = countdown.toString()
            if (countdown <= 0) {
                if (interval !== undefined) clearInterval(interval)
                closeModal()
                clickLoginButton()
            }
        }, 1000)
    }

    if (loginNowBtn)
        loginNowBtn.onclick = () => {
            if (interval !== undefined) clearInterval(interval)
            closeModal()
            clickLoginButton()
        }
    if (cancelLoginBtn)
        cancelLoginBtn.onclick = () => {
            if (interval !== undefined) clearInterval(interval)
            closeModal()
        }

    startCountdown()
}
