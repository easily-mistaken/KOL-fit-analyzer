import { AUDIENCE_BUCKET_LABELS, type EngagedAccountRaw } from "@kol-fit/shared";

import type {
  ClassifyKolContentInput,
  ClassifyOrgInput,
  GenerateFitReportInput,
} from "../provider.js";

export const SYSTEM_PROMPT =
  "You are a precise crypto-marketing analyst. Respond ONLY with a single JSON " +
  "object matching the provided schema — no prose, no markdown, no commentary.";

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

const BUCKET_LIST = Object.entries(AUDIENCE_BUCKET_LABELS)
  .map(([k, label]) => `${k} (${label})`)
  .join(", ");

/** Append a bounded repair instruction after an invalid response. */
export function repairNote(errorSummary: string): string {
  return (
    `\n\nYour previous response did not satisfy the schema: ${truncate(errorSummary, 300)}. ` +
    "Return a corrected JSON object that strictly matches the schema. Do not add fields."
  );
}

export function buildOrgPrompt(input: ClassifyOrgInput): string {
  const p = input.profile;
  const brief = input.manualBrief ?? {};
  const lines = [
    `Classify the ORG account @${input.handle} for a KOL-fit analysis.`,
    p
      ? `Profile: name="${truncate(p.displayName ?? "", 80)}", bio="${truncate(p.bio ?? "", 240)}", followers=${p.followersCount ?? "?"}.`
      : "Profile: unavailable.",
    input.websiteText ? `Website/docs excerpt: "${truncate(input.websiteText, 800)}".` : "",
    "Manual brief fields (these OVERRIDE anything you infer; echo them verbatim when present):",
    `  productCategory=${brief.productCategory ?? "(none)"}, targetUser=${brief.targetUser ?? "(none)"}, stage=${brief.stage ?? "(none)"}, campaignGoal=${brief.campaignGoal ?? "(none)"}, region=${brief.region ?? "(none)"}.`,
    "Fill each field (use null for unknown optionals), a short keywords list, and a confidence of low|medium|high.",
  ];
  return lines.filter(Boolean).join("\n");
}

export function buildKolContentPrompt(input: ClassifyKolContentInput): string {
  const p = input.profile;
  const posts = input.posts.slice(0, 40).map((t) => `- ${truncate(t.text, 200)}`).join("\n");
  const replies = (input.replies ?? []).slice(0, 15).map((t) => `- ${truncate(t.text, 160)}`).join("\n");
  return [
    `Analyze the content of KOL @${input.handle}.`,
    p ? `Profile bio: "${truncate(p.bio ?? "", 240)}".` : "Profile: unavailable.",
    `Recent posts (sample):\n${posts || "(none)"}`,
    replies ? `Recent replies (sample):\n${replies}` : "",
    "Return themes, verticals, a style descriptor, a depth descriptor (null if unclear), " +
      "any promoPatterns (giveaway/shill/paid-promo language), and repeatedTickers ($SYMBOLs).",
  ].filter(Boolean).join("\n");
}

export function buildAudiencePrompt(batch: EngagedAccountRaw[]): string {
  const rows = batch
    .map((a) => {
      const u = a.user;
      return `- accountId=${u.id} handle=@${u.handle} source=${a.source} followers=${u.followersCount ?? "?"} bio="${truncate(u.bio ?? "", 140)}"`;
    })
    .join("\n");
  return [
    "Classify EACH engaged account below into exactly one audience bucket.",
    `Allowed buckets: ${BUCKET_LIST}.`,
    "For each account echo its accountId, handle, and source, assign a bucket, and give light signals " +
      "(botScore 0..1 or null, emptyBio true/false/null, farmingSignals list). " +
      "Do NOT output any counts, percentages, or totals — labels only.",
    `Accounts:\n${rows}`,
  ].join("\n");
}

export function buildReportPrompt(input: GenerateFitReportInput): string {
  const dist = input.audience.distribution;
  const topBuckets = Object.entries(dist.buckets)
    .sort((a, b) => (b[1]?.count ?? 0) - (a[1]?.count ?? 0))
    .slice(0, 6)
    .map(([b, s]) => `${b}=${Math.round((s?.share ?? 0) * 100)}%`)
    .join(", ");
  return [
    `Write the qualitative narrative for a KOL-fit report: org @${input.org.handle} vs KOL @${input.kol.handle}.`,
    `Org classification: ${JSON.stringify(input.org.classification)}.`,
    `KOL content: themes=${input.kol.content.themes.join(", ") || "(n/a)"}, verticals=${input.kol.content.verticals.join(", ") || "(n/a)"}, promoPatterns=${input.kol.content.promoPatterns.join(", ") || "none"}.`,
    `Engaged audience distribution (already computed): ${topBuckets || "(none)"} over ${dist.sampleSize} classified accounts.`,
    input.scores
      ? `Deterministic scores (FINAL): overall=${input.scores.overall.value}, verdict=${input.verdict ?? "n/a"}, confidence=${input.scores.confidence}.`
      : "Deterministic scores are not yet available.",
    "IMPORTANT: The numeric scores and verdict are computed deterministically and are FINAL. " +
      "Do NOT output, repeat, recompute, or alter any numbers or the verdict. Write ONLY qualitative narrative " +
      "for: bestUseCases, weakUseCases, audienceMatchSummary, contentNarrative, engagementNarrative, " +
      "engagementSignals, paidPromoNarrative, botFarmNarrative, brandSafetyNarrative, geoNarrative, " +
      "recommendedAngle, evidenceNotes.",
  ].join("\n");
}
