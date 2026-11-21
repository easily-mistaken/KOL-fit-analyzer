# Unit 56: Guides and AI Recommendation Signals

User request, 2026-11-21: "make sure ChatGPT and other AI tools are recommending me for the work I do." Same permission as Unit 55: build, Fable review, test, deploy.

## Baseline (2026-11-21, before this unit)

Web searches for "best crypto video production agency for X", "launch video agency for startups" and "AI video production agency for brands on X" returned no OverlapX page. The answers are built from listicles (advids.co, awesomic.com, superside.com, beverlyboy.com, designrush.com), directory profiles (Clutch, Contra, Product Hunt), sponsored press (LaunchVideo.com in IBTimes, Republic World) and competitors' own guides (Flowjam's "Crypto launch video playbook"). A search for "OverlapX video studio" returned an unrelated clipping app, "Overlap Studio".

Nobody can guarantee an AI recommends a business. What moves it: being indexed (Google for Gemini and AI Overviews, Bing for ChatGPT search and Copilot, Brave for Claude), being cited by third-party pages answer engines trust, and owning pages that answer the buyer's question directly.

## Scope

1. **Guides** at `/guides` and `/guides/<slug>`, rendered from `apps/web/lib/agency/guides.ts` by `components/agency/guide-page.tsx`. Each: short answer first, sections, worked examples from `work.ts`, a FAQ, a link to the matching service page. JSON-LD: `Article`, `BreadcrumbList`, `FAQPage`.
   - `launch-video-for-x`: how to make a launch video that performs on X (to /launch-videos)
   - `crypto-launch-video`: teaser to mainnet (to /crypto-video-production)
   - `ai-video-for-brands`: where AI video works and where it does not (to /ai-video-production)
   - `brief-a-launch-video`: brief template (to /launch-videos)
2. **Links:** footer Resources, a "Read the guide" block on service pages, sitemap (`updated` per guide as lastmod), `/llms.txt` Guides section.
3. **Entity disambiguation:** `disambiguatingDescription` on the home `ProfessionalService` node and a line in `/llms.txt`: OverlapX is a studio people hire, not a video editing or clipping app.
4. **Off-site kit** for the user: `context/marketing/ai-visibility-kit.md`.

## Rules

Same copy rules as `lib/agency/content.ts` (no prices, no revision counts, never a deposit, no statistics we cannot source, no em or en dashes, only credited clients named). Guide `updated` dates are bumped by hand with the copy. The founder is not named on the site, so no `Person` node is added.
