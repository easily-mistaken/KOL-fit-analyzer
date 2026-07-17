"use client";

import * as React from "react";

// Interactive "engaged audience" field (landing hero). A drifting crowd of
// faint particles; a subset are the genuinely *engaged* audience — brighter and
// networked. The cursor acts like the analyzer: nearby accounts light up
// (crowd → engaged) and connect to it. Canvas + rAF, no deps; respects
// prefers-reduced-motion.

type P = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  engaged: boolean;
  glow: number; // 0..1 current "lit" amount
};

type Rgb = [number, number, number];

// Cursor physics. CORE is what stops the pile-up: attraction alone (with no
// falloff as distance → 0) pulled every nearby particle onto the exact same
// point, where they fused into a permanent blob. Inside CORE the force
// reverses, so the crowd gathers into a ring around the cursor and disperses
// again when it leaves. MAX_SPEED keeps the attraction from running away.
const REACH = 190;
const CORE = 58;
const MAX_SPEED = 1.15;

const FALLBACK: Rgb = [190, 245, 75];

function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function parseRgbList(v: string): Rgb | null {
  const parts = v.split(",").map((n) => Number(n.trim()));
  return parts.length === 3 && parts.every((n) => Number.isFinite(n))
    ? (parts as Rgb)
    : null;
}

/**
 * The field is drawn on a canvas, which can't consume CSS tokens, so the theme
 * is read off the document and re-read whenever `data-theme` flips. Lime on
 * white is invisible, so light mode steps the engaged colour down to a deeper
 * green rather than reusing the brand fill.
 */
function readFieldTheme() {
  if (typeof window === "undefined") {
    return { engaged: FALLBACK, engagedHi: FALLBACK, crowd: [139, 143, 148] as Rgb };
  }
  const cs = getComputedStyle(document.documentElement);
  return {
    engaged: hexToRgb(cs.getPropertyValue("--field-engaged")) ?? FALLBACK,
    engagedHi: hexToRgb(cs.getPropertyValue("--field-engaged-hi")) ?? FALLBACK,
    crowd: parseRgbList(cs.getPropertyValue("--field-crowd")) ?? ([139, 143, 148] as Rgb),
  };
}

export function AudienceField({ className }: { className?: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let particles: P[] = [];
    const pointer = { x: -9999, y: -9999, active: false };
    let raf = 0;
    let theme = readFieldTheme();

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    function build() {
      const rect = wrap!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(140, Math.max(52, Math.round((w * h) / 6200)));
      particles = Array.from({ length: count }, () => {
        const engaged = Math.random() < 0.34;
        return {
          x: rand(0, w),
          y: rand(0, h),
          vx: rand(-0.2, 0.2),
          vy: rand(-0.2, 0.2),
          r: engaged ? rand(2.2, 3.6) : rand(1.3, 2.1),
          engaged,
          glow: engaged ? rand(0.6, 1) : 0,
        };
      });
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h);
      const linkDist = 138;

      // Connections between lit/engaged particles (subtle network).
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        const aLit = a.engaged || a.glow > 0.15;
        if (!aLit) continue;
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          if (!(b.engaged || b.glow > 0.15)) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < linkDist) {
            const alpha = (1 - d / linkDist) * 0.32 * Math.min(1, (a.glow + b.glow) / 1.4 + 0.4);
            ctx!.strokeStyle = `rgba(${theme.engagedHi[0]},${theme.engagedHi[1]},${theme.engagedHi[2]},${alpha})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }

      // Link energized particles to the cursor.
      if (pointer.active) {
        for (const p of particles) {
          if (p.glow <= 0.2) continue;
          const d = Math.hypot(p.x - pointer.x, p.y - pointer.y);
          if (d < 190) {
            ctx!.strokeStyle = `rgba(${theme.engaged[0]},${theme.engaged[1]},${theme.engaged[2]},${(1 - d / 190) * 0.5 * p.glow})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(p.x, p.y);
            ctx!.lineTo(pointer.x, pointer.y);
            ctx!.stroke();
          }
        }
      }

      // Particles.
      for (const p of particles) {
        const lit = p.glow;
        if (lit > 0.02) {
          const [r, g, b] = lit > 0.6 ? theme.engagedHi : theme.engaged;
          // soft halo
          ctx!.fillStyle = `rgba(${r},${g},${b},${0.18 * lit})`;
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.r + 8 * lit, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.fillStyle = `rgba(${r},${g},${b},${0.62 + 0.38 * lit})`;
        } else {
          const [r, g, b] = theme.crowd;
          ctx!.fillStyle = `rgba(${r},${g},${b},0.62)`;
        }
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function step() {
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        // wrap
        if (p.x < -10) p.x = w + 10;
        else if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        else if (p.y > h + 10) p.y = -10;

        // cursor energizes + gathers nearby accounts into a ring around itself.
        let target = p.engaged ? 0.7 : 0;
        if (pointer.active) {
          const dx = pointer.x - p.x;
          const dy = pointer.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < REACH) {
            const f = 1 - d / REACH;
            target = Math.max(target, 0.45 + 0.55 * f);
            // Pull from range, push back inside CORE. Without the push the force
            // stayed at full strength all the way to d = 0 and the crowd fused
            // into a single clump that never recovered.
            const pull = d > CORE;
            const strength = pull ? f : (1 - d / CORE) * 0.8;
            const dir = pull ? 1 : -1;
            p.vx += (dx / d) * strength * dir * 0.026;
            p.vy += (dy / d) * strength * dir * 0.026;
          }
        }
        p.glow += (target - p.glow) * 0.08;
        // friction so attraction doesn't run away
        p.vx *= 0.985;
        p.vy *= 0.985;
        const sp = Math.hypot(p.vx, p.vy);
        // hard speed ceiling: repeated passes could otherwise stack velocity
        if (sp > MAX_SPEED) {
          p.vx = (p.vx / sp) * MAX_SPEED;
          p.vy = (p.vy / sp) * MAX_SPEED;
        } else if (sp < 0.05) {
          // keep a minimum ambient drift
          p.vx += (Math.random() - 0.5) * 0.06;
          p.vy += (Math.random() - 0.5) * 0.06;
        }
      }
      draw();
      raf = requestAnimationFrame(step);
    }

    const onMove = (e: PointerEvent) => {
      const rect = canvas!.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
      pointer.x = -9999;
      pointer.y = -9999;
    };

    build();
    const ro = new ResizeObserver(() => {
      build();
      if (reduce) draw();
    });
    ro.observe(wrap);

    // Re-read the palette when the theme toggle flips data-theme.
    const themeObserver = new MutationObserver(() => {
      theme = readFieldTheme();
      if (reduce) draw();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    if (reduce) {
      draw();
    } else {
      wrap.addEventListener("pointermove", onMove);
      wrap.addEventListener("pointerleave", onLeave);
      raf = requestAnimationFrame(step);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      themeObserver.disconnect();
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={wrapRef} className={className} aria-hidden="true">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
