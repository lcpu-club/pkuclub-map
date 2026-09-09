const REGION_RANGES = [
  { id: 1, label: "区域①", range: "1–30", min: 1, max: 30 },
  { id: 2, label: "区域②", range: "31–65", min: 31, max: 65 },
  { id: 3, label: "区域③", range: "66–90", min: 66, max: 90 },
  { id: 4, label: "区域④", range: "91–100", min: 91, max: 100 },
  { id: 5, label: "区域⑤", range: "101–120", min: 101, max: 120 },
  { id: 6, label: "区域⑥", range: "121–145", min: 121, max: 145 },
  { id: 7, label: "区域⑦", range: "146–165", min: 146, max: 165 },
  { id: 8, label: "区域⑧", range: "166–175", min: 166, max: 175 },
];

const state = { clubs: [], query: "", region: 0, selectedBooth: null };
const els = {
  searchForm: document.querySelector("#search-form"),
  searchPanel: document.querySelector(".search-panel"),
  searchInput: document.querySelector("#search-input"),
  clearSearch: document.querySelector("#clear-search"),
  regionFilters: document.querySelector("#region-filters"),
  resultCount: document.querySelector("#result-count"),
  activeFilter: document.querySelector("#active-filter"),
  resultsColumn: document.querySelector(".results-column"),
  results: document.querySelector("#results"),
  mapRegion: document.querySelector("#map-region"),
  mapFrame: document.querySelector(".map-frame"),
  mapZones: [...document.querySelectorAll("[data-map-zone]")],
  backToSearch: document.querySelector("#back-to-search"),
};

function normalize(text) {
  return String(text).toLocaleLowerCase().replace(/[\s··“”"'‘’()（）【】\[\]、，。]/g, "");
}

function getRegion(booth) {
  return REGION_RANGES.find((region) => booth >= region.min && booth <= region.max) || null;
}

function orderedCharacterScore(query, target, baseScore) {
  if (query.length < 2 || query.length >= target.length) return -1;

  let searchFrom = 0;
  let firstMatch = -1;
  let lastMatch = -1;
  for (const character of query) {
    const matchAt = target.indexOf(character, searchFrom);
    if (matchAt === -1) return -1;
    if (firstMatch === -1) firstMatch = matchAt;
    lastMatch = matchAt;
    searchFrom = matchAt + 1;
  }

  const gapCount = lastMatch - firstMatch + 1 - query.length;
  return baseScore - gapCount * 6 - (target.length - query.length);
}

function matchScore(club, query) {
  if (!query) return 0;

  const name = normalize(club.name);
  const aliases = (club.aliases || []).map(normalize).filter(Boolean);
  if (name === query) return 1000;
  if (aliases.includes(query)) return 950;
  if (name.startsWith(query)) return 850;
  if (aliases.some((alias) => alias.startsWith(query))) return 800;
  if (name.includes(query)) return 700;
  if (aliases.some((alias) => alias.includes(query))) return 650;

  // 只接受原字符按顺序出现，不使用同音字、拼音或编辑距离替换。
  return Math.max(
    orderedCharacterScore(query, name, 450),
    ...aliases.map((alias) => orderedCharacterScore(query, alias, 420)),
  );
}

function renderRegionFilters() {
  const buttons = [{ id: 0, label: "全部", range: `${state.clubs.length} 个社团` }, ...REGION_RANGES];
  els.regionFilters.innerHTML = buttons.map((item) => {
    const label = item.id === 0 ? item.label : `${item.label} ${item.range}`;
    return `<button class="region-filter${state.region === item.id ? " is-active" : ""}" type="button" data-region="${item.id}">${label}</button>`;
  }).join("");
}

function filteredClubs() {
  const query = normalize(state.query);
  const matches = state.clubs.map((club) => {
    const inRegion = !state.region || getRegion(club.booth)?.id === state.region;
    return { club, score: inRegion ? matchScore(club, query) : -1 };
  }).filter((item) => item.score >= 0);

  if (!matches.length) return [];
  const bestScore = Math.max(...matches.map((item) => item.score));
  const minimumScore = !query
    ? 0
    : bestScore >= 1000
      ? 1000
      : bestScore >= 950
        ? 950
        : bestScore >= 650
          ? 650
          : bestScore - 24;
  return matches.filter((item) => item.score >= minimumScore)
    .sort((a, b) => query
      ? b.score - a.score || a.club.name.length - b.club.name.length || a.club.booth - b.club.booth
      : a.club.booth - b.club.booth)
    .map((item) => item.club);
}

function renderResults() {
  const clubs = filteredClubs();
  const region = state.region ? REGION_RANGES.find((item) => item.id === state.region) : null;
  els.activeFilter.textContent = region ? `${region.label} · ${region.range}` : "全部区域";
  els.resultCount.textContent = `${clubs.length} / ${state.clubs.length} 个社团`;

  if (!clubs.length) {
    els.results.innerHTML = `<div class="empty-state">没有找到匹配的社团，请检查名称或尝试其他常用简称。</div>`;
    return;
  }

  els.results.innerHTML = clubs.map((club) => {
    const clubRegion = getRegion(club.booth);
    const selected = state.selectedBooth === club.booth;
    return `<button class="result-item${selected ? " is-selected" : ""}" type="button" data-booth="${club.booth}">
      <span class="result-name">${club.name}</span>
      <span class="result-meta"><span class="region-tag">${clubRegion?.label || "待标注"}</span><span>展位</span><strong class="booth-number">${club.booth}</strong></span>
    </button>`;
  }).join("");
}

function renderMapHighlight() {
  const selectedRegion = state.selectedBooth == null ? null : getRegion(state.selectedBooth)?.id;
  els.mapFrame?.classList.toggle("has-highlight", selectedRegion != null);
  if (els.mapFrame) {
    els.mapFrame.dataset.highlightRegion = selectedRegion ? `区域${String.fromCharCode(9311 + selectedRegion)}` : "";
  }
  els.mapZones.forEach((zone) => {
    const isSelected = selectedRegion != null && Number(zone.dataset.mapZone) === selectedRegion;
    zone.classList.toggle("is-highlighted", isSelected);
    zone.classList.toggle("is-dimmed", selectedRegion != null && !isSelected);
  });
}

function clearSelection(message = "选择社团后查看区域") {
  state.selectedBooth = null;
  els.mapRegion.textContent = message;
  renderMapHighlight();
}

function selectClub(booth) {
  state.selectedBooth = booth;
  const region = getRegion(booth);
  els.mapRegion.textContent = region ? `${region.label} · 展位 ${booth}` : `展位 ${booth}`;
  renderMapHighlight();
  renderResults();
  if (window.matchMedia("(max-width: 820px)").matches) {
    els.mapFrame?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

async function loadClubs() {
  try {
    const response = await fetch("pku-2026-spring-booths.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.clubs = (await response.json()).sort((a, b) => a.booth - b.booth);
    renderRegionFilters();
    renderResults();
  } catch (error) {
    els.resultCount.textContent = "名单加载失败";
    els.results.innerHTML = `<div class="empty-state">无法读取名单文件。请通过本地服务器打开此页面。</div>`;
    console.error(error);
  }
}

els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  clearSelection();
  renderResults();
});

els.clearSearch.addEventListener("click", () => {
  els.searchInput.value = "";
  state.query = "";
  clearSelection();
  renderResults();
  els.searchInput.focus();
});

els.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  renderResults();
  els.searchInput.blur();
  if (window.matchMedia("(max-width: 820px)").matches) {
    els.resultsColumn?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

els.regionFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-region]");
  if (!button) return;
  state.region = Number(button.dataset.region);
  clearSelection(state.region ? `${REGION_RANGES[state.region - 1].label} · 请选择社团` : "选择社团后查看区域");
  renderRegionFilters();
  renderResults();
});

els.results.addEventListener("click", (event) => {
  const item = event.target.closest("[data-booth]");
  if (item) selectClub(Number(item.dataset.booth));
});

els.backToSearch.addEventListener("click", () => {
  els.searchInput.focus({ preventScroll: true });
  els.searchPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
});

if ("IntersectionObserver" in window) {
  const mobileView = window.matchMedia("(max-width: 820px)");
  let searchPanelVisible = true;
  const updateBackToSearch = () => {
    els.backToSearch.hidden = !mobileView.matches || searchPanelVisible;
  };
  new IntersectionObserver(([entry]) => {
    searchPanelVisible = entry.isIntersecting;
    updateBackToSearch();
  }, { threshold: 0.1 }).observe(els.searchPanel);
  mobileView.addEventListener?.("change", updateBackToSearch);
}

loadClubs();
