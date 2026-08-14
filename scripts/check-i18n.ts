/**
 * i18n dictionary check.
 *
 * Was `check-i18n.mjs`, which read translations.ts as TEXT and hand-stripped
 * the TypeScript with two literal `.replace()` calls before running it in a
 * vm sandbox. Both literals were edited away when the dictionary grew from
 * `Language = "en" | "ta"` to the eight-code `LanguageCode` union, so the
 * script has been dying with `SyntaxError: Unexpected token 'export'` on the
 * first line it failed to strip. Nothing noticed, because it is not in CI.
 *
 * It now imports the module, so the parser is tsx's rather than ours and the
 * check cannot rot when the file is edited again.
 *
 * The en/ta assertion it used to make was also wrong after the same change.
 * `TranslationEntry` is `{ en: string } & Partial<...>`: English is the
 * accessibility floor and the fallback, every other language is optional so a
 * city can ship before its strings are translated. Missing `en` is therefore
 * fatal; per-language coverage is reported, not enforced.
 *
 * Run: npx tsx scripts/check-i18n.ts
 */

import fs from "node:fs";
import path from "node:path";

import { translations, ALL_LANGUAGES, LANGUAGE_LABELS } from "../src/lib/i18n/translations";

/** Key prefixes filled in at runtime from data (river names, water-body types,
 *  pollutant codes), so they never appear as a literal `t("...")` call. */
const DYNAMIC_PREFIXES = [
  "rivers_legend.",
  "poll.",
  "wb_type.",
  "wb_replace.",
  "river_name.",
];

/** Every .ts/.tsx file under src/. Replaces the old `rg --files src` shell-out:
 *  the check should not need a binary that is not a declared dependency. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Comments describe the key SHAPE, not a key: `t("about.*")`, `t("about.X")`,
 *  `t("briefing.freshness.*")`. Scanning them reports four keys that no
 *  dictionary should ever carry, which is enough noise to make a fatal check
 *  ignorable. Strip comments before matching. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");
}

const dictKeys = new Set(Object.keys(translations));
let hasError = false;

// ── Fatal: the English floor ────────────────────────────────────────────────
for (const [key, entry] of Object.entries(translations)) {
  if (!entry?.en) {
    hasError = true;
    console.error(`[i18n] Missing English text for key: ${key}`);
  }
}

// ── Fatal: a key used in the app that the dictionary does not carry ─────────
const usedStaticKeys = new Set<string>();

for (const file of sourceFiles(path.resolve("src"))) {
  const content = stripComments(fs.readFileSync(file, "utf8"));
  for (const match of content.matchAll(/\bt\("([^"]+)"\)/g)) {
    usedStaticKeys.add(match[1]);
  }
  for (const match of content.matchAll(/\b(?:key|tKey|labelKey|descKey)\s*:\s*"([^"]+)"/g)) {
    if (match[1].includes(".")) usedStaticKeys.add(match[1]);
  }
}

for (const key of usedStaticKeys) {
  if (!dictKeys.has(key)) {
    hasError = true;
    console.error(`[i18n] Missing translation key in dictionary: ${key}`);
  }
}

// ── Non-fatal: keys the app no longer references ───────────────────────────
const unused = Object.keys(translations)
  .filter((key) => !usedStaticKeys.has(key))
  .filter((key) => !DYNAMIC_PREFIXES.some((prefix) => key.startsWith(prefix)))
  .sort();

if (unused.length > 0) {
  console.warn(`[i18n] Unused keys (non-fatal): ${unused.length}`);
  for (const key of unused) console.warn(`  - ${key}`);
}

// ── Non-fatal: per-language coverage ───────────────────────────────────────
// The number a city onboarding actually wants to see before it flips its
// language chip on. `en` is 100% by the check above, so it is not listed.
const total = dictKeys.size;
const coverage = ALL_LANGUAGES.filter((code) => code !== "en")
  .map((code) => {
    const done = Object.values(translations).filter((e) => e[code as "ta"]).length;
    return { code, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
  })
  .sort((a, b) => b.done - a.done);

console.log(`[i18n] ${total} keys, English complete.`);
for (const { code, done, pct } of coverage) {
  console.log(`  ${LANGUAGE_LABELS[code].english.padEnd(10)} ${String(done).padStart(4)}/${total}  ${pct}%`);
}

if (hasError) process.exit(1);

console.log("[i18n] OK");
