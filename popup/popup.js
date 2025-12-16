document.addEventListener("DOMContentLoaded", () => {
  const saveBtn = document.getElementById("save-current-tabs");
  const setsListEl = document.getElementById("sets-list");
  const emptyMessageEl = document.getElementById("empty-message");

  const detailView = document.getElementById("detail-view");
  const detailTabsEl = document.getElementById("detail-tabs");
  const detailInfoEl = document.getElementById("detail-info");
  const detailTitleEl = document.getElementById("detail-title");
  const backBtn = document.getElementById("back-btn");
  const openSelectedBtn = document.getElementById("open-selected");

  let currentSet = null;
  let selectedTabIndexes = new Set();

  saveBtn.addEventListener("click", handleSaveCurrentTabs);
  backBtn.addEventListener("click", () => {
    detailView.classList.add("hidden");
    document.querySelector(".container").classList.remove("hidden");
  });

  openSelectedBtn.addEventListener("click", () => {
    if (!currentSet) return;
    const urls = [...selectedTabIndexes].map(i => currentSet.tabs[i].url);
    if (urls.length) chrome.windows.create({ url: urls });
  });

  loadSets();

  function loadSets() {
    chrome.storage.local.get(["sets"], (result) => {
      const sets = result.sets || [];
      setsListEl.innerHTML = "";

      if (!sets.length) {
        emptyMessageEl.style.display = "block";
        return;
      }
      emptyMessageEl.style.display = "none";

      sets.slice().reverse().forEach(set => {
        const item = document.createElement("div");
        item.className = "set-item";

        const header = document.createElement("div");
        header.className = "set-item-header";

        const left = document.createElement("div");
        left.className = "set-item-left";

        const title = document.createElement("div");
        title.className = "set-item-title";
        title.textContent = set.title || "이름 없는 세트";

        const memo = document.createElement("div");
        memo.className = set.memo ? "set-item-memo-inline" : "set-item-memo-inline empty";
        memo.textContent = set.memo || "메모 없음";

        const date = document.createElement("div");
        date.className = "set-item-date";
        date.textContent = `${set.date} · ${set.tabs.length}개`;

        left.append(title, memo, date);

        const delBtn = document.createElement("button");
        delBtn.className = "delete-btn";
        delBtn.textContent = "🗑";
        delBtn.onclick = (e) => {
          e.stopPropagation();
          deleteSet(set.id);
        };

        header.append(left, delBtn);
        item.append(header);

        const cat = document.createElement("div");
        cat.className = `set-item-category category-${set.category}`;
        cat.textContent = `카테고리: ${set.category}`;
        item.append(cat);

        item.onclick = () => showDetail(set);
        setsListEl.append(item);
      });
    });
  }

  function showDetail(set) {
    currentSet = set;
    selectedTabIndexes.clear();

    detailTitleEl.textContent = set.title;
    detailInfoEl.innerHTML = `
      <div>날짜: ${set.date}</div>
      <div>메모: ${set.memo || "(메모 없음)"}</div>
      <div>카테고리: ${set.category}</div>
      <div>탭 수: ${set.tabs.length}개</div>
    `;

    detailTabsEl.innerHTML = "";
    set.tabs.forEach((tab, i) => {
      const row = document.createElement("div");
      row.className = "detail-tab-item";

      row.innerHTML = `
        <input type="checkbox" data-i="${i}" checked />
        <img src="${tab.favicon || ""}" />
        <div class="detail-tab-title">${tab.title || "제목 없음"}</div>
        <button class="detail-tab-open-btn">↗</button>
      `;

      row.querySelector("input").onchange = e => {
        e.target.checked ? selectedTabIndexes.add(i) : selectedTabIndexes.delete(i);
      };
      selectedTabIndexes.add(i);

      row.querySelector(".detail-tab-open-btn").onclick = () => {
        chrome.tabs.create({ url: tab.url });
      };

      detailTabsEl.append(row);
    });

    document.querySelector(".container").classList.add("hidden");
    detailView.classList.remove("hidden");
  }

  function deleteSet(id) {
    chrome.storage.local.get(["sets"], res => {
      chrome.storage.local.set({
        sets: res.sets.filter(s => s.id !== id)
      }, loadSets);
    });
  }

  function handleSaveCurrentTabs() {
    chrome.tabs.query({ currentWindow: true }, tabs => {
      const simplified = tabs
        .filter(t => t.url && !t.url.startsWith("chrome://"))
        .map(t => ({ title: t.title, url: t.url, favicon: t.favIconUrl || "" }));

      chrome.storage.local.get(["sets"], res => {
        const now = new Date();
        const sets = res.sets || [];
        sets.push({
          id: now.getTime(),
          title: "수동 저장 세트",
          date: now.toLocaleString(),
          memo: "",
          category: "기타",
          tabs: simplified
        });
        chrome.storage.local.set({ sets }, loadSets);
      });
    });
  }
});