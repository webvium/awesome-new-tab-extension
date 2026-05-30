const clock = document.getElementById("clock");
const status = document.getElementById("status");
const form = document.getElementById("searchForm");
const input = document.getElementById("searchInput");
const tabsList = document.getElementById("tabsList");
const historyList = document.getElementById("historyList");
const REFRESH_MS = 3 * 60 * 60 * 1000;

const MAX_RECENT = 8;
const ICON_MIN_WIDTH = 96;
let recentEntries = [];

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

function renderItems(container, items, emptyText) {
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML = `<div class="empty">${emptyText}</div>`;
    return;
  }
  container.append(...items);
}

function makeCard(title, url, meta) {
  const a = document.createElement("a");
  a.className = "item card";
  a.href = url;
  a.target = "_blank";
  a.rel = "noreferrer";
  a.innerHTML = `
    <div class="card-title">${title}</div>
    <div class="card-meta">${meta}</div>
  `;
  return a;
}

function makeIcon(title, url) {
  const a = document.createElement("a");
  a.className = "item icon";
  a.href = url;
  a.target = "_blank";
  a.rel = "noreferrer";
  const label = title
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  const icon = label.slice(0, 1).toUpperCase();
  a.innerHTML = `
    <div class="icon-badge">${icon || "?"}</div>
    <div class="icon-label">${label}</div>
  `;
  return a;
}

async function loadWallpaper() {
  try {
    const response = await fetch(
      "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&uhd=1&mkt=en-US",
      {
        cache: "no-store",
      },
    );
    const data = await response.json();
    const image = data?.images?.[0];
    if (!image) throw new Error("No image data");
    const url = `https://www.bing.com${image.url}`;
    document.body.style.backgroundImage = `url('${url}')`;
    status.textContent = image.copyright || "bing wallpaper";
  } catch (error) {
    status.textContent = "bing wallpaper blocked (check host_permissions)";
  }
}

function loadOpenTabs() {
  chrome.tabs.query({}, (tabs) => {
    const items = tabs
      .filter((tab) => tab.title && tab.url && /^https?:/.test(tab.url))
      .slice(0, 6)
      .map((tab) => makeCard(tab.title, tab.url, "open tab"));
    renderItems(tabsList, items, "No regular tabs visible.");
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
    renderItems(historyList, [], "No history to show.");
    return;
  }
  const limit = getRecentLimit();
  const items = recentEntries
    .slice(0, limit)
    .map((entry) => makeIcon(entry.title, entry.url));
  renderItems(historyList, items, "No history to show.");
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

const historyObserver = new ResizeObserver(() => renderRecentSites());
historyObserver.observe(historyList);

loadWallpaper();
setInterval(loadWallpaper, REFRESH_MS);
loadOpenTabs();
loadRecentSites();
