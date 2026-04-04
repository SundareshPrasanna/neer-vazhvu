import { ImageResponse } from "next/og";
import { loadProfilesServer } from "@/lib/utils/load-profiles-server";
import { computeWardRankings } from "@/lib/utils/ward-rankings";
import { parseWardsParam } from "@/lib/utils/parse-wards-param";
import { GRADE_COLORS } from "@/lib/utils/grade-colors";

export const runtime = "nodejs";

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

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
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
            marginBottom: "16px",
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
          <span style={{ fontSize: "24px", fontWeight: 700, color: "#94a3b8" }}>
            Neer Vazhvu
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: "36px",
            fontWeight: 800,
            color: "white",
            letterSpacing: "-0.5px",
            marginBottom: "40px",
          }}
        >
          Ward Comparison
        </div>

        {/* Ward columns */}
        <div
          style={{
            display: "flex",
            gap: "24px",
            justifyContent: rankings.length === 1 ? "center" : "flex-start",
            flex: 1,
          }}
        >
          {rankings.map((r) => {
            if (!r) return null;
            const gc =
              GRADE_COLORS[r.overallGrade] || GRADE_COLORS.C;
            return (
              <div
                key={r.wardNumber}
                style={{
                  width: `${colWidth}px`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "12px",
                  padding: "24px",
                  borderRadius: "16px",
                  backgroundColor: "rgba(255,255,255,0.06)",
                }}
              >
                <span
                  style={{
                    fontSize: "32px",
                    fontWeight: 800,
                    color: "white",
                  }}
                >
                  Ward {r.wardNumber}
                </span>
                <span
                  style={{ fontSize: "16px", color: "#94a3b8" }}
                >
                  {r.zoneName}
                </span>
                <div
                  style={{
                    width: "80px",
                    height: "80px",
                    borderRadius: "20px",
                    backgroundColor: gc.bg,
                    color: gc.text,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: "8px",
                  }}
                >
                  <span style={{ fontSize: "48px", fontWeight: 900 }}>
                    {r.overallGrade}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "16px",
                    color: "#cbd5e1",
                    marginTop: "4px",
                  }}
                >
                  #{r.overallRank} of {r.overallTotal}
                </span>
                <span style={{ fontSize: "14px", color: "#64748b" }}>
                  {r.overallPercentile}th percentile
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
            Ward Comparison
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
