// Choices on the "Get a free video idea" form (Unit 57). Kept free of zod so
// the browser form can import them (as @kol-fit/shared/video-idea-options)
// without pulling the validation library into every agency page. The stored
// value is the key; never rename a key once rows exist (add a new one).

export const IDEA_BUDGETS = {
  under_500: "Under $500",
  "500_1000": "$500-1k",
  "1000_2500": "$1k-2.5k",
  "2500_5000": "$2.5k-5k",
  "5000_10000": "$5k-10k",
  "10000_plus": "$10k+",
} as const;

export const IDEA_STYLES = {
  motion: "Motion graphics",
  ai: "AI",
  hype: "Hype edit",
  mix: "Mix",
  unsure: "Not sure",
} as const;

export const IDEA_CONTACT_CHANNELS = {
  email: "Email",
  x: "X",
  telegram: "Telegram",
} as const;

/** Where on the site the form was sent from. */
export const IDEA_SOURCES = ["free_idea_page", "home"] as const;

export type IdeaBudget = keyof typeof IDEA_BUDGETS;
export type IdeaStyle = keyof typeof IDEA_STYLES;
export type IdeaContactChannel = keyof typeof IDEA_CONTACT_CHANNELS;
export type IdeaSource = (typeof IDEA_SOURCES)[number];

/** How the contact reads to a person: "you@x.com", "@name on X". */
export function ideaContactLabel(channel: IdeaContactChannel, value: string): string {
  if (channel === "email") return value;
  return `@${value} on ${IDEA_CONTACT_CHANNELS[channel]}`;
}
