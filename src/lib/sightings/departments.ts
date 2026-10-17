/**
 * The department channel: one private signed link per handling body. Its officers see the checked
 * reports routed to that body and mark each one. Departments are not users: the link is the only
 * credential, and what it shows is the public record (never the reporter, note or references; the
 * point only as the public map has it, rounded and never for tap water).
 *
 * No `server-only` import, so the pure helpers run under node:test; the database helpers load
 * serialize (server-only) lazily. The secret is a non-public env var, so nothing here works in a browser.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveAuthority } from "./routing";
import { STATE_ROUTING } from "./routing/states";
import type { Authority } from "./routing/types";
import { DEPARTMENT_EVENTS, OPEN_STATUSES, departmentNext, type ActorRole, type CaseStatus, type DepartmentEvent } from "./status";
import type { AuthorityRole } from "./taxonomy";
import type { EventRow, PhotoRow, PublicReport, SightingRow } from "./types";

export const NOTE_MAX = 280;
/** Updates per department per rolling day, and per report per department per rolling day. */
export const DEPARTMENT_LIMITS = { daily: 300, perReportDaily: 5 } as const;

const MIN_SECRET = 32;
const KEY_RE = /^[0-9a-f]{16}$/;
const SIG_RE = /^[A-Za-z0-9_-]{43}$/;

/** The link secret, or null when department links are off (missing or under 32 characters). */
export function linkSecret(): string | null {
  const s = process.env.SIGHTINGS_DEPARTMENT_LINK_SECRET ?? "";
  return s.length >= MIN_SECRET ? s : null;
}

/**
 * One key per body per state: the same body across places (a state pollution board, a basin circle
 * shared by two districts) is one department. Keyed on the name, not the source URL, so a corrected
 * source page keeps the link working; renaming a body in routing gives it a new key and a new link.
 */
export function departmentKey(stateCode: string, body: string): string {
  const name = body.trim().replace(/\s+/g, " ").toLowerCase();
  return createHash("sha256").update(`${stateCode.toUpperCase()}\n${name}`).digest("hex").slice(0, 16);
}

/** What an event row's actor_key holds for a department. */
export const actorKey = (key: string) => `dept:${key}`;

const mac = (secret: string, key: string) => createHmac("sha256", secret).update(`department-link:${key}`).digest();
const usable = (secret: string | null): secret is string => !!secret && secret.length >= MIN_SECRET;

/** `<key>.<signature>`, or null when links are off. */
export function signDepartment(key: string, secret: string | null = linkSecret()): string | null {
  if (!usable(secret) || !KEY_RE.test(key)) return null;
  return `${key}.${mac(secret, key).toString("base64url")}`;
}

/** The department key a token was signed for, or null. Constant-time on the signature. */
export function verifyDepartmentToken(token: unknown, secret: string | null = linkSecret()): string | null {
  if (!usable(secret) || typeof token !== "string") return null;
  const [key, sig, ...rest] = token.split(".");
  if (rest.length || !KEY_RE.test(key) || !SIG_RE.test(sig ?? "")) return null;
  const given = Buffer.from(sig, "base64url");
  const want = mac(secret, key);
  return given.length === want.length && timingSafeEqual(given, want) ? key : null;
}

export interface Department {
  key: string;
  body: string;
  acronym: string | null;
}

const asDepartment = (stateCode: string, a: Authority): Department => ({ key: departmentKey(stateCode, a.body), body: a.body, acronym: a.acronym ?? null });

export type RoutableRow = Pick<SightingRow, "authority_role" | "state_code" | "place_id" | "place_kind" | "corporation_id">;

/** The body that handles a row, resolved exactly as the public card resolves it (serialize.ts). */
export function departmentOf(row: RoutableRow): Department | null {
  if (!row.authority_role) return null;
  const { authority } = resolveAuthority(row.authority_role as AuthorityRole, {
    stateCode: row.state_code,
    placeId: row.place_id,
    placeKind: row.place_kind,
    corporationId: row.corporation_id,
  });
  return authority ? asDepartment(row.state_code, authority) : null;
}

/** A key's body from the routing tables, so a link works before its body has any report. */
export function findDepartment(key: string): Department | null {
  for (const [stateCode, state] of Object.entries(STATE_ROUTING)) {
    const tables = [state.roles, ...Object.values(state.places).flatMap((p) => [p.roles, ...Object.values(p.corporations ?? {})])];
    for (const table of tables)
      for (const a of Object.values(table)) if (a && departmentKey(stateCode, a.body) === key) return asDepartment(stateCode, a);
  }
  return null;
}

export const isDepartmentEvent = (v: unknown): v is DepartmentEvent => typeof v === "string" && (DEPARTMENT_EVENTS as readonly string[]).includes(v);

/** Whether a department's event fits the status, and where it leads. "Not ours" records only, on an open item. */
export function departmentMove(event: DepartmentEvent, current: CaseStatus | null): { ok: boolean; next: CaseStatus | null } {
  if (event === "not_ours") return { ok: !!current && OPEN_STATUSES.has(current), next: null };
  const next = departmentNext(event, current);
  return { ok: next !== null, next };
}

export const actionsFor = (status: CaseStatus | null): DepartmentEvent[] => DEPARTMENT_EVENTS.filter((e) => departmentMove(e, status).ok);

/** One report as its department sees it: the public card, its history with the department's own notes, and what it may mark. */
export interface DepartmentItem {
  id: string;
  /** YYYY-MM-DD in India time. */
  date: string;
  label: string;
  placeName: string;
  where: string | null;
  caseStatus: CaseStatus;
  readings: PublicReport["readings"];
  waterSource: string | null;
  test: string | null;
  photoUrls: string[];
  /** The public point (PublicReport.point): rounded to about 100 m, null for tap water and water tests. */
  point: PublicReport["point"];
  history: HistoryEntry[];
  actions: DepartmentEvent[];
}

export interface HistoryEntry {
  event: string;
  at: string;
  by: ActorRole;
  /** The department's own note on its own marks; nobody else's text. */
  note: string | null;
}

/** EventRow plus the column a department's own marks are told apart by. */
export type KeyedEvent = EventRow & { actor_key: string | null };

/** YYYY-MM-DD in India time, as public dates are. */
export const istDate = (iso: string | number | Date) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** Public events, plus this department's own marks (including "not ours", which is not public) with its notes. */
export function historyFor(events: KeyedEvent[], key: string, publicEvents: ReadonlySet<string>): HistoryEntry[] {
  const me = actorKey(key);
  return events.flatMap((e) => {
    const own = e.actor_role === "department" && e.actor_key === me;
    if (!own && !publicEvents.has(e.event)) return [];
    return [{ event: e.event, at: istDate(e.created_at), by: e.actor_role, note: own ? e.reason : null }];
  });
}

export interface DepartmentSummary extends Department {
  open: number;
  all: number;
  /** Reports this department marked "not ours": a routing entry to check. */
  notOurs: number;
}

type Routable = RoutableRow & Pick<SightingRow, "id" | "case_status">;

/** Counts per department from routable rows and the department "not ours" marks, by body name. */
export function summarise(rows: Routable[], notOurs: { sighting_id: string; actor_key: string | null }[]): DepartmentSummary[] {
  const marked = new Set(notOurs.map((m) => `${m.actor_key}|${m.sighting_id}`));
  const by = new Map<string, DepartmentSummary>();
  for (const r of rows) {
    const d = departmentOf(r);
    if (!d || !r.case_status) continue;
    const s = by.get(d.key) ?? { ...d, open: 0, all: 0, notOurs: 0 };
    s.all += 1;
    if (OPEN_STATUSES.has(r.case_status)) s.open += 1;
    if (marked.has(`${actorKey(d.key)}|${r.id}`)) s.notOurs += 1;
    by.set(d.key, s);
  }
  return [...by.values()].sort((a, b) => a.body.localeCompare(b.body));
}

/*
 * Database helpers. Matching is in memory: every approved, routed row is loaded (slim columns) and
 * resolved through the routing tables, since only authority_role is stored. Cheap at today's scale
 * (hundreds of reports); SCAN_MAX bounds a request. Well before that, store the department key on the
 * row at approval (a migration) and filter in SQL.
 */
const PAGE = 1000;
const SCAN_MAX = 20_000;
const CHUNK = 150;
const ROUTABLE = "id, created_at, case_status, authority_role, state_code, place_id, place_kind, corporation_id";

async function approvedRoutable(admin: SupabaseClient): Promise<(Routable & { created_at: string })[]> {
  const rows: (Routable & { created_at: string })[] = [];
  for (let from = 0; from < SCAN_MAX; from += PAGE) {
    const { data, error } = await admin
      .from("sightings")
      .select(ROUTABLE)
      .eq("review_status", "approved")
      .not("authority_role", "is", null)
      .not("case_status", "is", null)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as (Routable & { created_at: string })[]));
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}

/** `.in()` over many ids, in chunks short enough for a URL. */
async function inChunks<T>(ids: string[], load: (chunk: string[]) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await load(ids.slice(i, i + CHUNK));
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
  }
  return out;
}

/** A department's approved reports, open ones first, newest first within each group. */
export async function departmentItems(admin: SupabaseClient, key: string): Promise<{ open: DepartmentItem[]; done: DepartmentItem[] }> {
  const ids = (await approvedRoutable(admin)).filter((r) => departmentOf(r)?.key === key).map((r) => r.id);
  if (!ids.length) return { open: [], done: [] };
  const { PUBLIC_EVENTS, byId, toPublic } = await import("./serialize");
  const [rows, photos, events] = await Promise.all([
    inChunks<SightingRow>(ids, (c) => admin.from("sightings").select("*").in("id", c)),
    inChunks<PhotoRow>(ids, (c) => admin.from("sighting_photos").select("*").in("sighting_id", c)),
    inChunks<KeyedEvent>(ids, (c) => admin.from("sighting_events").select("*").in("sighting_id", c).order("created_at")),
  ]);
  const photoMap = byId(photos);
  const eventMap = byId(events);
  const items = rows
    .filter((r) => r.review_status === "approved" && r.case_status && departmentOf(r)?.key === key)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((r): DepartmentItem => {
      const p = toPublic(r, photoMap.get(r.id) ?? [], []);
      return {
        id: p.id,
        date: p.createdAt,
        label: p.label,
        placeName: p.placeName,
        where: p.where,
        caseStatus: r.case_status!,
        readings: p.readings,
        waterSource: p.waterSource,
        test: p.test,
        photoUrls: p.photoUrls,
        point: p.point,
        history: historyFor(eventMap.get(r.id) ?? [], key, PUBLIC_EVENTS),
        actions: actionsFor(r.case_status),
      };
    });
  return { open: items.filter((i) => OPEN_STATUSES.has(i.caseStatus)), done: items.filter((i) => !OPEN_STATUSES.has(i.caseStatus)) };
}

/** Every department with approved reports, with counts, for the reviewer. */
export async function departmentSummaries(admin: SupabaseClient): Promise<DepartmentSummary[]> {
  const [rows, marks] = await Promise.all([
    approvedRoutable(admin),
    admin.from("sighting_events").select("sighting_id, actor_key").eq("actor_role", "department").eq("event", "not_ours").limit(10_000),
  ]);
  if (marks.error) throw marks.error;
  return summarise(rows, (marks.data ?? []) as { sighting_id: string; actor_key: string | null }[]);
}
