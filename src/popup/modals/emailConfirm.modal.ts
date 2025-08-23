export function showEmailConfirmationModal(email: string, onClose?: () => void) {
    // Сохраняем и увеличиваем высоту body
    const initialBodyHeight = document.body.style.height;
    document.body.style.height = '180px';

    let confirmMsg = document.getElementById('emailConfirmMsg');
    if (!confirmMsg) {
        confirmMsg = document.createElement('div');
        confirmMsg.id = 'emailConfirmMsg';
        confirmMsg.className = 'email-confirm-message';
        document.body.appendChild(confirmMsg);
    }

    confirmMsg.innerHTML = `
        <div class="confirm-content">
            <div style="font-size: 28px; margin-bottom: 6px; color: #00aacc;">📧</div>
            <h3>Sprawdź swoją skrzynkę e-mail</h3>
            <p>Wysłaliśmy link potwierdzający na adres:</p>
            <p class="email-address">${email}</p>
            <button id="backToLoginBtn" class="confirm-btn">OK</button>
        </div>
    `;

    addSimpleStyles();

    confirmMsg.classList.add('show');

    function hideConfirmMsg() {
        confirmMsg?.classList.remove('show');
        if (onClose) onClose(); // СРАЗУ возвращаем UI
        setTimeout(() => {
            confirmMsg?.remove();
            document.body.style.height = initialBodyHeight;
        }, 250);
    }

    const backBtn = document.getElementById('backToLoginBtn');
    if (backBtn) {
        backBtn.addEventListener('click', hideConfirmMsg);
    }

    setTimeout(hideConfirmMsg, 15000);
}

function addSimpleStyles() {
    if (document.getElementById('simpleConfirmStyles')) return;

    const style = document.createElement('style');
    style.id = 'simpleConfirmStyles';
    style.textContent = `
        .email-confirm-message {
            position: fixed;
            top: 47%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #fff;
            border-radius: 14px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 1.5px 6px rgba(0,0,0,0.08);
            max-width: 340px;
            width: 95vw;
            padding: 12px 12px 12px 12px;
            text-align: center;
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.2s;
        }
        .email-confirm-message.show {
            opacity: 1;
        }
        .confirm-content h3 {
            color: #00aacc;
            margin: 0 0 12px 0;
            font-size: 18px;
            font-weight: 700;
        }
        .confirm-content p {
            margin: 8px 0 0 0;
            color: #444;
            font-size: 14px;
        }
        .email-address {
            color: #021d3a !important;
            font-weight: 600;
            background: #e7f3ff;
            padding: 6px 10px;
            border-radius: 6px;
            display: inline-block;
            margin: 12px 0 12px 0;
            font-size: 14px;
            word-break: break-all;
        }
        .confirm-btn {
            background: #00aacc;
            color: white;
            border: none;
            padding: 6px 18px;
            border-radius: 7px;
            cursor: pointer;
            margin-top: 8px;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 2px 8px rgba(0,170,204,0.08);
            transition: background 0.18s, box-shadow 0.18s, transform 0.18s;
            outline: none;
        }
        .confirm-btn:hover, .confirm-btn:focus {
            background: #018fac;
            box-shadow: 0 4px 16px rgba(0,170,204,0.13);
            transform: translateY(-2px) scale(1.04);
        }
    `;
    document.head.appendChild(style);
}
