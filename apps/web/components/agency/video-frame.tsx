"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import type { Aspect, WorkCategory } from "@/lib/agency/work";
import { MotionPoster } from "@/components/agency/motion-poster";

const ASPECT_CLASS: Record<Aspect, string> = {
  "16:9": "aspect-video",
  "1:1": "aspect-square",
  "9:16": "aspect-[9/16]",
  "4:5": "aspect-[4/5]",
};

/**
 * A video the way the X timeline shows one: muted, looping, playing only while
 * it is on screen (so a grid of twelve never decodes twelve streams at once).
 * With no footage yet it falls back to the category's <MotionPoster>.
 */
export function VideoFrame({
  video,
  category,
  aspect = "16:9",
  className,
  controls = false,
}: {
  video: { src: string; poster?: string } | null;
  category: WorkCategory;
  aspect?: Aspect;
  className?: string;
  /** Full player controls (project pages) instead of the silent loop. */
  controls?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || controls) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [controls]);

  return (
    <div className={cn("relative overflow-hidden bg-base", ASPECT_CLASS[aspect], className)}>
      {video ? (
        <video
          ref={ref}
          src={video.src}
          poster={video.poster}
          muted={!controls}
          loop={!controls}
          playsInline
          controls={controls}
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <MotionPoster category={category} className="absolute inset-0" />
      )}
    </div>
  );
}
