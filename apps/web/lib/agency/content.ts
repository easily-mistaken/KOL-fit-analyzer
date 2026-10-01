// ============================================================================
// OverlapX agency copy and commercial terms (Unit 54).
//
// Single source of truth for the agency site AND the /deck brochure, so the two
// can never quote different prices, turnaround, or contact details. Every value
// here was set by the user; see context/specs/54-agency-site-and-creator-fit-move.md
// before changing any of them.
//
// House rules for copy in this file:
// - Never state a revision count. We refine until the client calls it perfect.
// - Payment is 100% after the client loves the video. Never imply a deposit.
// ============================================================================

export const CONTACT = {
  calendly: "https://calendly.com/tanmayjain4477/quick-call",
  x: { handle: "tanmayJain5114", url: "https://x.com/tanmayJain5114" },
  telegram: { handle: "tanmayjain5114", url: "https://t.me/tanmayjain5114" },
  linkedin: "https://www.linkedin.com/in/tanmay-jain5/",
  email: "tanmay@overlapx.com",
} as const;

export const TURNAROUND = "4-5 days";

export const POSITIONING = {
  eyebrow: "Video studio for brands on X",
  headline: "Videos made for the X timeline.",
  sub: "Motion graphics, AI films and hype edits for crypto brands, products and AI companies. Built to stop the scroll, delivered in 4-5 days, and you only pay once you love it.",
} as const;

/** The four promises that recur on the site and in the deck. */
export const PROMISES = [
  { title: "Pay when you love it", body: "Nothing upfront. You pay 100% once the video is right." },
  { title: `Delivered in ${TURNAROUND}`, body: "From brief to final cut in under a week." },
  { title: "Every format", body: "16:9, 1:1, 9:16 and 4:5, ready for X and everywhere else." },
  { title: "Refined until perfect", body: "We keep iterating until you call it done." },
] as const;

export const AUDIENCES = ["Crypto brands", "Products", "AI products"] as const;

/** Why X is its own medium. Reasons, not statistics we cannot source. */
export const WHY_X = [
  {
    title: "The first second decides",
    body: "On X the video autoplays mid-scroll. We open on the hook, never on a logo sting, so people stop before they decide to.",
  },
  {
    title: "Sound is off",
    body: "The timeline autoplays muted. Motion and on-screen type carry the story; audio is the bonus, not the message.",
  },
  {
    title: "Built for the feed",
    body: "Framed and paced for how the timeline crops, loops and autoplays, in every aspect ratio you need.",
  },
  {
    title: "Fluent in crypto and AI",
    body: "Launches, mainnets, token events, product drops. We know the audience and the language, so it lands without the cringe.",
  },
] as const;

export interface Plan {
  id: string;
  name: string;
  price: string;
  unit: string;
  summary: string;
  includes: string[];
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "motion-graphics",
    name: "Motion Graphics",
    price: "$999",
    unit: "30-second video",
    summary: "Clean, kinetic motion design for launches, features and announcements.",
    includes: [
      "Concept and script",
      "Custom motion design",
      "Music and sound design",
      "Every format",
      `Delivered in ${TURNAROUND}`,
    ],
    highlight: true,
  },
  {
    id: "ai-video",
    name: "AI Video",
    price: "$999",
    unit: "1-minute video",
    summary: "Cinematic AI-generated films that look like a far bigger budget.",
    includes: [
      "Concept and script",
      "AI-generated cinematic scenes",
      "Edit, music and sound",
      "Every format",
      `Delivered in ${TURNAROUND}`,
    ],
  },
  {
    id: "custom",
    name: "Custom",
    price: "Let's talk",
    unit: "Built around your launch",
    summary: "Hype edits, fast cuts, product and UI walkthroughs, explainers, event promos, longer videos and multi-video plans.",
    includes: [
      "Any style or length",
      "Multiple videos and campaigns",
      "Plan shaped to your goals",
      "Same pay-when-you-love-it terms",
    ],
  },
];

export const PROCESS = [
  { title: "Quick call", body: "Tell us what you're launching and who it's for. One short call is enough." },
  { title: "Concept", body: "We write the script and shape the look, so you see the idea before we build it." },
  { title: "Production", body: "Design, animation, AI generation and edit, paced for the timeline." },
  { title: "Refine", body: "You review, we refine, as many times as it takes to be perfect." },
  { title: "Deliver, then pay", body: "Every format, ready to post. You pay once you love it." },
] as const;

export const FAQS = [
  {
    q: "Do I pay anything upfront?",
    a: "No. You pay 100% after the video is done and you love it. Try us first.",
  },
  {
    q: "What if I'm not happy with the first cut?",
    a: "We refine it. There's no fixed revision count; we keep going until it's right.",
  },
  {
    q: "How fast is delivery?",
    a: `Most videos ship in ${TURNAROUND} from the moment we have your brief.`,
  },
  {
    q: "Which formats do I get?",
    a: "Every format you need: 16:9, 1:1, 9:16 and 4:5, sized for X and ready for any other platform.",
  },
  {
    q: "What do you need from me?",
    a: "A short brief or call, your brand assets, and product access or screens if the video shows your product. We handle concept, script, design and edit.",
  },
  {
    q: "Who do you work with?",
    a: "Crypto brands, products and AI products that market themselves on X, from first launch to established teams.",
  },
  {
    q: "What does Custom cover?",
    a: "Hype edits, fast cuts, product and UI walkthroughs, explainers, launch and event promos, longer videos and multi-video plans. Book a call and we'll shape it around your launch.",
  },
] as const;
