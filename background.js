const DEFAULT_OPTIONS = {
  autoSaveEnabled: true,
  autoSaveTrigger: "session",
  autoSaveIntervalMinutes: 10,
  autoSaveMode: "single",
  autoCategoryEnabled: true,
  excludedUrlPrefixes: ["chrome://", "chrome-extension://"]
};

let lastSnapshotString = "";

// --------------------
// 옵션 초기화
// --------------------
function initOptions() {
  chrome.storage.local.get(["options"], (res) => {
    if (!res.options) {
      chrome.storage.local.set({ options: DEFAULT_OPTIONS });
    }
  });
}

function getOptions(cb) {
  chrome.storage.local.get(["options"], (res) => {
    cb({ ...DEFAULT_OPTIONS, ...(res.options || {}) });
  });
}

initOptions();

// --------------------
// 탭 스냅샷
// --------------------
async function getTabsSnapshot() {
  const tabs = await chrome.tabs.query({ currentWindow: true });

  return tabs
    .filter(t =>
      t.url &&
      !DEFAULT_OPTIONS.excludedUrlPrefixes.some(p => t.url.startsWith(p))
    )
    .map(t => ({
      title: t.title,
      url: t.url,
      favicon: t.favIconUrl || ""
    }));
}

function makeSnapshotString(tabs) {
  return JSON.stringify(tabs.map(t => t.url));
}

// --------------------
// 자동 저장 실행
// --------------------
async function runAutoSave(trigger) {
  getOptions(async (options) => {
    if (!options.autoSaveEnabled) return;
    if (options.autoSaveTrigger !== trigger) return;

    const tabs = await getTabsSnapshot();
    if (!tabs.length) return;

    const snap = makeSnapshotString(tabs);
    if (snap === lastSnapshotString) return;
    lastSnapshotString = snap;

    chrome.storage.local.get(["sets"], (res) => {
      let sets = res.sets || [];

      if (options.autoSaveMode === "single") {
        sets = sets.filter(s => !s.isAuto);
      }

      const now = new Date();
      const date =
        `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")} `
        + `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

      sets.push({
        id: now.getTime(),
        title: "자동 저장 세트",
        date,
        memo: "",
        category: "기타",
        tabs,
        isAuto: true
      });

      chrome.storage.local.set({ sets });
    });
  });
}

// --------------------
// 이벤트 연결
// --------------------
chrome.windows.onRemoved.addListener(() => runAutoSave("session"));
chrome.tabs.onCreated.addListener(() => runAutoSave("change"));
chrome.tabs.onRemoved.addListener(() => runAutoSave("change"));

setInterval(() => runAutoSave("interval"), 60 * 1000);