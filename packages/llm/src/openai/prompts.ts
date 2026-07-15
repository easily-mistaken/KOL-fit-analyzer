import {
  AUDIENCE_BUCKET_LABELS,
  type EngagedAccountRaw,
  type Tweet,
} from "@kol-fit/shared";

import type {
  AssessContentFitInput,
  ClassifyKolContentInput,
  ClassifyOrgInput,
  GenerateFitReportInput,
} from "../provider.js";

export const SYSTEM_PROMPT =
  "You are a precise crypto-marketing analyst. Respond ONLY with a single JSON " +
  "object matching the provided schema — no prose, no markdown, no commentary.";

// Strip unpaired UTF-16 surrogates: slicing can split an emoji (a surrogate
// pair) and a lone surrogate is invalid UTF-8, which OpenAI rejects with a 400.
// Also removes any pre-existing lone surrogate in the raw text.
function stripLoneSurrogates(s: string): string {
  return s.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    ""
  );
}

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  const sliced = t.length > max ? `${t.slice(0, max)}…` : t;
  return stripLoneSurrogates(sliced);
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
    "Also fill targetBuckets — the audience buckets this org actually WANTS to reach:",
    `  primary = the core target users (usually 1-3 buckets), secondary = adjacent-but-valuable (0-3 buckets).`,
    `  Allowed buckets: ${BUCKET_LIST}.`,
    "  Base it on the product category and target user (manual brief wins). Never include bots_spam or giveaway_hunters.",
  ];
  return lines.filter(Boolean).join("\n");
}

/** Posts the KOL-content prompt labels (bounded sample, ids included). */
export const KOL_CONTENT_POST_SAMPLE = 40;

export function buildKolContentPrompt(
  input: ClassifyKolContentInput,
  attachedImagePostIds: string[] = []
): string {
  const p = input.profile;
  const sample = input.posts.slice(0, KOL_CONTENT_POST_SAMPLE);
  const posts = sample
    .map((t) => {
      const mediaNote = t.media?.length
        ? ` [media: ${t.media.map((m) => m.type).join(",")}]`
        : "";
      return `- [${t.id}] ${truncate(t.text, 200)}${mediaNote}`;
    })
    .join("\n");
  const replies = (input.replies ?? []).slice(0, 15).map((t) => `- ${truncate(t.text, 160)}`).join("\n");
  return [
    `Analyze the content of KOL @${input.handle}.`,
    p ? `Profile bio: "${truncate(p.bio ?? "", 240)}".` : "Profile: unavailable.",
    `Recent posts (sample, each prefixed with its [postId]):\n${posts || "(none)"}`,
    replies ? `Recent replies (sample):\n${replies}` : "",
    "Return themes, verticals, a style descriptor, a depth descriptor (null if unclear), " +
      "any promoPatterns (giveaway/shill/paid-promo language), and repeatedTickers ($SYMBOLs).",
    "postLabels: label EVERY post listed above by its postId — isPromo (is it promotional/paid-sounding " +
      "content for a project/token, not the KOL's own analysis or their own product), " +
      "promoRelated (true if the promoted thing sits inside the KOL's usual domain, null when not a promo), " +
      "promoQuality ('low' for obviously low-quality/pump-ish projects, 'ok' otherwise, null when not a promo). " +
      "Do NOT output counts, ratios, or totals — per-post labels only.",
    "brandSafetyFlags: report ONLY genuinely concerning patterns IN THE KOL'S OWN CONDUCT (scam/rug association, " +
      "misleading claims, hate/harassment, NSFW, excessive drama/feuds, gambling promotion, legal/regulatory issues, " +
      "impersonation/deception) with severity low|medium|high and evidence quoting the specific post(s). " +
      "Ordinary promotion, memes, or strong opinions are NOT flags. CRITICAL: reporting on, investigating, " +
      "or warning about scams/hacks/exploits (security researchers, investigators, journalists) is NOT a flag — " +
      "it is a trust signal about the subject matter, not the KOL's conduct. Empty list when nothing concerning.",
    attachedImagePostIds.length > 0
      ? `mediaLabels: ${attachedImagePostIds.length} post image(s) are attached to this request, in this order ` +
        `of postIds: ${attachedImagePostIds.join(", ")}. Label EACH attached image with its postId and kind ` +
        "(chart_or_data | screenshot_text | meme | promo_graphic | photo_other). Label only attached images."
      : "mediaLabels: no images are attached; return an empty list.",
  ].filter(Boolean).join("\n");
}

export function buildAudiencePrompt(batch: EngagedAccountRaw[]): string {
  const rows = batch
    .map((a) => {
      const u = a.user;
      const year = (u.createdAt ?? "").slice(0, 4);
      const stats = [
        `followers=${u.followersCount ?? "?"}`,
        `following=${u.followingCount ?? "?"}`,
        `tweets=${u.tweetCount ?? "?"}`,
        year ? `since=${year}` : "",
        u.verified ? "verified" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const text = a.text ? ` said="${truncate(a.text, 160)}"` : "";
      return `- accountId=${u.id} handle=@${u.handle} source=${a.source} ${stats} bio="${truncate(u.bio ?? "", 140)}"${text}`;
    })
    .join("\n");
  return [
    "Classify EACH engaged account below into exactly one audience bucket.",
    `Allowed buckets: ${BUCKET_LIST}.`,
    'Use ALL signals: the bio, the numeric profile stats (follower/following ratio, account age, tweet volume), ' +
      'and — most importantly — `said=` (what they actually replied/quoted, when present). ' +
      'Generic hype ("🚀🚀", "gm", giveaway-claims, "wen airdrop/token") signals bots_spam / giveaway_hunters / ' +
      "airdrop_farmers; substantive on-topic replies signal a real bucket. An empty bio alone does NOT make a bot " +
      "if the reply is substantive.",
    "For each account echo its accountId, handle, and source, assign a bucket, and give light signals " +
      "(botScore 0..1 or null, emptyBio true/false/null, farmingSignals list). " +
      "Do NOT output any counts, percentages, or totals — labels only.",
    `Accounts:\n${rows}`,
  ].join("\n");
}

export function buildContentFitPrompt(input: AssessContentFitInput): string {
  const org = input.org.classification;
  const kol = input.kol.content;
  const p = input.kol.profile;
  return [
    `Rate the SEMANTIC content fit between org @${input.org.handle} and KOL @${input.kol.handle}.`,
    `Org: productCategory=${org.productCategory ?? "(unknown)"}, targetUser="${truncate(org.targetUser ?? "", 200)}", keywords=${(org.keywords ?? []).join(", ") || "(none)"}.`,
    p
      ? `KOL profile: name="${truncate(p.displayName ?? "", 80)}", bio="${truncate(p.bio ?? "", 240)}".`
      : "KOL profile: unavailable.",
    `KOL content: themes=${kol.themes.join(", ") || "(n/a)"}, verticals=${kol.verticals.join(", ") || "(n/a)"}, style=${kol.style ?? "(n/a)"}, depth=${kol.depth ?? "(n/a)"}.`,
    "Rate three dimensions as INTEGERS 0-5 (0 = unrelated, 3 = clearly adjacent domains, 5 = same domain):",
    "- topicalAdjacency: how close the KOL's usual topics are to the org's domain. Adjacent counts: a " +
      "DeFi-yield KOL is adjacent (>=3) to a lending protocol even with zero shared words.",
    "- audienceOverlapPotential: how plausibly the KOL's audience contains the org's target users.",
    "- naturalMentionFit: would this KOL talking about this org feel natural (not forced) to their audience?",
    "Rate audienceIntentOverlap as an INTEGER 0-5 — a SEPARATE question from topic: does what this KOL's " +
      "engaged audience actually DOES and SEEKS match what this org's product needs users to DO? " +
      "Category overlap is NOT intent overlap. Contrasts (rate the mismatched side 0-2): " +
      "DEX traders are not lenders/borrowers; borrowers are not yield depositors; retail wallet users are not " +
      "multisig administrators; mainstream gamers are not NFT traders or Web3 users; crypto NEWS READERS are " +
      "not product users or protocol developers; sports-betting tipsters' followers are not researchers. " +
      "And the reverse holds: a non-crypto audience CAN have high intent (5) when the product serves exactly " +
      "what they do — e.g. election forecasters for a prediction market. " +
      "0-1 = audience consumes content but would not use this product; 2 = mostly wrong intent; " +
      "3 = plausible intent WITH positive evidence; 4-5 = the audience demonstrably does/seeks what this product offers. " +
      "ANTI-HEDGE RULE: 3 is not a safe default — it requires POSITIVE evidence the audience acts with this " +
      "product-relevant intent. If the audience's primary reason for following is content consumption (news, " +
      "entertainment, streams, headlines) or their demonstrated activity centers on a DIFFERENT product intent, " +
      "rate 2 or lower. When torn between 2 and 3, choose 2.",
    "Also list sharedTopics (concrete overlapping topics, may be empty) and a 1-3 sentence rationale.",
    "Classify `relationship` — the KOL's relationship to THIS ORG specifically. FIRST ask: is this account's " +
      "owner publicly known as the founder/creator/lead of this org, even under a pseudonym? Check the handle and " +
      "display name against your knowledge of the org's leadership — identity beats content. Use BOTH the bio AND " +
      "your public knowledge; when genuinely unsure AFTER that identity check, choose the weaker category:",
    "- founder_or_core_team: founder/inventor/CEO/core team of THIS org itself. This INCLUDES pseudonymous " +
      "founders who are publicly known to lead the org even if the bio doesn't state it, and creators/leads " +
      "publicly identified with the org (a missing legal name or modest bio is not a discount).",
    "- adjacent_ecosystem_authority: founder or major figure of the underlying chain/ecosystem the org builds on, " +
      "but NOT this org (e.g. a chain co-founder vs an app on that chain).",
    "- independent_specialist: respected independent analyst/investigator/researcher in the org's domain.",
    "- media_or_news: a media, news, or aggregator account rather than an individual voice.",
    "- none: an ordinary KOL with no special relationship.",
    "Give `relationshipEvidence`: one sentence naming what grounds the call (bio claim or public role).",
    "Output ONLY the ratings/labels — no scores out of 100, no verdicts, no recommendations.",
  ].join("\n");
}

/** Bounded selection of attachable post images: first `limit` http(s) image
 *  URLs (photo url / video+gif thumbnail) walking posts in order. Returns
 *  parallel arrays of urls + their postIds (one entry per image). */
export function selectPostImages(
  posts: Tweet[],
  limit: number
): { urls: string[]; postIds: string[] } {
  const urls: string[] = [];
  const postIds: string[] = [];
  for (const post of posts) {
    if (urls.length >= limit) break;
    for (const m of post.media ?? []) {
      if (urls.length >= limit) break;
      const url = m.type === "photo" ? m.url : m.previewUrl;
      if (url && /^https?:\/\//i.test(url)) {
        urls.push(url);
        postIds.push(post.id);
      }
    }
  }
  return { urls, postIds };
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
    "Write `summary` as a 3-5 sentence plain-English executive summary a reader can skim to understand the " +
      "fit: whether this KOL is a good match for this org and why, grounded in the engaged-audience match, " +
      "content alignment, and any risks. Reference the verdict qualitatively (e.g. \"a weak fit\") but do NOT " +
      "state or invent any numeric scores. Write it as flowing prose, not bullet points.",
    "Write `keyTakeaways` as 3-5 punchy, standalone one-line points (the scannable version of the summary) — " +
      "each a concrete \"so what\" a busy reader can grasp in a glance. No numbers, no filler.",
    "IMPORTANT: The numeric scores and verdict are computed deterministically and are FINAL. " +
      "Do NOT output, repeat, recompute, or alter any numbers or the verdict. Write ONLY qualitative narrative " +
      "for: summary, keyTakeaways, bestUseCases, weakUseCases, audienceMatchSummary, contentNarrative, engagementNarrative, " +
      "engagementSignals, paidPromoNarrative, botFarmNarrative, brandSafetyNarrative, geoNarrative, " +
      "recommendedAngle, evidenceNotes.",
  ].join("\n");
}
