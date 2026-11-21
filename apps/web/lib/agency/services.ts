// ============================================================================
// Service landing pages (Unit 55, user request 2026-11-21).
//
// One page per thing buyers search for: "launch video agency", "crypto video
// production", "AI video production". Each page is real content (what we
// make, the work that proves it, a page-specific FAQ), not a keyword stub.
//
// Same house rules as content.ts: no prices, never a revision count, never a
// deposit, no statistics we cannot source, no em or en dashes. Only clients
// already credited in work.ts may be named.
// ============================================================================

import { PROJECTS, type Project } from "@/lib/agency/work";
import { FAQS, LAUNCH_GALLERY, TURNAROUND } from "@/lib/agency/content";

export interface Service {
  slug: "launch-videos" | "crypto-video-production" | "ai-video-production";
  /** Short label for the footer and cross-links. */
  label: string;
  metaTitle: string;
  metaDescription: string;
  /** schema.org Service.serviceType: the plain name of the service. */
  serviceType: string;
  eyebrow: string;
  title: string;
  /** H2 over the "What we make" cards. */
  offersTitle: string;
  lead: string;
  offers: { title: string; body: string }[];
  points: { title: string; body: string }[];
  /** Project slugs from work.ts, in display order. */
  projectSlugs: string[];
  faqs: { q: string; a: string }[];
}

const faq = (q: string) => {
  const found = FAQS.find((f) => f.q === q);
  if (!found) throw new Error(`services.ts: no FAQ "${q}" in content.ts`);
  return { q: found.q, a: found.a };
};

export const SERVICES: Service[] = [
  {
    slug: "launch-videos",
    label: "Launch videos",
    metaTitle: "Product launch videos for startups · OverlapX",
    metaDescription: `Product launch videos for startups, crypto and AI teams, made for X: motion graphics, hype edits and AI films. Delivered in ${TURNAROUND}, paid when you love it.`,
    serviceType: "Product launch video production",
    eyebrow: "Launch videos",
    title: "Launch videos that make the announcement land.",
    offersTitle: "Every video your launch needs.",
    lead: `Your launch post gets one scroll to make its case. We make the video that carries it: the hook in the first second, your product on screen, the story told on mute. Delivered in ${TURNAROUND}, and you pay only once you love it.`,
    offers: [
      {
        title: "Product launch films",
        body: "A 30 to 90 second story of what you built and why it matters, built around your real product UI.",
      },
      {
        title: "Feature and update drops",
        body: "Short, sharp cuts for a new feature, integration or milestone, sized for a single post.",
      },
      {
        title: "Teasers",
        body: "A few seconds of anticipation before the big day, so the launch post lands on an audience that is already waiting.",
      },
      {
        title: "Launch packs",
        body: "The hero video plus versions in every aspect ratio, so one launch fills the week of posts around it.",
      },
    ],
    points: [
      {
        title: "Hook first",
        body: "The first second names the change, not the logo. On X, that is where people decide to stop.",
      },
      {
        title: "Your real product",
        body: "We animate your actual UI and flows, so viewers see what they will get instead of a stock mockup.",
      },
      {
        title: "Works on mute",
        body: "Kinetic type and captions carry the story, because the timeline autoplays silent.",
      },
      {
        title: "Every format",
        body: "16:9, 1:1, 9:16 and 4:5 from one edit, ready for X, LinkedIn and your landing page.",
      },
    ],
    projectSlugs: [
      "outcome-sports-markets",
      "webacy-dd-ai",
      "cashxchain-launch",
      "avena-esim",
      "r8-pick-a-side",
      "nosana-gpu-rental",
    ],
    faqs: [
      {
        q: "How long should a launch video be?",
        a: "Long enough to land one idea. Our launch videos run from under 20 seconds for a hype cut to about a minute for a full product story. We recommend a length on the call, based on what you are announcing and where it will run.",
      },
      {
        q: "How fast can you deliver a launch video?",
        a: `Most videos ship in ${TURNAROUND} from the moment we have your brief, so book the call about a week before your launch date.`,
      },
      {
        q: "Do you need access to our product?",
        a: "If the video shows your product, yes: a test account, a staging link or screen recordings. We handle concept, script, design, animation and edit.",
      },
      {
        q: "Where can I find launch video references?",
        a: `${LAUNCH_GALLERY.name} (launchgallery.video) is a hand-picked library of startup, AI and crypto launch videos from X and YouTube, with the views each one got, updated daily. Save the ones you like and bring them to the call.`,
      },
      faq("How much does a video cost?"),
      faq("Do I pay anything upfront?"),
    ],
  },
  {
    slug: "crypto-video-production",
    label: "Crypto and Web3 videos",
    metaTitle: "Crypto and Web3 video production for X · OverlapX",
    metaDescription: `Crypto and Web3 videos for launches, mainnets, new markets and ecosystem moments: hype edits, motion graphics and AI films made for X. Delivered in ${TURNAROUND}.`,
    serviceType: "Crypto and Web3 video production",
    eyebrow: "Crypto and Web3",
    title: "Crypto videos that speak the timeline's language.",
    offersTitle: "From teaser to mainnet.",
    lead: `Crypto lives on X. We make launch films, hype edits and explainers for protocols, trading products, security tools and ecosystems, in the language your community already uses. Delivered in ${TURNAROUND}, and you pay only once you love it.`,
    offers: [
      {
        title: "Launch and mainnet videos",
        body: "Make a launch, mainnet or new market feel like an event, from the teaser to the go-live post.",
      },
      {
        title: "Protocol explainers",
        body: "Turn a mechanism that takes a long thread to explain into a minute anyone can follow: what it is, why it matters, what to do next.",
      },
      {
        title: "Hype edits",
        body: "High-energy cuts for campaigns, seasons and community moments, paced to the second.",
      },
      {
        title: "Ecosystem and event films",
        body: "Chapter teasers, builder programs and event invitations for ecosystems and communities.",
      },
    ],
    points: [
      {
        title: "Fluent, not cringe",
        body: "We know the audience and the language, so the video lands with people who have already seen every launch.",
      },
      {
        title: "Your product on screen",
        body: "Real UI and real flows. Traders and builders trust what they can see working.",
      },
      {
        title: "Built for the feed",
        body: "Hook first, readable on mute, and cut in every aspect ratio for X, Telegram and beyond.",
      },
      {
        title: "Fast when the market is",
        body: `Most videos ship in ${TURNAROUND}, so the video is ready when the announcement is.`,
      },
    ],
    projectSlugs: [
      "outcome-sports-markets",
      "r8-pick-a-side",
      "webacy-dd-ai",
      "nosana-gpu-rental",
      "superteam-map",
      "build-station-georgia",
    ],
    faqs: [
      {
        q: "Which crypto projects do you work with?",
        a: "Protocols, trading and prediction markets, security tools, infrastructure, ecosystems and communities. Recent work includes videos for Outcome, R8, Webacy and Nosana.",
      },
      {
        q: "Can you explain a complex protocol in a short video?",
        a: "Yes. We start from your docs and a short call, find the one idea a newcomer needs, and build the video around it with your product on screen.",
      },
      faq("How fast is delivery?"),
      faq("Which formats do I get?"),
      faq("How much does a video cost?"),
      faq("Do I pay anything upfront?"),
    ],
  },
  {
    slug: "ai-video-production",
    label: "AI videos",
    metaTitle: "AI video production agency for brands on X · OverlapX",
    metaDescription: `AI films and launch videos for brands and AI startups: cinematic worlds, characters and product shots without a shoot, made for X. Delivered in ${TURNAROUND}.`,
    serviceType: "AI video production",
    eyebrow: "AI video",
    title: "Cinematic AI videos, directed for the timeline.",
    offersTitle: "Films, launches and teasers.",
    lead: `We use AI generation the way a studio uses a camera: to tell a story. Cinematic worlds, characters and product shots without a shoot, cut and paced for X. Building an AI product? We make its launch video too.`,
    offers: [
      {
        title: "AI brand films",
        body: "Story-led films with recurring characters and worlds, for launches, campaigns and founder stories.",
      },
      {
        title: "AI product launch videos",
        body: "For AI startups: show what the product does in the first second, with real UI and a use case people recognise.",
      },
      {
        title: "Teasers and event films",
        body: "Short AI teasers and invitations that build anticipation for a date, a reveal or an event.",
      },
      {
        title: "AI with motion graphics",
        body: "AI scenes cut with motion-graphic UI, so the story feels cinematic and the product stays precise.",
      },
    ],
    points: [
      {
        title: "Directed, not just generated",
        body: "Script, look and edit come first. AI is the tool; the story is the job.",
      },
      {
        title: "One consistent look",
        body: "Characters, style and colour are designed up front so the film reads as one piece, not a reel of clips.",
      },
      {
        title: "No shoot needed",
        body: "No crew, locations or actors, so a cinematic film fits a launch timeline.",
      },
      {
        title: "Made for X",
        body: "Hook first, captioned for mute, and delivered in every aspect ratio.",
      },
    ],
    projectSlugs: [
      "nosana-gpu-rental",
      "kunal-shah-story",
      "build-station-georgia",
      "r8-pick-a-side",
      "world-teaser",
      "webacy-dd-ai",
    ],
    faqs: [
      {
        q: "What does an AI video production agency do?",
        a: "It combines AI image and video generation with traditional scripting, design and editing to make films that would otherwise need a shoot. At OverlapX we write the story, set the visual style, generate and direct the shots, and edit them for the X timeline.",
      },
      {
        q: "Will an AI video look generic?",
        a: "Not when it is directed. Every film starts from a script and a defined visual style, and we keep refining until you call it perfect.",
      },
      {
        q: "Do you make launch videos for AI products?",
        a: "Yes. Nosana's GPU rental film and Webacy's DD AI launch are two examples: the product's real UI, a clear use case, and a hook in the first second.",
      },
      faq("How fast is delivery?"),
      faq("How much does a video cost?"),
      faq("Do I pay anything upfront?"),
    ],
  },
];

export function serviceBySlug(slug: Service["slug"]): Service {
  const s = SERVICES.find((x) => x.slug === slug);
  if (!s) throw new Error(`Unknown service ${slug}`);
  return s;
}

/** The service's projects, in its own order. Unknown slugs fail the build. */
export function serviceProjects(service: Service): Project[] {
  return service.projectSlugs.map((slug) => {
    const p = PROJECTS.find((x) => x.slug === slug);
    if (!p) throw new Error(`services.ts: ${service.slug} lists unknown project "${slug}"`);
    return p;
  });
}
