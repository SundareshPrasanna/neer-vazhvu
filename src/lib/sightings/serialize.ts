import "server-only";

import { tryGetPlaceConfig } from "@/lib/cities";
import { listAtlasDistricts } from "@/lib/atlas/registry";
import { publicPhotoUrl } from "./photos";
import { resolveAuthority } from "./routing";
import { isPrivateCategory, labelFor, type AuthorityRole } from "./taxonomy";
import type { EventRow, OwnReport, PhotoRow, PublicReport, SightingRow } from "./types";

export const PUBLIC_EVENTS = new Set(["approved", "reported", "authority_done", "fixed", "still_there", "closed", "reopened"]);

function placeName(row: SightingRow): string {
  if (row.place_kind === "city") return tryGetPlaceConfig(row.place_id)?.displayName ?? row.place_id;
  return listAtlasDistricts().find((d) => d.scopeId === row.place_id)?.name ?? row.place_id;
}

function where(row: SightingRow): string | null {
  const unit = row.ward_name ?? (row.ward_id ? `Ward ${row.ward_id}` : null) ?? row.panchayat_name;
  return [row.water_body_name, unit].filter(Boolean).join(", ") || null;
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

export function toPublic(row: SightingRow, photos: PhotoRow[], events: EventRow[]): PublicReport {
  const hidePoint = isPrivateCategory(row.category);
  return {
    id: row.id,
    createdAt: row.created_at,
    placeKind: row.place_kind,
    placeId: row.place_id,
    placeName: placeName(row),
    where: hidePoint ? (row.ward_name ?? row.panchayat_name) : where(row),
    category: row.category,
    subcategory: row.subcategory,
    label: labelFor(row.category, row.subcategory),
    caseStatus: row.case_status,
    lat: hidePoint ? null : Number(row.lat),
    lng: hidePoint ? null : Number(row.lng),
    photoUrls: photos
      .filter((p) => p.public_path)
      .sort((a, b) => (a.kind === b.kind ? a.ordinal - b.ordinal : a.kind === "report" ? -1 : 1))
      .map((p) => publicPhotoUrl(p.public_path!)),
    events: events
      .filter((e) => PUBLIC_EVENTS.has(e.event))
      // authority_body is reporter-typed: shown to the reporter only.
      .map((e) => ({ event: e.event, at: e.created_at, authorityBody: null })),
    handler: resolved(row)?.authority ?? null,
  };
}

export function toOwn(row: SightingRow, photos: PhotoRow[], events: EventRow[]): OwnReport {
  const rejected = events.findLast((e) => e.event === "rejected");
  return {
    ...toPublic(row, photos, events),
    lat: Number(row.lat),
    lng: Number(row.lng),
    where: where(row),
    events: events.map((e) => ({ event: e.event, at: e.created_at, authorityBody: e.authority_body })),
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
