const clock = document.getElementById("clock");
const status = document.getElementById("status");
const form = document.getElementById("searchForm");
const input = document.getElementById("searchInput");
const tabsList = document.getElementById("tabsList");
const historyList = document.getElementById("historyList");
const recentSitesSection = document.getElementById("recentSitesSection");
const tabsSection = document.getElementById("tabsSection");
const wallpaper = document.getElementById("wallpaper");

const REFRESH_MS = 3 * 60 * 60 * 1000;
const MAX_RECENT = 8;
const ICON_MIN_WIDTH = 96;
let recentEntries = [];
let wallpapers = [];
let currentIndex = 0;

function updateClock() {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
updateClock();
setInterval(updateClock, 1000);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query) return;

  if (chrome.search && chrome.search.query) {
    chrome.search.query({ text: query });
  } else {
    window.location.href = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  }
});

function makeCard(title, url, meta) {
  const a = document.createElement("div");
  a.className = "item card";

  a.innerHTML = `
    <div class="card-title">${title}</div>
    <div class="card-meta">${url}</div>
  `;

  a.addEventListener("click", () => {
    chrome.tabs.update(meta.tabId, { active: true });
    chrome.windows.update(meta.windowId, { focused: true });
  });

  return a;
}

function makeIcon(title, url) {
  const a = document.createElement("a");
  a.className = "item icon";
  a.href = url;
  a.target = "_blank";
  a.rel = "noreferrer";
  a.title = title;

  const label = title
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];

  a.innerHTML =
    `
    <img class="icon-badge" src="https://www.google.com/s2/favicons?sz=64&domain_url=` +
    url +
    `" alt="` +
    title +
    `"/>
    <div class="icon-label">${label}</div>
  `;
  return a;
}

async function loadWallpaper() {
  try {
    const response = await fetch(
      "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=3&uhd=1&mkt=en-US",
      { cache: "no-store" },
    );

    const data = await response.json();

    wallpapers = (data.images || []).map((img) => ({
      url: `https://www.bing.com${img.url}`,
      copyright: img.copyright,
    }));

    if (!wallpapers.length) throw new Error("No wallpapers");

    currentIndex = 0;
    applyWallpaper();
  } catch (error) {
    status.textContent = "bing wallpaper blocked (check host_permissions)";
  }
}

function applyWallpaper() {
  const wp = wallpapers[currentIndex];
  if (!wp) return;

  wallpaper.style.backgroundImage = `url('${wp.url}')`;
  status.textContent = wp.copyright || "bing wallpaper";
}

function loadOpenTabs() {
  if (!chrome.tabs) return (tabsSection.style.display = "none");

  chrome.tabs.query({}, (tabs) => {
    const items = tabs
      .filter((tab) => tab.title && tab.url && /^https?:/.test(tab.url))
      .slice(0, 6)
      .map((tab) =>
        makeCard(tab.title, tab.url, {
          tabId: tab.id,
          windowId: tab.windowId,
        }),
      );

    if (!items.length) return (tabsSection.style.display = "none");

    tabsList.replaceChildren(...items);
    tabsSection.style.display = "block";
  });
}

function getRecentLimit() {
  const width = historyList.clientWidth || 0;
  if (!width) return MAX_RECENT;
  const columns = Math.max(1, Math.floor(width / ICON_MIN_WIDTH));
  return Math.min(MAX_RECENT, columns);
}

function renderRecentSites() {
  if (!recentEntries.length) {
    recentSitesSection.style.display = "none";
    return;
  }

  const seen = new Set();

  const uniqueEntries = recentEntries.filter((entry) => {
    const key = entry.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const limit = getRecentLimit();

  const items = uniqueEntries
    .slice(0, limit)
    .map((entry) => makeIcon(entry.title, entry.url));

  historyList.replaceChildren(...items);
  recentSitesSection.style.display = "block";
}

function loadRecentSites() {
  chrome.history.search(
    {
      text: "",
      maxResults: 40,
      startTime: Date.now() - 1000 * 60 * 60 * 24 * 7,
    },
    (results) => {
      const seen = new Set();
      recentEntries = results
        .filter(
          (entry) => entry.title && entry.url && /^https?:/.test(entry.url),
        )
        .filter((entry) => {
          const key = entry.url.split("#")[0];
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((entry) => ({ title: entry.title, url: entry.url }));

      renderRecentSites();
    },
  );
}

document.getElementById("prevWallpaper").addEventListener("click", () => {
  if (!wallpapers.length) return;
  currentIndex = (currentIndex - 1 + wallpapers.length) % wallpapers.length;
  applyWallpaper();
});

document.getElementById("nextWallpaper").addEventListener("click", () => {
  if (!wallpapers.length) return;
  currentIndex = (currentIndex + 1) % wallpapers.length;
  applyWallpaper();
});

document.getElementById("toggleWallpaper").addEventListener("click", () => {
  document.body.classList.toggle("dim-wallpaper");
});

const historyObserver = new ResizeObserver(() => renderRecentSites());
historyObserver.observe(historyList);

loadWallpaper();
setInterval(loadWallpaper, REFRESH_MS);
loadOpenTabs();
loadRecentSites();
