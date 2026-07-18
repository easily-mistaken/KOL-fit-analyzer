import { createHash } from "node:crypto";

import {
  AudienceClassificationSchema,
  ContentFitAssessmentSchema,
  KolContentClassificationSchema,
  OrgClassificationSchema,
  type AudienceClassification,
  type ContentFitAssessment,
  type KolContentClassification,
  type OrgClassification,
} from "@kol-fit/shared";
import type {
  AssessContentFitInput,
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
// v2: Unit 29B classification overhaul (target buckets, post labels, safety
// flags, media, text-aware audience classification, content-fit rubric).
const NS = "cls:v2";

/** The provider KIND is part of the cache identity (live-calibration incident,
 *  2026-07-14): the mock provider echoes LLM_MODEL, so model-only keys let a
 *  mock run poison the cache for live runs. Defaults to the same env the
 *  provider factory resolves. */
function resolveKind(explicit?: string): string {
  return (explicit ?? process.env.LLM_PROVIDER ?? "mock").trim().toLowerCase();
}

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
  fit: HitStats;
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
    fit: { hits: 0, misses: 0 },
  };

  /** Kind-namespaced key prefix, e.g. `cls:v2:openai`. */
  private readonly ns: string;

  constructor(
    private readonly inner: LlmProvider,
    private readonly store: CacheStore,
    private readonly config: ClassificationCacheConfig,
    kind?: string
  ) {
    this.ns = `${NS}:${resolveKind(kind)}`;
  }

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
    const key = `${this.ns}:org:${hash({
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
    const key = `${this.ns}:content:${hash({
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
    const key = `${this.ns}:audience:${hash({
      // Engagement text (Unit 29A) affects classification, so it is part of
      // the identity — same accounts with different sampled replies re-classify.
      accounts: input.accounts
        .map((a) => `${a.user.id}:${a.source}:${a.text ?? ""}`)
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

  /** Pair-specific but content-addressed + deterministic — cached under the
   *  `fit` kind (reuses the content TTL; Unit 29B). */
  assessContentFit(input: AssessContentFitInput): Promise<ContentFitAssessment> {
    // Unit 30: fit calls may run on a stronger tier (LLM_MODEL_FIT) — key on
    // the model that actually judges, falling back to the provider model.
    const fitModel =
      (this.inner as { fitModel?: string }).fitModel ?? this.inner.model;
    const key = `${this.ns}:fit:${hash({
      org: { handle: norm(input.org.handle), classification: input.org.classification },
      kol: {
        handle: norm(input.kol.handle),
        content: input.kol.content,
        // The bio feeds the content-fit rubric, so it's part of the cache key.
        profileId: input.kol.profile?.id ?? null,
        bio: input.kol.profile?.bio ?? null,
      },
      model: fitModel,
    })}`;
    return this.cached(
      "fit",
      key,
      this.config.ttls.contentSeconds,
      ContentFitAssessmentSchema,
      () => this.inner.assessContentFit(input)
    );
  }

  /** Pair-specific narrative — never cached. */
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
            fit: { ...this.cacheStats.fit },
          },
        }
      : undefined;
  }
}

export function withLlmCache(
  inner: LlmProvider,
  store: CacheStore,
  config: ClassificationCacheConfig,
  kind?: string
): CachingLlmProvider {
  return new CachingLlmProvider(inner, store, config, kind);
}
