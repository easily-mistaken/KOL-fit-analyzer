"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import type { Aspect, ProjectVideo, WorkCategory } from "@/lib/agency/work";
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
 * Loops use the short preview cut when there is one; the full video (with
 * sound and controls) plays only on the project page. With no footage yet it
 * falls back to the category's <MotionPoster>.
 */
export function VideoFrame({
  video,
  category,
  aspect = "16:9",
  className,
  controls = false,
  fit = "cover",
  fill = false,
}: {
  video: ProjectVideo | null;
  category: WorkCategory;
  aspect?: Aspect;
  className?: string;
  /** Full player controls (project pages) instead of the silent loop. */
  controls?: boolean;
  /** "contain" letterboxes footage whose own aspect differs from the frame
   *  (over a blurred copy of its poster, so there are no black bars). */
  fit?: "cover" | "contain";
  /** Fill the parent (which must be positioned) instead of keeping an aspect. */
  fill?: boolean;
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
    <div className={cn("overflow-hidden bg-base", fill ? "absolute inset-0" : cn("relative", ASPECT_CLASS[aspect]), className)}>
      {video && fit === "contain" && video.poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={video.poster} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />
      ) : null}
      {video ? (
        <video
          ref={ref}
          src={controls ? video.src : (video.preview ?? video.src)}
          poster={video.poster}
          muted={!controls}
          loop={!controls}
          playsInline
          controls={controls}
          preload="metadata"
          className={cn("absolute inset-0 h-full w-full", fit === "contain" ? "object-contain" : "object-cover")}
        />
      ) : (
        <MotionPoster category={category} className="absolute inset-0" />
      )}
    </div>
  );
}
