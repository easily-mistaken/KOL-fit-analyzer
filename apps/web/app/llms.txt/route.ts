import { CONTACT, FAQS, LAUNCH_GALLERY, POSITIONING, PROMISES } from "@/lib/agency/content";
import { PROJECTS, WORK_CATEGORIES } from "@/lib/agency/work";
import { SERVICES } from "@/lib/agency/services";
import { GUIDES, plainText } from "@/lib/agency/guides";
import { absoluteUrl, projectHeadline } from "@/lib/agency/seo";

// /llms.txt (llmstxt.org): a plain Markdown summary of the studio for AI
// assistants and answer engines, so "who makes launch videos for crypto / AI
// startups" has a clean, quotable source. Promises, styles, work, FAQ and
// contact come from the same data as the site; the intro paragraph and page
// descriptions are written here, so update them if the positioning changes.
// Shape per the spec: H1, blockquote, free prose, then H2 sections that are
// link lists only. Static at build time.
export const dynamic = "force-static";

export function GET() {
  const lines = [
    "# OverlapX",
    "",
    `> ${POSITIONING.eyebrow}. ${POSITIONING.sub}`,
    "",
    "OverlapX is a launch video agency. It makes product launch videos, motion graphics, AI films, hype videos and explainers for crypto and Web3 projects, AI products and startups that market themselves on X (Twitter). Every video is made for the X timeline: it opens on the hook, works on mute and ships in 16:9, 1:1, 9:16 and 4:5.",
    "",
    "OverlapX is a studio that brands hire to make videos. It is not a video editing or clipping app, and it is unrelated to similarly named video software.",
    "",
    ...PROMISES.map((p) => `**${p.title}.** ${p.body}`).join("\n\n").split("\n"),
    "",
    "**Pricing.** Every video is quoted for its brief: length, style and quality level. There is no public price list.",
    "",
    "**Video styles.** " + WORK_CATEGORIES.map((c) => `${c.title}: ${c.blurb}`).join(" "),
    "",
    "Frequently asked questions:",
    "",
    ...FAQS.map((f) => `**${f.q}** ${f.a}`).join("\n\n").split("\n"),
    "",
    "## Pages",
    "",
    `- [Home](${absoluteUrl("/")}): what OverlapX does and for whom`,
    ...SERVICES.map((s) => `- [${s.label}](${absoluteUrl(`/${s.slug}`)}): ${s.metaDescription}`),
    `- [Work](${absoluteUrl("/work")}): every project with its brief, video and results`,
    `- [Guides](${absoluteUrl("/guides")}): practical guides to launch videos on X`,
    `- [Free video idea](${absoluteUrl("/free-video-idea")}): say what you are launching and your budget, and get a free video idea, no call needed`,
    `- [Pricing](${absoluteUrl("/pricing")}): how a quote is built`,
    `- [About](${absoluteUrl("/about")}): the studio`,
    `- [Contact](${absoluteUrl("/contact")}): book a 15-minute call`,
    `- [Creator Fit](${absoluteUrl("/creator-fit")}): free tool that checks whether an X creator's engaged audience matches your target buyers`,
    "",
    "## Guides",
    "",
    ...GUIDES.map((g) => `- [${g.title}](${absoluteUrl(`/guides/${g.slug}`)}): ${plainText(g.summary)}`),
    "",
    "## Work",
    "",
    ...PROJECTS.map((p) => `- [${projectHeadline(p)}](${absoluteUrl(`/work/${p.slug}`)})`),
    "",
    "## Contact",
    "",
    `- [Book a call](${CONTACT.calendly})`,
    `- [X](${CONTACT.x.url})`,
    `- [Telegram](${CONTACT.telegram.url})`,
    `- [LinkedIn](${CONTACT.linkedin})`,
    `- [Email](mailto:${CONTACT.email}): ${CONTACT.email}`,
    "",
    "## Optional",
    "",
    `- [${LAUNCH_GALLERY.name}](${LAUNCH_GALLERY.url}): hand-picked library of the best startup, AI and crypto launch videos from X and YouTube, useful for references before a brief`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
