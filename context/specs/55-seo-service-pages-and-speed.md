# Unit 55: Search, AI Answer Engines and Speed

User request, 2026-11-21: "rank karana chahta hoon aur AI isko recommend kare"; make the site faster; reference Launch Gallery (the user's own site, https://launchgallery.video/) so it gains authority. The user granted full permission to build, review (Fable), test and deploy.

## Scope

1. **Launch Gallery references.** `LaunchGalleryPromo` strip on home, /work and /launch-videos; footer "Resources" link. Followed links, `rel="noopener"` only (keeps the Referer).
2. **Service landing pages**, one per buyer search, all rendered from `apps/web/lib/agency/services.ts` by `components/agency/service-page.tsx`:
   - `/launch-videos`: "product / startup launch video" (the home page title keeps "launch video agency", so the two do not compete).
   - `/crypto-video-production`: "crypto / Web3 video production".
   - `/ai-video-production`: "AI video production agency", "AI product launch video".
   Each page: H1 + lead, what we make, matching work (only projects that genuinely fit), why it works on X, process, a page FAQ, links to the other services. JSON-LD: `Service` + `BreadcrumbList` + `FAQPage`. Linked from the footer "Services" column and the home hero's audience line.
3. **Structured data and AI discovery.** Home `FAQPage`, buyer-phrased `knowsAbout`, `/llms.txt` built from site data, services in the sitemap (`SERVICES_UPDATED` lastmod, bumped by hand).
4. **IndexNow.** Key file `apps/web/public/<key>.txt`; `scripts/indexnow.mjs` submits every sitemap URL after a deploy that adds or changes pages.
5. **Speed.** Geist Sans and Mono self-hosted as Latin subsets (~70 KB to ~40 KB each); mono no longer preloaded. Client logos get a `sizes` hint. Next.js 16.4.3 to 16.4.5 (two moderate advisories).

## Rules carried over

Same copy rules as `lib/agency/content.ts`: no prices, no revision counts, never a deposit, no statistics we cannot source, no em or en dashes, only credited clients named. The deck and its PDF use none of the changed copy (`POSITIONING` is untouched), so no brochure regen is needed.

## Out of scope / needs the user

- Google Search Console and Bing Webmaster Tools submissions (need the user's accounts).
- Directory listings (Clutch, GoodFirms, DesignRush, Contra, Behance) and client backlinks.
