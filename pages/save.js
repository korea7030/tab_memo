document.addEventListener("DOMContentLoaded", () => {
    const tabCountEl = document.getElementById("tab-count");
    const memoEl = document.getElementById("memo");
    const saveBtn = document.getElementById("save-btn");
    const cancelBtn = document.getElementById("cancel-btn");
  
    let pendingTabs = [];
  
    // pendingTabs 불러오기
    chrome.storage.local.get(["pendingTabs"], (result) => {
      pendingTabs = result.pendingTabs || [];
      tabCountEl.textContent = `현재 탭: ${pendingTabs.length}개`;
  
      if (!pendingTabs.length) {
        tabCountEl.textContent = "저장할 탭이 없습니다.";
        saveBtn.disabled = true;
      }
    });
  
    // 저장 버튼
    saveBtn.addEventListener("click", () => {
      if (!pendingTabs.length) {
        window.close();
        return;
      }
  
      const memo = memoEl.value.trim();
  
      chrome.storage.local.get(["sets"], (result) => {
        const sets = result.sets || [];
  
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${pad2(
          now.getMonth() + 1
        )}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(
          now.getMinutes()
        )}`;

        const category = document.getElementById("category").value;
  
        const newSet = {
          id: now.getTime(),
          date: dateStr,
          memo,
          category,
          tabs: pendingTabs
        };
  
        sets.push(newSet);
  
        chrome.storage.local.set({ sets, pendingTabs: [] }, () => {
          window.close();
        });
      });
    });
  
    // 취소 버튼
    cancelBtn.addEventListener("click", () => {
      // pendingTabs는 남겨두고 창만 닫음
      window.close();
    });
  
    function pad2(num) {
      return num.toString().padStart(2, "0");
    }
  });