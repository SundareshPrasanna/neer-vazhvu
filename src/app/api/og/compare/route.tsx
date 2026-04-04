import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { resolve } from "path";
import { loadProfilesServer } from "@/lib/utils/load-profiles-server";
import { computeWardRankings } from "@/lib/utils/ward-rankings";
import { parseWardsParam } from "@/lib/utils/parse-wards-param";
import { GRADE_COLORS } from "@/lib/utils/grade-colors";

export const runtime = "nodejs";

const logoPng = readFileSync(resolve(process.cwd(), "public/favicon-80.png"));
const logoSrc = `data:image/png;base64,${logoPng.toString("base64")}`;


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wardNumbers = parseWardsParam(searchParams.get("wards"));

  if (wardNumbers.length === 0) {
    return new Response("Missing or invalid wards param", { status: 400 });
  }

  const profiles = loadProfilesServer();
  const rankings = wardNumbers
    .map((w) => computeWardRankings(w, profiles))
    .filter(Boolean);

  if (rankings.length === 0) {
    return new Response("No valid wards found", { status: 404 });
  }

  const colWidth = rankings.length === 1 ? 400 : rankings.length === 2 ? 350 : 280;

  const columns = rankings.map((r) => {
    if (!r) return null;
    const gc = GRADE_COLORS[r.overallGrade] || GRADE_COLORS.C;
    return { wardNumber: r.wardNumber, zoneName: r.zoneName, grade: r.overallGrade, rank: r.overallRank, total: r.overallTotal, percentile: r.overallPercentile, bg: gc.bg, text: gc.text };
  }).filter(Boolean);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0c4a6e 100%)",
        padding: "60px 80px",
      }}
    >
      {/* Branding */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={40} height={40} style={{ width: "40px", height: "40px", borderRadius: "10px" }} alt="" />
        <span style={{ fontSize: "24px", fontWeight: 700, color: "#94a3b8" }}>Neer Vazhvu</span>
      </div>

      {/* Title */}
      <div style={{ fontSize: "36px", fontWeight: 800, color: "white", marginBottom: "40px", display: "flex" }}>
        Ward Comparison
      </div>

      {/* Ward columns */}
      <div style={{ display: "flex", gap: "24px", justifyContent: columns.length === 1 ? "center" : "flex-start", flex: 1 }}>
        {columns.map((c) => (
          <div key={c!.wardNumber} style={{ width: `${colWidth}px`, display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "24px", borderRadius: "16px", backgroundColor: "rgba(255,255,255,0.08)" }}>
            <span style={{ fontSize: "32px", fontWeight: 800, color: "white" }}>Ward {c!.wardNumber}</span>
            <span style={{ fontSize: "16px", color: "#cbd5e1" }}>{c!.zoneName}</span>
            <div style={{ width: "80px", height: "80px", borderRadius: "20px", backgroundColor: c!.bg, color: c!.text, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", marginTop: "8px" }}>
              <span style={{ fontSize: "48px", fontWeight: 900, lineHeight: 1 }}>{c!.grade}</span>
            </div>
            <span style={{ fontSize: "16px", color: "#e2e8f0", marginTop: "4px" }}>#{c!.rank} of {c!.total}</span>
            <span style={{ fontSize: "14px", color: "#94a3b8" }}>{c!.percentile}th percentile</span>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div style={{ position: "absolute", bottom: "40px", left: "80px", right: "80px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: "16px", color: "#94a3b8" }}>Ward Comparison</span>
        <span style={{ fontSize: "16px", color: "#94a3b8" }}>neervazhvu.org</span>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    },
  );
}
