import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Neer Vazhvu | Chennai Water Intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0c4a6e 100%)",
          padding: "60px 80px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Water drop icon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #06b6d4, #2563eb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="36"
              height="36"
              fill="white"
            >
              <path d="M12 3s-5 6.1-5 9.9A5 5 0 0 0 12 18a5 5 0 0 0 5-5.1C17 9.1 12 3 12 3z" />
            </svg>
          </div>
          <span
            style={{
              fontSize: "48px",
              fontWeight: 800,
              color: "white",
              letterSpacing: "-1px",
            }}
          >
            Neer Vazhvu
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: "28px",
            color: "#94a3b8",
            lineHeight: 1.4,
            marginBottom: "48px",
            maxWidth: "800px",
          }}
        >
          Real-time dashboard tracking Chennai&apos;s water reserves,
          groundwater health, and days of water remaining.
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: "48px",
          }}
        >
          {[
            { label: "Reservoirs", value: "6", color: "#3b82f6" },
            { label: "Water Bodies", value: "1,635", color: "#06b6d4" },
            { label: "Groundwater Wards", value: "200", color: "#22c55e" },
            { label: "Rivers Tracked", value: "4", color: "#f97316" },
          ].map((stat) => (
            <div key={stat.label} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "36px", fontWeight: 700, color: stat.color }}>
                {stat.value}
              </span>
              <span style={{ fontSize: "16px", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px" }}>
                {stat.label}
              </span>
            </div>
          ))}
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
          <span style={{ fontSize: "18px", color: "#475569" }}>
            Chennai Water Intelligence
          </span>
          <span style={{ fontSize: "16px", color: "#475569" }}>
            neervazhvu.vercel.app
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
