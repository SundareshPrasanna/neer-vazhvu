import type { Language } from "@/lib/i18n/translations";
import { translations } from "@/lib/i18n/translations";

function toTitleCase(value: string): string {
  return value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function zoneKey(zone: string): string {
  return zone
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export function getZoneLabel(zone: string, language: Language): string {
  if (language !== "ta") return toTitleCase(zone);
  const key = `zone_name.${zoneKey(zone)}`;
  const record = translations[key];
  if (!record?.ta) return toTitleCase(zone);
  return record.ta;
}
