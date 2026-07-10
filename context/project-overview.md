# Crypto KOL Fit Analyzer

## Overview

Crypto KOL Fit Analyzer is an internal-first analysis tool for crypto startups and future agency workflows. It compares a crypto organization/startup with a known Twitter/X KOL and generates a deep fit report showing whether the KOL's actual engaged audience overlaps with the organization's target audience and campaign goal. The product does not only check what a KOL posts; it checks who actually listens, who engages, how useful that audience is, and whether the KOL introduces brand, bot, farming, or paid-promo risk.

## Product Positioning

The core product promise is:

> We don't just check what a KOL posts. We check who actually listens.

The key insight is:

> A KOL can have high impressions and still be a bad fit if the wrong people are listening.

The primary metric the system optimizes for is **Engaged Audience Match**:

> Among the people who actually interact with this KOL, how many look like the organization's target users?

## Primary User

The first user is the internal operator/founder/team member evaluating KOLs for crypto startup campaigns. Later users may include agency teammates, crypto startup clients, growth teams, foundations, ecosystem teams, and marketing operators.

## Goals

1. Let a user compare one crypto organization/startup against one known Twitter/X KOL.
2. Produce a deep, evidence-backed scorecard rather than a simple yes/no recommendation.
3. Prioritize engaged audience overlap over vanity metrics like follower count or raw likes.
4. Detect whether the KOL is useful for the organization's specific campaign goal, such as awareness, community growth, user acquisition, developer adoption, token launch visibility, or investor credibility.
5. Detect risk signals including paid-promo intensity, bot/farm engagement, low-quality promotional history, giveaway audiences, and brand-safety concerns.
6. Store reports and underlying evidence so the system can become an internal KOL intelligence database over time.
7. Build with provider abstractions so Twitter/X data sources and LLM providers can be replaced later without rewriting the product.

## Core User Flow

1. User opens the analysis form.
2. User enters an organization Twitter/X handle.
3. User enters a KOL Twitter/X handle.
4. User optionally adds organization context:
   - website URL
   - docs URL
   - product category
   - target user
   - campaign goal
   - product stage
   - region/language preference
5. User submits the analysis request.
6. The web API validates the request and creates an analysis job.
7. A background worker picks up the job.
8. The worker fetches organization profile/post data.
9. The worker fetches KOL profile/post/reply/engagement data.
10. The worker samples engaged accounts from replies, quote tweets, and retweeters.
11. The system classifies organization positioning, KOL content, engaged audience buckets, engagement quality, and risk signals.
12. The scoring module produces deterministic scores.
13. The LLM module produces the final explanation, verdict, and recommendation using structured evidence.
14. The final report is saved to the database.
15. The frontend polls job/report status and displays the completed report.
16. User reviews the scorecard, audience breakdown, risks, recommendations, and evidence/sample size.

## Features

### Analysis Request

- Enter organization handle.
- Enter KOL handle.
- Add optional website/docs/product/category/target/campaign/stage/region context.
- Validate required fields before creating a job.
- Create an analysis job instead of running analysis inside the API request.

### Organization Analysis

- Fetch organization profile data.
- Fetch pinned/recent posts where available.
- Use manual context first when provided.
- Infer product category, target audience, stage, campaign goal, region/language focus, and keywords when manual context is missing.
- Attach confidence levels to inferred fields.

### KOL Content Analysis

- Fetch KOL profile data.
- Fetch last 100 KOL posts.
- Fetch recent replies where useful.
- Identify top posts by engagement for deeper analysis.
- Classify content themes, crypto verticals, style, depth, promotional patterns, and repeated project/ticker mentions.

### Engaged Audience Analysis

- Deep-analyze replies, quotes, and retweeters for selected top KOL posts.
- Sample engaged accounts.
- Classify engaged accounts into audience buckets:
  - founders
  - developers
  - DeFi users
  - traders
  - investors/VCs
  - airdrop farmers
  - meme coin degens
  - NFT/gaming users
  - AI x crypto people
  - infra/research people
  - community managers
  - KOLs/creators
  - bots/spam
  - giveaway hunters
  - non-crypto audience
- Compare the audience distribution against the organization's target user.

### Engagement Quality Analysis

- Detect meaningful discussion vs shallow engagement.
- Detect repeat quality engagers.
- Detect generic replies, giveaway replies, bot-like accounts, empty bios, and farming behavior.
- Separate high-value engagement from vanity engagement.

### Paid-Promo and Brand-Risk Analysis

- Detect repeated promotional patterns.
- Detect high frequency of unrelated project mentions.
- Detect heavy ticker/contract/giveaway activity.
- Detect topic switching that suggests paid promotion.
- Flag brand risks such as low-quality projects, excessive drama, misleading claims, and weak audience trust.

### Scoring

The scoring system should include:

- overall fit score
- content fit score
- engaged audience match score
- audience quality score
- campaign goal fit score
- geo/language fit score
- brand safety score
- paid promo risk score
- bot/farm risk score
- confidence level

Recommended overall score weights:

| Metric | Weight |
| --- | ---: |
| Engaged audience match | 35% |
| Audience quality | 20% |
| Content fit | 15% |
| Campaign goal fit | 15% |
| Brand safety | 10% |
| Geo/language fit | 5% |

### Report Generation

The final report should include:

1. Overall Fit Score
2. Final Verdict
3. Best Use Cases
4. Weak Use Cases
5. Audience Match
6. Audience Breakdown
7. KOL Content Analysis
8. Engagement Quality
9. Paid Promo Detection
10. Bot/Farm Risk
11. Brand Safety
12. Geo/Language Fit
13. Recommended Campaign Angle
14. Evidence and Sample Size
15. Confidence Level

### Saved Intelligence

- Save every report.
- Save the request inputs, status, scores, report content, evidence summary, and sample-size metadata.
- Store enough data to compare future runs against past results.
- Do not overbuild CRM, campaign management, or discovery in the first version.

## Scope

### In Scope

- One organization vs one known KOL analysis.
- Deep analysis using Twitter/X data from TwitterAPI.io.
- Provider abstraction for Twitter/X data.
- Provider abstraction for LLM calls.
- Background job processing.
- Saved reports.
- Basic report dashboard.
- Manual org brief input.
- Lightweight website/docs text ingestion: fetch and parse only the single provided URL, with strict size/timeout limits. No crawler.
- Organization inference when manual context is missing.
- KOL content analysis.
- Engaged audience classification.
- Engagement quality analysis.
- Paid-promo/risk analysis.
- Scorecard and human-readable recommendation.
- Evidence/sample-size tracking.
- Internal-first architecture that can become SaaS/agency tooling later.

### Out of Scope for First Build

- KOL discovery/search marketplace.
- Full website/docs crawling beyond the single provided URL.
- Campaign management CRM.
- Client billing.
- Payments.
- Multi-user agency workspaces unless auth/workspace is explicitly added later.
- Automated outreach to KOLs.
- Telegram/Discord/YouTube/TikTok analysis.
- On-chain wallet attribution.
- Exact conversion tracking.
- Historical trend intelligence beyond saved reports from this app.
- Large-scale concurrent report generation.
- Fine-tuned custom ML models.
- Manual admin moderation tools.
- PDF export unless added in a later spec.

## Success Criteria

1. A user can submit an organization handle and a KOL handle with optional context.
2. The API creates an analysis job and returns a job/report identifier.
3. A background worker executes the analysis outside the request lifecycle.
4. The system fetches and stores enough organization and KOL data to generate a report.
5. The report includes all required scoring categories and a final verdict.
6. The report clearly explains whether the KOL is a strong, good, okay, weak, or avoid-level fit.
7. The report prioritizes engaged audience match over raw content similarity.
8. Every report includes confidence and evidence/sample-size information.
9. Reports are saved and viewable after generation.
10. The codebase keeps API, worker, provider, scoring, database, and UI concerns separate.

## Post-MVP Enhancement Roadmap

Deferred product enhancements to make this best-in-class after the first build (Units 1–21) ships. Not in current scope; captured here so we work on them later. Prioritized by impact on the core value (engaged-audience match + audience quality + turning the report into a *spend decision*). A rough self-rating: the planned MVP ≈ 6.5/10 (right core metric, deterministic + explainable, provider-abstracted, but 1:1, single-snapshot, text-only, no ranking/ROI, blunt audience sampling, thin engagement-quality depth); with P0 ≈ 8.5/10 (becomes a decision tool); with P0+P1+select P2 ≈ 9/10.

### P0 — turns "neat report" into a paid decision tool

1. **Engagement-quality depth (reply/quote *content*, not just the engaging account).** Today the Twitter provider normalization keeps only *who* engaged and drops reply/quote *text* (a known limitation since the Unit 10 provider design). Capture a bounded sample of reply/quote text to score meaningful discussion vs shallow `gm 🚀`/giveaway/bot engagement, and detect **repeat quality engagers** (real community vs one-off). Highest-signal lever for detecting fake/farmed engagement; directly strengthens the existing "Engagement Quality Analysis" feature. Fix in provider normalization + the audience/engagement classification, not the scoring math.
2. **KOL shortlisting / ranking (N KOLs → one ranked list for a campaign).** The MVP is 1:1 (a research tool); agencies decide from a shortlist. Analyze several KOLs for one org/goal and rank them by fit. Biggest usability lever.
3. **ROI / cost framing.** Accept a KOL price/rate input and express fit as cost per *matched-engaged* reach (not per follower). This is what makes it an actual spend decision, not just an interesting report.

### P1 — accuracy + trust

4. **Representative audience sampling** (already flagged for Unit 19): replace the blunt first-N deterministic slice (`OPENAI_AUDIENCE_CLASSIFICATION_LIMIT`) with proportional sampling across sources/engagement so the core metric isn't order-biased; wire confidence to the classified-sample size (`engagedAccountsClassified`, already recorded).
5. **Cross-KOL audience overlap** — "you already reached ~40% of this audience via KOL X." Stops paying twice for the same eyeballs (needs saved-report history, Unit 20).
6. **Paid-promo track record** — historical shill frequency / unrelated-project mentions over time to deepen brand-risk beyond current single-snapshot content signals.

### P2 — polish / reach

7. **Media / visual content analysis** — whether posts are substantive (charts, threads, analysis) vs meme/image spam; feeds content-fit and brand-safety. Requires carrying media URLs through provider normalization + a vision-capable model. **Model foresight:** pick a multimodal frontier model family now (Claude, Gemini, and the GPT‑4o family are all multimodal — including their cheap tiers) so this is later just wiring, **no new API key/provider**. Avoid text-only models if media is on the roadmap.
8. **Export / shareable client-facing reports** (PDF/link) — currently out of scope; agencies present to clients. Also saved-reports list + re-run + history (Unit 20 covers history/list).
9. **Engagement trend over time** — growing vs declining engagement; stale vs recent engaged audience.
