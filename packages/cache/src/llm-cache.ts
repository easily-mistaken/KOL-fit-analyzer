import { createHash } from "node:crypto";

import {
  AudienceClassificationSchema,
  KolContentClassificationSchema,
  OrgClassificationSchema,
  type AudienceClassification,
  type KolContentClassification,
  type OrgClassification,
} from "@kol-fit/shared";
import type {
  ClassifyAudienceInput,
  ClassifyKolContentInput,
  ClassifyOrgInput,
  GenerateFitReportInput,
  LlmProvider,
  LlmUsageStats,
} from "@kol-fit/llm";
import type { ClassificationCacheConfig } from "./config.js";
import type { CacheStore } from "./store.js";

// Minimal structural view of a Zod schema (avoids a direct zod dependency).
type Parseable<T> = {
  safeParse(v: unknown): { success: true; data: T } | { success: false };
};

// Versioned namespace — bump the version to invalidate on a prompt/shape change.
const NS = "cls:v1";

const norm = (s: string): string => s.trim().toLowerCase();

// Canonical JSON with sorted object keys, so equivalent inputs hash equally.
function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const obj = v as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
    .join(",")}}`;
}

function hash(obj: unknown): string {
  return createHash("sha256").update(canonical(obj)).digest("hex").slice(0, 40);
}

function sortedIds(tweets: { id: string }[] | undefined): string[] {
  return (tweets ?? []).map((t) => t.id).sort();
}

function audienceLimit(): number {
  const n = Number(process.env.OPENAI_AUDIENCE_CLASSIFICATION_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 300;
}

type HitStats = { hits: number; misses: number };
export interface LlmClassificationCacheStats {
  org: HitStats;
  content: HitStats;
  audience: HitStats;
}

/**
 * Content-addressed cache for the reusable LLM classifications (Unit 23). Each
 * result is keyed by a hash of its actual inputs + model, so it is reused only
 * for identical inputs — org/KOL classifications are shared across analyses of
 * the same entity without any staleness risk. `generateFitReport` is
 * pair-specific and always passes through uncached. Miss-safe: any store error
 * (or a cached payload that fails re-validation) is treated as a miss.
 */
export class CachingLlmProvider implements LlmProvider {
  readonly cacheStats: LlmClassificationCacheStats = {
    org: { hits: 0, misses: 0 },
    content: { hits: 0, misses: 0 },
    audience: { hits: 0, misses: 0 },
  };

  constructor(
    private readonly inner: LlmProvider,
    private readonly store: CacheStore,
    private readonly config: ClassificationCacheConfig
  ) {}

  get model(): string {
    return this.inner.model;
  }

  private async cached<T>(
    kind: keyof LlmClassificationCacheStats,
    key: string,
    ttlSeconds: number,
    schema: Parseable<T>,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    if (!this.config.enabled) return fetchFn();
    try {
      const hit = await this.store.get(key);
      if (hit) {
        const parsed = schema.safeParse(hit.payload);
        if (parsed.success) {
          this.cacheStats[kind].hits++;
          return parsed.data;
        }
        // Fall through to recompute on a shape mismatch (defensive).
      }
    } catch {
      /* miss-safe: treat store error as a miss */
    }
    this.cacheStats[kind].misses++;
    const value = await fetchFn();
    try {
      await this.store.set(key, value, ttlSeconds);
    } catch {
      /* miss-safe: caching write failure must not fail the analysis */
    }
    return value;
  }

  classifyOrgProfile(input: ClassifyOrgInput): Promise<OrgClassification> {
    const key = `${NS}:org:${hash({
      handle: norm(input.handle),
      profileId: input.profile?.id ?? null,
      website: input.websiteText ? hash(input.websiteText) : null,
      brief: input.manualBrief ?? null,
      model: this.inner.model,
    })}`;
    return this.cached(
      "org",
      key,
      this.config.ttls.orgSeconds,
      OrgClassificationSchema,
      () => this.inner.classifyOrgProfile(input)
    );
  }

  classifyKolContent(
    input: ClassifyKolContentInput
  ): Promise<KolContentClassification> {
    const key = `${NS}:content:${hash({
      handle: norm(input.handle),
      profileId: input.profile?.id ?? null,
      posts: sortedIds(input.posts),
      replies: sortedIds(input.replies),
      model: this.inner.model,
    })}`;
    return this.cached(
      "content",
      key,
      this.config.ttls.contentSeconds,
      KolContentClassificationSchema,
      () => this.inner.classifyKolContent(input)
    );
  }

  classifyAudienceAccounts(
    input: ClassifyAudienceInput
  ): Promise<AudienceClassification> {
    const key = `${NS}:audience:${hash({
      accounts: input.accounts
        .map((a) => `${a.user.id}:${a.source}`)
        .sort(),
      audienceLimit: audienceLimit(),
      model: this.inner.model,
    })}`;
    return this.cached(
      "audience",
      key,
      this.config.ttls.audienceSeconds,
      AudienceClassificationSchema,
      () => this.inner.classifyAudienceAccounts(input)
    );
  }

  /** Pair-specific — never cached. */
  generateFitReport(input: GenerateFitReportInput) {
    return this.inner.generateFitReport(input);
  }

  /** Forwards the inner provider's usage stats (if any) + classification hits. */
  getUsageStats():
    | (LlmUsageStats & { classificationCache: LlmClassificationCacheStats })
    | undefined {
    const inner = (
      this.inner as { getUsageStats?: () => LlmUsageStats }
    ).getUsageStats?.();
    return inner
      ? {
          ...inner,
          classificationCache: {
            org: { ...this.cacheStats.org },
            content: { ...this.cacheStats.content },
            audience: { ...this.cacheStats.audience },
          },
        }
      : undefined;
  }
}

export function withLlmCache(
  inner: LlmProvider,
  store: CacheStore,
  config: ClassificationCacheConfig
): CachingLlmProvider {
  return new CachingLlmProvider(inner, store, config);
}
