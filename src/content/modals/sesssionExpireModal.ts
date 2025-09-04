import { isUserAuthenticated } from '../utils/contentUtils';

export async function showSessionExpireModal(opts?: { onModalClosed?: () => void }) {
    const isAuth = await isUserAuthenticated();
    if (!isAuth) return;
    if (document.getElementById('session-expire-modal')) return; // Уже показано

    const modal = document.createElement('div');
    modal.id = 'session-expire-modal';
    modal.style =
        'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
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
        <h2 style='margin-bottom: var(--spacing-medium, 12px); font-size: var(--font-size-large, 18px); color: var(--color-primary, #00aacc);'>Twoja sesja wkrótce wygaśnie!</h2>
        <p id="modal-desc" style='margin-bottom: var(--spacing-large, 24px); color: var(--color-text-light, #888); font-size: var(--font-size-medium, 14px);'>Strona zostanie odświeżona za <span id="modal-timer" style="font-weight:bold; color:var(--color-error,#ff0000);">60</span> sekund</p>
        <div id="modal-btns" style="display:flex;gap:var(--spacing-medium,12px);justify-content:center;">
          <button id="reload-now" style='
            padding: var(--spacing-medium, 12px) var(--spacing-large, 24px);
            background: var(--color-primary, #00aacc);
            color: var(--color-white, #fff);
            border: none;
            border-radius: 4px;
            font-size: var(--font-size-medium, 14px);
            box-shadow: var(--shadow-button, 0 0 2px rgba(0,0,0,0.2));
            cursor: pointer;
            transition: background 0.2s;
          '>Odśwież teraz</button>
          <button id="cancel-reload" style='
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
    `;
    document.body.appendChild(modal);

    let countdown = 60;
    let interval: number | undefined = undefined;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let waitingForMinute = false;
    let isModalClosed = false; // Flag to prevent multiple actions

    const timerSpan = document.getElementById('modal-timer');
    const desc = document.getElementById('modal-desc');
    const btns = document.getElementById('modal-btns');
    const reloadNowBtn = document.getElementById('reload-now');
    const cancelReloadBtn = document.getElementById('cancel-reload');

    function closeModal() {
        if (isModalClosed) return; // Prevent multiple closures
        isModalClosed = true;

        if (interval !== undefined) {
            clearInterval(interval);
            interval = undefined;
        }

        const modal = document.getElementById('session-expire-modal');
        if (modal) modal.remove();
        if (opts && typeof opts.onModalClosed === 'function') opts.onModalClosed();
    }

    function startCountdown() {
        countdown = 60;
        if (timerSpan) timerSpan.textContent = countdown.toString();
        if (desc)
            desc.innerHTML =
                'Strona zostanie odświeżona za <span id="modal-timer" style="font-weight:bold; color:var(--color-error,#ff0000);">60</span> sekund';
        if (btns) btns.style.display = 'flex';
        waitingForMinute = false;
        if (interval !== undefined) clearInterval(interval);
        interval = window.setInterval(() => {
            countdown--;
            const timerEl = document.getElementById('modal-timer');
            if (timerEl) timerEl.textContent = countdown.toString();
            if (countdown <= 0) {
                if (!isModalClosed) {
                    window.location.reload();
                    closeModal();
                }
            }
        }, 1000);
    }

    function waitForOneMinute() {
        if (isModalClosed) return; // Don't start waiting if modal is already closed

        if (interval !== undefined) clearInterval(interval);
        if (btns) btns.style.display = 'none';
        if (desc) {
            desc.innerHTML =
                'Odświeżenie strony zostanie wykonane za <span id="modal-timer" style="font-weight:bold; color:var(--color-error,#ff0000);">60</span> sekund.<br><button id="close-modal-btn" style="margin-top:18px;padding:8px 24px;border-radius:4px;background:var(--color-primary,#00aacc);color:#fff;border:none;cursor:pointer;">Zamknij</button>';
        }
        waitingForMinute = true;

        // Кнопка закрытия
        const closeBtn = document.getElementById('close-modal-btn') as HTMLButtonElement | null;
        const autoCloseTimeout: number | undefined = window.setTimeout(() => {
            if (!isModalClosed) {
                closeModal();
            }
        }, 5000);
        if (closeBtn) {
            closeBtn.onclick = () => {
                if (autoCloseTimeout !== undefined) clearTimeout(autoCloseTimeout);
                if (!isModalClosed) {
                    closeModal();
                }
            };
        }

        // Обратный отсчет 60 секунд
        let countdown = 60;
        const reloadInterval: number | undefined = window.setInterval(() => {
            if (isModalClosed) {
                if (reloadInterval !== undefined) clearInterval(reloadInterval);
                if (autoCloseTimeout !== undefined) clearTimeout(autoCloseTimeout);
                return;
            }

            countdown--;
            const timerEl = document.getElementById('modal-timer');
            if (timerEl) timerEl.textContent = countdown.toString();
            if (countdown <= 0) {
                if (reloadInterval !== undefined) clearInterval(reloadInterval);
                if (autoCloseTimeout !== undefined) clearTimeout(autoCloseTimeout);
                window.location.reload();
                closeModal();
            }
        }, 1000);
    }

    if (reloadNowBtn)
        reloadNowBtn.onclick = () => {
            if (isModalClosed) return; // Prevent multiple clicks
            window.location.reload();
            closeModal();
        };
    if (cancelReloadBtn)
        cancelReloadBtn.onclick = () => {
            if (isModalClosed) return; // Prevent multiple clicks
            waitForOneMinute();
        };

    startCountdown();
}
