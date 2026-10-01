import { ImageResponse } from "next/og";

// Agency share card (Unit 54), used by every route that does not set its own.
// The Creator Fit tool keeps its own preview via its layout's metadata.
// Colours are the dark tokens from globals.css; ImageResponse cannot read CSS
// variables, so they are spelled out here.
export const alt = "OverlapX: videos made for the X timeline";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0a0c10",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="56" height="56" viewBox="0 0 32 32" fill="none">
            <circle cx="12.5" cy="16" r="8" stroke="#bef54b" strokeWidth="2" />
            <circle cx="19.5" cy="16" r="8" stroke="#bef54b" strokeWidth="2" />
            <path d="M16 8.94a8 8 0 0 0 0 14.12A8 8 0 0 0 16 8.94Z" fill="#bef54b" />
          </svg>
          <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>overlapx</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, fontWeight: 700, lineHeight: 0.95, letterSpacing: -4, display: "flex", flexWrap: "wrap" }}>
            <span>Videos made for the&nbsp;</span>
            <span style={{ background: "#bef54b", color: "#0a0c10", padding: "0 14px", borderRadius: 12 }}>X timeline.</span>
          </div>
          <div style={{ marginTop: 28, fontSize: 30, color: "#9ba3af" }}>
            Motion graphics · AI films · Hype · Delivered in 4-5 days
          </div>
        </div>
      </div>
    ),
    size
  );
}
