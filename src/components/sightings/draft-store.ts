"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

/**
 * Kept on this phone only (IndexedDB; nothing here is ever sent anywhere but our own submit route): a report started
 * before signing in, across the Google redirect, and reports that could not be sent for want of a connection.
 * Every call fails soft: with storage blocked or full, nothing is kept and the flow behaves as it did before.
 */

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const DB_NAME = "nv-citizen";
const DRAFTS = "draft";
const OUTBOX = "outbox";
const DRAFT_KEY = "current";
/** sessionStorage: this tab saved the draft, so it is this person's to restore. */
const PENDING_KEY = "nv-draft";
/** Without that mark (another tab, a home-screen app), only a draft this fresh is restored. */
const FRESH_MS = 30 * 60_000;
/** Older drafts are dropped. */
const DRAFT_MAX_MS = 24 * 3_600_000;
/** Reports waiting to send on one phone. */
export const OUTBOX_MAX = 10;

let opening: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DRAFTS);
      req.result.createObjectStore(OUTBOX, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("blocked"));
  }).catch((e) => {
    opening = null;
    throw e;
  });
  return opening;
}

async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** A photo as bytes: every browser's IndexedDB keeps an ArrayBuffer, not every one keeps a File. */
export type StoredFile = { data: ArrayBuffer; type: string; name: string };
export const toStored = async (f: File): Promise<StoredFile> => ({ data: await f.arrayBuffer(), type: f.type, name: f.name });
export const fromStored = (s: StoredFile) => new File([s.data], s.name, { type: s.type });

/* The draft: one report, kept while its maker signs in. */

type Saved<T> = { id: string; savedAt: number; value: T };

/** Keeps the report on this phone; false when it could not be kept. */
export async function saveDraft<T>(value: T): Promise<boolean> {
  try {
    const id = newId();
    await run(DRAFTS, "readwrite", (s) => s.put({ id, savedAt: Date.now(), value } satisfies Saved<T>, DRAFT_KEY));
    try {
      sessionStorage.setItem(PENDING_KEY, id);
    } catch {
      // Storage blocked: a fresh draft is still restored.
    }
    return true;
  } catch {
    return false;
  }
}

/** Whether this tab kept a draft (read before anything renders, so the form opens rather than the front door). */
export function draftPending(): boolean {
  try {
    return !!sessionStorage.getItem(PENDING_KEY);
  } catch {
    return false;
  }
}

/** The draft this person left, if any. It stays stored until it is sent, saved to the outbox or discarded. */
export async function loadDraft<T>(): Promise<T | null> {
  try {
    const d = (await run(DRAFTS, "readonly", (s) => s.get(DRAFT_KEY))) as Saved<T> | undefined;
    if (!d) return null;
    const age = Date.now() - d.savedAt;
    if (age > DRAFT_MAX_MS) {
      await clearDraft();
      return null;
    }
    let mine = false;
    try {
      mine = sessionStorage.getItem(PENDING_KEY) === d.id;
    } catch {
      // As above.
    }
    return mine || age < FRESH_MS ? d.value : null;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Storage blocked.
  }
  try {
    await run(DRAFTS, "readwrite", (s) => s.delete(DRAFT_KEY));
  } catch {
    // Nothing kept.
  }
}

/* The outbox: reports that could not reach us yet, each kept with whoever was signed in when it was made. */

export interface Queued {
  id: string;
  /** The signed-in account that made it: only that account sees or sends it. */
  owner: string;
  savedAt: number;
  label: string;
  place: string | null;
  /** The submit form as it was, photos as bytes. */
  entries: [string, string | StoredFile][];
  /** The server's answer the last time it said no (a 4xx); a network failure leaves it empty. */
  error?: string | null;
  status?: number | null;
}

type Snap = { items: Queued[]; loaded: boolean; sent: number };
const EMPTY: Snap = { items: [], loaded: false, sent: 0 };
let snap: Snap = EMPTY;
const listeners = new Set<() => void>();
const set = (next: Partial<Snap>) => {
  snap = { ...snap, ...next };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

async function reload(): Promise<void> {
  try {
    const items = ((await run(OUTBOX, "readonly", (s) => s.getAll())) as Queued[]).sort((a, b) => a.savedAt - b.savedAt);
    set({ items, loaded: true });
  } catch {
    set({ items: [], loaded: true });
  }
}

/** This account's waiting reports, oldest first, and how many were sent from here since the page opened. */
export function useOutbox(owner: string | null) {
  const s = useSyncExternalStore(subscribe, () => snap, () => EMPTY);
  useEffect(() => {
    if (owner) void reload();
  }, [owner]);
  const items = useMemo(() => (owner ? s.items.filter((q) => q.owner === owner) : []), [s.items, owner]);
  return { items, loaded: s.loaded, sent: s.sent };
}

export type Kept = "saved" | "full" | "failed";

/** Keeps a report that could not be sent; "full" at OUTBOX_MAX, "failed" when the phone will not store it. */
export async function enqueue(owner: string, fd: FormData, label: string, place: string | null): Promise<Kept> {
  try {
    const count = await run(OUTBOX, "readonly", (s) => s.count());
    if (count >= OUTBOX_MAX) return "full";
    const entries: Queued["entries"] = [];
    for (const [k, v] of fd.entries()) entries.push([k, typeof v === "string" ? v : await toStored(v)]);
    const item: Queued = { id: newId(), owner, savedAt: Date.now(), label, place, entries };
    await run(OUTBOX, "readwrite", (s) => s.put(item));
    await reload();
    return "saved";
  } catch {
    return "failed";
  }
}

export async function removeQueued(id: string): Promise<boolean> {
  try {
    await run(OUTBOX, "readwrite", (s) => s.delete(id));
    await reload();
    return true;
  } catch {
    return false;
  }
}

/** Drops an account's waiting reports and any draft: for deleting the account, which promises nothing is left behind. */
export async function forgetOwner(owner: string): Promise<void> {
  await clearDraft();
  try {
    const all = (await run(OUTBOX, "readonly", (s) => s.getAll())) as Queued[];
    for (const q of all.filter((x) => x.owner === owner)) await run(OUTBOX, "readwrite", (s) => s.delete(q.id));
  } catch {
    // Nothing kept.
  }
  await reload();
}

const sending = new Set<string>();

/** Network failures and server trouble (5xx, an expired sign-in) are retried; any other no is kept with its reason. */
async function sendOne(q: Queued, authFetch: Fetch): Promise<"sent" | "offline" | "kept"> {
  if (sending.has(q.id)) return "kept";
  sending.add(q.id);
  try {
    const fd = new FormData();
    for (const [k, v] of q.entries) {
      if (typeof v === "string") fd.append(k, v);
      else fd.append(k, fromStored(v));
    }
    const res = await authFetch("/api/sightings", { method: "POST", body: fd }).catch(() => null);
    if (!res) return "offline";
    if (res.ok) {
      await run(OUTBOX, "readwrite", (s) => s.delete(q.id));
      return "sent";
    }
    if (res.status >= 500 || res.status === 401) return "offline";
    const json = await res.json().catch(() => ({}));
    await run(OUTBOX, "readwrite", (s) => s.put({ ...q, error: json.error ?? "We could not take this report.", status: res.status }));
    return "kept";
  } catch {
    return "kept";
  } finally {
    sending.delete(q.id);
  }
}

/**
 * Sends this account's waiting reports, oldest first; stops at the first network failure. Reports the server turned
 * down wait for the person's own "Send now" (`only`). Returns how many went.
 */
export async function flushOutbox(owner: string, authFetch: Fetch, only?: string): Promise<{ sent: number; offline: boolean }> {
  let sent = 0;
  let offline = false;
  try {
    const all = (await run(OUTBOX, "readonly", (s) => s.getAll())) as Queued[];
    const mine = all.filter((q) => q.owner === owner && (only ? q.id === only : !q.status)).sort((a, b) => a.savedAt - b.savedAt);
    for (const q of mine) {
      const r = await sendOne(q, authFetch);
      if (r === "sent") sent++;
      if (r === "offline") {
        offline = true;
        break;
      }
    }
  } catch {
    // Storage gone: nothing to send.
  }
  await reload();
  if (sent) set({ sent: snap.sent + sent });
  return { sent, offline };
}

/** While signed in: send what is waiting now, and again whenever the phone comes back online. */
export function useOutboxSender(owner: string | null, authFetch: Fetch, onSent: () => void) {
  useEffect(() => {
    if (!owner) return;
    const go = () => {
      void flushOutbox(owner, authFetch).then((r) => r.sent > 0 && onSent());
    };
    go();
    window.addEventListener("online", go);
    return () => window.removeEventListener("online", go);
  }, [owner, authFetch, onSent]);
}
