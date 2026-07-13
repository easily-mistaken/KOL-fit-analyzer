"use client";

import * as React from "react";

// Interactive "engaged audience" field (landing hero). A drifting crowd of
// faint particles; a subset are the genuinely *engaged* audience — electric
// blue, brighter, and networked. The cursor acts like the analyzer: nearby
// accounts light up (crowd → engaged) and connect to it. Canvas + rAF, no deps;
// respects prefers-reduced-motion.

type P = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  engaged: boolean;
  glow: number; // 0..1 current "lit" amount
};

const ENGAGED_COLOR = [41, 115, 255]; // Morpho blue #2973FF
const ENGAGED_HI = [87, 146, 255]; // #5792FF

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
            ctx!.strokeStyle = `rgba(87,146,255,${alpha})`;
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
            ctx!.strokeStyle = `rgba(41,115,255,${(1 - d / 190) * 0.5 * p.glow})`;
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
          const [r, g, b] = lit > 0.6 ? ENGAGED_HI : ENGAGED_COLOR;
          // soft halo
          ctx!.fillStyle = `rgba(${r},${g},${b},${0.18 * lit})`;
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.r + 8 * lit, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.fillStyle = `rgba(${r},${g},${b},${0.62 + 0.38 * lit})`;
        } else {
          ctx!.fillStyle = "rgba(139,143,148,0.62)";
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

        // cursor energizes + gently attracts nearby accounts.
        let target = p.engaged ? 0.7 : 0;
        if (pointer.active) {
          const dx = pointer.x - p.x;
          const dy = pointer.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d < 190) {
            const f = 1 - d / 190;
            target = Math.max(target, 0.45 + 0.55 * f);
            p.vx += (dx / (d || 1)) * f * 0.028;
            p.vy += (dy / (d || 1)) * f * 0.028;
          }
        }
        p.glow += (target - p.glow) * 0.08;
        // friction so attraction doesn't run away
        p.vx *= 0.985;
        p.vy *= 0.985;
        // keep a minimum ambient drift
        const sp = Math.hypot(p.vx, p.vy);
        if (sp < 0.05) {
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
