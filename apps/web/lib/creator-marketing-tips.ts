// Curated creator-marketing tips shown on the analysis waiting screen. A run
// takes ~5-7 minutes; rather than leave a captive, on-topic audience (brands
// about to spend on creators) staring at a spinner, we give them something
// genuinely useful. Neutral for both AI and Web3 brands; no "KOL".
//
// Keep these punchy and quotable. `tag` is a one-word category chip.

export type CreatorTip = { tag: string; text: string };

export const CREATOR_MARKETING_TIPS: CreatorTip[] = [
  {
    tag: "Engagement",
    text: "Engagement beats follower count. 10K genuinely engaged followers routinely outperform 100K passive ones.",
  },
  {
    tag: "Vetting",
    text: "Ask any creator for their last three campaign results before you pay. Reach is a vanity number; conversions are the real one.",
  },
  {
    tag: "Goals",
    text: "The same creator can be a great fit for awareness and a poor one for signups. Match the creator to the specific goal.",
  },
  {
    tag: "Audience",
    text: "Look at who replies, not just who follows. The people in the comments are the audience you're actually renting.",
  },
  {
    tag: "Red flags",
    text: "A spike in followers with flat engagement is a warning sign. Someone may have bought the audience.",
  },
  {
    tag: "Budget",
    text: "One well-matched creator usually beats ten mediocre ones. Concentrate budget where the audience actually overlaps yours.",
  },
  {
    tag: "Attribution",
    text: "Give every creator a unique link or code. If you can't attribute the result, you can't tell reach from impact.",
  },
  {
    tag: "Overlap",
    text: "If a creator's audience already knows you, you're paying for reach you have. Look for new, adjacent audiences.",
  },
  {
    tag: "Signals",
    text: "Comments are the tell. Real questions and back-and-forth mean an engaged audience; one-word hype usually doesn't.",
  },
  {
    tag: "Red flags",
    text: "Beware engagement pods and giveaway spikes. They inflate the numbers without adding a single real customer.",
  },
  {
    tag: "Creative",
    text: "Give creators creative freedom. Audiences can smell a scripted ad, and it costs the trust you paid for.",
  },
  {
    tag: "Trust",
    text: "A feed full of unrelated promos dilutes trust. Fewer, relevant partnerships almost always perform better.",
  },
  {
    tag: "Strategy",
    text: "Long-term partnerships beat one-off posts. Audiences act on repetition from a voice they already trust.",
  },
  {
    tag: "Focus",
    text: "Set one clear call to action per collaboration. Splitting attention across three asks kills conversion.",
  },
  {
    tag: "Timing",
    text: "Coordinate the drop with the creator's peak posting window. The same post lands harder at the right hour.",
  },
  {
    tag: "Content",
    text: "Agree on content rights up front, then repurpose the best creator posts across your own channels.",
  },
  {
    tag: "Vetting",
    text: "Read a creator's last 20 posts before you commit. Their off-days are your brand risk.",
  },
  {
    tag: "Quality",
    text: "A smaller, genuinely interested audience converts better than a large one full of bots and freebie hunters.",
  },
];
