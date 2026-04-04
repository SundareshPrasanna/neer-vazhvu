import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { resolve } from "path";
import { loadProfilesServer } from "@/lib/utils/load-profiles-server";
import { computeWardRankings } from "@/lib/utils/ward-rankings";
import { GRADE_COLORS } from "@/lib/utils/grade-colors";

export const runtime = "nodejs";

// Read the favicon PNG at module load (Satori Node runtime can't handle SVG)
const logoPng = readFileSync(resolve(process.cwd(), "public/favicon-80.png"));
const logoSrc = `data:image/png;base64,${logoPng.toString("base64")}`;

const SHORT_LABELS: Record<string, string> = {
  wb_health: "Water Bodies",
  wb_density: "WB Density",
  flood_risk: "Flood Risk",
  drainage: "Drainage",
  sewerage_infra: "Sewerage",
};


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wardNumber = parseInt(searchParams.get("ward") || "", 10);

  if (!wardNumber || isNaN(wardNumber)) {
    return new Response("Missing or invalid ward param", { status: 400 });
  }

  const profiles = loadProfilesServer();
  const rankings = computeWardRankings(wardNumber, profiles);

  if (!rankings) {
    return new Response("Ward not found", { status: 404 });
  }

  const gc = GRADE_COLORS[rankings.overallGrade] || GRADE_COLORS.C;

  const pills = rankings.metrics.map((m) => {
    const mc = m.grade ? GRADE_COLORS[m.grade] || GRADE_COLORS.C : { bg: "#334155", text: "#94a3b8" };
    return {
      key: m.key,
      grade: m.grade || "-",
      label: SHORT_LABELS[m.key] || m.key,
      rank: m.rank,
      total: m.total,
      bg: mc.bg,
      text: mc.text,
    };
  });

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0c4a6e 100%)",
        padding: "48px 80px 80px",
      }}
    >
      {/* Branding */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={40} height={40} style={{ width: "40px", height: "40px", borderRadius: "10px" }} alt="" />
        <span style={{ fontSize: "24px", fontWeight: 700, color: "#94a3b8" }}>Neer Vazhvu</span>
      </div>

      {/* Ward info + grade badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "48px", fontWeight: 800, color: "white" }}>Ward {rankings.wardNumber}</span>
          <span style={{ fontSize: "22px", color: "#94a3b8", marginTop: "4px" }}>Zone {rankings.zoneNo} - {rankings.zoneName}</span>
        </div>
        <div style={{ width: "120px", height: "120px", borderRadius: "24px", backgroundColor: gc.bg, color: gc.text, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "64px", fontWeight: 900, lineHeight: 1 }}>{rankings.overallGrade}</span>
          <span style={{ fontSize: "14px", fontWeight: 600 }}>OVERALL</span>
        </div>
      </div>

      {/* Rank line */}
      <div style={{ fontSize: "20px", color: "#e2e8f0", marginBottom: "32px", display: "flex" }}>
        Ranked #{rankings.overallRank} of {rankings.overallTotal} wards - {rankings.overallPercentile}th percentile
      </div>

      {/* Metric grade pills with rank */}
      <div style={{ display: "flex", gap: "16px" }}>
        {pills.map((p) => (
          <div key={p.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", padding: "12px 20px", borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.08)" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "10px", backgroundColor: p.bg, color: p.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: 800 }}>
              {p.grade}
            </div>
            <span style={{ fontSize: "13px", color: "#cbd5e1", fontWeight: 600 }}>{p.label}</span>
            {p.rank != null && (
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>#{p.rank}/{p.total}</span>
            )}
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div style={{ position: "absolute", bottom: "40px", left: "80px", right: "80px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: "16px", color: "#94a3b8" }}>Ward Report Card</span>
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
