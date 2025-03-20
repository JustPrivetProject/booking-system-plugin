const waitForElement = (selector, callback) => {
    const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        
        if (element) {
            callback(element);

            // Wait for the element to disappear before continuing
            const checkRemoval = new MutationObserver(() => {
                if (!document.querySelector(selector)) {
                    checkRemoval.disconnect(); // Stop observing disappearance
                    observer.observe(document.body, { childList: true, subtree: true }); // Re-enable observer
                }
            });

            checkRemoval.observe(document.body, { childList: true, subtree: true });
            observer.disconnect(); // Temporarily stop observing until element disappears
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
};

waitForElement('#slotsDisplay', (targetNode) => {
    const enableButtons = () => {
        targetNode.querySelectorAll('button[disabled]').forEach((button) => {
            button.removeAttribute('disabled')
            button.classList.remove('disabled')
            button.style.pointerEvents = 'auto'
        })
    }

    enableButtons()

    const observer = new MutationObserver(enableButtons)
    observer.observe(targetNode, { childList: true, subtree: true })
})

waitForElement('#toast-container', () => {
    chrome.runtime.sendMessage({ action: "showError", message: "An error occurred!" });
})
