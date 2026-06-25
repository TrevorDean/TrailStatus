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
    lta: "WMBC",
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
    lta: "WMBC",
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
    lta: "Burleson MTB Riders",
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
    key: "jeff-laquey",
    city: "Fort Worth",
    name: "Jeff Laquey Trail System",
    statusArea: "Jeff Laquey Trail System",
    statusType: "Riding area",
    rid: "68516",
    url: "https://www.trailforks.com/region/jeff-laquey-trail-system-68516/"
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
    subsection: "North Dallas Region",
    name: "Arbor Hills Nature Preserve Off Road Bike Trail",
    statusArea: "Arbor Hills Nature Preserve Off Road Bike Trail",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/arbor-hills-nature-preserve-off-road-bike-trail/"
  },
  {
    key: "barber-hills",
    city: "Far North Region",
    lta: "Barber Hills Trail Association",
    name: "Barber Hills",
    statusArea: "Barber Hills",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/barber-hills/"
  },
  {
    key: "big-cedar",
    city: "Dallas",
    subsection: "South Dallas Region",
    name: "Big Cedar Wilderness Trails",
    statusArea: "Big Cedar Wilderness Trails",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/big-cedar-wilderness-trails/"
  },
  {
    key: "binkley-park",
    city: "Far North Region",
    name: "Binkley Park",
    statusArea: "Binkley Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/binkley-park-24408/"
  },
  {
    key: "bonham-state-park",
    city: "Far North Region",
    name: "Bonham State Park",
    statusArea: "Bonham State Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/bonham-state-park/"
  },
  {
    key: "boulder-park",
    city: "Dallas",
    subsection: "South Dallas Region",
    name: "Boulder Park",
    statusArea: "Boulder Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/boulder-park-13783/"
  },
  {
    key: "cedar-hill-state-park",
    city: "Dallas",
    subsection: "South Dallas Region",
    name: "Cedar Hill State Park",
    statusArea: "Cedar Hill State Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/cedar-hill-state-park-19031/"
  },
  {
    key: "corinth-community-park",
    city: "Dallas",
    subsection: "North Dallas Region",
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
    city: "Far North Region",
    name: "Cross Timbers",
    statusArea: "Cross Timbers",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/cross-timbers/"
  },
  {
    key: "dinosaur-valley-state-park",
    city: "Fort Worth",
    name: "Dinosaur Valley State Park",
    statusArea: "Dinosaur Valley State Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/dinosaur-valley-state-park/"
  },
  {
    key: "eisenhower-state-park",
    city: "Far North Region",
    name: "Eisenhower State Park",
    statusArea: "Eisenhower State Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/eisenhower-state-park-23481/"
  },
  {
    key: "erwin-park",
    city: "Dallas",
    subsection: "North Dallas Region",
    name: "Erwin Park",
    statusArea: "Erwin Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/erwin-park/"
  },
  {
    key: "erwin-park-skill-park",
    city: "Dallas",
    subsection: "North Dallas Region",
    lta: "DORBA",
    name: "Erwin Park Skill Park",
    statusArea: "Erwin Park Skill Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/erwin-park-skill-park-54704/",
    sourceUrl: "https://www.trailforks.com/trails/erwin-park-skills-area-530338/"
  },
  {
    key: "frisco-northwest-community-park",
    city: "Dallas",
    subsection: "North Dallas Region",
    name: "Frisco Northwest Community Park",
    statusArea: "Frisco Northwest Community Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/frisco-northwest-community-park/"
  },
  {
    key: "goat-island-preserve",
    city: "Dallas",
    subsection: "South Dallas Region",
    name: "Goat Island Preserve",
    statusArea: "Goat Island Preserve",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/goat-island-preserve-33774/"
  },
  {
    key: "hachie-mtb-trail",
    city: "Dallas",
    lta: "Hachie MTB Trail Riders",
    subsection: "South Dallas Region",
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
    subsection: "North Dallas Region",
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
    subsection: "North Dallas Region",
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
    city: "Tyler",
    name: "Mineola Nature Preserve",
    statusArea: "Mineola Nature Preserve",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/mineola-nature-preserve-greer-hill-mtb-trails/"
  },
  {
    key: "northshore",
    city: "Dallas",
    subsection: "North Dallas Region",
    lta: "DORBA",
    name: "Northshore",
    statusArea: "Northshore",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/northshore/"
  },
  {
    key: "oak-cliff-nature-preserve",
    city: "Dallas",
    subsection: "South Dallas Region",
    name: "Oak Cliff Nature Preserve",
    statusArea: "Oak Cliff Nature Preserve",
    statusType: "Riding area",
    updatedNote: "This trail stays open in all weather conditions.",
    url: "https://www.trailforks.com/region/oak-cliff-nature-preserve/"
  },
  {
    key: "paul-dryer-preserve",
    city: "Dallas",
    subsection: "South Dallas Region",
    name: "Paul S. Dryer Preserve at Windmill Hill",
    statusArea: "Paul S. Dryer Preserve at Windmill Hill",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/paul-s-dryer-preserve-at-windmill-hill/"
  },
  {
    key: "pecan-grove-park",
    city: "Dallas",
    subsection: "East Dallas Region",
    name: "Pecan Grove Park",
    statusArea: "Pecan Grove Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/pecan-grove-park/"
  },
  {
    key: "ray-roberts-isle-du-bois",
    city: "Far North Region",
    name: "Ray Roberts Lake Isle Du Bois Unit",
    statusArea: "Ray Roberts Lake Isle Du Bois Unit",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/ray-roberts-lake-isle-du-bois-unit/"
  },
  {
    key: "ray-roberts-johnson-branch",
    city: "Far North Region",
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
    subsection: "East Dallas Region",
    name: "Rowlett Creek Preserve",
    statusArea: "Rowlett Creek Preserve",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/rowlett-creek-preserve-19612/"
  },
  {
    key: "sister-grove-park",
    city: "Dallas",
    subsection: "North Dallas Region",
    name: "Sister Grove Park",
    statusArea: "Sister Grove Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/sister-grove-park-24208/"
  },
  {
    key: "squabble-creek",
    city: "Dallas",
    subsection: "East Dallas Region",
    name: "Squabble Creek Mountain Bike Trails",
    statusArea: "Squabble Creek Mountain Bike Trails",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/squabble-creek-mountain-bike-trails-33812/"
  },
  {
    key: "waterloo-lake",
    city: "Far North Region",
    name: "Waterloo Lake Regional Park",
    statusArea: "Waterloo Lake Regional Park",
    statusType: "Riding area",
    url: "https://www.trailforks.com/region/waterloo-lake-regional-park-24406/"
  },
  {
    key: "wildcat-ranch",
    city: "Dallas",
    subsection: "South Dallas Region",
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

const SECTION_ORDER = ["Dallas", "Far North Region", "Fort Worth", "Tyler", "Waco", "Weatherford"];
const SUBSECTION_ORDER = ["North Dallas Region", "South Dallas Region", "East Dallas Region"];

const SECTION_DISPLAY = {
  "Weatherford": "Weatherford Region",
  "Fort Worth": "Fort Worth Region",
  "Tyler": "Tyler Region",
  "Dallas": "Dallas Region"
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
  "Hachie MTB Trail Riders": "https://www.facebook.com/groups/HachieMTB",
  "Waco Bicycle Club": "https://www.wacobicycleclub.com/"
};

const groupsEl = document.querySelector("#trail-groups");
const searchEl = document.querySelector("#trail-search");
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const statusFilterButtons = [...document.querySelectorAll("[data-status-filter]")];
let activeFilters = new Set();
let activeStatusFilter = "all";
let statuses = {};
const collapsedSections = new Set();
const collapsedSubsections = new Set();
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
  const heading = e.target.closest(".subsection-heading");
  if (heading) {
    const key = heading.dataset.subsection;
    if (collapsedSubsections.has(key)) {
      collapsedSubsections.delete(key);
      heading.classList.remove("collapsed");
      heading.nextElementSibling?.classList.remove("hidden");
    } else {
      collapsedSubsections.add(key);
      heading.classList.add("collapsed");
      heading.nextElementSibling?.classList.add("hidden");
    }
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

function render() {
  const search = searchEl.value.trim().toLowerCase();
  const visibleTrails = trails.filter((trail) => {
    const matchesCity = activeFilters.size === 0 || activeFilters.has(trail.city);
    const cityForSearch = statuses[trail.key]?.city || trail.city;
    const matchesSearch = `${cityForSearch} ${trail.name} ${trail.statusArea}`.toLowerCase().includes(search);
    const status = (statuses[trail.key]?.status || "").toLowerCase();
    const matchesStatus =
      activeStatusFilter === "all" ||
      (activeStatusFilter === "rideable" && (status.includes("open") || status.includes("caution") || status.includes("ideal") || status.includes("dry") || status.includes("variable"))) ||
      (activeStatusFilter === "closed" && (status.includes("closed") || status.includes("wet") || status.includes("mud")));
    return matchesCity && matchesSearch && matchesStatus;
  });

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
      const sectionTrails = visibleTrails.filter(t => t.city === city);
      const mainTrails = sectionTrails.filter(t => !t.subsection);
      const subsectionNames = [...new Set(sectionTrails.filter(t => t.subsection).map(t => t.subsection))]
        .sort((a, b) => {
          const ai = SUBSECTION_ORDER.indexOf(a);
          const bi = SUBSECTION_ORDER.indexOf(b);
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });

      const mainHtml = mainTrails.map(renderRow).join("");
      const subsectionsHtml = subsectionNames.map(sub => {
        const subTrails = sectionTrails
          .filter(t => t.subsection === sub)
          .sort((a, b) => a.name.localeCompare(b.name));
        const isCollapsed = collapsedSubsections.has(sub);
        return `<div class="subsection-heading${isCollapsed ? " collapsed" : ""}" data-subsection="${sub}">${sub}</div><div class="subsection-trails${isCollapsed ? " hidden" : ""}">${subTrails.map(renderRow).join("")}</div>`;
      }).join("");

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
  const updated = formatUpdated(current?.updated || "");
  const linkText = statusUrl.includes("trailforks.com") ? "Trailforks" : "Find status";

  const isFav = favoritedTrails.has(trail.key);
  const favBtn = `<button class="fav-btn" data-key="${trail.key}" aria-label="${isFav ? "Remove from favorites" : "Add to favorites"}">${isFav ? "★" : "☆"}</button>`;

  return `
    <article class="trail-row" data-city="${trail.city}" role="row">
      <div class="trail-name-cell">${favBtn}<a class="trail-name" href="${trail.url}" title="${sourceText}">${trail.name}</a></div>
      <span class="status-pill ${statusClass}">${status}</span>
      <span class="status-updated">${trail.updatedNote ? `<span class="updated-note" tabindex="0" data-tooltip="${trail.updatedNote}">${updated}</span>` : updated}</span>
      <span class="trail-city">${statuses[trail.key]?.city || trail.city}</span>
      <span class="trail-lta">${renderLTA(statuses[trail.key]?.lta || trail.lta || "Unknown")}</span>
      <a class="status-link" href="${statusUrl}">${linkText}</a>
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
  if (isNaN(date.getTime())) return updated;
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

const searchClearEl = document.querySelector("#search-clear");

searchEl.addEventListener("input", () => {
  searchClearEl.classList.toggle("hidden", searchEl.value === "");
  render();
});

searchClearEl.addEventListener("click", () => {
  searchEl.value = "";
  searchClearEl.classList.add("hidden");
  searchEl.focus();
  render();
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
