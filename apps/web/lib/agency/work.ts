// ============================================================================
// OverlapX portfolio data (Unit 54).
//
// Projects, clients, testimonials and team live here as typed data, read by the
// agency site and the /deck brochure alike. Adding a project = appending to
// PROJECTS; nothing else changes.
//
// Until the user's assets arrive (~/overlapx-assets), PROJECTS is empty and the
// site renders PREVIEW_SLOTS instead: unattributed placeholders with no client
// name, no metrics and no detail page. Never put an invented client or number
// in this file.
// ============================================================================

export const WORK_CATEGORIES = [
  {
    id: "ai",
    label: "AI",
    title: "AI films",
    blurb: "Cinematic AI-generated worlds, characters and product shots at a fraction of a shoot's cost.",
    plan: "From $999",
  },
  {
    id: "motion-graphics",
    label: "Motion Graphics",
    title: "Motion graphics",
    blurb: "Kinetic type, clean shapes and product UI in motion for launches and announcements.",
    plan: "From $999",
  },
  {
    id: "hype",
    label: "Hype",
    title: "Hype videos",
    blurb: "High-energy teasers built to make a launch, mainnet or event feel inevitable.",
    plan: "Custom",
  },
  {
    id: "fast-cuts",
    label: "Fast Cuts",
    title: "Fast cuts",
    blurb: "Rapid, rhythm-driven edits that hold attention second by second.",
    plan: "Custom",
  },
  {
    id: "others",
    label: "Others",
    title: "Product, explainers and more",
    blurb: "UI walkthroughs, explainers, event promos and anything else your launch needs.",
    plan: "Custom",
  },
] as const;

export type WorkCategory = (typeof WORK_CATEGORIES)[number]["id"];

export type Aspect = "16:9" | "1:1" | "9:16" | "4:5";

export interface Metric {
  label: string;
  value: string;
}

/**
 * Where portfolio video files live. Defaults to /work-media (public/work-media,
 * kept out of git and synced to the server). Set NEXT_PUBLIC_WORK_MEDIA_BASE to
 * serve the same filenames from a video host instead; nothing else changes.
 */
const MEDIA_BASE = (process.env.NEXT_PUBLIC_WORK_MEDIA_BASE ?? "/work-media").replace(/\/+$/, "");

export interface ProjectVideo {
  /** Full video, played with controls on the project page. */
  src: string;
  /** Short silent loop for grids and the hero timeline. */
  preview?: string;
  poster?: string;
}

/** Builds the media URLs for a project from its slug (see MEDIA_BASE). */
function media(slug: string): ProjectVideo {
  return {
    src: `${MEDIA_BASE}/${slug}.mp4`,
    preview: `${MEDIA_BASE}/${slug}-preview.mp4`,
    poster: `/work/posters/${slug}.jpg`,
  };
}

export interface Project {
  slug: string;
  title: string;
  /** null when no client is credited (NDA, white-label, or our own piece). */
  client: string | null;
  /** The client is an individual creator, not a brand: credited on the
   *  project, but left out of the brand-name strip. */
  personalClient?: boolean;
  category: WorkCategory;
  aspect: Aspect;
  year?: number;
  durationSeconds?: number;
  featured?: boolean;
  video: ProjectVideo | null;
  /** The public post the video ran in, and where. */
  post?: { url: string; platform: "X" | "LinkedIn" };
  objective?: string;
  approach?: string;
  metrics?: Metric[];
  /** When/where the public counts in `metrics` were read. */
  metricsNote?: string;
  /** Featured as the results spotlight on the home page. */
  spotlight?: boolean;
}

/** A placeholder tile shown only while PROJECTS is empty. */
export interface PreviewSlot {
  key: string;
  category: WorkCategory;
  aspect: Aspect;
}

// Order = display order. Metrics are the public counts on the post, read
// 2026-10-01; they are labelled with that date wherever they render in full.
const COUNTS_NOTE = "Public counts on the post, 1 Oct 2026";

export const PROJECTS: Project[] = [
  {
    slug: "outcome-sports-markets",
    title: "Sports markets go live",
    client: "Outcome",
    category: "hype",
    aspect: "16:9",
    year: 2026,
    durationSeconds: 19,
    featured: true,
    video: media("outcome-sports-markets"),
    post: { url: "https://x.com/Outcomexyz/status/2095861545435545606", platform: "X" },
    objective:
      "Announce Outcome's first sports prediction market, live on Hyperliquid, and get traders in for the Premier League season.",
    approach:
      "A 19-second hype edit that slams real match footage against Outcome's own product UI, with punchy type beats (Trade and earn, Up to $1M in rewards) and a branded sports ticker to close.",
    metrics: [
      { label: "views", value: "127K" },
      { label: "likes", value: "344" },
      { label: "reposts", value: "39" },
      { label: "replies", value: "59" },
    ],
    metricsNote: COUNTS_NOTE,
    spotlight: true,
  },
  {
    slug: "webacy-dd-ai",
    title: "DD AI launch",
    client: "Webacy",
    category: "motion-graphics",
    aspect: "16:9",
    year: 2026,
    durationSeconds: 24,
    featured: true,
    video: media("webacy-dd-ai"),
    post: { url: "https://x.com/mywebacy/status/2102004211043242297", platform: "X" },
    objective: "Launch DD AI, Webacy's onchain analyst that gives AI agents risk judgment, to builders on X.",
    approach:
      "Product UI in motion, a typed prompt that turns into a full risk report, and kinetic type cycling through what agents can now do, all in Webacy's dark gradient look.",
    metrics: [
      { label: "views", value: "5.7K" },
      { label: "replies", value: "13" },
      { label: "likes", value: "21" },
      { label: "reposts", value: "5" },
    ],
    metricsNote: COUNTS_NOTE,
  },
  {
    slug: "superteam-map",
    title: "The map keeps growing",
    client: "Bart",
    personalClient: true,
    category: "fast-cuts",
    aspect: "1:1",
    year: 2026,
    durationSeconds: 9,
    featured: true,
    video: media("superteam-map"),
    post: { url: "https://x.com/Bartlugm/status/2101752592942456924", platform: "X" },
    objective: "Tease a new Superteam chapter joining the Solana ecosystem.",
    approach:
      "Nine seconds of rapid cuts across every regional Superteam mark, ending on a question-mark tile and a 'Don't blink, someone new is joining' sign-off.",
    metrics: [
      { label: "views", value: "2.7K" },
      { label: "likes", value: "91" },
      { label: "replies", value: "18" },
      { label: "reposts", value: "7" },
    ],
    metricsNote: COUNTS_NOTE,
  },
  {
    slug: "avena-esim",
    title: "One eSIM, everywhere",
    client: "Avena",
    category: "others",
    aspect: "16:9",
    year: 2026,
    durationSeconds: 30,
    featured: true,
    video: media("avena-esim"),
    objective: "Introduce Avena's single global eSIM and make setup feel effortless.",
    approach:
      "A product film that walks through the real app (install once, choose a destination, activate data) and ends on a journey across the map: Avena travels with you.",
  },
  {
    slug: "cashxchain-launch",
    title: "Global business accounts launch",
    client: "CashXChain",
    category: "motion-graphics",
    aspect: "16:9",
    year: 2026,
    durationSeconds: 30,
    featured: true,
    video: media("cashxchain-launch"),
    post: {
      url: "https://www.linkedin.com/feed/update/urn:li:ugcPost:7511312567861047297/",
      platform: "LinkedIn",
    },
    objective: "Launch CashXChain's business accounts: named accounts in USD, EUR, GBP and CAD, with payouts in 70+ currencies.",
    approach:
      "Kinetic type and currency stacks around the real dashboard, with burned-in captions so the whole story lands with the sound off.",
  },
  {
    slug: "world-teaser",
    title: "09.09.26 teaser",
    client: "Bart",
    personalClient: true,
    category: "ai",
    aspect: "1:1",
    year: 2026,
    durationSeconds: 11,
    featured: true,
    video: media("world-teaser"),
    post: { url: "https://x.com/Bartlugm/status/2097304692963385413", platform: "X" },
    objective: "Build anticipation for a World reveal on 9 September 2026.",
    approach: "A square AI teaser: iridescent orbs travelling through gaming, geopolitics and crowds, landing on the date.",
  },
];

export const PREVIEW_SLOTS: PreviewSlot[] = [
  { key: "p1", category: "motion-graphics", aspect: "16:9" },
  { key: "p2", category: "ai", aspect: "16:9" },
  { key: "p3", category: "hype", aspect: "16:9" },
  { key: "p4", category: "fast-cuts", aspect: "16:9" },
  { key: "p5", category: "others", aspect: "16:9" },
  { key: "p6", category: "ai", aspect: "16:9" },
];

export interface Client {
  name: string;
  /** Path under /public, e.g. /clients/acme.svg. */
  logo: string;
}

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  avatar?: string;
}

export interface TeamMember {
  name: string;
  role: string;
  photo?: string;
  x?: string;
}

export const CLIENTS: Client[] = [];
export const TESTIMONIALS: Testimonial[] = [];
export const TEAM: TeamMember[] = [];

export function categoryById(id: WorkCategory) {
  return WORK_CATEGORIES.find((c) => c.id === id)!;
}

export function isWorkCategory(v: string | undefined): v is WorkCategory {
  return WORK_CATEGORIES.some((c) => c.id === v);
}

export function featuredProjects(limit = 6): Project[] {
  const featured = PROJECTS.filter((p) => p.featured);
  return (featured.length > 0 ? featured : PROJECTS).slice(0, limit);
}

export function projectsWithMetrics(): Project[] {
  return PROJECTS.filter((p) => p.metrics && p.metrics.length > 0);
}

export function spotlightProject(): Project | undefined {
  return PROJECTS.find((p) => p.spotlight && p.metrics && p.metrics.length > 0);
}

/** Credited clients, in portfolio order, for the "worked with" strip. */
export function clientNames(): string[] {
  return [
    ...new Set(
      PROJECTS.filter((p) => !p.personalClient)
        .map((p) => p.client)
        .filter((c): c is string => Boolean(c))
    ),
  ];
}

export function projectBySlug(slug: string): Project | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}
