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

/**
 * There are no public prices (user, 2026-10-02): every video is quoted from
 * its brief. These are the things a quote depends on, shown on /pricing.
 */
export const PRICING_FACTORS = [
  {
    title: "Length",
    body: "A 15-second teaser and a two-minute story are different jobs.",
  },
  {
    title: "Style",
    body: "Motion graphics, an AI film, a hype edit or a product walkthrough each take different craft and tools.",
  },
  {
    title: "Quality level",
    body: "A clean, simple cut, or a high-end piece with custom design, characters and sound.",
  },
  {
    title: "Your brief",
    body: "What you already have (script, footage, product access, brand assets) and how many videos you need.",
  },
] as const;

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
    q: "How much does a video cost?",
    a: "It depends on the length, the style, the quality level you're after and what you already have. Tell us on a quick call and you get a clear quote before any work starts.",
  },
  {
    q: "Can you do more than one video?",
    a: "Yes. Launch packs, series and ongoing work are all quoted around what you need.",
  },
] as const;
