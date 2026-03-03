import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execSync } from "node:child_process";
const translationsSourcePath = path.resolve("src/lib/i18n/translations.ts");
const rawTranslationsSource = fs.readFileSync(translationsSourcePath, "utf8");

const executableTranslationsSource = rawTranslationsSource
  .replace('export type Language = "en" | "ta";\n\n', "")
  .replace(
    "export const translations: Record<string, { en: string; ta: string }> =",
    "const translations ="
  );

const sandbox = { module: { exports: {} } };
vm.runInNewContext(`${executableTranslationsSource}\nmodule.exports = { translations };`, sandbox, {
  filename: "translations.ts",
});

const dict = sandbox.module.exports.translations;
const dictKeys = new Set(Object.keys(dict));

let hasError = false;

for (const [key, value] of Object.entries(dict)) {
  if (!value?.en || !value?.ta) {
    hasError = true;
    console.error(`[i18n] Missing en/ta text for key: ${key}`);
  }
}

const files = execSync("rg --files src", { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);

const usedStaticKeys = new Set();

for (const file of files) {
  const absPath = path.resolve(file);
  const content = fs.readFileSync(absPath, "utf8");
  for (const match of content.matchAll(/\bt\("([^"]+)"\)/g)) {
    usedStaticKeys.add(match[1]);
  }
  for (const match of content.matchAll(/\b(?:key|tKey|labelKey|descKey)\s*:\s*"([^"]+)"/g)) {
    if (match[1].includes(".")) {
      usedStaticKeys.add(match[1]);
    }
  }
}

for (const key of usedStaticKeys) {
  if (!dictKeys.has(key)) {
    hasError = true;
    console.error(`[i18n] Missing translation key in dictionary: ${key}`);
  }
}

const dynamicPrefixes = [
  "rivers_legend.",
  "poll.",
  "wb_type.",
  "wb_replace.",
  "river_name.",
];

const unused = Object.keys(dict)
  .filter((key) => !usedStaticKeys.has(key))
  .filter((key) => !dynamicPrefixes.some((prefix) => key.startsWith(prefix)))
  .sort();

if (unused.length > 0) {
  console.warn(`[i18n] Unused keys (non-fatal): ${unused.length}`);
  for (const key of unused) {
    console.warn(`  - ${key}`);
  }
}

if (hasError) {
  process.exit(1);
}

console.log("[i18n] OK");
