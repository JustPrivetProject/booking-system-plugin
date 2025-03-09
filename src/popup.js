document.getElementById("fetch-btn").addEventListener("click", () => {
  const dateInput = document.getElementById("date-input").value;

  if (!dateInput) {
    alert("Date field is empty!");
    return;
  }

  // Преобразуем YYYY-MM-DD → DD.MM.YYYY
  const dateObj = new Date(dateInput);
  const formattedDate = dateObj.toLocaleDateString("ru-RU"); // "04.03.2025"

  chrome.runtime.sendMessage({ action: "fetchData", date: formattedDate }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending message:", chrome.runtime.lastError.message);
      return;
    }

    if (response && response.success) {
      document.getElementById("response").innerHTML = response.html;
      document.getElementById("dialog").style.display = "flex";
    } else {
        console.error("Request error:", response ? JSON.stringify(response) : "Unknown error");
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const closeDialogBtn = document.getElementById("close-dialog");
  const dialog = document.getElementById("dialog");

  function closeDialog() {
    dialog.style.display = "none";
  }
  closeDialogBtn.addEventListener("click", closeDialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeDialog();
    }
  });
});

async function updateQueueDisplay() {
  try {
    // Получаем очередь из хранилища
    const { retryQueue } = await new Promise(resolve =>
      chrome.storage.local.get({ retryQueue: [] }, resolve)
    );

    let table = document.getElementById("queueTable");
    table.innerHTML = ""; // Очищаем таблицу

    // Заполняем таблицу данными из очереди
    retryQueue.forEach((req, index) => {
      let row = document.createElement("tr");
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${req.url}</td>
        <td><button class="remove-button" data-index="${index}"><span class="material-icons icon">delete</span></button></td>
      `;
      table.appendChild(row);
    });

    // Добавляем обработчики кнопок
    document.querySelectorAll(".remove-button").forEach((btn) => {
      btn.addEventListener("click", () => removeRequestFromRetryQueue(btn.dataset.index));
    });
  } catch (error) {
    console.error("Error updating queue display:", error);
  }
}

async function removeRequestFromRetryQueue(index) {
  try {
    // Получаем очередь повторных запросов из хранилища
    const { retryQueue } = await new Promise(resolve =>
      chrome.storage.local.get({ retryQueue: [] }, resolve)
    );

    let req = retryQueue[index];

    if (!req) {
      console.log("Request not found at index:", index);
      return;
    }

    // Удаляем запрос из очереди
    retryQueue.splice(index, 1);

    // Обновляем хранилище после удаления
    await new Promise(resolve =>
      chrome.storage.local.set({ retryQueue: retryQueue }, resolve)
    );

    console.log("Request removed from retry queue:", req.url);
    updateQueueDisplay(); // Обновляем отображение очереди
  } catch (error) {
    console.error("Error removing request from queue:", error);
  }
}

// Обновлять очередь при открытии popup
document.addEventListener("DOMContentLoaded", updateQueueDisplay);

document.getElementById("stopRetry").addEventListener("click", () => {
  chrome.storage.local.set({ retryEnabled: false }, () => {
    console.log("Retrying stopped.");
  });
});

document.getElementById("startRetry").addEventListener("click", () => {
  chrome.storage.local.set({ retryEnabled: true }, () => {
    console.log("Retrying enabled.");
  });
});