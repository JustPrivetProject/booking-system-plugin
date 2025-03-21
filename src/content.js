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
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: "showError", message: "An error occurred!" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Error sending message:", chrome.runtime.lastError);
            }
        });
    } else {
        console.error("Chrome runtime API is not available");
    }
})


// waitForElement('#toast-container', () => {
//     window.postMessage({ 
//         type: "FROM_CONTENT_SCRIPT", 
//         action: "showError", 
//         message: "An error occurred!" 
//     }, "*");
// })

// window.addEventListener("message", function(event) {
//     if (event.source === window && 
//         event.data.type && 
//         event.data.type === "FROM_CONTENT_SCRIPT") {
        
//         if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
//             chrome.runtime.sendMessage({
//                 action: event.data.action,
//                 message: event.data.message
//             });
//         }
//     }
// }, false);