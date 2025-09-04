// Page-level flag to track if modal was dismissed (not in storage)
let modalDismissedOnThisPage = false;

/**
 * Shows extension connection warning modal
 * This modal appears when extension connection is lost and offers to refresh the page
 * It shows only once per page load and can be dismissed
 */
export async function showExtensionWarningModal() {
    // Check if modal is already shown
    if (document.getElementById('extension-warning-modal')) {
        console.log('[content] Extension warning modal already shown');
        return;
    }

    // Check if warning was already dismissed on this page
    if (modalDismissedOnThisPage) {
        console.log('[content] Extension warning modal was dismissed on this page');
        return;
    }

    console.log('[content] Showing extension warning modal');

    const modal = document.createElement('div');
    modal.id = 'extension-warning-modal';
    modal.style =
        'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';

    // Modal content
    modal.innerHTML = `
      <div id="modal-content" style="
        background: var(--color-white, #fff);
        padding: var(--spacing-medium, 20px);
        border-radius: var(--border-radius, 8px);
        text-align: center;
        min-width: 280px;
        max-width: 380px;
        box-shadow: var(--shadow-card, 0 4px 10px rgba(0,0,0,0.1));
        font-family: Arial, sans-serif;
        color: var(--color-primary, #00aacc);
        max-width: 85vw;
      ">
        <div style="
          width: 32px;
          height: 32px;
          margin: 0 auto 12px;
          background: var(--color-warning, #ff9800);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          color: white;
          font-weight: bold;
        ">⚠</div>
        <h2 style='margin-bottom: var(--spacing-small, 8px); font-size: var(--font-size-medium, 16px); color: var(--color-primary, #00aacc);'>Problemy z rozszerzeniem Brama</h2>
        <p style='margin-bottom: var(--spacing-medium, 16px); color: var(--color-text-light, #888); font-size: var(--font-size-small, 13px); line-height: 1.4;'>
          Wykryto problemy z połączeniem z rozszerzeniem Brama. 
          Odświeżenie strony może rozwiązać ten problem.
        </p>
        <div id="modal-btns" style="display:flex;gap:var(--spacing-small,8px);justify-content:center;flex-wrap:wrap;">
          <button id="refresh-page" style='
            padding: var(--spacing-small, 8px) var(--spacing-medium, 16px);
            background: var(--color-primary, #00aacc);
            color: var(--color-white, #fff);
            border: none;
            border-radius: 4px;
            font-size: var(--font-size-small, 13px);
            box-shadow: var(--shadow-button, 0 0 2px rgba(0,0,0,0.2));
            cursor: pointer;
            transition: background 0.2s;
            min-width: 100px;
          '>Odśwież stronę</button>
          <button id="dismiss-warning" style='
            padding: var(--spacing-small, 8px) var(--spacing-medium, 16px);
            background: var(--color-background-light, #f9f9f9ec);
            color: var(--color-primary, #00aacc);
            border: 1px solid var(--color-border-light, #ccc);
            border-radius: 4px;
            font-size: var(--font-size-small, 13px);
            box-shadow: var(--shadow-button, 0 0 2px rgba(0,0,0,0.2));
            cursor: pointer;
            transition: background 0.2s;
            min-width: 100px;
          '>Zamknij</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const refreshBtn = document.getElementById('refresh-page');
    const dismissBtn = document.getElementById('dismiss-warning');

    function closeModal() {
        const modal = document.getElementById('extension-warning-modal');
        if (modal) {
            modal.remove();
        }
    }

    function dismissWarning() {
        // Mark as dismissed for this page only
        modalDismissedOnThisPage = true;
        closeModal();
    }

    // Refresh page button
    if (refreshBtn) {
        refreshBtn.onclick = () => {
            closeModal();
            window.location.reload();
        };
    }

    // Dismiss button
    if (dismissBtn) {
        dismissBtn.onclick = () => {
            dismissWarning();
        };
    }

    // Close modal when clicking outside
    modal.onclick = event => {
        if (event.target === modal) {
            dismissWarning();
        }
    };

    // Close modal with Escape key
    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            dismissWarning();
            document.removeEventListener('keydown', handleKeyDown);
        }
    };
    document.addEventListener('keydown', handleKeyDown);

    console.log('[content] Extension warning modal displayed');
}
