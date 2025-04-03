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

function waitElementAndSendChromeMessage(selector, action, actionFunction) {
    waitForElement(selector, () => {
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
            console.error("Chrome runtime API is not available");
            return;
        }

        try {
            const parsedData = actionFunction();

            chrome.runtime.sendMessage(
                { action: action, message: parsedData },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.error(`Error sending ${action} message:`, chrome.runtime.lastError);
                    }
                }
            );
        } catch (error) {
            console.error(`Error processing ${action}:`, error);
        }
    });
}

function parseTable() {
    const table = document.querySelector("#Grid table");
    if (!table) return [];

    const data = [];
    table.querySelectorAll("tr").forEach((row, rowIndex) => {
        const cells = row.querySelectorAll("td, th");
        const rowData = [];
        cells.forEach(cell => rowData.push(cell.innerText.trim()));
        data.push(rowData);
    });

    return data;
}

waitElementAndSendChromeMessage('#toast-container', "showError", () => {
    return "An error occurred!";
});

waitElementAndSendChromeMessage('.swal2-icon-success[role="dialog"]', "succeedBooking", () => {
    return "Successful booking found!";
});

waitElementAndSendChromeMessage('#Grid table', "parsedTable", () => {
    return parseTable();
});

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