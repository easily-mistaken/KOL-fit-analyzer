import { cn } from "@/lib/utils";
import type { WorkCategory } from "@/lib/agency/work";

/**
 * CSS-only animated stand-in for a video, one composition per category. Shown
 * wherever a project has no footage yet (the preview slots, the hero timeline,
 * the deck), so the layout reads as intended before the real reel lands.
 * Decorative: hidden from assistive tech.
 */
export function MotionPoster({
  category,
  className,
}: {
  category: WorkCategory;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn("relative overflow-hidden bg-base [container-type:inline-size]", className)}
    >
      {category === "ai" && <AiPoster />}
      {category === "motion-graphics" && <MotionGraphicsPoster />}
      {category === "hype" && <HypePoster />}
      {category === "fast-cuts" && <FastCutsPoster />}
      {category === "others" && <ProductPoster />}
      {/* film grain + vignette shared by every poster */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55))]" />
    </div>
  );
}

function AiPoster() {
  return (
    <>
      <div className="poster-orb absolute left-1/4 top-1/4 h-2/3 w-1/2 rounded-full bg-accent-primary/40 blur-3xl" />
      <div className="poster-orb absolute right-[10%] top-[30%] h-1/2 w-1/3 rounded-full bg-info/30 blur-3xl [animation-delay:-3s]" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
      <div className="poster-scan absolute inset-x-0 top-0 h-[10%] bg-gradient-to-b from-transparent via-white/10 to-transparent" />
      <span className="absolute bottom-[8%] left-[6%] font-mono text-[clamp(8px,1.4cqw,12px)] uppercase tracking-[0.2em] text-white/60">
        render 04 / scene 12
      </span>
    </>
  );
}

function MotionGraphicsPoster() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="poster-slide-a absolute h-[46%] aspect-square rounded-full border-[3px] border-accent-primary" />
      <div className="poster-slide-b absolute h-[46%] aspect-square rounded-full border-[3px] border-white/80" />
      <div className="poster-spin absolute h-[78%] aspect-square rounded-full border border-dashed border-white/15" />
      <div className="absolute left-[8%] top-[12%] h-2 w-[18%] rounded-full bg-accent-primary" />
      <div className="absolute bottom-[14%] right-[8%] h-2 w-[26%] rounded-full bg-white/20" />
    </div>
  );
}

function HypePoster() {
  return (
    <>
      <div className="poster-stripes absolute inset-0 opacity-25 [background-image:repeating-linear-gradient(115deg,var(--accent-primary)_0_12px,transparent_12px_32px)] [background-size:64px_64px]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="poster-strobe text-[clamp(28px,9cqw,96px)] font-black uppercase italic leading-none tracking-tighter text-white">
          Live
        </span>
      </div>
      <span className="absolute left-[6%] top-[8%] rounded-full bg-accent-primary px-2 py-0.5 font-mono text-[clamp(8px,1.3cqw,12px)] font-semibold uppercase tracking-widest text-accent-contrast">
        T-minus 03
      </span>
    </>
  );
}

function FastCutsPoster() {
  const frames = [
    "bg-accent-primary",
    "bg-white",
    "bg-elevated",
    "bg-info",
  ];
  return (
    <>
      {frames.map((bg, i) => (
        <div
          key={bg}
          className={cn("poster-cut absolute inset-0 flex items-center justify-center", bg)}
          style={{ animationDelay: `${i * -0.4}s` }}
        >
          <div className="h-1/2 aspect-square rotate-45 rounded-xl bg-black/80" />
        </div>
      ))}
      <div className="absolute inset-x-[6%] bottom-[8%] flex gap-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="h-1 flex-1 rounded-full bg-black/50" />
        ))}
      </div>
    </>
  );
}

function ProductPoster() {
  return (
    <div className="absolute inset-[10%] rounded-lg border border-white/15 bg-surface">
      <div className="flex gap-1.5 border-b border-white/10 p-[3%]">
        <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
      </div>
      <div className="grid grid-cols-3 gap-[4%] p-[5%]">
        <div className="col-span-2 h-3 rounded bg-white/15" />
        <div className="h-3 rounded bg-accent-primary/80" />
        <div className="col-span-3 h-10 rounded bg-white/5" />
        <div className="h-6 rounded bg-white/10" />
        <div className="h-6 rounded bg-white/10" />
        <div className="h-6 rounded bg-white/10" />
      </div>
      <div className="poster-cursor absolute left-[20%] top-[25%] h-3 w-3 rotate-[-20deg] border-l-[6px] border-r-[6px] border-b-[12px] border-l-transparent border-r-transparent border-b-white" />
    </div>
  );
}
