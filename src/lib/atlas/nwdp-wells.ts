/**
 * The National Water Data Portal (nwdp.nwic.gov.in, CKAN datastore) resources
 * a district's wells are read from, as the reviewed plan names them, and the
 * parsing of their rows into stations. Each resource spells its fields its
 * own way (KSGWD's manual set has 'Logitude'), so the plan carries the field
 * names beside the resource id and nothing here guesses them.
 */
import { isNonEmptyString, isRecord } from "./acquisition-validation";
import { QUALITY_PARAMETERS, type QualityParameter, type RawReading } from "./groundwater-wells";

export const NWDP_DATASTORE_URL = "https://nwdp.nwic.gov.in/api/3/action/datastore_search";

export interface NwdpLevelNetwork {
  /** Stable name for the family: ksgwd-manual-monthly, ksgwd-telemetry, cgwb-telemetry. */
  network: string;
  /** Registry id the envelope cites. */
  sourceId: string;
  resourceId: string;
  fields: {
    station: string;
    time: string;
    value: string;
    latitude: string;
    longitude: string;
    agency: string;
    wellType?: string;
  };
}

export interface NwdpQualityNetwork {
  sourceId: string;
  resourceId: string;
  fields: {
    station: string;
    date: string;
    latitude: string;
    longitude: string;
    agency: string;
    wellType?: string;
  };
  parameters: Partial<Record<QualityParameter, string>>;
}

export interface NwdpWellsSource {
  /** The District value the portal filters on (upper case in Kerala). */
  districtName: string;
  levels: NwdpLevelNetwork[];
  quality?: NwdpQualityNetwork;
}

export function validateNwdpWellsSource(raw: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(raw)) return ["sources.wells: must be an object"];
  if (!isNonEmptyString(raw.districtName)) errors.push("sources.wells.districtName: must be non-empty");
  const fieldsOk = (fields: unknown, required: string[]): boolean =>
    isRecord(fields) && required.every((name) => isNonEmptyString(fields[name]));
  if (!Array.isArray(raw.levels) || raw.levels.length === 0) errors.push("sources.wells.levels: must be a non-empty array");
  else {
    const networks = new Set<string>();
    for (const [index, level] of raw.levels.entries()) {
      const label = `sources.wells.levels[${index}]`;
      if (!isRecord(level) || !isNonEmptyString(level.network) || !isNonEmptyString(level.sourceId) || !isNonEmptyString(level.resourceId)) {
        errors.push(`${label}: needs network, sourceId and resourceId`);
        continue;
      }
      if (networks.has(level.network)) errors.push(`${label}.network: ${level.network} repeats`);
      networks.add(level.network);
      if (!fieldsOk(level.fields, ["station", "time", "value", "latitude", "longitude", "agency"])) {
        errors.push(`${label}.fields: needs station, time, value, latitude, longitude and agency`);
      }
    }
  }
  if (raw.quality !== undefined) {
    const quality = raw.quality;
    if (!isRecord(quality) || !isNonEmptyString(quality.sourceId) || !isNonEmptyString(quality.resourceId)) {
      errors.push("sources.wells.quality: needs sourceId and resourceId");
    } else {
      if (!fieldsOk(quality.fields, ["station", "date", "latitude", "longitude", "agency"])) {
        errors.push("sources.wells.quality.fields: needs station, date, latitude, longitude and agency");
      }
      if (!isRecord(quality.parameters) || Object.keys(quality.parameters).some((key) => !QUALITY_PARAMETERS.includes(key as QualityParameter))) {
        errors.push(`sources.wells.quality.parameters: keys must be among ${QUALITY_PARAMETERS.join(", ")}`);
      }
    }
  }
  return errors;
}

/** The portal's dates come as dd-mm-yyyy[ hh:mm[:ss]] or yyyy-mm-dd. */
export function nwdpDate(value: unknown): string | null {
  const text = String(value ?? "").trim();
  let match = /^(\d{2})-(\d{2})-(\d{4})/.exec(text);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export function nwdpNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text === "" || text === "-") return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

/** Coordinates published to two decimals or fewer (the CGWB Kerala
 *  telemetry sits on a 0.05 degree grid) are kilometres off, too coarse to
 *  say which Panchayat a well is in. */
export function coarseCoordinates(latitude: unknown, longitude: unknown): boolean {
  const decimals = (value: unknown): number => {
    const text = String(value ?? "").trim().replace(/0+$/, "");
    const dot = text.indexOf(".");
    return dot < 0 ? 0 : text.length - dot - 1;
  };
  return decimals(latitude) <= 2 && decimals(longitude) <= 2;
}

export interface NwdpStation {
  id: string;
  agency: string;
  wellType: string | null;
  latitude: number;
  longitude: number;
  coarse: boolean;
  raw: RawReading[];
}

/** Rows grouped into stations; a row with no station, date, value or
 *  position is counted and left out. */
export function stationsFromRows(
  rows: Array<Record<string, unknown>>,
  fields: NwdpLevelNetwork["fields"],
): { stations: NwdpStation[]; unusableRows: number } {
  const byId = new Map<string, NwdpStation>();
  let unusable = 0;
  for (const row of rows) {
    const id = String(row[fields.station] ?? "").trim();
    const date = nwdpDate(row[fields.time]);
    const value = nwdpNumber(row[fields.value]);
    const latitude = nwdpNumber(row[fields.latitude]);
    const longitude = nwdpNumber(row[fields.longitude]);
    if (!id || !date || value === null || latitude === null || longitude === null) {
      unusable += 1;
      continue;
    }
    const station = byId.get(id) ?? {
      id,
      agency: String(row[fields.agency] ?? "").trim(),
      wellType: fields.wellType ? String(row[fields.wellType] ?? "").trim() || null : null,
      latitude,
      longitude,
      coarse: coarseCoordinates(row[fields.latitude], row[fields.longitude]),
      raw: [],
    };
    station.raw.push({ date, value });
    byId.set(id, station);
  }
  return { stations: [...byId.values()].sort((left, right) => left.id.localeCompare(right.id)), unusableRows: unusable };
}
