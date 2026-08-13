// Canonical trail definitions — the SINGLE source of truth for every trail.
// Consumed by: worker.js (cold-start scrape), scripts/update-trail-status.js (cron scraper),
// and public/script.js (frontend rendering). Add or edit a trail in exactly ONE place: here.
//
// Fields:
//   key        stable id, also the KV/status key
//   type       "region" | "trail" — selects the Trailforks parse strategy
//   batch      1 | 2 — which staggered cron job scrapes it
//   scrapeUrl  ONLY when the page scraped for status differs from the display url
//   url        user-facing link shown on the card (also the default scrape target)
//   + display fields used by the frontend (city, statusArea, statusType, lta, ...)
//
// Scrape target = scrapeUrl || url.

export const TRAILS = [
  { key: "quanah-hill", type: "region", batch: 1, city: "Weatherford", name: "Quanah Hill", statusArea: "Quanah Hill", statusType: "Region", rid: "19635", url: "https://www.trailforks.com/region/quanah-hill-19635/" },
  { key: "parks-of-aledo", type: "region", batch: 1, city: "Weatherford", name: "Parks of Aledo", statusArea: "Parks of Aledo", statusType: "Riding area", rid: "23588", url: "https://www.trailforks.com/region/parks-of-aledo/" },
  { key: "trinity-track", type: "trail", batch: 1, city: "Weatherford", name: "Trinity Track", statusArea: "Trinity Track Green Loop", statusType: "Trail status", trailId: "780968", lta: "WMBC", url: "https://www.trailforks.com/trails/trinity-track-green-loop/", sourceUrl: "https://www.trailforks.com/region/willow-park/" },
  { key: "western-heritage-park", type: "trail", batch: 1, city: "Weatherford", name: "Western Heritage Park", statusArea: "Western Heritage Park Green Trail", statusType: "Trail status", lta: "WMBC", url: "https://www.trailforks.com/trails/western-heritage-park-green-trail/", sourceUrl: "https://www.trailforks.com/trails/western-heritage-park-green-trail/reports/" },
  { key: "the-pit", type: "region", batch: 1, city: "Weatherford", name: "The Pit", statusArea: "The Pit Trails", statusType: "Riding area", url: "https://www.trailforks.com/region/the-pit-trails/" },
  { key: "chisenhall", type: "region", batch: 1, city: "Fort Worth", name: "Chisenhall", statusArea: "Chisenhall", statusType: "Riding area", rid: "38370", lta: "FWMBA", url: "https://www.trailforks.com/region/chisenhall-38370/" },
  { key: "fossil-creek-park", type: "region", batch: 1, city: "Fort Worth", name: "Fossil Creek Park", statusArea: "Fossil Creek Park", statusType: "Riding area", rid: "46439", url: "https://www.trailforks.com/region/fossil-creek-park-46439/" },
  { key: "gateway-park", type: "region", batch: 1, city: "Fort Worth", name: "Gateway Park", statusArea: "Gateway Park", statusType: "Riding area", rid: "3721", url: "https://www.trailforks.com/region/gateway-park/" },
  { key: "marion-sansom", type: "region", batch: 1, city: "Fort Worth", name: "Marion Sansom", statusArea: "Marion Sansom Park", statusType: "Riding area", rid: "14433", url: "https://www.trailforks.com/region/marion-sansom-park-14433/" },
  { key: "north-z-boaz-park", type: "region", batch: 1, city: "Fort Worth", name: "North Z Boaz Park", statusArea: "North Z Boaz Park", statusType: "Riding area", rid: "60252", url: "https://www.trailforks.com/region/north-z-boaz-park-60252/" },
  { key: "the-woods-at-dunlop-park", type: "region", batch: 1, city: "Fort Worth", name: "The Woods at Dunlop Park", statusArea: "The Woods at Dunlop Park", statusType: "Riding area", rid: "72039", url: "https://www.trailforks.com/region/the-woods-at-dunlop-park-72039/" },
  { key: "lindsey-park", type: "region", batch: 2, city: "Tyler", name: "Lindsey Park", statusArea: "Lindsey Park", statusType: "Riding area", rid: "13827", url: "https://www.trailforks.com/region/lindsey-park-13827/" },
  { key: "faulkner-park", type: "region", batch: 2, city: "Tyler", name: "Faulkner Park", statusArea: "Faulkner Park", statusType: "Riding area", rid: "13829", url: "https://www.trailforks.com/region/faulkner-park-13829/" },
  { key: "tyler-state-park", type: "region", batch: 2, city: "Tyler", name: "Tyler State Park", statusArea: "Tyler State Park", statusType: "Riding area", rid: "3717", url: "https://www.trailforks.com/region/tyler-state-park/" },
  { key: "arbor-hills", type: "region", batch: 1, city: "North Dallas Region", name: "Arbor Hills Nature Preserve Off Road Bike Trail", statusArea: "Arbor Hills Nature Preserve Off Road Bike Trail", statusType: "Riding area", url: "https://www.trailforks.com/region/arbor-hills-nature-preserve-off-road-bike-trail/" },
  { key: "barber-hills", type: "region", batch: 1, city: "Far North Region", name: "Barber Hills", statusArea: "Barber Hills", statusType: "Riding area", lta: "Barber Hills Trail Association", url: "https://www.trailforks.com/region/barber-hills/" },
  { key: "big-cedar", type: "region", batch: 1, city: "South Dallas Region", name: "Big Cedar Wilderness Trails", statusArea: "Big Cedar Wilderness Trails", statusType: "Riding area", url: "https://www.trailforks.com/region/big-cedar-wilderness-trails/" },
  { key: "binkley-park", type: "region", batch: 1, city: "Far North Region", name: "Binkley Park", statusArea: "Binkley Park", statusType: "Riding area", url: "https://www.trailforks.com/region/binkley-park-24408/" },
  { key: "bonham-state-park", type: "region", batch: 1, city: "Far North Region", name: "Bonham State Park", statusArea: "Bonham State Park", statusType: "Riding area", url: "https://www.trailforks.com/region/bonham-state-park/" },
  { key: "boulder-park", type: "region", batch: 1, city: "South Dallas Region", name: "Boulder Park", statusArea: "Boulder Park", statusType: "Riding area", url: "https://www.trailforks.com/region/boulder-park-13783/" },
  { key: "cedar-hill-state-park", type: "region", batch: 1, city: "South Dallas Region", name: "Cedar Hill State Park", statusArea: "Cedar Hill State Park", statusType: "Riding area", url: "https://www.trailforks.com/region/cedar-hill-state-park-19031/" },
  { key: "corinth-community-park", type: "region", batch: 1, city: "North Dallas Region", name: "Corinth Community Park", statusArea: "Corinth Community Park", statusType: "Riding area", url: "https://www.trailforks.com/region/corinth-community-park-25637/" },
  { key: "creekside-park-dorba", type: "region", batch: 1, city: "East Dallas Region", name: "Creekside Park DORBA Trail", statusArea: "Creekside Park DORBA Trail", statusType: "Riding area", url: "https://www.trailforks.com/region/creekside-park-dorba-trail/" },
  { key: "creekside-park-skillpark", type: "region", batch: 1, city: "East Dallas Region", name: "Creekside Park Skillpark", statusArea: "Creekside Park Skillpark", statusType: "Riding area", url: "https://www.trailforks.com/region/creekside-park-skillpark/" },
  { key: "cross-timbers", type: "region", batch: 1, city: "Far North Region", name: "Cross Timbers", statusArea: "Cross Timbers", statusType: "Riding area", url: "https://www.trailforks.com/region/cross-timbers/" },
  { key: "dinosaur-valley-state-park", type: "region", batch: 1, city: "Fort Worth", name: "Dinosaur Valley State Park", statusArea: "Dinosaur Valley State Park", statusType: "Riding area", url: "https://www.trailforks.com/region/dinosaur-valley-state-park/" },
  { key: "eisenhower-state-park", type: "region", batch: 1, city: "Far North Region", name: "Eisenhower State Park", statusArea: "Eisenhower State Park", statusType: "Riding area", url: "https://www.trailforks.com/region/eisenhower-state-park-23481/" },
  { key: "erwin-park", type: "region", batch: 1, city: "North Dallas Region", name: "Erwin Park", statusArea: "Erwin Park", statusType: "Riding area", url: "https://www.trailforks.com/region/erwin-park/" },
  { key: "erwin-park-skill-park", type: "trail", batch: 1, scrapeUrl: "https://www.trailforks.com/trails/erwin-park-skills-area-530338/", city: "North Dallas Region", name: "Erwin Park Skill Park", statusArea: "Erwin Park Skill Park", statusType: "Riding area", lta: "DORBA", url: "https://www.trailforks.com/region/erwin-park-skill-park-54704/", sourceUrl: "https://www.trailforks.com/trails/erwin-park-skills-area-530338/" },
  { key: "frisco-northwest-community-park", type: "region", batch: 1, city: "North Dallas Region", name: "Frisco Northwest Community Park", statusArea: "Frisco Northwest Community Park", statusType: "Riding area", url: "https://www.trailforks.com/region/frisco-northwest-community-park/" },
  { key: "goat-island-preserve", type: "region", batch: 1, city: "South Dallas Region", name: "Goat Island Preserve", statusArea: "Goat Island Preserve", statusType: "Riding area", url: "https://www.trailforks.com/region/goat-island-preserve-33774/" },
  { key: "hachie-mtb-trail", type: "region", batch: 1, city: "South Dallas Region", name: "Hachie MTB Trail", statusArea: "Hachie MTB Trail", statusType: "Riding area", lta: "Hachie MTB Trail Riders", url: "https://www.trailforks.com/region/hachie-mtb-trail-28103/" },
  { key: "harry-moss-park", type: "region", batch: 1, city: "North Dallas Region", name: "Harry Moss Park", statusArea: "Harry Moss Park", statusType: "Riding area", url: "https://www.trailforks.com/region/harry-moss-park-22007/" },
  { key: "horseshoe", type: "region", batch: 2, city: "North Dallas Region", name: "Horseshoe", statusArea: "Horseshoe", statusType: "Riding area", url: "https://www.trailforks.com/region/horseshoe-13746/" },
  { key: "katie-jackson-park-dorba", type: "region", batch: 2, city: "North Dallas Region", name: "Katie Jackson Park DORBA Trail", statusArea: "Katie Jackson Park DORBA Trail", statusType: "Riding area", url: "https://www.trailforks.com/region/katie-jackson-park-dorba-trail/" },
  { key: "katie-jackson-park-skillpark", type: "region", batch: 2, city: "North Dallas Region", name: "Katie Jackson Park Skillpark", statusArea: "Katie Jackson Park Skillpark", statusType: "Riding area", url: "https://www.trailforks.com/region/katie-jackson-park-skillpark-45471/" },
  { key: "knob-hills", type: "region", batch: 2, city: "North Dallas Region", name: "Knob Hills", statusArea: "Knob Hills", statusType: "Riding area", url: "https://www.trailforks.com/region/knob-hills-22005/" },
  { key: "lb-houston-park", type: "region", batch: 2, city: "North Dallas Region", name: "L.B. Houston Park", statusArea: "L.B. Houston Park", statusType: "Riding area", url: "https://www.trailforks.com/region/l-b-houston-park-22065/" },
  { key: "mineola-nature-preserve", type: "region", batch: 2, city: "Tyler", name: "Mineola Nature Preserve", statusArea: "Mineola Nature Preserve", statusType: "Riding area", url: "https://www.trailforks.com/region/mineola-nature-preserve-greer-hill-mtb-trails/" },
  { key: "northshore", type: "region", batch: 2, city: "North Dallas Region", name: "Northshore", statusArea: "Northshore", statusType: "Riding area", lta: "DORBA", url: "https://www.trailforks.com/region/northshore/" },
  { key: "preserve-at-maxwell-creek", type: "region", batch: 2, city: "North Dallas Region", name: "Preserve at Maxwell Creek", statusArea: "Preserve at Maxwell Creek", statusType: "Region", rid: "56823", lta: "City of Murphy", url: "https://www.trailforks.com/region/preserve-at-maxwell-creek-56823/" },
  { key: "oak-cliff-nature-preserve", type: "region", batch: 2, city: "South Dallas Region", name: "Oak Cliff Nature Preserve", statusArea: "Oak Cliff Nature Preserve", statusType: "Riding area", url: "https://www.trailforks.com/region/oak-cliff-nature-preserve/", updatedNote: "This trail stays open in all weather conditions." },
  { key: "paul-dryer-preserve", type: "region", batch: 2, city: "South Dallas Region", name: "Paul S. Dryer Preserve at Windmill Hill", statusArea: "Paul S. Dryer Preserve at Windmill Hill", statusType: "Riding area", url: "https://www.trailforks.com/region/paul-s-dryer-preserve-at-windmill-hill/" },
  { key: "pecan-grove-park", type: "region", batch: 2, city: "East Dallas Region", name: "Pecan Grove Park", statusArea: "Pecan Grove Park", statusType: "Riding area", url: "https://www.trailforks.com/region/pecan-grove-park/" },
  { key: "ray-roberts-isle-du-bois", type: "region", batch: 2, city: "Far North Region", name: "Ray Roberts Lake Isle Du Bois Unit", statusArea: "Ray Roberts Lake Isle Du Bois Unit", statusType: "Riding area", url: "https://www.trailforks.com/region/ray-roberts-lake-isle-du-bois-unit/" },
  { key: "ray-roberts-johnson-branch", type: "region", batch: 2, city: "Far North Region", name: "Ray Roberts Lake Johnson Branch Unit", statusArea: "Ray Roberts Lake Johnson Branch Unit", statusType: "Riding area", url: "https://www.trailforks.com/region/ray-roberts-lake-johnson-branch-unit-13751/" },
  { key: "jeff-laquey", type: "region", batch: 2, city: "Far North Region", name: "Jeff Laquey Trail System", statusArea: "Jeff Laquey Trail System", statusType: "Riding area", rid: "68516", lta: "Denton Trails", url: "https://www.trailforks.com/region/jeff-laquey-trail-system-68516/" },
  { key: "bridgeport", type: "region", batch: 2, city: "Far North Region", displayCity: "Bridgeport", name: "Bridgeport", statusArea: "Bridgeport", statusType: "Riding area", rid: "23422", lta: "Bridgeport", url: "https://www.trailforks.com/region/endeavor-bridgeport-adventure-park-23422/" },
  { key: "river-legacy-park", type: "region", batch: 2, city: "Mid-Cities Region", name: "River Legacy Park", statusArea: "River Legacy Park", statusType: "Riding area", url: "https://www.trailforks.com/region/river-legacy-park/" },
  { key: "red-kane-park", type: "region", batch: 2, city: "Mid-Cities Region", name: "Red Kane Park", statusArea: "Red Kane Park", statusType: "Riding area", url: "https://www.trailforks.com/region/red-kane-park/" },
  { key: "rowlett-creek-preserve", type: "region", batch: 2, city: "East Dallas Region", name: "Rowlett Creek Preserve", statusArea: "Rowlett Creek Preserve", statusType: "Riding area", url: "https://www.trailforks.com/region/rowlett-creek-preserve-19612/" },
  { key: "sister-grove-park", type: "region", batch: 2, city: "North Dallas Region", name: "Sister Grove Park", statusArea: "Sister Grove Park", statusType: "Riding area", url: "https://www.trailforks.com/region/sister-grove-park-24208/" },
  { key: "squabble-creek", type: "region", batch: 2, city: "East Dallas Region", name: "Squabble Creek Mountain Bike Trails", statusArea: "Squabble Creek Mountain Bike Trails", statusType: "Riding area", url: "https://www.trailforks.com/region/squabble-creek-mountain-bike-trails-33812/" },
  { key: "waterloo-lake", type: "region", batch: 2, city: "Far North Region", name: "Waterloo Lake Regional Park", statusArea: "Waterloo Lake Regional Park", statusType: "Riding area", url: "https://www.trailforks.com/region/waterloo-lake-regional-park-24406/" },
  { key: "wildcat-ranch", type: "region", batch: 2, city: "South Dallas Region", name: "Wildcat Ranch", statusArea: "Wildcat Ranch", statusType: "Riding area", url: "https://www.trailforks.com/region/wildcat-ranch/" },
  { key: "cameron-park", type: "region", batch: 2, city: "Waco", name: "Cameron Park", statusArea: "Cameron Park", statusType: "Riding area", url: "https://www.trailforks.com/region/cameron-park/" },
  { key: "lacy-point", type: "region", batch: 2, city: "Waco", name: "Lacy Point Nature Trail", statusArea: "Lacy Point Nature Trail", statusType: "Riding area", url: "https://www.trailforks.com/region/lacy-point-nature-trail-60140/" },
  { key: "woodway-park", type: "region", batch: 2, city: "Waco", name: "Woodway Park", statusArea: "Woodway Park", statusType: "Riding area", url: "https://www.trailforks.com/region/woodway-park/" },
];

export const sourcesForBatch = (batch) =>
  TRAILS.filter((t) => t.batch === batch)
    .map((t) => ({ key: t.key, name: t.name, type: t.type, url: t.scrapeUrl || t.url }));

export const allSources = () =>
  TRAILS.map((t) => ({ key: t.key, name: t.name, type: t.type, url: t.scrapeUrl || t.url }));
