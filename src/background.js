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

    return true;
  }
});

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method === "POST" && details.requestBody) {
      let rawData = details.requestBody.raw;
      if (rawData && rawData[0]) {
        let decoder = new TextDecoder("utf-8");
        let body = decoder.decode(rawData[0].bytes); // Decode request body

        chrome.storage.local.get({ requestCache: {} }, (data) => {
          let cache = data.requestCache;

          // Check if the request already exists in the cache by requestId
          if (!cache[details.requestId]) {
            cache[details.requestId] = { url: details.url, body };
            chrome.storage.local.set({ requestCache: cache }, () => {
              console.log("Cached Request:", details.requestId, details.url);
            });
          } else {
            console.log("Request already in cache:", details.requestId, details.url);
          }
        });
      }
    }
  },
  { urls: ["*://*/Home/GetSlotsForPreview*"] },
  ["requestBody"]
);

// Function to retry requests
function retryRequests() {
  chrome.storage.local.get({ retryQueue: [], retryEnabled: true }, async (data) => {
    if (!data.retryEnabled) {
      console.log("Retrying is disabled.");
      return;
    }

    let queue = data.retryQueue;
    let newQueue = [];

    for (const req of queue) {
      try {
        let body = typeof req.body === "string" ? req.body : JSON.stringify(req.body); // Ensure string

        let response = await fetch(req.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
        });

        if (!response.ok) {
          console.warn("Retry failed, keeping in queue:", req.url);
          newQueue.push(req);
        } else {
          console.log("Request retried successfully:", req.url);
        }
      } catch (err) {
        console.error("Error retrying request:", err);
        newQueue.push(req);
      }
    }

    chrome.storage.local.set({ retryQueue: newQueue });
  });
}

chrome.webRequest.onCompleted.addListener(
  (details) => {
    chrome.storage.local.get({ requestCache: {} }, (data) => {
      let cache = data.requestCache;
      delete cache[details.requestId]; // Remove processed request
      chrome.storage.local.set({ requestCache: cache });
    });
  },
  { urls: ["*://*/Home/GetSlotsForPreview*"] }
);

// Intercept responses and add to queue on error
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.statusCode == 200) {
      console.log("Request failed, checking cache:", details.requestId);

      chrome.storage.local.get({ requestCache: {}, retryQueue: [] }, (data) => {
        let cache = data.requestCache;
        let queue = data.retryQueue;

        // Check if the request is already in the cache, do not add it to the queue
        if (cache[details.requestId]) {
          // Check if the request is already in the retry queue
          
            queue.push(cache[details.requestId]); // Add request to queue
            chrome.storage.local.set({ retryQueue: queue }, () => {
              console.log("Added to retry queue:", cache[details.requestId].url);
            });
          } else {
            console.log("Request is already in the retry queue:", cache[details.requestId].url);
          }
       
      });
    }
  },
  { urls: ["*://*/Home/GetSlotsForPreview*"] }
);

// Settings
chrome.storage.local.set({ retryEnabled: true });
const RETRY_INTERVAL = 60 * 1000;
// Start retry attempts every 10 seconds
setInterval(retryRequests, RETRY_INTERVAL);
