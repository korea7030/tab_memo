// =======================================
//  사용자 옵션 저장 구조
// =======================================

let userOptions = {
  autoSave: true,
  autoCategory: true,
  excludedDomains: []
};

// 옵션 불러오기
chrome.storage.sync.get(
  ["autoSave", "autoCategory", "excludedDomains"],
  (result) => {
    userOptions = {
      autoSave: result.autoSave ?? true,
      autoCategory: result.autoCategory ?? true,
      excludedDomains: result.excludedDomains || []
    };
  }
);

// 옵션 변경을 실시간 반영
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") {
    if (changes.autoSave) userOptions.autoSave = changes.autoSave.newValue;
    if (changes.autoCategory) userOptions.autoCategory = changes.autoCategory.newValue;
    if (changes.excludedDomains) userOptions.excludedDomains = changes.excludedDomains.newValue;
  }
});

// =======================================
//  자동 저장을 위한 스냅샷 로직
// =======================================

let lastSavedSnapshot = "";

// 확장/새탭 제외 필터링
function filterExcludedTabs(tabs) {
  return tabs.filter(t => {
    if (!t.url || t.url.startsWith("chrome://")) return false;
    if (t.url.startsWith("chrome-extension://")) return false;
    if (t.url === "chrome://newtab/" || t.url === "chrome://new-tab-page/") return false;

    // 사용자 옵션에 따른 제외 도메인
    const domain = (() => {
      try {
        return new URL(t.url).hostname.replace("www.", "");
      } catch {
        return "";
      }
    })();

    if (userOptions.excludedDomains.some(d => domain.includes(d))) {
      return false;
    }

    return true;
  });
}

// 스냅샷 만들기
function makeSnapshot(tabs) {
  return JSON.stringify(tabs.map(t => ({
    title: t.title,
    url: t.url
  })));
}

// 자동 저장 실행
function autoSaveTabs() {
  if (!userOptions.autoSave) return;

  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    const filtered = filterExcludedTabs(tabs);

    const snapshot = makeSnapshot(filtered);

    if (snapshot === lastSavedSnapshot) return;

    lastSavedSnapshot = snapshot;

    const simplifiedTabs = filtered.map(t => ({
      title: t.title,
      url: t.url,
      favicon: t.favIconUrl || ""
    }));

    chrome.storage.local.get(["sets"], (result) => {
      const sets = result.sets || [];

      const now = new Date();
      const dateStr =
        `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}` +
        ` ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

      const category = userOptions.autoCategory
        ? detectCategory(simplifiedTabs)
        : "기타";

      const newSet = {
        id: now.getTime(),
        title: "자동 저장 세트",
        date: dateStr,
        memo: "",
        category,
        tabs: simplifiedTabs
      };

      sets.push(newSet);
      chrome.storage.local.set({ sets });
    });
  });
}

// =======================================
//  자동 카테고리 분류
// =======================================
function detectCategory(tabs) {
  const urls = tabs.map(t => t.url);

  if (urls.some(u => u.includes("notion") || u.includes("github") || u.includes("google.com"))) {
    return "업무";
  }
  if (urls.some(u => u.includes("youtube") || u.includes("instagram") || u.includes("naver"))) {
    return "개인";
  }
  return "기타";
}

// =======================================
//  탭 이벤트 감지
// =======================================

chrome.tabs.onCreated.addListener(autoSaveTabs);
chrome.tabs.onRemoved.addListener(autoSaveTabs);

// 창 닫기 감지
chrome.windows.onRemoved.addListener(autoSaveTabs);

// =======================================
//  썸네일 캡처 (상세 페이지에서 사용)
// =======================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "capture") {
    chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 40 }, (dataUrl) => {
      sendResponse({ thumbnail: dataUrl });
    });
    return true;
  }
});