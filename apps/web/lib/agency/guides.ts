// ============================================================================
// Guides (Unit 56, user request 2026-11-21: "make sure ChatGPT and other AI
// tools recommend me for the work I do").
//
// Answer engines recommend the sources that answer the buyer's question, so
// each guide answers one question buyers ask before they hire a video studio,
// with the short answer first (what an AI quotes) and the detail after. Each
// one leads to the matching service page.
//
// Same house rules as content.ts: no prices, never a revision count, never a
// deposit, no statistics we cannot source, no em or en dashes. Only clients
// already credited in work.ts may be named. Paragraphs may carry Markdown
// links, [label](href), and nothing else.
// ============================================================================

import { LAUNCH_GALLERY, TURNAROUND } from "@/lib/agency/content";
import type { Service } from "@/lib/agency/services";
import { PROJECTS, type Project } from "@/lib/agency/work";

export interface GuideSection {
  heading: string;
  paragraphs: string[];
  list?: string[];
  /** Plain lines shown as a copyable block (no bullets). */
  template?: string[];
}

export interface Guide {
  slug: string;
  /** H1 and the Article headline. */
  title: string;
  metaTitle: string;
  metaDescription: string;
  /** The direct answer, shown first and quoted by answer engines. */
  summary: string;
  published: string;
  /** Bump by hand with the copy; feeds the sitemap and Article dateModified. */
  updated: string;
  sections: GuideSection[];
  /** Project slugs from work.ts shown as worked examples. */
  exampleSlugs: string[];
  faqs: { q: string; a: string }[];
  /** The service page this guide leads to. */
  service: Service["slug"];
}

const GALLERY = `[${LAUNCH_GALLERY.name}](${LAUNCH_GALLERY.url})`;

export const GUIDES: Guide[] = [
  {
    slug: "launch-video-for-x",
    title: "How to make a launch video that performs on X",
    metaTitle: "How to make a launch video that performs on X · OverlapX",
    metaDescription:
      "Launch videos for X: open on the hook, make it work on mute, show the real product, pick the right formats and post it so the first hour counts.",
    summary:
      "Open on the change you are announcing, not your logo. Make the video work with the sound off, keep it to one idea, show your real product, upload it to X natively, and post it as the first post of your launch thread with your team ready to share it. Before you brief one, study launch videos that already did well.",
    published: "2026-11-21",
    updated: "2026-11-21",
    sections: [
      {
        heading: "Open on the hook, not the logo",
        paragraphs: [
          "On X a video starts playing while people are still scrolling. The first second decides whether they stop, so it has to show what changed: your product doing the new thing, one bold line of type, or a question your buyer already has.",
          "Logo stings, slow fades and intros belong at the end, if anywhere. Your name is already on the post above the video.",
          "Our [video for Outcome's sports markets](/work/outcome-sports-markets) opens on real match footage cut against the product UI and is over in 19 seconds. It drew 127K views on X at last count.",
        ],
      },
      {
        heading: "Make it work on mute",
        paragraphs: [
          "The timeline autoplays without sound, so every line that matters has to be on screen as captions or kinetic type. A voiceover and music make the video better for people who tap in, but they should never carry the message alone.",
          "The test is simple: watch your cut with the sound off. If the story is lost, it is not finished. [CashXChain's launch](/work/cashxchain-launch) burns its captions into the video for exactly this reason.",
        ],
      },
      {
        heading: "Sell one idea",
        paragraphs: [
          "Make people understand the one thing that is new and want to try it. A list of ten features is what the thread and the landing page are for.",
          "Length follows the idea. A teaser can be a few seconds, a hype cut lands in under 20, and a full product story runs to about a minute. At the time of writing, standard X accounts can post videos up to 2 minutes 20 seconds (Premium allows longer), but a launch rarely needs that long.",
        ],
      },
      {
        heading: "Show the real product",
        paragraphs: [
          "Animating your actual UI and flows shows people exactly what they get, where a stock mockup or a vague abstract animation asks them to imagine it. [Webacy's DD AI launch](/work/webacy-dd-ai) shows a typed prompt turning into a full risk report in the real product.",
          "If your product is hard to show, show the moment it solves: the error, the wait, the question, and then your product making it go away.",
        ],
      },
      {
        heading: "Plan every format from the start",
        paragraphs: [
          "16:9 works well on X, and most of our launch videos use it, because it also plays on desktop, YouTube and your website. A square video takes up more of a phone screen, and 9:16 suits X's vertical player, Stories, Reels and TikTok.",
          "Plan the ratios before the edit and export them all from it, so each place you post gets a version framed for it instead of a crop.",
        ],
      },
      {
        heading: "Post it so the first hour counts",
        paragraphs: [
          "Upload the video file to X itself. A YouTube link does not autoplay in the feed the way a native upload does.",
          "Put the video in the first post of the launch thread with one clear line of copy, and let the thread carry the details. Pin the post to your profile.",
          "Tell your team, investors and partners when it goes up, so the people who already back you can share it and add their own take early, and reply to every question that comes in.",
        ],
      },
      {
        heading: "Study launch videos that already performed",
        paragraphs: [
          `The fastest way to brief a good launch video is to point at ones that worked. ${GALLERY} is a hand-picked library of startup, AI and crypto launch videos from X and YouTube, with the views each one got, updated daily.`,
          "Save two or three you like and note exactly what you like about each: the hook, the pace, the type, the tone. That note is most of a brief.",
        ],
      },
      {
        heading: "Launch video checklist",
        paragraphs: ["Before you post, check that the video:"],
        list: [
          "Shows what changed in the first second",
          "Tells the whole story with the sound off",
          "Sells one idea, not a feature list",
          "Shows your real product or the problem it solves",
          "Has every ratio you will post exported from one edit",
          "Is uploaded natively to X, as the first post of the thread, and pinned",
          "Goes up with your team ready to share it",
        ],
      },
    ],
    exampleSlugs: ["outcome-sports-markets", "webacy-dd-ai", "cashxchain-launch"],
    faqs: [
      {
        q: "How long should a launch video be on X?",
        a: "Long enough to land one idea: under 20 seconds for a hype cut, up to about a minute for a full product story. At the time of writing, standard accounts can post up to 2 minutes 20 seconds, but a launch rarely needs it.",
      },
      {
        q: "What aspect ratio is best for a video on X?",
        a: "16:9 works well on X and also plays on desktop, YouTube and your site. Square takes up more of a phone screen, and 9:16 suits vertical players. Export every ratio you need from one edit.",
      },
      {
        q: "Does a launch video need a voiceover?",
        a: "It can have one, but it must not depend on it. The timeline autoplays muted, so captions or kinetic type have to carry every line that matters.",
      },
      {
        q: "Where can I find good launch video examples?",
        a: `${LAUNCH_GALLERY.name} (launchgallery.video) collects startup, AI and crypto launch videos from X and YouTube with their view counts, updated daily.`,
      },
    ],
    service: "launch-videos",
  },
  {
    slug: "crypto-launch-video",
    title: "Crypto launch videos: what to make, from teaser to mainnet",
    metaTitle: "Crypto launch videos, from teaser to mainnet · OverlapX",
    metaDescription:
      "The videos a crypto or Web3 launch needs on X: the teaser, the launch-day hero video and the cuts after, plus how to explain the mechanic honestly.",
    summary:
      "A crypto launch usually needs three kinds of video: a short teaser before the date, a hero video on launch day that explains the mechanic in one idea, and quick follow-up cuts for every milestone after. Each one should work on mute in the X feed, show the real product or mechanic, and promise nothing about price or returns.",
    published: "2026-11-21",
    updated: "2026-11-21",
    sections: [
      {
        heading: "Before launch: the teaser",
        paragraphs: [
          "A teaser builds an audience that is already waiting when the launch post goes up. It is short, often under 15 seconds, and it holds something back: a date, a question, a glimpse of the brand world, never the full reveal.",
          "It works best as a loop that rewards a second watch, posted a few days ahead and pinned until launch day. Our [Superteam teaser](/work/superteam-map) is nine seconds of rapid cuts ending on a question mark, and the [World teaser](/work/world-teaser) travels through AI scenes to land on a date.",
        ],
      },
      {
        heading: "Launch day: the hero video",
        paragraphs: [
          "The hero video carries the announcement. It answers three questions in order: what is this, why should I care now, and how do I start. Everything else goes in the thread.",
          "It can be a fast hype edit that sells the energy of the moment or a longer brand film that explains a new mechanic. Choose by how new the idea is: a familiar product needs energy, a new primitive needs a story. Outcome's sports markets launch was a [19-second hype edit](/work/outcome-sports-markets); R8's new kind of market got a [60-second brand film](/work/r8-pick-a-side).",
        ],
      },
      {
        heading: "After launch: milestone cuts",
        paragraphs: [
          "Integrations, listings, feature drops, events and community wins each deserve a short cut of their own. Reusing the hero video's look, type and sound makes the feed read as one campaign instead of a string of unrelated posts.",
          "Planning these with the hero video is faster and more consistent than starting each one from scratch.",
        ],
      },
      {
        heading: "Explain the mechanic, not the whitepaper",
        paragraphs: [
          "Most crypto products are hard to picture. Find the one-sentence version of the mechanic and build the video around it, then show it working in the real product UI.",
          "When the idea is abstract, a metaphor scene does the explaining. [R8's film](/work/r8-pick-a-side) opens on a cinematic AI scene everyone knows, turns it into the pitch, and only then walks through the mechanic in kinetic type and product UI.",
        ],
      },
      {
        heading: "Keep every claim honest",
        paragraphs: [
          "Show what the product does, not what the token might do. Never promise price moves, returns or guaranteed rewards, and state any reward terms exactly as the product does.",
          "Many countries regulate how tokens and investment products are promoted, so have your legal team check the claims in the script before production starts.",
        ],
      },
      {
        heading: "Speak the audience's language",
        paragraphs: [
          "Forced slang and meme templates read as fake to people who live on crypto Twitter. The tone that works is the one your community already uses with each other.",
        ],
      },
      {
        heading: "Plan the formats and the timing together",
        paragraphs: [
          "Get every ratio you will post (16:9, square, vertical) delivered at the same time, so the launch week of posts is ready before launch day.",
          `Work back from the date. With OverlapX most videos ship in ${TURNAROUND} from the brief, so book the call about a week before you want the teaser out.`,
        ],
      },
    ],
    exampleSlugs: ["r8-pick-a-side", "outcome-sports-markets", "superteam-map", "world-teaser"],
    faqs: [
      {
        q: "What videos does a token or mainnet launch need?",
        a: "A short teaser before the date, a hero video on launch day that explains the mechanic, and short follow-up cuts for each milestone after, each in every ratio you will post.",
      },
      {
        q: "How long should a crypto teaser be?",
        a: "Usually under 15 seconds. A teaser holds the reveal back and works best as a loop people watch twice.",
      },
      {
        q: "What should a crypto launch video avoid?",
        a: "Promises about price, returns or guaranteed rewards, forced slang, and long intros. Show what the product does, and have your legal team check the claims.",
      },
    ],
    service: "crypto-video-production",
  },
  {
    slug: "ai-video-for-brands",
    title: "AI video for brands: where it works and where it does not",
    metaTitle: "AI video for brands: where it works, where it does not · OverlapX",
    metaDescription:
      "Where AI video helps a brand and where it falls short: worlds, metaphors and stories versus exact product UI and type, and how to combine it with motion graphics.",
    summary:
      "AI video is strongest at what is expensive or impossible to film: imagined worlds, metaphors, characters and cinematic scenes. It is weakest at what must be exact: your product UI, readable on-screen text and your logo. The best brand videos combine the two, with AI scenes for the story and motion graphics for the product, type and brand.",
    published: "2026-11-21",
    updated: "2026-11-21",
    sections: [
      {
        heading: "Where AI video shines",
        paragraphs: [
          "AI generation makes scenes that would need a location, a cast and a crew. Our [Build Station Georgia film](/work/build-station-georgia) reimagines old Tbilisi as a city of makers; [Nosana's](/work/nosana-gpu-rental) opens on a late-night training run every developer knows. It turns an abstract product idea into a picture people feel before they read a word.",
        ],
        list: [
          "Brand films and teasers built around a world or a mood",
          "Metaphor scenes that explain an abstract product",
          "Founder and origin stories told in an illustrated or animated style",
          "Event and campaign films where a shoot is not practical",
        ],
      },
      {
        heading: "Where it falls short",
        paragraphs: [
          "A generated frame cannot be guaranteed to match your real UI, your copy or your logo pixel for pixel, and characters and products need care to stay consistent from shot to shot.",
          "Anything your audience will read or check against the real product should be designed, not generated.",
        ],
      },
      {
        heading: "The hybrid that works",
        paragraphs: [
          "The AI scenes set up the problem or the world; your real product UI, the type and the logo are designed and animated in motion graphics, so every word is readable and every screen is accurate. In [Nosana's GPU rental film](/work/nosana-gpu-rental) the crashed training run is AI, and the moment the developer rents a GPU is Nosana's real marketplace in motion graphics.",
          "Captions carry the narration, so the film still works on a muted timeline.",
        ],
      },
      {
        heading: "Questions to ask an AI video studio",
        paragraphs: ["Before you hire one, ask:"],
        list: [
          "How do you keep characters and products consistent across shots?",
          "Is the on-screen text and product UI generated, or designed by hand?",
          "Can I see full videos, not just single shots?",
          "Do you deliver every aspect ratio from one edit?",
          "How do you handle my logo and brand marks?",
        ],
      },
      {
        heading: "Where to start",
        paragraphs: [
          `Start from the story you want people to remember, then decide which parts AI should make. ${GALLERY} has AI launch videos from X and YouTube with their view counts if you want references before the brief.`,
        ],
      },
    ],
    exampleSlugs: ["nosana-gpu-rental", "build-station-georgia", "r8-pick-a-side", "world-teaser"],
    faqs: [
      {
        q: "Is AI video good enough for a brand launch?",
        a: "For worlds, metaphors, characters and cinematic scenes, yes. Product UI, on-screen text and logos should be designed in motion graphics and combined with the AI scenes, because a generated frame cannot be guaranteed to match them exactly.",
      },
      {
        q: "Can AI video show my real product?",
        a: "Not pixel for pixel. The reliable approach animates your real UI with motion graphics and uses AI for the scenes around it.",
      },
      {
        q: "What makes an AI video look professional?",
        a: "Consistent characters and style across shots, hand-designed type and product screens, a clear story, and an edit paced for the platform it runs on.",
      },
    ],
    service: "ai-video-production",
  },
  {
    slug: "choose-a-launch-video-agency",
    title: "How to choose a launch video agency",
    metaTitle: "How to choose a launch video agency (crypto, AI, startups) · OverlapX",
    metaDescription:
      "What to look for in a launch video agency for X: real posts with public results, fluency in your market, your real product on screen, and terms that fit your launch.",
    summary:
      "Judge a launch video agency on four things: videos it has made for X with links to the real posts and their public results, fluency in your market, the craft to show your real product, and terms that fit your launch: turnaround, every format, and what happens if you do not like the first cut. Ask for posts, not a showreel.",
    published: "2026-11-21",
    updated: "2026-11-21",
    sections: [
      {
        heading: "Ask for posts, not a showreel",
        paragraphs: [
          "A showreel shows the best three seconds of everything. A link to the post shows the whole video as your audience saw it, with its public views, reposts and replies. If an agency makes videos for X, its work should be on X.",
          "Every project on [our work page](/work) opens with its brief and the full video, and links the post with its public counts where the post is public.",
        ],
      },
      {
        heading: "Fluency in your market",
        paragraphs: [
          "Crypto, AI and developer audiences notice when a video gets the product or the language wrong. Look for an agency that has already shipped for teams like yours and can explain your mechanic back to you in one sentence on the first call.",
        ],
      },
      {
        heading: "Your real product on screen",
        paragraphs: [
          "Ask how they will show your product. The strongest launch videos animate the real UI and flows; a stock phone mockup or abstract shapes ask the viewer to imagine it. If they use AI video, ask which parts are generated and which are designed, since product screens and type should be designed.",
        ],
      },
      {
        heading: "Terms that fit a launch",
        paragraphs: ["Launches have dates, so the terms matter as much as the craft:"],
        list: [
          "Turnaround: can they deliver before your date, with time for feedback?",
          "Formats: do you get every ratio you will post from one edit?",
          "Concept and script: do they write them, or expect you to?",
          "Changes: what happens if you do not like the first cut?",
          "Payment: how much is due before you have seen anything?",
        ],
      },
      {
        heading: "Agency, freelancer or doing it yourself",
        paragraphs: [
          "A freelancer is a good fit for one style if you can write the concept and direct the edit yourself. An agency takes the whole job, from concept and script to design, animation and edit. Do-it-yourself tools are fine for quick clips you make often; a launch is the one post where it pays to have specialists.",
        ],
      },
      {
        heading: "Where OverlapX fits",
        paragraphs: [
          `OverlapX is a launch video studio for crypto, AI and startup brands on X. We write the concept and script, make motion graphics, AI films and hype edits, deliver every ratio, and ship most videos in ${TURNAROUND}. There is nothing to pay upfront: you pay once you love the video, and we refine it until you do.`,
          "If your video depends on a live-action shoot with a crew, cast and location, a production house built for shoots is the better choice. Our work is motion graphics, AI films and edits.",
        ],
      },
    ],
    exampleSlugs: ["outcome-sports-markets", "webacy-dd-ai", "r8-pick-a-side"],
    faqs: [
      {
        q: "What should I look for in a launch video agency?",
        a: "Videos it has made for X with links to the real posts and their public results, fluency in your market, your real product on screen, and terms that fit your date: turnaround, every format, and what happens if you do not like the first cut.",
      },
      {
        q: "Should I hire an agency or a freelancer for a launch video?",
        a: "A freelancer suits one style if you can write the concept and direct it yourself. An agency takes the whole job, from concept and script to design, animation and edit.",
      },
      {
        q: "What is OverlapX?",
        a: `OverlapX is a launch video studio for crypto, AI and startup brands on X. It makes launch videos, motion graphics, AI films and hype edits, delivered in ${TURNAROUND}, and clients pay only once they love the video. It is a studio you hire, not an app.`,
      },
    ],
    service: "launch-videos",
  },
  {
    slug: "brief-a-launch-video",
    title: "How to brief a launch video (with a template)",
    metaTitle: "How to brief a launch video (with a template) · OverlapX",
    metaDescription:
      "What to send a video studio before a launch: what it is, who it is for, the one message, the date, where it runs and references. With a copy-paste template.",
    summary:
      "A good launch video brief answers six things: what you are launching, who it is for, the one thing they should remember, the date it goes live, where it will be posted, and two or three reference videos you like and why. Add your brand assets and product access, and a studio can quote it and start.",
    published: "2026-11-21",
    updated: "2026-11-21",
    sections: [
      {
        heading: "The six things a brief needs",
        paragraphs: [
          "Everything else, from the script to the look, is the studio's job. The one message can be a single sentence: the goal for [Avena's video](/work/avena-esim) was to introduce one global eSIM and make setup feel effortless.",
        ],
        list: [
          "What you are launching, in one or two sentences",
          "Who it is for: the person you want to stop scrolling",
          "The one thing they should remember after watching",
          "The date it goes live, and any teaser dates before it",
          "Where it will be posted: X, YouTube, your site, ads",
          "Two or three reference videos, and what you like about each",
        ],
      },
      {
        heading: "What to send with it",
        paragraphs: [
          "Your logo and brand files, any fonts and colours, and product access if the video shows your product: a test account, a staging link or screen recordings. If you have a voice, a tagline or a sound you always use, include it.",
        ],
      },
      {
        heading: "What you do not need",
        paragraphs: [
          "You do not need a script, a storyboard or a shot list. A good studio writes the concept and script from your brief and shows you the idea before building it.",
        ],
      },
      {
        heading: "Where to find references",
        paragraphs: [
          `${GALLERY} collects startup, AI and crypto launch videos from X and YouTube with the views each one got, updated daily. Saying "this hook, that pace, this type style" is the fastest way to show a studio what you mean.`,
        ],
      },
      {
        heading: "Common brief mistakes",
        paragraphs: [],
        list: [
          "Five messages in one video. Pick one; the thread can carry the rest.",
          "No date. Without it a studio cannot plan the teaser, the hero video and the cuts.",
          "References without reasons. Say what you like, or the studio has to guess.",
          "Approving with the sound on. Review the cut muted, the way the timeline will play it.",
        ],
      },
      {
        heading: "Copy-paste brief template",
        paragraphs: ["Fill this in and send it to any studio:"],
        template: [
          "We are launching:",
          "It is for:",
          "After watching, they should remember:",
          "Launch date (and teaser date):",
          "It will be posted on:",
          "References we like, and why:",
          "Brand assets and product access:",
        ],
      },
      {
        heading: "How it works with OverlapX",
        paragraphs: [
          `You can skip the written brief: one short call covers it. You get a clear quote before any work starts, most videos ship in ${TURNAROUND}, and you pay only once you love the video.`,
        ],
      },
    ],
    exampleSlugs: ["avena-esim", "webacy-dd-ai", "nosana-gpu-rental"],
    faqs: [
      {
        q: "What should I send a video agency before a launch video?",
        a: "What you are launching, who it is for, the one message, the launch date, where it will be posted, two or three reference videos with reasons, your brand assets and product access.",
      },
      {
        q: "Do I need a script before hiring a video agency?",
        a: "No. A good studio writes the concept and script from your brief and shows it to you before production.",
      },
      {
        q: "How far ahead should I brief a launch video?",
        a: `At least a week before you want it live. OverlapX ships most videos in ${TURNAROUND} from the brief.`,
      },
    ],
    service: "launch-videos",
  },
];

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export function guidesForService(service: Service["slug"]): Guide[] {
  return GUIDES.filter((g) => g.service === service);
}

/** The guide's example projects, in order. Throws on a slug work.ts lacks. */
export function guideExamples(guide: Guide): Project[] {
  return guide.exampleSlugs.map((slug) => {
    const p = PROJECTS.find((x) => x.slug === slug);
    if (!p) throw new Error(`guides.ts: unknown project "${slug}" in ${guide.slug}`);
    return p;
  });
}

/** Newest guide edit, for the /guides lastmod. */
export function guidesUpdated(): string {
  return GUIDES.map((g) => g.updated).sort().at(-1)!;
}

/** Paragraph text with its Markdown links reduced to their labels. */
export function plainText(s: string): string {
  return s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}
