import { ImageResponse } from "next/og";
import sharp from "sharp";

import { day } from "@/components/sightings/report-card";
import { countsLine, placeLine, shareAsk } from "@/lib/sightings/issue-share";
import { loadSharedIssue } from "./load";

export const runtime = "nodejs";
export const revalidate = 300;
export const alt = "A water issue on the public record, from residents' reports on Neer Vazhvu";
export const size = { width: 1200, height: 630 };
/** JPEG, not the PNG ImageResponse draws: a photo card as PNG is near 1 MB, and WhatsApp drops preview images over about 300 KB. */
export const contentType = "image/jpeg";

/** The site's paper and ink: white, slate-200 rules, slate-900 ink, slate-600 for quieter lines, cyan-700 for the ask. */
const PAPER = "#ffffff";
const RULE = "#e2e8f0";
const INK = "#0f172a";
const MUTED = "#475569";
const ACCENT = "#0e7490";
const PHOTO_W = 520;

/** The published photo cropped to its column as a JPEG (stored photos are WebP); null if it cannot be fetched or read. */
async function photoData(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const jpeg = await sharp(Buffer.from(await res.arrayBuffer()), { limitInputPixels: 50_000_000 })
      .resize(PHOTO_W, size.height, { fit: "cover" })
      .jpeg({ quality: 80 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

/** The issue's photo beside its label, place and counts; text alone when it has no published photo. No icons. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const shared = await loadSharedIssue((await params).id);
  if (!shared) return new Response("Not found", { status: 404 });
  const { issue } = shared;
  const photo = await photoData(issue.photoUrl);
  const place = placeLine(issue.where, shared.placeName);
  const label = issue.label.length > 90 ? `${issue.label.slice(0, 88).trimEnd()}...` : issue.label;

  const card = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: PAPER, color: INK }}>
        {photo && <img src={photo} alt="" width={PHOTO_W} height={size.height} style={{ objectFit: "cover" }} />}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: photo ? "56px 64px 52px 56px" : "64px 80px 56px",
          }}
        >
          <div style={{ fontSize: 30, letterSpacing: -0.5 }}>Neer Vazhvu</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: photo ? 50 : 66, lineHeight: 1.12, letterSpacing: -1 }}>{label}</div>
            {place && <div style={{ fontSize: photo ? 28 : 32, lineHeight: 1.3, color: MUTED }}>{place}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: `2px solid ${RULE}`, paddingTop: 24 }}>
            <div style={{ fontSize: photo ? 28 : 32, lineHeight: 1.3 }}>{countsLine(issue, day)}</div>
            <div style={{ fontSize: 24, color: ACCENT }}>{shareAsk(issue)}</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
  const jpeg = await sharp(Buffer.from(await card.arrayBuffer())).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } });
}
