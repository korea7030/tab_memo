document.addEventListener("DOMContentLoaded", () => {

    const autoSaveToggle = document.getElementById("auto-save-toggle");
    const autoCategoryToggle = document.getElementById("auto-category-toggle");
    const excludedDomainsEl = document.getElementById("excluded-domains");
    const saveBtn = document.getElementById("save-btn");
    const statusEl = document.getElementById("status");
  
    // 저장된 설정 불러오기
    chrome.storage.sync.get(
      ["autoSave", "autoCategory", "excludedDomains"],
      (result) => {
        autoSaveToggle.checked = result.autoSave ?? true;
        autoCategoryToggle.checked = result.autoCategory ?? true;
        excludedDomainsEl.value = (result.excludedDomains || []).join("\n");
      }
    );
  
    // 저장 버튼 클릭
    saveBtn.addEventListener("click", () => {
      const excludedList = excludedDomainsEl.value
        .split("\n")
        .map(s => s.trim())
        .filter(s => s.length > 0);
  
      chrome.storage.sync.set(
        {
          autoSave: autoSaveToggle.checked,
          autoCategory: autoCategoryToggle.checked,
          excludedDomains: excludedList
        },
        () => {
          statusEl.textContent = "저장되었습니다.";
          setTimeout(() => (statusEl.textContent = ""), 1500);
        }
      );
    });
  
  });