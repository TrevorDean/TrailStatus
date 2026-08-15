import { TRAILS as trails } from "/trails.js";
import { TRAIL_STATS } from "/trail-stats.js";

// Staging-only visual marker so the two environments are easy to tell apart.
if (location.hostname.includes("staging")) {
  const h1 = document.querySelector("h1");
  if (h1) {
    h1.textContent += " STAGING";
    h1.classList.add("staging-title");
  }
  document.title += " STAGING";
}

const SECTION_ORDER = ["North Dallas Region", "East Dallas Region", "South Dallas Region", "Mid-Cities Region", "Far North Region", "Fort Worth", "Tyler", "Waco", "Weatherford"];

const SECTION_DISPLAY = {
  "Weatherford": "Weatherford Region",
  "Fort Worth": "Fort Worth Region",
  "Tyler": "Tyler Region"
};

const LTA_LINKS = {
  "Barber Hills Trail Association": "https://visitparistexas.com/cycling-destination/",
  "DORBA": "https://dorba.org/",
  "Dallas Off Road Bicycle Association": "https://dorba.org/",
  "FWMBA": "https://fwmba.org/",
  "WMBC": "https://www.wmbctx.com/",
  "WBC": "https://www.wacobicycleclub.com/",
  "ETXTA": "https://www.trailforks.com/directory/10525/",
  "Burleson MTB Riders": "https://www.facebook.com/groups/579687176161531",
  "Denton Trails": "https://www.dentontrails.org/home",
  "DT": "https://www.dentontrails.org/home",
  "Hachie MTB Trail Riders": "https://www.facebook.com/groups/HachieMTB",
  "Waco Bicycle Club": "https://www.wacobicycleclub.com/",
  "City of Murphy": "https://www.murphytx.org/295/Preserve-at-Maxwell-Creek",
  "Bridgeport": "https://www.facebook.com/HikeBikeBridgeport/"
};

const groupsEl = document.querySelector("#trail-groups");
const searchEl = document.querySelector("#trail-search");
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const statusFilterButtons = [...document.querySelectorAll("[data-status-filter]")];
const difficultyButtons = [...document.querySelectorAll("[data-difficulty]")];
let activeFilters = new Set();
let activeStatusFilter = "all";
let activeDifficulty = "all";
let statuses = {};
let currentView = "list";
const collapsedSections = new Set();
const favoritedTrails = new Set(JSON.parse(localStorage.getItem('ntxmtb-favorites') || '[]'));

function saveFavorites() {
  localStorage.setItem('ntxmtb-favorites', JSON.stringify([...favoritedTrails]));
}

groupsEl.addEventListener("click", (e) => {
  const favBtn = e.target.closest(".fav-btn");
  if (favBtn) {
    const key = favBtn.dataset.key;
    if (favoritedTrails.has(key)) {
      favoritedTrails.delete(key);
    } else {
      favoritedTrails.add(key);
    }
    saveFavorites();
    render();
    return;
  }
  const h2 = e.target.closest("h2");
  if (!h2) return;
  const section = h2.closest(".city-section");
  if (!section) return;
  const city = section.dataset.city;
  if (collapsedSections.has(city)) {
    collapsedSections.delete(city);
    section.classList.remove("collapsed");
  } else {
    collapsedSections.add(city);
    section.classList.add("collapsed");
  }
});

document.querySelector("main").addEventListener("click", (e) => {
  const h2 = e.target.closest(".manual-checks h2");
  if (!h2) return;
  h2.closest(".manual-checks").classList.toggle("collapsed");
});

function trailStatusWidgetUrl(trailId) {
  const params = new URLSearchParams({
    trailid: trailId,
    width: "100%",
    height: "80",
    displaytype: "table",
    noheader: "1",
    cols: "status,trail,date,condition,report"
  });

  return `https://www.trailforks.com/widgets/trails_status/?${params.toString()}`;
}

function getVisibleTrails() {
  const search = searchEl.value.trim().toLowerCase();
  return trails.filter((trail) => {
    const matchesCity = activeFilters.size === 0 || activeFilters.has(trail.city);
    const cityForSearch = statuses[trail.key]?.city || trail.city;
    const matchesSearch = `${cityForSearch} ${trail.name} ${trail.statusArea}`.toLowerCase().includes(search);
    const status = (statuses[trail.key]?.status || "").toLowerCase();
    const matchesStatus =
      activeStatusFilter === "all" ||
      (activeStatusFilter === "rideable" && (status.includes("open") || status.includes("caution") || status.includes("ideal") || status.includes("dry") || status.includes("variable"))) ||
      (activeStatusFilter === "closed" && (status.includes("closed") || status.includes("wet") || status.includes("mud")));
    // Trailheads with no sub-trail data have no band, so they only show under "All".
    const stats = TRAIL_STATS[trail.key];
    const matchesDifficulty =
      activeDifficulty === "all" ||
      (stats != null && difficultyBand(stats.avgDifficulty).toLowerCase() === activeDifficulty);
    return matchesCity && matchesSearch && matchesStatus && matchesDifficulty;
  });
}

function renderCurrentView() {
  if (currentView === "map") renderMap();
  else render();
}

function render() {
  const visibleTrails = getVisibleTrails();

  const sections = SECTION_ORDER.filter(city => visibleTrails.some(t => t.city === city));

  let favHtml = "";
  const favTrails = visibleTrails.filter(t => favoritedTrails.has(t.key));
  if (favTrails.length > 0) {
    const isCollapsed = collapsedSections.has("__favorites__");
    favHtml = `
      <section class="city-section favorites-section${isCollapsed ? " collapsed" : ""}" data-city="__favorites__">
        <h2>Favorites</h2>
        <div class="trail-table" role="table" aria-label="Favorite trails">
          <div class="trail-heading" role="row">
            <span>Trail Name</span>
            <span>Status</span>
            <span>Updated</span>
            <span>City</span>
            <span>Trail Org</span>
            <span>Source</span>
          </div>
          <div class="trail-list">${favTrails.map(renderRow).join("")}</div>
        </div>
      </section>
    `;
  }

  groupsEl.innerHTML = favHtml + sections
    .map((city) => {
      const sectionTrails = visibleTrails
        .filter(t => t.city === city)
        .sort((a, b) => a.name.localeCompare(b.name));
      const rowsHtml = sectionTrails.map(renderRow).join("");

      return `
        <section class="city-section${collapsedSections.has(city) ? " collapsed" : ""}" data-city="${city}">
          <h2>${SECTION_DISPLAY[city] || city}</h2>
          <div class="trail-table" role="table" aria-label="${SECTION_DISPLAY[city] || city} trail statuses">
            <div class="trail-heading" role="row">
              <span>Trail Name</span>
              <span>Status</span>
              <span>Updated</span>
              <span>City</span>
              <span>Trail Org</span>
              <span>Source</span>
            </div>
            <div class="trail-list">${rowsHtml}</div>
          </div>
        </section>
      `;
    })
    .join("");
}

// --- Trail stats (generated from Trailforks by scripts/extract-trail-stats.js) ---

// Difficulty is a 0.5-3.5 mean: white .5, green 1, blue 2, black 3, dbl black
// and pro 3.5. Each trailhead is named by band so the number has a plain-English
// anchor; upper bound first match wins.
// Three bands, matching the Difficulty picker's options exactly — a band with no
// filter option would be unreachable, and an option with no band would be dead.
const DIFFICULTY_BANDS = [
  [1.4, "Beginner"],
  [2.2, "Intermediate"],
  [Infinity, "Expert"]
];

function difficultyBand(avg) {
  return DIFFICULTY_BANDS.find(([max]) => avg <= max)[1];
}

function difficultyText(avg) {
  const n = avg.toFixed(1); // keep 1dp so a flat 1 reads "1.0", not "1"
  return `${difficultyBand(avg)} ${n}`;
}

// variant "popup" is the map detail popup, which drops the trail count and
// spells out "Total Climb"; "tip" is the list-view hover.
function statsRows(key, variant = "tip") {
  const s = TRAIL_STATS[key];
  if (!s) return null;
  const rows = [
    ["Difficulty", difficultyText(s.avgDifficulty)],
    ["Distance", `${s.totalMiles.toFixed(1)} mi`],
    [variant === "popup" ? "Total Climb" : "Climb", `${s.totalClimbFt.toLocaleString()} ft`],
    ["Per mile", `${s.ftPerMile.toLocaleString()} ft/mi`]
  ];
  if (variant !== "popup") rows.push(["Trails", String(s.trailCount)]);
  return rows;
}

function statGridHtml(rows) {
  return rows
    .map(([label, value]) => `<span class="stat-label">${label}:</span><span class="stat-value">${value}</span>`)
    .join("");
}

function statsTipHtml(trail) {
  const rows = statsRows(trail.key, "tip");
  if (!rows) return "";
  return `<div class="trail-stats-tip" role="tooltip"><div class="stat-title">${trail.name}</div><div class="stat-grid">${statGridHtml(rows)}</div></div>`;
}

function statsPopupHtml(trail) {
  const rows = statsRows(trail.key, "popup");
  if (!rows) return "";
  return `<div class="map-popup-stats"><div class="stat-grid">${statGridHtml(rows)}</div></div>`;
}

// Map marker hover: name plus the two headline numbers, no status (the marker
// colour already carries status).
function markerTooltipText(trail) {
  const s = TRAIL_STATS[trail.key];
  if (!s) return trail.name;
  return `${trail.name} — ${s.totalMiles.toFixed(1)} mi · ${s.totalClimbFt.toLocaleString()} ft climb`;
}

function renderRow(trail) {
  const current = statuses[trail.key];
  const hasWidgetStatus = trail.rid || trail.trailId;
  const status = current?.status || "Loading";
  const statusClass = statusClassFor(status);
  const sourceText = trail.rid || trail.trailId ? `${trail.statusType}: ${trail.statusArea}` : "Manual lookup";
  const statusUrl = trail.sourceUrl || (trail.trailId ? trailStatusWidgetUrl(trail.trailId) : trail.url);
  const updated = formatUpdated(current?.updated || "");
  const linkText = statusUrl.includes("trailforks.com") ? "Trailforks" : "Find status";

  const isFav = favoritedTrails.has(trail.key);
  const favBtn = `<button class="fav-btn" data-key="${trail.key}" aria-label="${isFav ? "Remove from favorites" : "Add to favorites"}">${isFav ? "★" : "☆"}</button>`;

  return `
    <article class="trail-row" data-city="${trail.city}" role="row">
      <div class="trail-name-cell">${favBtn}<a class="trail-name" href="${trail.url}" title="${sourceText}">${trail.name}</a></div>
      <span class="status-pill ${statusClass}">${status}</span>
      <span class="status-updated">${trail.updatedNote ? `<span class="updated-note" tabindex="0" data-tooltip="${trail.updatedNote}">${updated}</span>` : updated}</span>
      <span class="trail-city">${trail.displayCity || statuses[trail.key]?.city || trail.city}</span>
      <span class="trail-lta">${renderLTA(statuses[trail.key]?.lta || trail.lta || "Unknown")}</span>
      <a class="status-link" href="${statusUrl}">${linkText}</a>
      ${statsTipHtml(trail)}
    </article>
  `;
}

function renderLTA(lta) {
  const url = LTA_LINKS[lta];
  if (url) return `<a href="${url}" target="_blank" rel="noopener">${lta}</a>`;
  return lta;
}

function formatUpdated(updated) {
  if (!updated) return "Unknown";
  if (/^(today|yesterday|\d+\s+(minute|hour|day|week)s?)$/i.test(updated)) return updated;
  const date = new Date(updated);
  // Guard against scraped page/menu text leaking into the UI: an unparseable
  // value is only shown if it's short enough to plausibly be a date.
  if (isNaN(date.getTime())) return String(updated).length <= 24 ? updated : "Unknown";
  const sixWeeksAgo = new Date();
  sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);
  if (date < sixWeeksAgo) {
    return `<span class="stale-date" tabindex="0" data-tooltip="No recent update. Check with trail org for conditions or closures.">${updated}</span>`;
  }
  return updated;
}

function statusClassFor(status) {
  const normalized = status.toLowerCase();
  if (normalized.includes("closed") || normalized.includes("wet") || normalized.includes("mud")) {
    return "status-closed";
  }
  if (normalized.includes("caution") || normalized.includes("variable")) {
    return "status-caution";
  }
  if (normalized.includes("open") || normalized.includes("ideal") || normalized.includes("dry")) {
    return "status-open";
  }
  if (normalized.includes("manual") || normalized.includes("unavailable")) {
    return "status-manual";
  }
  return "status-unknown";
}

// ---- Map view (Leaflet) ----
const mapEl = document.querySelector("#trail-map");
let map = null;
let markerLayer = null;

function ensureMap() {
  if (map) {
    map.invalidateSize();
    return;
  }
  map = L.map(mapEl, { scrollWheelZoom: true }).setView([32.75, -97.1], 8);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
}

function markerClassFor(status) {
  return statusClassFor(status).replace("status-", "marker-");
}

// Prefer the Trailforks parking coordinates for the marker; fall back to the
// trail's approximate geocoded position when no parking link was found.
function markerLatLng(trail) {
  const lat = typeof trail.parkingLat === "number" ? trail.parkingLat : trail.lat;
  const lng = typeof trail.parkingLng === "number" ? trail.parkingLng : trail.lng;
  return [lat, lng];
}

// Google Maps driving directions to the trail's parking lot, using the same
// coordinates Trailforks links to. Null when we have no real parking pin.
function parkingDirectionsUrl(trail) {
  if (typeof trail.parkingLat !== "number" || typeof trail.parkingLng !== "number") return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${trail.parkingLat},${trail.parkingLng}`;
}

function mapPopupHtml(trail) {
  const current = statuses[trail.key];
  const status = current?.status || "Loading";
  const statusClass = statusClassFor(status);
  const updated = formatUpdated(current?.updated || "");
  const statusUrl = trail.sourceUrl || (trail.trailId ? trailStatusWidgetUrl(trail.trailId) : trail.url);
  const linkText = statusUrl.includes("trailforks.com") ? "Trailforks" : "Find status";
  const city = trail.displayCity || statuses[trail.key]?.city || trail.city;
  const lta = renderLTA(statuses[trail.key]?.lta || trail.lta || "Unknown");
  const parkingUrl = parkingDirectionsUrl(trail);
  const parkingLink = parkingUrl
    ? `<a class="map-popup-link map-popup-parking" href="${parkingUrl}" target="_blank" rel="noopener">🅿️ Directions to parking</a>`
    : "";
  return `
    <div class="map-popup">
      <a class="map-popup-name" href="${trail.url}" target="_blank" rel="noopener">${trail.name}</a>
      <div class="map-popup-row"><span class="status-pill ${statusClass}">${status}</span></div>
      <div class="map-popup-meta"><strong>Updated:</strong> ${updated}</div>
      <div class="map-popup-meta"><strong>City:</strong> ${city}</div>
      <div class="map-popup-meta"><strong>Trail org:</strong> ${lta}</div>
      ${statsPopupHtml(trail)}
      <div class="map-popup-links">
        <a class="map-popup-link" href="${statusUrl}" target="_blank" rel="noopener">${linkText}</a>
        ${parkingLink}
      </div>
    </div>
  `;
}

function renderMap(fitBounds = true) {
  if (!map || !markerLayer) return;
  markerLayer.clearLayers();
  const visible = getVisibleTrails().filter((t) => {
    const [lat, lng] = markerLatLng(t);
    return typeof lat === "number" && typeof lng === "number";
  });
  const points = [];
  visible.forEach((trail) => {
    const status = statuses[trail.key]?.status || "Loading";
    const icon = L.divIcon({
      className: "trail-marker-wrap",
      html: `<span class="trail-marker ${markerClassFor(status)}"></span>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -9]
    });
    const latLng = markerLatLng(trail);
    // bindTooltip, not the native `title` attribute: the browser delays title
    // tooltips ~1s, whereas Leaflet shows this the instant the pointer lands.
    const marker = L.marker(latLng, { icon })
      .bindTooltip(markerTooltipText(trail), { direction: "top", offset: [0, -10], className: "trail-marker-tip" })
      .bindPopup(mapPopupHtml(trail));
    markerLayer.addLayer(marker);
    points.push(latLng);
  });
  if (fitBounds && points.length) {
    map.fitBounds(points, { padding: [40, 40], maxZoom: 12 });
  }
}

async function loadStatuses() {
  try {
    const response = await fetch("/api/status");
    if (!response.ok) {
      throw new Error(`Status request failed with ${response.status}`);
    }

    const data = await response.json();
    statuses = data.statuses || {};
  } catch (error) {
    statuses = Object.fromEntries(
      trails.map((trail) => [
        trail.key,
        {
          status: "Unavailable",
          detail: "Status feed unavailable",
          updated: ""
        }
      ])
    );
  }

  renderCurrentView();
}

const viewButtons = [...document.querySelectorAll("[data-view]")];
viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentView = button.dataset.view;
    viewButtons.forEach((b) => b.classList.toggle("active", b === button));
    const isMap = currentView === "map";
    groupsEl.classList.toggle("hidden", isMap);
    mapEl.classList.toggle("hidden", !isMap);
    if (isMap) {
      ensureMap();
      // let the container get its dimensions before Leaflet measures it
      requestAnimationFrame(() => {
        map.invalidateSize();
        renderMap();
      });
    } else {
      render();
    }
  });
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    if (filter === "all") {
      activeFilters.clear();
      collapsedSections.clear();
    } else {
      if (activeFilters.has(filter)) {
        activeFilters.delete(filter);
      } else {
        activeFilters.add(filter);
        collapsedSections.delete(filter);
      }
    }
    filterButtons.forEach((btn) => {
      const f = btn.dataset.filter;
      btn.classList.toggle("active", f === "all" ? activeFilters.size === 0 : activeFilters.has(f));
    });
    renderCurrentView();
  });
});

statusFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeStatusFilter = button.dataset.statusFilter;
    statusFilterButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderCurrentView();
  });
});

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeDifficulty = button.dataset.difficulty;
    difficultyButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderCurrentView(); // a filter, so it thins the map markers too
  });
});

const searchClearEl = document.querySelector("#search-clear");

searchEl.addEventListener("input", () => {
  searchClearEl.classList.toggle("hidden", searchEl.value === "");
  renderCurrentView();
});

searchClearEl.addEventListener("click", () => {
  searchEl.value = "";
  searchClearEl.classList.add("hidden");
  searchEl.focus();
  renderCurrentView();
});
render();
loadStatuses();

const infoBtn = document.getElementById('info-btn');
const infoModal = document.getElementById('info-modal');
const infoClose = document.getElementById('info-close');
infoBtn.addEventListener('click', () => infoModal.classList.remove('hidden'));
infoClose.addEventListener('click', () => infoModal.classList.add('hidden'));
infoModal.addEventListener('click', e => { if (e.target === infoModal) infoModal.classList.add('hidden'); });

const donateBtn = document.getElementById('donate-btn');
const donateModal = document.getElementById('donate-modal');
const donateClose = document.getElementById('donate-close');
donateBtn.addEventListener('click', () => donateModal.classList.remove('hidden'));
donateClose.addEventListener('click', () => donateModal.classList.add('hidden'));
donateModal.addEventListener('click', e => { if (e.target === donateModal) donateModal.classList.add('hidden'); });

document.addEventListener('keydown', e => { if (e.key === 'Escape') { infoModal.classList.add('hidden'); donateModal.classList.add('hidden'); } });
