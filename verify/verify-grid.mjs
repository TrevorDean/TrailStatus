import { readFileSync } from "node:fs";

// Strip comments first — an inline /* ... */ between declarations breaks the
// naive property regex below and produced a false "gap mismatch".
const css = readFileSync("public/styles.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function ruleBody(selector) {
  // first (desktop) occurrence only
  const re = new RegExp(`(^|\\})\\s*${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`, "m");
  const m = css.match(re);
  return m ? m[2] : null;
}
const prop = (body, name) => {
  const m = body?.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`));
  return m ? m[1].trim() : null;
};

const head = ruleBody(".trail-heading");
const row = ruleBody(".trail-row");

const checks = [];
const cmp = (name, a, b) => checks.push({ name, heading: a, row: b, ok: a === b });

cmp("grid-template-columns", prop(head, "grid-template-columns"), prop(row, "grid-template-columns"));
cmp("gap", prop(head, "gap"), prop(row, "gap"));

const padH = prop(head, "padding").split(/\s+/);
const padR = prop(row, "padding").split(/\s+/);
cmp("padding-left", padH[3] ?? padH[1], padR[3] ?? padR[1]);
cmp("padding-right", padH[1], padR[1]);

for (const c of checks) {
  console.log(`  ${c.ok ? "OK  " : "FAIL"} ${c.name.padEnd(22)} heading=${c.heading}  row=${c.row}`);
}

// A content-sized track makes the two grids resolve differently, since their
// content differs. This is what caused the drift.
const tpl = prop(head, "grid-template-columns");
const contentSized = (tpl.match(/\b(auto|max-content|min-content|fit-content)\b/g) || []);
console.log(`\n  content-sized tracks in template: ${contentSized.length ? contentSized.join(", ") + "  <-- WILL DRIFT" : "none"}`);

// track count
let depth = 0, cur = "", tracks = [];
for (const ch of tpl) {
  if (ch === "(") depth++;
  if (ch === ")") depth--;
  if (ch === " " && depth === 0) { if (cur) tracks.push(cur); cur = ""; } else cur += ch;
}
if (cur) tracks.push(cur);
console.log(`  tracks: ${tracks.length}`);
tracks.forEach((t, i) => console.log(`    ${i + 1}. ${t}`));

// leftover heading transforms would now overshoot
const transforms = [...css.matchAll(/\.trail-heading span:nth-child\(([\d,\s\w()]+)\)[^{]*\{([^}]*)\}/g)]
  .map((m) => ({ sel: m[1], body: m[2].replace(/\s+/g, " ").trim() }));
console.log("\n  heading nth-child rules:");
for (const t of transforms) console.log(`    (${t.sel}) -> ${t.body}`);
const stillTranslating = transforms.filter((t) => /translateX/.test(t.body));
console.log(`  rules still using translateX: ${stillTranslating.length ? stillTranslating.map((t) => t.sel).join(", ") : "none"}`);

console.log(`\n  RESULT: ${checks.every((c) => c.ok) && !contentSized.length ? "grids will resolve identically" : "MISMATCH REMAINS"}`);
