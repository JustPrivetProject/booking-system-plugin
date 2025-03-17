const waitForElement = (selector, callback) => {
    const observer = new MutationObserver(() => {
        const element = document.querySelector(selector)
        if (element) {
            observer.disconnect()
            callback(element)
        }
    })

    observer.observe(document.body, { childList: true, subtree: true })
}

waitForElement('#SlotsTileDetails', (targetNode) => {
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

// // Create an observer to monitor changes in the DOM
// const observer = new MutationObserver((mutationsList, observer) => {
//     // Iterate through all changes in the DOM
//     mutationsList.forEach(mutation => {
//       // Check if a new element was added (e.g., a modal window)
//       if (mutation.type === "childList") {
//         mutation.addedNodes.forEach(node => {
//           // If an element with an error is found (e.g., with the class "error-modal")
//           if (node.nodeType === 1 && node.classList.contains("error-modal")) {
//             console.log("An error modal window appeared!");

//             // Send an action to background.js (do not wait for a response)
//             chrome.runtime.sendMessage({ action: "showError", message: "An error occurred!" });

//             // Stop the observer if further monitoring is not needed
//             observer.disconnect();
//           }
//         });
//       }
//     });
//   });

//   // Configure the observer to monitor changes in the body and the entire DOM subtree
//   observer.observe(document.body, {
//     childList: true,  // Monitor the addition of new elements
//     subtree: true     // Monitor changes in the DOM subtree
//   });
