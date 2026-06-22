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
    key: "western-heritage-park",
    city: "Weatherford",
    name: "Western Heritage Park",
    statusArea: "Western Heritage Park Green Trail",
    statusType: "Trail status",
    url: "https://www.trailforks.com/trails/western-heritage-park-green-trail/",
    sourceUrl: "https://www.trailforks.com/trails/western-heritage-park-green-trail/reports/"
  },
  {
    key: "the-pit",
    city: "Weatherford",
    name: "The Pit",
    statusArea: "The Pit Trails",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/the-pit-trails/"
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
  },
  {
    key: "arbor-hills",
    city: "Dallas",
    name: "Arbor Hills Nature Preserve Off Road Bike Trail",
    statusArea: "Arbor Hills Nature Preserve Off Road Bike Trail",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/arbor-hills-nature-preserve-off-road-bike-trail/"
  },
  {
    key: "barber-hills",
    city: "Dallas",
    name: "Barber Hills",
    statusArea: "Barber Hills",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/barber-hills/"
  },
  {
    key: "big-cedar",
    city: "Dallas",
    subsection: "South Dallas",
    name: "Big Cedar Wilderness Trails",
    statusArea: "Big Cedar Wilderness Trails",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/big-cedar-wilderness-trails/"
  },
  {
    key: "binkley-park",
    city: "Dallas",
    name: "Binkley Park",
    statusArea: "Binkley Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/binkley-park-24408/"
  },
  {
    key: "bonham-state-park",
    city: "Dallas",
    name: "Bonham State Park",
    statusArea: "Bonham State Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/bonham-state-park/"
  },
  {
    key: "boulder-park",
    city: "Dallas",
    subsection: "South Dallas",
    name: "Boulder Park",
    statusArea: "Boulder Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/boulder-park-13783/"
  },
  {
    key: "cedar-hill-state-park",
    city: "Dallas",
    subsection: "South Dallas",
    name: "Cedar Hill State Park",
    statusArea: "Cedar Hill State Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/cedar-hill-state-park-19031/"
  },
  {
    key: "corinth-community-park",
    city: "Dallas",
    name: "Corinth Community Park",
    statusArea: "Corinth Community Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/corinth-community-park-25637/"
  },
  {
    key: "creekside-park-dorba",
    city: "Dallas",
    name: "Creekside Park DORBA Trail",
    statusArea: "Creekside Park DORBA Trail",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/creekside-park-dorba-trail/"
  },
  {
    key: "creekside-park-skillpark",
    city: "Dallas",
    name: "Creekside Park Skillpark",
    statusArea: "Creekside Park Skillpark",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/creekside-park-skillpark/"
  },
  {
    key: "cross-timbers",
    city: "Dallas",
    name: "Cross Timbers",
    statusArea: "Cross Timbers",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/cross-timbers/"
  },
  {
    key: "dinosaur-valley-state-park",
    city: "Dallas",
    name: "Dinosaur Valley State Park",
    statusArea: "Dinosaur Valley State Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/dinosaur-valley-state-park/"
  },
  {
    key: "eisenhower-state-park",
    city: "Dallas",
    name: "Eisenhower State Park",
    statusArea: "Eisenhower State Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/eisenhower-state-park-23481/"
  },
  {
    key: "erwin-park",
    city: "Dallas",
    name: "Erwin Park",
    statusArea: "Erwin Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/erwin-park/"
  },
  {
    key: "erwin-park-skill-park",
    city: "Dallas",
    name: "Erwin Park Skill Park",
    statusArea: "Erwin Park Skill Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/erwin-park-skill-park-54704/"
  },
  {
    key: "frisco-northwest-community-park",
    city: "Dallas",
    name: "Frisco Northwest Community Park",
    statusArea: "Frisco Northwest Community Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/frisco-northwest-community-park/"
  },
  {
    key: "goat-island-preserve",
    city: "Dallas",
    subsection: "South Dallas",
    name: "Goat Island Preserve",
    statusArea: "Goat Island Preserve",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/goat-island-preserve-33774/"
  },
  {
    key: "hachie-mtb-trail",
    city: "Dallas",
    subsection: "South Dallas",
    name: "Hachie MTB Trail",
    statusArea: "Hachie MTB Trail",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/hachie-mtb-trail-28103/"
  },
  {
    key: "harry-moss-park",
    city: "Dallas",
    name: "Harry Moss Park",
    statusArea: "Harry Moss Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/harry-moss-park-22007/"
  },
  {
    key: "horseshoe",
    city: "Dallas",
    name: "Horseshoe",
    statusArea: "Horseshoe",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/horseshoe-13746/"
  },
  {
    key: "katie-jackson-park-dorba",
    city: "Dallas",
    name: "Katie Jackson Park DORBA Trail",
    statusArea: "Katie Jackson Park DORBA Trail",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/katie-jackson-park-dorba-trail/"
  },
  {
    key: "katie-jackson-park-skillpark",
    city: "Dallas",
    name: "Katie Jackson Park Skillpark",
    statusArea: "Katie Jackson Park Skillpark",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/katie-jackson-park-skillpark-45471/"
  },
  {
    key: "knob-hills",
    city: "Dallas",
    name: "Knob Hills",
    statusArea: "Knob Hills",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/knob-hills-22005/"
  },
  {
    key: "lb-houston-park",
    city: "Dallas",
    name: "L.B. Houston Park",
    statusArea: "L.B. Houston Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/l-b-houston-park-22065/"
  },
  {
    key: "mineola-nature-preserve",
    city: "Dallas",
    name: "Mineola Nature Preserve",
    statusArea: "Mineola Nature Preserve",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/mineola-nature-preserve-greer-hill-mtb-trails/"
  },
  {
    key: "northshore",
    city: "Dallas",
    name: "Northshore",
    statusArea: "Northshore",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/northshore/"
  },
  {
    key: "oak-cliff-nature-preserve",
    city: "Dallas",
    subsection: "South Dallas",
    name: "Oak Cliff Nature Preserve",
    statusArea: "Oak Cliff Nature Preserve",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/oak-cliff-nature-preserve/"
  },
  {
    key: "paul-dryer-preserve",
    city: "Dallas",
    subsection: "South Dallas",
    name: "Paul S. Dryer Preserve at Windmill Hill",
    statusArea: "Paul S. Dryer Preserve at Windmill Hill",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/paul-s-dryer-preserve-at-windmill-hill/"
  },
  {
    key: "pecan-grove-park",
    city: "Dallas",
    name: "Pecan Grove Park",
    statusArea: "Pecan Grove Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/pecan-grove-park/"
  },
  {
    key: "ray-roberts-isle-du-bois",
    city: "Dallas",
    name: "Ray Roberts Lake Isle Du Bois Unit",
    statusArea: "Ray Roberts Lake Isle Du Bois Unit",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/ray-roberts-lake-isle-du-bois-unit/"
  },
  {
    key: "ray-roberts-johnson-branch",
    city: "Dallas",
    name: "Ray Roberts Lake Johnson Branch Unit",
    statusArea: "Ray Roberts Lake Johnson Branch Unit",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/ray-roberts-lake-johnson-branch-unit-13751/"
  },
  {
    key: "river-legacy-park",
    city: "Dallas",
    name: "River Legacy Park",
    statusArea: "River Legacy Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/river-legacy-park/"
  },
  {
    key: "rowlett-creek-preserve",
    city: "Dallas",
    name: "Rowlett Creek Preserve",
    statusArea: "Rowlett Creek Preserve",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/rowlett-creek-preserve-19612/"
  },
  {
    key: "sister-grove-park",
    city: "Dallas",
    name: "Sister Grove Park",
    statusArea: "Sister Grove Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/sister-grove-park-24208/"
  },
  {
    key: "squabble-creek",
    city: "Dallas",
    name: "Squabble Creek Mountain Bike Trails",
    statusArea: "Squabble Creek Mountain Bike Trails",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/squabble-creek-mountain-bike-trails-33812/"
  },
  {
    key: "waterloo-lake",
    city: "Dallas",
    name: "Waterloo Lake Regional Park",
    statusArea: "Waterloo Lake Regional Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/waterloo-lake-regional-park-24406/"
  },
  {
    key: "wildcat-ranch",
    city: "Dallas",
    subsection: "South Dallas",
    name: "Wildcat Ranch",
    statusArea: "Wildcat Ranch",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/wildcat-ranch/"
  },
  {
    key: "cameron-park",
    city: "Waco",
    name: "Cameron Park",
    statusArea: "Cameron Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/cameron-park/"
  },
  {
    key: "lacy-point",
    city: "Waco",
    name: "Lacy Point Nature Trail",
    statusArea: "Lacy Point Nature Trail",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/lacy-point-nature-trail-60140/"
  },
  {
    key: "woodway-park",
    city: "Waco",
    name: "Woodway Park",
    statusArea: "Woodway Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/woodway-park/"
  }
];

const SECTION_ORDER = ["Weatherford", "Fort Worth", "Tyler", "Dallas", "Waco"];

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

  const sections = SECTION_ORDER.filter(city => visibleTrails.some(t => t.city === city));

  groupsEl.innerHTML = sections
    .map((city) => {
      const sectionTrails = visibleTrails.filter(t => t.city === city);
      const mainTrails = sectionTrails.filter(t => !t.subsection);
      const subsectionNames = [...new Set(sectionTrails.filter(t => t.subsection).map(t => t.subsection))].sort();

      const mainHtml = mainTrails.map(renderRow).join("");
      const subsectionsHtml = subsectionNames.map(sub => {
        const subTrails = sectionTrails
          .filter(t => t.subsection === sub)
          .sort((a, b) => a.name.localeCompare(b.name));
        return `<div class="subsection-heading">${sub}</div>${subTrails.map(renderRow).join("")}`;
      }).join("");

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
            <div class="trail-list">${mainHtml}${subsectionsHtml}</div>
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
  const linkText = statusUrl.includes("trailforks.com") ? "Trailforks" : "Find status";

  return `
    <article class="trail-row" data-city="${trail.city}" role="row">
      <a class="trail-name" href="${trail.url}" title="${sourceText}">${trail.name}</a>
      <span class="status-pill ${statusClass}">${status}</span>
      <span class="status-updated">${updated}</span>
      <span class="trail-city">${statuses[trail.key]?.city || trail.city}</span>
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
