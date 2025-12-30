document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // DOM
  // =========================
  const saveBtn = document.getElementById("save-current-tabs");
  const setsListEl = document.getElementById("sets-list");
  const emptyMessageEl = document.getElementById("empty-message");

  const detailView = document.getElementById("detail-view");
  const detailTabsEl = document.getElementById("detail-tabs");
  const detailInfoEl = document.getElementById("detail-info");
  const backBtn = document.getElementById("back-btn");
  const openSelectedBtn = document.getElementById("open-selected");

  const searchInput = document.getElementById("search-input");
  const filterButtons = document.querySelectorAll(".filter-btn");

  // merge
  const mergeBtn = document.getElementById("merge-mode-btn");

  // =========================
  // State
  // =========================
  let currentSet = null;
  let selectedTabIndexes = new Set();

  let currentFilter = "all";
  let searchKeyword = "";

  let mergeMode = false;
  let mergeSelectedIds = new Set();

  // =========================
  // Init Events
  // =========================
  saveBtn?.addEventListener("click", handleSaveCurrentTabs);

  backBtn?.addEventListener("click", () => {
    detailView.classList.add("hidden");
    document.querySelector(".container")?.classList.remove("hidden");
  });

  openSelectedBtn?.addEventListener("click", () => {
    if (!currentSet) return;
    const urls = [...selectedTabIndexes]
      .map(i => currentSet.tabs?.[i]?.url)
      .filter(Boolean);

    if (urls.length) chrome.windows.create({ url: urls });
  });

  // 검색
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      searchKeyword = (searchInput.value || "").toLowerCase().trim();
      loadSets();
    });
  }

  // 필터
  filterButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      currentFilter = btn.dataset.cat || "all";
      filterButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      loadSets();
    });
  });

  // 병합 모드 버튼
  mergeBtn?.addEventListener("click", async () => {
    if (!mergeMode) {
      // 병합 모드 진입
      mergeMode = true;
      mergeSelectedIds.clear();
      mergeBtn.textContent = "병합 실행";
      loadSets();
      return;
    }

    // 병합 실행
    if (mergeSelectedIds.size < 2) {
      alert("병합할 세트를 2개 이상 선택하세요.");
      return;
    }

    await mergeSets([...mergeSelectedIds]);

    // 병합 모드 종료
    mergeMode = false;
    mergeSelectedIds.clear();
    mergeBtn.textContent = "세트 병합 모드";
    loadSets();
  });

  // =========================
  // Utils
  // =========================
  function safeCategory(cat) {
    return cat || "기타";
  }

  function getDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return "";
    }
  }

  function detectCategoryFromTabs(tabs) {
    const urls = (tabs || []).map(t => (t.url || "").toLowerCase());
    if (urls.some(u => /github|notion|figma|slack|google/.test(u))) return "업무";
    if (urls.some(u => /youtube|instagram|netflix|tiktok/.test(u))) return "개인";
    return "기타";
  }

  function nowDateString() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }

  function isSavableUrl(url) {
    if (!url) return false;
    if (url.startsWith("chrome://")) return false;
    if (url.startsWith("chrome-extension://")) return false;
    if (url === "chrome://newtab/") return false;
    return true;
  }

  // =========================
  // Load Sets (필터 + 검색)
  // =========================
  function loadSets() {
    chrome.storage.local.get(["sets"], (res) => {
      let sets = Array.isArray(res.sets) ? res.sets : [];
      setsListEl.innerHTML = "";

      // 1) 필터
      if (currentFilter !== "all") {
        sets = sets.filter(s => safeCategory(s.category) === currentFilter);
      }

      // 2) 검색 (세트 제목/메모/날짜/카테고리 + 탭제목/URL/도메인)
      if (searchKeyword) {
        sets = sets.filter(s => {
          const title = (s.title || "").toLowerCase();
          const memo = (s.memo || "").toLowerCase();
          const date = (s.date || "").toLowerCase();
          const category = safeCategory(s.category).toLowerCase();

          const setHit =
            title.includes(searchKeyword) ||
            memo.includes(searchKeyword) ||
            date.includes(searchKeyword) ||
            category.includes(searchKeyword);

          const tabHit = (s.tabs || []).some(t => {
            const tTitle = (t.title || "").toLowerCase();
            const tUrl = (t.url || "").toLowerCase();
            const domain = getDomain(t.url || "");
            return (
              tTitle.includes(searchKeyword) ||
              tUrl.includes(searchKeyword) ||
              domain.includes(searchKeyword)
            );
          });

          return setHit || tabHit;
        });
      }

      // Empty
      if (!sets.length) {
        emptyMessageEl.style.display = "block";
        return;
      }
      emptyMessageEl.style.display = "none";

      // Render
      sets.slice().reverse().forEach(set => {
        const category = safeCategory(set.category);

        const item = document.createElement("div");
        item.className = "set-item";
        item.classList.add(`category-${category}`);

        // 병합 모드 체크박스
        if (mergeMode) {
          const check = document.createElement("input");
          check.type = "checkbox";
          check.className = "merge-checkbox";
          check.checked = mergeSelectedIds.has(set.id);

          check.addEventListener("click", (e) => {
            // ✅ 체크만 할 때 상세로 이동 방지
            e.stopPropagation();
          });

          check.addEventListener("change", (e) => {
            if (e.target.checked) mergeSelectedIds.add(set.id);
            else mergeSelectedIds.delete(set.id);
          });

          item.prepend(check);
        }

        const header = document.createElement("div");
        header.className = "set-item-header";

        const left = document.createElement("div");
        left.className = "set-item-left";

        const titleEl = document.createElement("div");
        titleEl.className = "set-item-title";
        titleEl.textContent = set.title || "이름 없는 세트";

        const memoEl = document.createElement("div");
        memoEl.className = set.memo ? "set-item-memo-inline" : "set-item-memo-inline empty";
        memoEl.textContent = set.memo || "메모 없음";

        const dateEl = document.createElement("div");
        dateEl.className = "set-item-date";
        dateEl.textContent = `${set.date || ""} · ${(set.tabs || []).length}개`;

        left.append(titleEl, memoEl, dateEl);

        const delBtn = document.createElement("button");
        delBtn.className = "delete-btn";
        delBtn.textContent = "🗑";
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteSet(set.id);
        });

        header.append(left, delBtn);
        item.append(header);

        const catEl = document.createElement("div");
        catEl.className = `set-item-category category-${category}`;
        catEl.textContent = `카테고리: ${category}`;
        item.append(catEl);

        if (set.auto) {
          item.classList.add("auto");
          const badge = document.createElement("div");
          badge.className = "auto-badge";
          badge.textContent = "자동 저장";
          item.append(badge);
        }

        item.addEventListener("click", () => {
          // 병합 모드일 때는 상세 이동 막고 싶으면 여기서 return 처리 가능
          // if (mergeMode) return;
          showDetail(set);
        });

        setsListEl.append(item);
      });
    });
  }

  // =========================
  // Detail View
  // =========================
  function showDetail(set) {
    currentSet = set;
    selectedTabIndexes.clear();

    renderDetailHeader(set);

    detailTabsEl.innerHTML = "";
    (set.tabs || []).forEach((tab, i) => {
      const row = document.createElement("div");
      row.className = "detail-tab-item";

      row.innerHTML = `
        <input type="checkbox" data-i="${i}" checked />
        <img src="${tab.favicon || ""}" alt="" />
        <div class="detail-tab-title">${tab.title || "제목 없음"}</div>
        <button class="detail-tab-open-btn" title="새 탭으로 열기">↗</button>
        <button class="detail-tab-delete-btn" title="세트에서 삭제">❌</button>
      `;

      // ✅ 기본 전체 선택
      selectedTabIndexes.add(i);

      const checkbox = row.querySelector("input");
      checkbox.addEventListener("change", (e) => {
        const checked = e.target.checked;
        if (checked) selectedTabIndexes.add(i);
        else selectedTabIndexes.delete(i);
      });

      const openBtn = row.querySelector(".detail-tab-open-btn");
      openBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        chrome.tabs.create({ url: tab.url });
      });

      const delBtn = row.querySelector(".detail-tab-delete-btn");
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteTabFromSet(set.id, i);
      });

      detailTabsEl.append(row);
    });

    document.querySelector(".container")?.classList.add("hidden");
    detailView.classList.remove("hidden");
  }

  function renderDetailHeader(set) {
    // ✅ replaceWith 때문에 레퍼런스 끊기므로 항상 다시 잡기
    const titleHost = document.getElementById("detail-title");
    if (!titleHost) return;

    titleHost.textContent = set.title || "제목 없음";
    titleHost.onclick = () => startEditTitle(set.id, titleHost, set.title || "");

    detailInfoEl.innerHTML = "";

    const dateRow = createInfoRow("날짜", set.date || "");
    const catRow = createInfoRow("카테고리", safeCategory(set.category));
    const countRow = createInfoRow("탭 수", `${(set.tabs || []).length}개`);

    const memoRow = document.createElement("div");
    memoRow.className = "detail-memo";
    memoRow.textContent = set.memo ? `메모: ${set.memo}` : "메모: (메모 없음)";
    memoRow.style.cursor = "pointer";
    memoRow.title = "클릭해서 메모 수정";
    memoRow.onclick = () => startEditMemo(set.id, memoRow, set.memo || "");

    if (set.auto) {
      const autoInfo = document.createElement("div");
      autoInfo.className = "auto-info";
      autoInfo.textContent = "⚡ 이 세트는 작업 흐름 중 자동 저장되었습니다.";
      detailInfoEl.append(autoInfo);
    }

    detailInfoEl.append(dateRow, memoRow, catRow, countRow);
  }

  function createInfoRow(label, value) {
    const div = document.createElement("div");
    div.textContent = `${label}: ${value}`;
    return div;
  }

  // =========================
  // Inline Edit: Title
  // =========================
  function startEditTitle(setId, hostEl, initialValue) {
    const input = document.createElement("input");
    input.className = "detail-title-input";
    input.value = initialValue;

    hostEl.replaceWith(input);
    input.focus();
    input.select();

    const finish = () => {
      const newTitle = input.value.trim() || "제목 없음";
      updateSet(setId, { title: newTitle }, (updatedSet) => {
        // ✅ CSS 원복 포함해서 다시 title div로 복구
        const restored = document.createElement("div");
        restored.id = "detail-title";
        restored.className = "detail-title";
        restored.textContent = newTitle;
        restored.onclick = () => startEditTitle(setId, restored, newTitle);

        input.replaceWith(restored);

        if (updatedSet) {
          currentSet = updatedSet;
          renderDetailHeader(updatedSet);
        }
      });
    };

    input.addEventListener("blur", finish);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") finish();
      if (e.key === "Escape") {
        const restored = document.createElement("div");
        restored.id = "detail-title";
        restored.className = "detail-title";
        restored.textContent = initialValue || "제목 없음";
        restored.onclick = () => startEditTitle(setId, restored, initialValue || "");
        input.replaceWith(restored);
      }
    });
  }

  // =========================
  // Inline Edit: Memo
  // =========================
  function startEditMemo(setId, hostEl, initialValue) {
    const textarea = document.createElement("textarea");
    textarea.className = "detail-memo-input";
    textarea.value = initialValue;

    hostEl.replaceWith(textarea);
    textarea.focus();
    textarea.select();

    const finish = () => {
      const newMemo = textarea.value.trim(); // 빈값 허용
      updateSet(setId, { memo: newMemo }, (updatedSet) => {
        const restored = document.createElement("div");
        restored.className = "detail-memo";
        restored.style.cursor = "pointer";
        restored.title = "클릭해서 메모 수정";
        restored.textContent = newMemo ? `메모: ${newMemo}` : "메모: (메모 없음)";
        restored.onclick = () => startEditMemo(setId, restored, newMemo);

        textarea.replaceWith(restored);

        if (updatedSet) {
          currentSet = updatedSet;
          renderDetailHeader(updatedSet);
        }
      });
    };

    textarea.addEventListener("blur", finish);
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const restored = document.createElement("div");
        restored.className = "detail-memo";
        restored.style.cursor = "pointer";
        restored.title = "클릭해서 메모 수정";
        restored.textContent = initialValue ? `메모: ${initialValue}` : "메모: (메모 없음)";
        restored.onclick = () => startEditMemo(setId, restored, initialValue);
        textarea.replaceWith(restored);
      }
      // Enter로 저장하고 싶으면 아래 주석 해제 (textarea는 보통 줄바꿈이라 blur 저장이 더 자연스러움)
      // if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) finish();
    });
  }

  // =========================
  // Storage helpers
  // =========================
  function updateSet(id, patch, cb) {
    chrome.storage.local.get(["sets"], (res) => {
      const sets = Array.isArray(res.sets) ? res.sets : [];
      const updatedSets = sets.map(s => (s.id === id ? { ...s, ...patch } : s));
      chrome.storage.local.set({ sets: updatedSets }, () => {
        loadSets();
        const updatedSet = updatedSets.find(s => s.id === id) || null;
        if (cb) cb(updatedSet);
      });
    });
  }

  function deleteTabFromSet(setId, index) {
    chrome.storage.local.get(["sets"], (res) => {
      const sets = Array.isArray(res.sets) ? res.sets : [];
      const updatedSets = sets.map(s => {
        if (s.id !== setId) return s;
        return { ...s, tabs: (s.tabs || []).filter((_, i) => i !== index) };
      });

      chrome.storage.local.set({ sets: updatedSets }, () => {
        loadSets();
        const refreshed = updatedSets.find(s => s.id === setId);
        if (refreshed) showDetail(refreshed);
      });
    });
  }

  function deleteSet(id) {
    chrome.storage.local.get(["sets"], (res) => {
      const sets = Array.isArray(res.sets) ? res.sets : [];
      chrome.storage.local.set({ sets: sets.filter(s => s.id !== id) }, loadSets);
    });
  }

  // =========================
  // Merge Sets
  // =========================
  async function mergeSets(ids) {
    return new Promise((resolve) => {
      chrome.storage.local.get(["sets"], (res) => {
        let sets = Array.isArray(res.sets) ? res.sets : [];

        const targets = sets.filter(s => ids.includes(s.id));
        if (targets.length < 2) {
          alert("병합할 세트를 2개 이상 선택하세요.");
          return resolve();
        }

        // 탭 합치기 + URL 중복 제거
        let mergedTabs = [];
        targets.forEach(s => mergedTabs = mergedTabs.concat(s.tabs || []));

        const uniqueTabs = Array.from(
          new Map(mergedTabs.map(t => [t.url, t])).values()
        );

        const mergedSet = {
          id: Date.now(),
          title: "병합된 세트",
          date: nowDateString(),
          memo: "",
          category: "기타",
          tabs: uniqueTabs
        };

        // 기존 제거 후 merged 추가
        sets = sets.filter(s => !ids.includes(s.id));
        sets.push(mergedSet);

        chrome.storage.local.set({ sets }, () => {
          alert("세트 병합 완료!");
          resolve();
        });
      });
    });
  }

  // =========================
  // Save current tabs
  // =========================
  function handleSaveCurrentTabs() {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      const simplified = (tabs || [])
        .filter(t => isSavableUrl(t.url))
        .map(t => ({
          title: t.title,
          url: t.url,
          favicon: t.favIconUrl || ""
        }));

      const category = detectCategoryFromTabs(simplified);

      chrome.storage.local.get(["sets"], (res) => {
        const sets = Array.isArray(res.sets) ? res.sets : [];
        sets.push({
          id: Date.now(),
          title: "수동 저장 세트",
          date: nowDateString(),
          memo: "",
          category,
          tabs: simplified
        });

        chrome.storage.local.set({ sets }, loadSets);
      });
    });
  }

  // =========================
  // Start
  // =========================
  loadSets();
});