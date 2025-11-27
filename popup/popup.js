document.addEventListener("DOMContentLoaded", () => {
  let mergeMode = false;
  let mergeSelected = new Set();

  // -----------------------------
  // 도메인 기반 카테고리 자동 분류 규칙
  // -----------------------------
  const DOMAIN_CATEGORY_MAP = {
    "notion.so": "업무",
    "github.com": "업무",
    "figma.com": "업무",
    "slack.com": "업무",
    "google.com": "업무",

    "youtube.com": "개인",
    "instagram.com": "개인",
    "tiktok.com": "개인",
    "netflix.com": "개인",

    "naver.com": "기타",
    "daum.net": "기타"
  };

  // -----------------------------
  // 확장프로그램 / 새탭 / chrome 내부 페이지 제외
  // -----------------------------
  function filterExcludedTabs(tabs) {
    return tabs.filter(t => {
      const url = t.url || "";
      if (url.startsWith("chrome-extension://")) return false;
      if (url.startsWith("chrome://")) return false; // 새탭 및 설정 등 모두 제외
      return true;
    });
  }

  // -----------------------------
  // 카테고리 자동 판별
  // -----------------------------
  function detectCategory(tabs) {
    const count = { "업무": 0, "개인": 0, "기타": 0 };

    tabs.forEach(tab => {
      try {
        const domain = new URL(tab.url).hostname.replace("www.", "");
        let matched = false;

        for (const key in DOMAIN_CATEGORY_MAP) {
          if (domain.includes(key)) {
            count[DOMAIN_CATEGORY_MAP[key]]++;
            matched = true;
            break;
          }
        }

        if (!matched) count["기타"]++;
      } catch {
        count["기타"]++;
      }
    });

    let best = "기타";
    let max = 0;

    for (const c in count) {
      if (count[c] > max) {
        max = count[c];
        best = c;
      }
    }
    return best;
  }

  // -----------------------------
  // 자동 제목 생성
  // -----------------------------
  function detectTitle(tabs) {
    try {
      const domains = tabs.map(t => new URL(t.url).hostname.replace("www.", ""));
      const unique = [...new Set(domains)];

      if (unique.length === 1) return `${unique[0]} 세트`;
      if (unique.length <= 3) return `${unique[0]} 외 ${unique.length - 1}개`;
      return `혼합 사이트 세트 (${tabs.length}개 탭)`;
    } catch {
      return "탭 세트";
    }
  }

  // -----------------------------
  // 상세 보기 화면 요소
  // -----------------------------
  const detailView = document.getElementById("detail-view");
  const detailTabsEl = document.getElementById("detail-tabs");
  const detailTitleEl = document.getElementById("detail-title");
  const detailMetaEl = document.getElementById("detail-meta");
  const backBtn = document.getElementById("back-btn");
  const openSelectedBtn = document.getElementById("open-selected");

  let currentSet = null;
  let searchKeyword = "";
  let selectedTabIndexes = new Set();

  // -----------------------------
  // 기본 UI 요소
  // -----------------------------
  const saveBtn = document.getElementById("save-current-tabs");
  const setsListEl = document.getElementById("sets-list");
  const emptyMessageEl = document.getElementById("empty-message");
  const filterButtons = document.querySelectorAll(".filter-btn");
  const searchInput = document.getElementById("search-input");
  const mergeBtn = document.getElementById("merge-mode-btn");

  let currentFilter = "all";

  // -----------------------------
  // 병합 모드 토글
  // -----------------------------
  mergeBtn.addEventListener("click", () => {
    // 병합 실행 트리거 역할만 하고, UI는 로딩 후 체크박스로 제어
    if (mergeMode && mergeSelected.size >= 2) {
      // 이미 병합 모드이고, 2개 이상 선택되었으면 병합 실행
      mergeSets([...mergeSelected]);
      return;
    }

    // 모드 토글
    mergeMode = !mergeMode;
    mergeSelected.clear();
    mergeBtn.textContent = mergeMode ? "병합 실행" : "세트 병합 모드";
    loadSets();
  });

  // -----------------------------
  // 저장 버튼
  // -----------------------------
  saveBtn.addEventListener("click", handleSaveCurrentTabs);

  // 검색
  searchInput.addEventListener("input", () => {
    searchKeyword = searchInput.value.toLowerCase().trim();
    loadSets();
  });

  // 카테고리 필터
  filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      currentFilter = btn.dataset.cat;
      filterButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadSets();
    });
  });

  // -----------------------------
  // 세트 목록 로드
  // -----------------------------
  function loadSets() {
    chrome.storage.local.get(["sets"], (result) => {
      const sets = result.sets || [];
      setsListEl.innerHTML = "";

      if (sets.length === 0) {
        emptyMessageEl.style.display = "block";
        return;
      }
      emptyMessageEl.style.display = "none";

      let filtered = sets;

      if (currentFilter !== "all") {
        filtered = filtered.filter(s => (s.category || "기타") === currentFilter);
      }

      if (searchKeyword) {
        filtered = filtered.filter(s => {
          const memo = (s.memo || "").toLowerCase();
          const date = (s.date || "").toLowerCase();
          const matchTab = s.tabs.some(tab => {
            const title = (tab.title || "").toLowerCase();
            const url = (tab.url || "").toLowerCase();
            let domain = "";
            try {
              domain = new URL(tab.url).hostname.replace("www.", "");
            } catch {}
            return (
              title.includes(searchKeyword) ||
              url.includes(searchKeyword) ||
              domain.includes(searchKeyword)
            );
          });

          return memo.includes(searchKeyword) || date.includes(searchKeyword) || matchTab;
        });
      }

      filtered.slice().reverse().forEach(set => {
        const item = document.createElement("div");
        item.className = `set-item category-${set.category || "기타"}`;

        // 병합 체크박스
        if (mergeMode) {
          const check = document.createElement("input");
          check.type = "checkbox";
          check.className = "merge-checkbox";

          check.addEventListener("click", (e) => {
            e.stopPropagation();
          });

          check.addEventListener("change", (e) => {
            if (e.target.checked) mergeSelected.add(set.id);
            else mergeSelected.delete(set.id);
          });

          item.appendChild(check);
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
        dateEl.textContent = `${set.date} · ${set.tabs.length}개`;

        left.appendChild(titleEl);
        left.appendChild(memoEl);
        left.appendChild(dateEl);

        const delBtn = document.createElement("button");
        delBtn.className = "delete-btn";
        delBtn.textContent = "🗑";
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteSet(set.id);
        });

        header.appendChild(left);
        header.appendChild(delBtn);
        item.appendChild(header);

        const catEl = document.createElement("div");
        catEl.className = `set-item-category category-${set.category || "기타"}`;
        catEl.textContent = set.category || "기타";
        item.appendChild(catEl);

        item.addEventListener("click", () => {
          if (!mergeMode) showDetailView(set);
        });

        setsListEl.appendChild(item);
      });
    });
  }

  // -----------------------------
  // 현재 탭 저장 (수동 저장)
  // -----------------------------
  function handleSaveCurrentTabs() {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      const filteredTabs = filterExcludedTabs(tabs);
      if (!filteredTabs.length) {
        alert("저장할 수 있는 탭이 없습니다. (새 탭 / 확장 페이지 제외)");
        return;
      }

      const simple = filteredTabs.map(t => ({
        title: t.title,
        url: t.url,
        favicon: t.favIconUrl || ""
      }));

      const autoCat = detectCategory(simple);
      const autoTitle = detectTitle(simple);

      chrome.storage.local.get(["sets"], (result) => {
        const sets = result.sets || [];

        const now = new Date();
        const dateStr =
          `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")} ` +
          `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

        sets.push({
          id: now.getTime(),
          title: autoTitle,
          date: dateStr,
          memo: "",
          category: autoCat,
          tabs: simple
        });

        chrome.storage.local.set({ sets }, () => loadSets());
      });
    });
  }

  // -----------------------------
  // 상세 보기
  // -----------------------------
  function showDetailView(set) {
    currentSet = set;
    selectedTabIndexes.clear();

    detailTitleEl.textContent = set.title || "이름 없는 세트";
    detailTitleEl.onclick = () => startEditTitle(set);

    detailMetaEl.innerHTML = `
      <div>${set.category || "기타"}</div>
      <div>${set.date}</div>
      <div>${set.tabs.length}개 탭</div>
    `;

    detailTabsEl.innerHTML = "";

    set.tabs.forEach((tab, index) => {
      const div = document.createElement("div");
      div.className = "detail-tab-item";

      div.innerHTML = `
        <input type="checkbox" data-index="${index}" />
        <img src="${tab.favicon}" width="16" height="16" />
        <div class="detail-tab-title">${tab.title}</div>
        <button class="detail-tab-open-btn">↗</button>
        <button class="detail-tab-delete-btn">❌</button>
      `;

      div.querySelector(".detail-tab-open-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        chrome.tabs.create({ url: tab.url });
      });

      div.querySelector(".detail-tab-delete-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        deleteTabFromSet(set, index);
      });

      div.querySelector("input").addEventListener("change", (e) => {
        const idx = Number(e.target.dataset.index);
        if (e.target.checked) selectedTabIndexes.add(idx);
        else selectedTabIndexes.delete(idx);
      });

      detailTabsEl.appendChild(div);
    });

    document.querySelector(".container").classList.add("hidden");
    detailView.classList.remove("hidden");
  }

  // -----------------------------
  // 세트 내부 개별 탭 삭제
  // -----------------------------
  function deleteTabFromSet(set, index) {
    chrome.storage.local.get(["sets"], (result) => {
      let updated = (result.sets || []).map(s => {
        if (s.id === set.id) {
          return {
            ...s,
            tabs: s.tabs.filter((_, i) => i !== index)
          };
        }
        return s;
      });

      chrome.storage.local.set({ sets: updated }, () => {
        const newSet = updated.find(s => s.id === set.id);
        showDetailView(newSet);
        loadSets();
      });
    });
  }

  // -----------------------------
  // 세트 삭제
  // -----------------------------
  function deleteSet(id) {
    chrome.storage.local.get(["sets"], (result) => {
      const newSets = (result.sets || []).filter(s => s.id !== id);
      chrome.storage.local.set({ sets: newSets }, () => loadSets());
    });
  }

  // -----------------------------
  // 뒤로가기
  // -----------------------------
  backBtn.addEventListener("click", () => {
    detailView.classList.add("hidden");
    document.querySelector(".container").classList.remove("hidden");
  });

  // -----------------------------
  // 선택한 탭 열기
  // -----------------------------
  openSelectedBtn.addEventListener("click", () => {
    if (!currentSet) return;

    const urls = [...selectedTabIndexes].map(i => currentSet.tabs[i].url);
    if (urls.length === 0) return;

    chrome.windows.create({ url: urls });
  });

  // -----------------------------
  // 제목 수정
  // -----------------------------
  function startEditTitle(set) {
    const input = document.createElement("input");
    input.className = "detail-title-input";
    input.value = set.title || "";

    detailTitleEl.replaceWith(input);
    input.focus();

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") finishEditTitle(set, input.value);
    });

    input.addEventListener("blur", () => finishEditTitle(set, input.value));
  }

  function finishEditTitle(set, newTitle) {
    newTitle = newTitle.trim() || "제목 없음";

    chrome.storage.local.get(["sets"], (result) => {
      const updated = (result.sets || []).map(s => {
        if (s.id === set.id) return { ...s, title: newTitle };
        return s;
      });

      chrome.storage.local.set({ sets: updated }, () => {
        const titleDiv = document.createElement("div");
        titleDiv.id = "detail-title";
        titleDiv.className = "detail-title";
        titleDiv.textContent = newTitle;
        titleDiv.onclick = () => startEditTitle(set);

        const input = document.querySelector(".detail-title-input");
        input.replaceWith(titleDiv);
      });
    });
  }

  // -----------------------------
  // 세트 병합
  // -----------------------------
  function mergeSets(ids) {
    chrome.storage.local.get(["sets"], (result) => {
      let sets = result.sets || [];
      const targetSets = sets.filter(s => ids.includes(s.id));

      let mergedTabs = [];
      targetSets.forEach(s => {
        mergedTabs = mergedTabs.concat(s.tabs);
      });

      const uniqueTabs = Array.from(new Map(mergedTabs.map(t => [t.url, t])).values());

      const now = new Date();
      const dateStr =
        `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")} ` +
        `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

      const newSet = {
        id: now.getTime(),
        title: "병합된 세트",
        date: dateStr,
        memo: "",
        category: "기타",
        tabs: uniqueTabs
      };

      sets = sets.filter(s => !ids.includes(s.id));
      sets.push(newSet);

      chrome.storage.local.set({ sets }, () => {
        mergeMode = false;
        mergeSelected.clear();
        mergeBtn.textContent = "세트 병합 모드";
        loadSets();
        alert("세트 병합 완료!");
      });
    });
  }

  // -----------------------------
  // 초기 로딩
  // -----------------------------
  loadSets();
});