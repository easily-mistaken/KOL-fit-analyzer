"use client";

import * as React from "react";
import { Bell, BellOff, BellRing, Check } from "lucide-react";

import { APP_NAME, type JobStatus } from "@kol-fit/shared";
import { cn } from "@/lib/utils";

type Perm = NotificationPermission | "unsupported";

/**
 * "Notify me when it's ready" — opt-in browser notification for a run that
 * takes a few minutes, so leaving the tab is safe and the user gets pulled back
 * the moment it finishes. Honest scope: this is the browser Notifications API
 * only (works while the tab lives in the background), NOT a push/Telegram ping —
 * we have no way to reach the user off-page during an anonymous analysis. Pairs
 * with the tab-title flash already in AnalysisStatus.
 */
export function NotifyWhenReady({
  status,
  orgHandle,
  kolHandle,
}: {
  status: JobStatus;
  orgHandle: string;
  kolHandle: string;
}) {
  const [perm, setPerm] = React.useState<Perm>("default");
  const [armed, setArmed] = React.useState(false);
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    setPerm("Notification" in window ? Notification.permission : "unsupported");
  }, []);

  // Auto-arm whenever permission is already/newly granted (mount or after enable).
  React.useEffect(() => {
    if (perm === "granted") setArmed(true);
  }, [perm]);

  // Fire exactly once when the run finishes while armed.
  React.useEffect(() => {
    if (!armed || firedRef.current) return;
    if (status !== "COMPLETED" && status !== "FAILED") return;
    firedRef.current = true;
    try {
      const done = status === "COMPLETED";
      const n = new Notification(
        done ? `✅ Your fit report is ready` : `⚠️ Analysis couldn't finish`,
        {
          body: `@${orgHandle} vs @${kolHandle} · ${APP_NAME}`,
          tag: `overlapx-${orgHandle}-${kolHandle}`,
        }
      );
      // Focus this tab if the user clicks the notification.
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      /* notifications are best-effort */
    }
  }, [armed, status, orgHandle, kolHandle]);

  async function enable() {
    if (!("Notification" in window)) return;
    let p = Notification.permission;
    if (p === "default") {
      try {
        p = await Notification.requestPermission();
      } catch {
        return;
      }
    }
    setPerm(p); // the perm effect arms it when granted
  }

  if (perm === "unsupported") return null;

  if (perm === "denied") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <BellOff className="h-3.5 w-3.5" />
        Notifications are blocked in your browser
      </span>
    );
  }

  if (armed) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-ink">
        <BellRing className="h-3.5 w-3.5" />
        We&apos;ll notify you the moment it&apos;s ready
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={enable}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-strong bg-transparent px-3 py-1.5 text-xs font-medium text-foreground transition-colors",
        "hover:border-accent/60 hover:bg-elevated"
      )}
    >
      <Bell className="h-3.5 w-3.5 text-accent-ink" />
      Notify me when it&apos;s ready
    </button>
  );
}
