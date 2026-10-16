import "server-only";

import { createHash } from "node:crypto";
import exifr from "exifr";
import sharp from "sharp";

import { adminClient } from "./auth";
import { LIMITS } from "./limits";

export const INTAKE_BUCKET = "sightings-intake";
export const PUBLIC_BUCKET = "sightings-public";

/** JPEG, PNG, WebP, HEIC by their first bytes; the browser's declared type is ignored. */
function looksLikeImage(b: Buffer): boolean {
  if (b.length < 12) return false;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true;
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return true;
  return b.toString("ascii", 4, 8) === "ftyp" && /^(heic|heix|mif1|msf1|hevc)$/.test(b.toString("ascii", 8, 12));
}

export interface ProcessedPhoto {
  webp: Buffer;
  sha256: string;
  bytes: number;
  width: number | null;
  height: number | null;
  exif: { capturedAt: string | null; lat: number | null; lng: number | null };
}

/** Validate, read EXIF, then re-encode: the stored file carries no metadata. */
export async function processPhoto(file: File): Promise<ProcessedPhoto | { error: string }> {
  if (file.size > LIMITS.photoBytes) return { error: "A photo is too large." };
  const raw = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(raw)) return { error: "Only photos can be uploaded." };

  const exif = { capturedAt: null as string | null, lat: null as number | null, lng: null as number | null };
  try {
    // No `pick`: exifr derives latitude/longitude only when it reads the whole GPS block.
    const tags = await exifr.parse(raw, { gps: true });
    const when = tags?.DateTimeOriginal ?? tags?.CreateDate;
    if (when instanceof Date && !Number.isNaN(when.getTime())) exif.capturedAt = when.toISOString();
    if (typeof tags?.latitude === "number" && typeof tags?.longitude === "number") [exif.lat, exif.lng] = [tags.latitude, tags.longitude];
  } catch {
    // No EXIF is normal (screenshots, stripped uploads).
  }

  try {
    const { data, info } = await sharp(raw, { limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    return {
      webp: data,
      sha256: createHash("sha256").update(raw).digest("hex"),
      bytes: data.length,
      width: info.width ?? null,
      height: info.height ?? null,
      exif,
    };
  } catch {
    return { error: "This photo could not be read." };
  }
}

type Stored = { exif: ProcessedPhoto["exif"] | null } | { error: string; status: number };

/** Re-encode, upload to the private bucket and record each photo; all or nothing. */
export async function storePhotos(
  sightingId: string,
  reporterKey: string,
  placeId: string,
  kind: "report" | "fixed",
  files: File[],
): Promise<Stored> {
  const processed: ProcessedPhoto[] = [];
  for (const file of files) {
    const p = await processPhoto(file);
    if ("error" in p) return { error: p.error, status: 400 };
    processed.push(p);
  }
  const admin = adminClient();
  const stamp = Date.now().toString(36);
  const rows = processed.map((p, i) => ({
    sighting_id: sightingId,
    reporter_key: reporterKey,
    kind,
    storage_path: `${placeId}/${sightingId}/${kind}-${stamp}-${i}.webp`,
    sha256: p.sha256,
    bytes: p.bytes,
    width: p.width,
    height: p.height,
    ordinal: i,
  }));
  const paths = rows.map((r) => r.storage_path);
  for (const [i, p] of processed.entries()) {
    const up = await admin.storage.from(INTAKE_BUCKET).upload(paths[i], p.webp, { contentType: "image/webp" });
    if (up.error) {
      await admin.storage.from(INTAKE_BUCKET).remove(paths);
      throw up.error;
    }
  }
  const ins = await admin.from("sighting_photos").insert(rows);
  if (ins.error) {
    await admin.storage.from(INTAKE_BUCKET).remove(paths);
    // 23505: this account already sent one of these photos.
    if (ins.error.code === "23505") return { error: "You have already sent this photo.", status: 409 };
    throw ins.error;
  }
  return { exif: processed.find((p) => p.exif.capturedAt || p.exif.lat != null)?.exif ?? null };
}

/** Copy reviewed photos to the public bucket and record their public paths. */
export async function publishPhotos(photos: { id: string; storage_path: string }[]): Promise<void> {
  const admin = adminClient();
  for (const p of photos) {
    const { error } = await admin.storage.from(INTAKE_BUCKET).copy(p.storage_path, p.storage_path, { destinationBucket: PUBLIC_BUCKET });
    if (error && !/exists/i.test(error.message)) throw error;
    await admin.from("sighting_photos").update({ public_path: p.storage_path }).eq("id", p.id);
    await admin.storage.from(INTAKE_BUCKET).remove([p.storage_path]);
  }
}

/** Delete photos from both buckets and their rows. */
export async function deletePhotos(photos: { id: string; storage_path: string }[]): Promise<void> {
  if (photos.length === 0) return;
  const admin = adminClient();
  const paths = photos.map((p) => p.storage_path);
  await admin.storage.from(INTAKE_BUCKET).remove(paths);
  await admin.storage.from(PUBLIC_BUCKET).remove(paths);
  await admin.from("sighting_photos").delete().in("id", photos.map((p) => p.id));
}

export function publicPhotoUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PUBLIC_BUCKET}/${path}`;
}
