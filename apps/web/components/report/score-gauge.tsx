import * as React from "react";

// Radial 0–100 score gauge (Unit 22). Pure SVG, server-rendered. `color` is a
// CSS color (usually a --state-* token var) for the value arc.
export function ScoreGauge({
  value,
  color,
  size = 160,
  label = "overall",
}: {
  value: number;
  color: string;
  size?: number;
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const stroke = 12;
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const dash = (c * v) / 100;
  const cx = size / 2;

  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="var(--bg-muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash.toFixed(2)} ${(c - dash + 4).toFixed(2)}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <div
          className="font-mono text-[40px] font-bold leading-none"
          style={{ color }}
        >
          {Math.round(v)}
        </div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">
          / 100 {label}
        </div>
      </div>
    </div>
  );
}
