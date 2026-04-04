import { ImageResponse } from "next/og";
import { loadProfilesServer } from "@/lib/utils/load-profiles-server";
import { computeWardRankings } from "@/lib/utils/ward-rankings";
import { GRADE_COLORS } from "@/lib/utils/grade-colors";

export const runtime = "nodejs";

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

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0c4a6e 100%)",
          padding: "60px 80px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #06b6d4, #2563eb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="white">
              <path d="M12 3s-5 6.1-5 9.9A5 5 0 0 0 12 18a5 5 0 0 0 5-5.1C17 9.1 12 3 12 3z" />
            </svg>
          </div>
          <span
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "#94a3b8",
            }}
          >
            Neer Vazhvu
          </span>
        </div>

        {/* Ward info + grade badge */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "32px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: "48px",
                fontWeight: 800,
                color: "white",
                letterSpacing: "-1px",
              }}
            >
              Ward {rankings.wardNumber}
            </span>
            <span
              style={{ fontSize: "22px", color: "#94a3b8", marginTop: "4px" }}
            >
              Zone {rankings.zoneNo} - {rankings.zoneName}
            </span>
          </div>
          <div
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "24px",
              backgroundColor: gc.bg,
              color: gc.text,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: "64px", fontWeight: 900 }}>
              {rankings.overallGrade}
            </span>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 600,
                textTransform: "uppercase" as const,
              }}
            >
              Overall
            </span>
          </div>
        </div>

        {/* Rank line */}
        <div
          style={{
            fontSize: "20px",
            color: "#cbd5e1",
            marginBottom: "32px",
          }}
        >
          Ranked #{rankings.overallRank} of {rankings.overallTotal} wards -{" "}
          {rankings.overallPercentile}th percentile
        </div>

        {/* Metric grade pills */}
        <div style={{ display: "flex", gap: "16px" }}>
          {rankings.metrics.map((m) => {
            const mc = m.grade
              ? GRADE_COLORS[m.grade] || GRADE_COLORS.C
              : { bg: "#334155", text: "#94a3b8" };
            return (
              <div
                key={m.key}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                  padding: "12px 20px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(255,255,255,0.06)",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    backgroundColor: mc.bg,
                    color: mc.text,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "22px",
                    fontWeight: 800,
                  }}
                >
                  {m.grade || "-"}
                </div>
                <span
                  style={{
                    fontSize: "12px",
                    color: "#64748b",
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.5px",
                  }}
                >
                  {SHORT_LABELS[m.key] || m.key}
                </span>
              </div>
            );
          })}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            left: "80px",
            right: "80px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "16px", color: "#475569" }}>
            Ward Report Card
          </span>
          <span style={{ fontSize: "16px", color: "#475569" }}>
            neervazhvu.org
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    },
  );
}
