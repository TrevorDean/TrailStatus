const trails = [
  {
    key: "quanah-hill",
    city: "Weatherford",
    name: "Quanah Hill",
    statusArea: "Quanah Hill",
    statusType: "Region",
    rid: "19635",
    url: "https://www.trailforks.com/region/quanah-hill-19635/"
  },
  {
    key: "parks-of-aledo",
    city: "Weatherford",
    name: "Parks of Aledo",
    statusArea: "Parks of Aledo",
    statusType: "Riding area",
    rid: "23588",
    url: "https://www.trailforks.com/region/parks-of-aledo/"
  },
  {
    key: "trinity-track",
    city: "Weatherford",
    name: "Trinity Track",
    statusArea: "Trinity Track Green Loop",
    statusType: "Trail status",
    trailId: "780968",
    url: "https://www.trailforks.com/trails/trinity-track-green-loop/",
    sourceUrl: "https://www.trailforks.com/region/willow-park/"
  },
  {
    key: "chisenhall",
    city: "Fort Worth",
    name: "Chisenhall",
    statusArea: "Chisenhall",
    statusType: "Riding area",
    rid: "38370",
    url: "https://www.trailforks.com/region/chisenhall-38370/"
  },
  {
    key: "fossil-creek-park",
    city: "Fort Worth",
    name: "Fossil Creek Park",
    statusArea: "Fossil Creek Park",
    statusType: "Riding area",
    rid: "46439",
    url: "https://www.trailforks.com/region/fossil-creek-park-46439/"
  },
  {
    key: "gateway-park",
    city: "Fort Worth",
    name: "Gateway Park",
    statusArea: "Gateway Park",
    statusType: "Riding area",
    rid: "3721",
    url: "https://www.trailforks.com/region/gateway-park/"
  },
  {
    key: "marion-sansom",
    city: "Fort Worth",
    name: "Marion Sansom",
    statusArea: "Marion Sansom Park",
    statusType: "Riding area",
    rid: "14433",
    url: "https://www.trailforks.com/region/marion-sansom-park-14433/"
  },
  {
    key: "north-z-boaz-park",
    city: "Fort Worth",
    name: "North Z Boaz Park",
    statusArea: "North Z Boaz Park",
    statusType: "Riding area",
    rid: "60252",
    url: "https://www.trailforks.com/region/north-z-boaz-park-60252/"
  },
  {
    key: "the-woods-at-dunlop-park",
    city: "Fort Worth",
    name: "The Woods at Dunlop Park",
    statusArea: "The Woods at Dunlop Park",
    statusType: "Riding area",
    rid: "72039",
    url: "https://www.trailforks.com/region/the-woods-at-dunlop-park-72039/"
  },
  {
    key: "lindsey-park",
    city: "Tyler",
    name: "Lindsey Park",
    statusArea: "Lindsey Park",
    statusType: "Riding area",
    rid: "13827",
    url: "https://www.trailforks.com/region/lindsey-park-13827/"
  },
  {
    key: "faulkner-park",
    city: "Tyler",
    name: "Faulkner Park",
    statusArea: "Faulkner Park",
    statusType: "Riding area",
    rid: "13829",
    url: "https://www.trailforks.com/region/faulkner-park-13829/"
  },
  {
    key: "tyler-state-park",
    city: "Tyler",
    name: "Tyler State Park",
    statusArea: "Tyler State Park",
    statusType: "Riding area",
    rid: "3717",
    url: "https://www.trailforks.com/region/tyler-state-park/"
  }
];

const groupsEl = document.querySelector("#trail-groups");
const searchEl = document.querySelector("#trail-search");
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const statusFilterButtons = [...document.querySelectorAll("[data-status-filter]")];
let activeFilter = "all";
let activeStatusFilter = "all";
let statuses = {};

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

function render() {
  const search = searchEl.value.trim().toLowerCase();
  const visibleTrails = trails.filter((trail) => {
    const matchesCity = activeFilter === "all" || trail.city === activeFilter;
    const matchesSearch = `${trail.city} ${trail.name} ${trail.statusArea}`.toLowerCase().includes(search);
    const status = (statuses[trail.key]?.status || "").toLowerCase();
    const matchesStatus =
      activeStatusFilter === "all" ||
      (activeStatusFilter === "rideable" && (status.includes("open") || status.includes("caution") || status.includes("ideal") || status.includes("dry") || status.includes("variable"))) ||
      (activeStatusFilter === "closed" && (status.includes("closed") || status.includes("wet") || status.includes("mud")));
    return matchesCity && matchesSearch && matchesStatus;
  });

  const cities = [...new Set(visibleTrails.map((trail) => trail.city))];

  groupsEl.innerHTML = cities
    .map((city) => {
      const cards = visibleTrails
        .filter((trail) => trail.city === city)
        .map(renderRow)
        .join("");

      return `
        <section class="city-section">
          <h2>${city}</h2>
          <div class="trail-table" role="table" aria-label="${city} trail statuses">
            <div class="trail-heading" role="row">
              <span>Trail Name</span>
              <span>Status</span>
              <span>Updated</span>
              <span>City</span>
              <span>Source</span>
            </div>
            <div class="trail-list">${cards}</div>
          </div>
        </section>
      `;
    })
    .join("");
}

function renderRow(trail) {
  const current = statuses[trail.key];
  const hasWidgetStatus = trail.rid || trail.trailId;
  const status = current?.status || "Loading";
  const statusClass = statusClassFor(status);
  const sourceText = trail.rid || trail.trailId ? `${trail.statusType}: ${trail.statusArea}` : "Manual lookup";
  const statusUrl = trail.sourceUrl || (trail.trailId ? trailStatusWidgetUrl(trail.trailId) : trail.url);
  const updated = current?.updated || current?.detail || "";
  const linkText = hasWidgetStatus ? "Trailforks" : "Find status";

  return `
    <article class="trail-row" data-city="${trail.city}" role="row">
      <a class="trail-name" href="${trail.url}" title="${sourceText}">${trail.name}</a>
      <span class="status-pill ${statusClass}">${status}</span>
      <span class="status-updated">${updated}</span>
      <span class="trail-city">${trail.city}</span>
      <a class="status-link" href="${statusUrl}">${linkText}</a>
    </article>
  `;
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

  render();
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});

statusFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeStatusFilter = button.dataset.statusFilter;
    statusFilterButtons.forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});

searchEl.addEventListener("input", render);
render();
loadStatuses();
