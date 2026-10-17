import "server-only";

import { tryGetPlaceConfig } from "@/lib/cities";
import { listAtlasDistricts } from "@/lib/atlas/registry";
import { tryGetBasinManifest } from "@/lib/basins";
import { publicPhotoUrl } from "./photos";
import { placeUrl } from "./place-url";
import { resolveAuthority } from "./routing";
import { assess, getParameter, valueText } from "./parameters";
import { WATER_SOURCES, isPrivateCategory, labelFor, type AuthorityRole } from "./taxonomy";
import type { EventRow, OwnReport, PhotoRow, PublicReport, SightingRow } from "./types";

export const PUBLIC_EVENTS = new Set(["approved", "reported", "authority_done", "fixed", "still_there", "closed", "reopened", "action_taken"]);

function placeName(row: SightingRow): string {
  if (row.place_kind === "city") return tryGetPlaceConfig(row.place_id)?.displayName ?? row.place_id;
  if (row.place_kind === "basin") return tryGetBasinManifest(row.place_id)?.displayName ?? row.place_id;
  return listAtlasDistricts().find((d) => d.scopeId === row.place_id)?.name ?? row.place_id;
}

type WhereParts = Pick<SightingRow, "water_body_name" | "ward_name" | "ward_id" | "panchayat_name" | "locality">;

const unit = (row: WhereParts) => row.ward_name ?? (row.ward_id ? `Ward ${row.ward_id}` : null) ?? row.panchayat_name ?? row.locality;

export function where(row: WhereParts): string | null {
  return [row.water_body_name, unit(row)].filter(Boolean).join(", ") || null;
}

function resolved(row: SightingRow) {
  return row.authority_role
    ? resolveAuthority(row.authority_role as AuthorityRole, {
        stateCode: row.state_code,
        placeId: row.place_id,
        placeKind: row.place_kind,
        corporationId: row.corporation_id,
      })
    : null;
}

/** YYYY-MM-DD in India time: public dates carry no time of day. */
const istDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

function readings(row: SightingRow): PublicReport["readings"] {
  return Object.entries(row.readings ?? {}).flatMap(([key, v]) => {
    const p = getParameter(key);
    return p ? [{ text: valueText(p, Number(v)), assessment: assess(p, Number(v)) }] : [];
  });
}

/** About 100 m: enough to find a stretch of bank, not a person. */
const roundPoint = (v: number) => Math.round(v * 1000) / 1000;

export function toPublic(row: SightingRow, photos: PhotoRow[], events: EventRow[]): PublicReport {
  const hidePoint = isPrivateCategory(row.category);
  const shownOn = placeUrl(row);
  return {
    id: row.id,
    createdAt: istDate(row.created_at),
    placeKind: row.place_kind,
    placeId: row.place_id,
    placeName: placeName(row),
    where: hidePoint ? unit(row) : where(row),
    category: row.category,
    subcategory: row.subcategory,
    label: labelFor(row.category, row.subcategory),
    caseStatus: row.case_status,
    readings: readings(row),
    waterSource: WATER_SOURCES.find((w) => w.key === row.water_source)?.label ?? null,
    photoUrls: photos
      .filter((p) => p.public_path)
      .sort((a, b) => (a.kind === b.kind ? a.ordinal - b.ordinal : a.kind === "report" ? -1 : 1))
      .map((p) => publicPhotoUrl(p.public_path!)),
    events: events
      .filter((e) => PUBLIC_EVENTS.has(e.event))
      // authority_body is reporter-typed: shown to the reporter only.
      .map((e) => ({ event: e.event, at: istDate(e.created_at), authorityBody: null, by: e.actor_role })),
    handler: resolved(row)?.authority ?? null,
    point: hidePoint ? null : [roundPoint(Number(row.lat)), roundPoint(Number(row.lng))],
    placeHref: shownOn?.href ?? null,
    placeLabel: shownOn?.label ?? null,
  };
}

export function toOwn(row: SightingRow, photos: PhotoRow[], events: EventRow[]): OwnReport {
  const rejected = events.findLast((e) => e.event === "rejected");
  return {
    ...toPublic(row, photos, events),
    createdAt: row.created_at,
    lat: Number(row.lat),
    lng: Number(row.lng),
    where: where(row),
    events: events.map((e) => ({ event: e.event, at: e.created_at, authorityBody: e.authority_body, by: e.actor_role })),
    reviewStatus: row.review_status,
    rejectReason: rejected?.reason ?? null,
    references: events.flatMap((e) => (e.reference ? [{ authorityBody: e.authority_body, reference: e.reference, at: e.created_at }] : [])),
    nationalChannels: resolved(row)?.national ?? [],
  };
}

/** Group child rows by sighting id. */
export function byId<T extends { sighting_id: string }>(rows: T[] | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows ?? []) map.set(r.sighting_id, [...(map.get(r.sighting_id) ?? []), r]);
  return map;
}
