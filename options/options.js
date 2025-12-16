const DEFAULT_OPTIONS = {
  autoSaveEnabled: true,
  autoSaveTrigger: "session",
  autoSaveIntervalMinutes: 10,
  autoSaveMode: "single"
};

chrome.storage.local.get(["options"], (res) => {
  const opt = { ...DEFAULT_OPTIONS, ...(res.options || {}) };

  document.getElementById("enabled").checked = opt.autoSaveEnabled;
  document.querySelector(`input[name="trigger"][value="${opt.autoSaveTrigger}"]`).checked = true;
  document.querySelector(`input[name="mode"][value="${opt.autoSaveMode}"]`).checked = true;
  document.getElementById("interval").value = opt.autoSaveIntervalMinutes;
});

document.body.addEventListener("change", () => {
  chrome.storage.local.set({
    options: {
      autoSaveEnabled: document.getElementById("enabled").checked,
      autoSaveTrigger: document.querySelector("input[name='trigger']:checked").value,
      autoSaveMode: document.querySelector("input[name='mode']:checked").value,
      autoSaveIntervalMinutes: Number(document.getElementById("interval").value || 10)
    }
  });
});