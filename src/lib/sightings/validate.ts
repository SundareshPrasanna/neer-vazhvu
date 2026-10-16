/** Hand-written form parsing (the repo's no-zod convention). */
import { LIMITS } from "./limits";
import { CASE_EVENTS, type CaseEvent } from "./status";
import { OTHER_KEY, isValidReport } from "./taxonomy";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function str(v: FormDataEntryValue | null, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

function num(v: FormDataEntryValue | null): number | null {
  const n = typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function photos(form: FormData): File[] {
  return form.getAll("photos").filter((p): p is File => p instanceof File && p.size > 0);
}

export interface SubmitInput {
  lat: number;
  lng: number;
  accuracy: number | null;
  category: string;
  subcategory: string | null;
  note: string | null;
  photos: File[];
  /** Read by the phone from the original photo; unverified. */
  photoMeta: { capturedAt: string | null; lat: number | null; lng: number | null };
}

export function parseSubmit(form: FormData): Parsed<SubmitInput> {
  const lat = num(form.get("lat"));
  const lng = num(form.get("lng"));
  if (lat == null || lng == null || lat < 6 || lat > 38 || lng < 68 || lng > 98) {
    return { ok: false, error: "We could not read a location in India." };
  }
  const category = str(form.get("category"), 40);
  const subcategory = str(form.get("subcategory"), 40);
  if (!category || !isValidReport(category, subcategory)) return { ok: false, error: "Choose what you saw." };
  const note = str(form.get("note"), LIMITS.noteChars);
  if (category === OTHER_KEY && !note) return { ok: false, error: "Describe what you saw." };
  const files = photos(form);
  if (files.length < 1) return { ok: false, error: "Add at least one photo." };
  if (files.length > LIMITS.photosPerReport) return { ok: false, error: `Add at most ${LIMITS.photosPerReport} photos.` };
  const taken = str(form.get("takenAt"), 40);
  const capturedAt = taken && !Number.isNaN(Date.parse(taken)) ? new Date(taken).toISOString() : null;
  const pLat = num(form.get("photoLat"));
  const pLng = num(form.get("photoLng"));
  const gps = pLat != null && pLng != null && Math.abs(pLat) <= 90 && Math.abs(pLng) <= 180;
  return {
    ok: true,
    value: {
      lat, lng, accuracy: num(form.get("accuracy")), category, subcategory, note, photos: files,
      photoMeta: { capturedAt, lat: gps ? pLat : null, lng: gps ? pLng : null },
    },
  };
}

export interface EventInput {
  event: CaseEvent;
  authorityBody: string | null;
  reference: string | null;
  reason: string | null;
  photo: File | null;
}

export function parseEvent(form: FormData): Parsed<EventInput> {
  const event = str(form.get("event"), 20) as CaseEvent | null;
  if (!event || !CASE_EVENTS.includes(event)) return { ok: false, error: "Unknown update." };
  const authorityBody = str(form.get("authorityBody"), 160);
  if (event === "reported" && !authorityBody) return { ok: false, error: "Say who you reported it to." };
  const photo = photos(form)[0] ?? null;
  if (event === "fixed" && !photo) return { ok: false, error: "Add a photo showing it fixed." };
  return {
    ok: true,
    value: { event, authorityBody, reference: str(form.get("reference"), 80), reason: str(form.get("reason"), LIMITS.noteChars), photo },
  };
}
