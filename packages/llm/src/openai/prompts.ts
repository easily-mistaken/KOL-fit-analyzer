import {
  AUDIENCE_DOMAIN_LABELS,
  AUDIENCE_QUALITY_LABELS,
  AUDIENCE_REGION_LABELS,
  AUDIENCE_ROLE_LABELS,
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

const ROLE_LIST = Object.entries(AUDIENCE_ROLE_LABELS)
  .map(([k, label]) => `${k} (${label})`)
  .join(", ");

const QUALITY_LIST = Object.entries(AUDIENCE_QUALITY_LABELS)
  .map(([k, label]) => `${k} (${label})`)
  .join(", ");

const REGION_LIST = Object.entries(AUDIENCE_REGION_LABELS)
  .map(([k, label]) => `${k} (${label})`)
  .join(", ");

const DOMAIN_LIST = Object.entries(AUDIENCE_DOMAIN_LABELS)
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
    "Fill targetRoles and targetDomains — who this org WANTS to reach, on two INDEPENDENT axes.",
    `  targetRoles = what those people DO. primary = the core target users (usually 1-3), secondary = adjacent-but-valuable (0-3). Allowed: ${ROLE_LIST}.`,
    `  targetDomains = what SPACE they are in. primary = the core space(s), secondary = adjacent (0-3). Allowed: ${DOMAIN_LIST}.`,
    "  The axes are separate questions: a crypto DeFi protocol targeting developers is roles=[developer] domains=[crypto_defi]; " +
      "an AI devtools company targeting the same people is roles=[developer] domains=[ai, software].",
    "  Leave targetDomains.primary EMPTY when the product genuinely serves any space (a general-purpose analytics tool, " +
      "a payments rail). Empty means 'no preference' and is scored as neutral — it is a real answer, not a failure. " +
      "Do NOT list every domain to express that.",
    "  Base it on the product category and target user (manual brief wins). Never include the 'unknown' role.",
    "Also fill valuedRegions — the macro-regions where THIS product is economically relevant (reason from product " +
      "ECONOMICS, not mere popularity): a stablecoin/payments/savings/remittance product values high-inflation " +
      "emerging markets (subsaharan_africa, latam, south_asia, southeast_asia, mena); a capital-heavy " +
      "trading/derivatives/prediction-market product values higher-income regions (north_america, western_europe, " +
      "east_asia). Use an EMPTY list [] when the product is globally relevant with no economic regional skew.",
    `  Allowed regions: ${REGION_LIST}.`,
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
      const loc = u.location ? ` location="${truncate(u.location, 60)}"` : "";
      const text = a.text ? ` said="${truncate(a.text, 160)}"` : "";
      return `- accountId=${u.id} handle=@${u.handle} source=${a.source} ${stats} bio="${truncate(u.bio ?? "", 140)}"${loc}${text}`;
    })
    .join("\n");
  return [
    "Classify EACH engaged account below on THREE INDEPENDENT axes. They are separate questions — answer each on " +
      "its own; do not let one decide another.",
    `  role — what this account DOES, regardless of the space they do it in. One of: ${ROLE_LIST}.`,
    `  domain — what SPACE this account is in. One of: ${DOMAIN_LIST}.`,
    `  quality — is this real engagement? One of: ${QUALITY_LIST}.`,
    "Because the axes are independent, a farming account still gets its real role and domain (role=developer, " +
      "domain=crypto_defi, quality=farmer) — do NOT collapse a farmer or a bot into role=unknown. Likewise a " +
      'developer building AI tooling is role=developer domain=ai, NOT "outside crypto": there is no such category ' +
      "here, only domains that happen not to be crypto ones.",
    'Use "unknown" for role or domain ONLY when there is genuinely nothing to go on, and "general" for a real person ' +
      "with no professional or topical niche.",
    'Use ALL signals: the bio, the numeric profile stats (follower/following ratio, account age, tweet volume), ' +
      'and — most importantly — `said=` (what they actually replied/quoted, when present). ' +
      'Generic hype ("🚀🚀", "gm", giveaway-claims, "wen airdrop/token") signals quality=bot / giveaway_hunter / ' +
      "farmer; substantive on-topic replies signal quality=real. An empty bio alone does NOT make a bot if the " +
      "reply is substantive.",
    "Also assign each account a coarse macro-region from `location=` (plus language/handle cues when clear) — one " +
      `of: ${REGION_LIST}. Use "unknown" when the location is blank, a joke ("metaverse", "onchain", "gm"), or ` +
      "genuinely unplaceable. Do NOT guess a region from the audience bucket or topic — only place accounts with a " +
      "real geographic signal.",
    "For each account echo its accountId, handle, and source, assign role/domain/quality and a region, and give light signals " +
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
    "Also list sharedTopics (concrete overlapping topics, may be empty) and a 1-3 sentence rationale.",
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
  const top = (
    record: Partial<Record<string, { count: number; share: number } | undefined>>
  ): string =>
    Object.entries(record)
      .sort((a, b) => (b[1]?.count ?? 0) - (a[1]?.count ?? 0))
      .slice(0, 6)
      .map(([k, v]) => `${k}=${Math.round((v?.share ?? 0) * 100)}%`)
      .join(", ");

  // Unit 43: the audience is described on three axes rather than one flat list.
  // The old single line reported `non_crypto=42%` and the model dutifully wrote
  // "42% non-crypto audience" — a statement of what the audience is NOT, which
  // told the reader nothing. Roles and domains each say something positive.
  const roles = top(dist.roles);
  const domains = top(dist.domains);
  const quality = top(dist.quality);

  return [
    `Write the qualitative narrative for a KOL-fit report: org @${input.org.handle} vs KOL @${input.kol.handle}.`,
    `Org classification: ${JSON.stringify(input.org.classification)}.`,
    `KOL content: themes=${input.kol.content.themes.join(", ") || "(n/a)"}, verticals=${input.kol.content.verticals.join(", ") || "(n/a)"}, promoPatterns=${input.kol.content.promoPatterns.join(", ") || "none"}.`,
    `Engaged audience over ${dist.sampleSize} classified accounts, on three INDEPENDENT axes (already computed):`,
    `  by role (what they do): ${roles || "(none)"}`,
    `  by domain (what space they are in): ${domains || "(none)"}`,
    `  by quality (is it real engagement): ${quality || "(none)"}`,
    "Describe this audience by what it IS — the roles and domains present — and cross the axes when it says " +
      'something ("mostly developers, and most of those are in AI rather than crypto"). NEVER characterise any ' +
      'part of it by what it is not ("non-crypto audience", "outside the space"): that is not a finding, and for ' +
      "a brand that is not itself crypto it is exactly backwards. Judge fit against THIS brand's stated target " +
      "roles and domains, whatever space those happen to be in.",
    "Write `summary` as a 3-5 sentence plain-English executive summary a reader can skim to understand the " +
      "fit: whether this KOL is a good match for this org and why, grounded in the engaged-audience match, " +
      "content alignment, and any risks. Reference the verdict qualitatively (e.g. \"a weak fit\") but do NOT " +
      "state or invent any numeric scores. Write it as flowing prose, not bullet points.",
    "Write `keyTakeaways` as 3-5 punchy, standalone one-line points (the scannable version of the summary), " +
      "each a concrete \"so what\" a busy reader can grasp in a glance. No numbers, no filler.",
    // The narrative fields are the only model-written text a reader ever sees, so
    // the house style is enforced here rather than post-processed downstream.
    // "KOL" is crypto-specific jargon; the product serves AI and Web3 brands alike.
    "WORDING: Never write \"KOL\". Call the account being analyzed \"the creator\" and the " +
      "organization \"the brand\". Never assume the brand is a crypto company.",
    "STYLE: Never use em dashes (—). Use a period, comma, colon, or parentheses instead. " +
      "Avoid stock LLM phrasing (\"it's worth noting\", \"in today's landscape\", \"dive into\", " +
      "\"when it comes to\", \"not just X, but Y\"). Prefer short declarative sentences and concrete " +
      "nouns over hedged abstractions. Write like an analyst briefing a colleague, not like marketing copy.",
    "IMPORTANT: The numeric scores and verdict are computed deterministically and are FINAL. " +
      "Do NOT output, repeat, recompute, or alter any numbers or the verdict. Write ONLY qualitative narrative " +
      "for: summary, keyTakeaways, bestUseCases, weakUseCases, audienceMatchSummary, contentNarrative, engagementNarrative, " +
      "engagementSignals, paidPromoNarrative, botFarmNarrative, brandSafetyNarrative, geoNarrative, " +
      "recommendedAngle, evidenceNotes.",
  ].join("\n");
}
