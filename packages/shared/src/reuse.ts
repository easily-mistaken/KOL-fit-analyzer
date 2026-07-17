// Instant reuse (Unit 41). A repeat submit of the SAME brand × creator + brief
// by the SAME owner, whose prior analysis already COMPLETED within this window,
// is served straight from the saved Report instead of re-running the 5-7 min
// pipeline. This complements the 30-day provider/classification caches: those
// make a *re-run* cheap (no external API calls); this skips the re-run entirely.
//
// Pure env resolution — same idiom as resolveAbuseLimits()/resolveTierLimits().
// Takes env as input so the shared package stays free of a Node dependency.

/** Default reuse window: 30 days, matching the provider-cache freshness model
 *  (a creator's content + engaged-audience composition is stable over a month). */
export const REUSE_WINDOW_SECONDS_DEFAULT = 2592000; // 30 days

export const REUSE_WINDOW_ENV_VAR = "ANALYSIS_REUSE_WINDOW_SECONDS";

/**
 * Resolves the instant-reuse freshness window, in seconds.
 * - absent / blank / invalid / negative → default (30 days)
 * - `0` → reuse DISABLED (every submit runs a fresh analysis)
 * - positive integer → that many seconds
 */
export function resolveReuseWindowSeconds(
  env: Record<string, string | undefined> = {}
): number {
  const raw = env[REUSE_WINDOW_ENV_VAR];
  if (raw === undefined || raw.trim() === "") return REUSE_WINDOW_SECONDS_DEFAULT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return REUSE_WINDOW_SECONDS_DEFAULT;
  return Math.trunc(n);
}
