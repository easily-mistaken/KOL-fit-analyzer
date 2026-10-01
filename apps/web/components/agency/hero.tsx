import Link from "next/link";
import { ChartBar, Heart, MessageCircle, Repeat2 } from "lucide-react";

import { LogoMark } from "@/components/logo-mark";
import { BookCallButton } from "@/components/agency/buttons";
import { Eyebrow } from "@/components/agency/section";
import { VideoFrame } from "@/components/agency/video-frame";
import { AUDIENCES, POSITIONING } from "@/lib/agency/content";
import {
  PREVIEW_SLOTS,
  PROJECTS,
  categoryById,
  type Aspect,
  type ProjectVideo,
  type WorkCategory,
} from "@/lib/agency/work";

interface Post {
  key: string;
  category: WorkCategory;
  aspect: Aspect;
  video: ProjectVideo | null;
  caption: string;
}

function timelinePosts(): Post[] {
  if (PROJECTS.length > 0) {
    return PROJECTS.slice(0, 6).map((p) => ({
      key: p.slug,
      category: p.category,
      aspect: p.aspect === "9:16" ? "4:5" : p.aspect,
      video: p.video,
      caption: p.client ? `${p.client}: ${p.title}` : p.title,
    }));
  }
  return PREVIEW_SLOTS.slice(0, 4).map((s) => ({
    key: s.key,
    category: s.category,
    aspect: s.aspect,
    video: null,
    caption: `${categoryById(s.category).title}, cut for the timeline.`,
  }));
}

export function Hero() {
  const posts = timelinePosts();

  return (
    <section className="relative overflow-hidden">
      {/* faint grid + a single lime glow; no decorative gradients beyond this */}
      <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(var(--border-default)_1px,transparent_1px),linear-gradient(90deg,var(--border-default)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(ellipse_at_30%_20%,black,transparent_70%)] opacity-60" />
      <div className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-accent-primary/10 blur-[120px]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-12 sm:px-8 sm:pt-20 lg:grid-cols-[1.25fr_1fr] lg:pb-28">
        <div>
          <Eyebrow>{POSITIONING.eyebrow}</Eyebrow>
          {/* "OverlapX" stays in the h1 so the brand reads first to people and
              crawlers alike; the claim follows as the visual headline. */}
          <h1 className="mt-6 text-[clamp(46px,7.2vw,104px)] font-semibold leading-[0.92] tracking-[-0.045em] text-foreground">
            <span className="sr-only">OverlapX: </span>
            Videos made for the{" "}
            <span className="relative inline-block whitespace-nowrap">
              <span className="absolute inset-x-[-0.06em] bottom-[0.06em] top-[0.12em] -z-0 -rotate-1 rounded-[0.12em] bg-accent-primary" />
              <span className="relative text-accent-contrast">X timeline.</span>
            </span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-secondary-foreground">{POSITIONING.sub}</p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <BookCallButton size="lg" />
            <Link
              href="/work"
              className="inline-flex h-13 items-center rounded-full border border-strong px-7 text-[15px] font-medium text-foreground transition-colors hover:bg-elevated"
            >
              See the work
            </Link>
          </div>
          <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            For {AUDIENCES.join(" · ")}
          </p>
        </div>

        <div className="relative mx-auto h-[540px] w-full max-w-[420px] overflow-hidden rounded-[28px] border border-default bg-surface [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_88%,transparent)] sm:h-[620px]">
          <div className="timeline-track">
            {[0, 1].map((copy) => (
              <div key={copy} aria-hidden={copy === 1}>
                {posts.map((post) => (
                  <TimelinePost key={`${copy}-${post.key}`} post={post} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TimelinePost({ post }: { post: Post }) {
  return (
    <article className="flex gap-3 border-b border-default px-4 py-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-elevated">
        <LogoMark className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-semibold text-foreground">OverlapX</span>{" "}
          <span className="text-muted-foreground">· {categoryById(post.category).label}</span>
        </p>
        <p className="mt-0.5 text-sm text-secondary-foreground">{post.caption}</p>
        <VideoFrame
          video={post.video}
          category={post.category}
          aspect={post.aspect}
          className="mt-3 rounded-2xl border border-default"
        />
        <div className="mt-3 flex justify-between pr-6 text-muted-foreground">
          <MessageCircle className="h-4 w-4" />
          <Repeat2 className="h-4 w-4" />
          <Heart className="h-4 w-4" />
          <ChartBar className="h-4 w-4" />
        </div>
      </div>
    </article>
  );
}
