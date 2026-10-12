import { ImageResponse } from "next/og";

// Touch icon for phones: iOS ignores the SVG favicon (app/icon.svg), so
// without this a saved bookmark or home-screen shortcut shows a blank tile or
// a page screenshot instead of the logo. Android falls back to it too.
// 180x180 is the size iOS asks for. The tile is opaque (iOS fills transparent
// pixels with black and rounds the corners itself) and the mark sits inside
// the safe area so the mask never clips it. Same mark as components/logo-mark;
// update both by hand if it ever changes.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0c10",
        }}
      >
        <svg width="128" height="128" viewBox="0 0 32 32" fill="none">
          <circle cx="12.5" cy="16" r="8" stroke="#bef54b" strokeWidth="2" />
          <circle cx="19.5" cy="16" r="8" stroke="#bef54b" strokeWidth="2" />
          <path d="M16 8.94a8 8 0 0 0 0 14.12A8 8 0 0 0 16 8.94Z" fill="#bef54b" />
        </svg>
      </div>
    ),
    size
  );
}
