chrome.runtime.onInstalled.addListener(() => {
  console.log("Plugin installed!");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchData") {
    (async () => {
      try {
        const response = await fetch("https://ebrama.baltichub.com/Home/GetSlotsForPreview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
            "X-requested-with": "XMLHttpRequest",
            "Referer": "https://ebrama.baltichub.com/vbs-slots",
            "Accept": "*/*",
          },
          body: JSON.stringify({ "date": request.date }),
          credentials: "include"
        });

        const htmlText = await response.text();
        sendResponse({ success: true, html: htmlText });
      } catch (error) {
        console.error("Fetch error:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true; // Указываем, что `sendResponse` будет вызван асинхронно
  }
});

