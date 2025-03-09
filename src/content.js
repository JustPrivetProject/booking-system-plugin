const waitForElement = (selector, callback) => {
    const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
            observer.disconnect();
            callback(element);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
};

waitForElement("#SlotsTileDetails", (targetNode) => {
    const enableButtons = () => {
        targetNode.querySelectorAll("button[disabled]").forEach(button => {
            button.removeAttribute("disabled");
            button.classList.remove("disabled");
            button.style.pointerEvents = "auto";
        });
    };

    enableButtons();

    const observer = new MutationObserver(enableButtons);
    observer.observe(targetNode, { childList: true, subtree: true });
});