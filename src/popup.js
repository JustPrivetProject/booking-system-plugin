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

