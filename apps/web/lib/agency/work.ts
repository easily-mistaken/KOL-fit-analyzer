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

export interface Project {
  slug: string;
  title: string;
  /** null when the client cannot be named (NDA / white-label). */
  client: string | null;
  category: WorkCategory;
  aspect: Aspect;
  year?: number;
  durationSeconds?: number;
  featured?: boolean;
  /** Direct, streamable file URL (Bunny Stream MP4 or any host) + poster. */
  video: { src: string; poster?: string } | null;
  xUrl?: string;
  objective?: string;
  approach?: string;
  metrics?: Metric[];
}

/** A placeholder tile shown only while PROJECTS is empty. */
export interface PreviewSlot {
  key: string;
  category: WorkCategory;
  aspect: Aspect;
}

export const PROJECTS: Project[] = [];

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

export function projectBySlug(slug: string): Project | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}
