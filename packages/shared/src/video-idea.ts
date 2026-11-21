import { z } from "zod";

// Validation for "Get a free video idea" requests (Unit 57), mirroring the
// form on launchgallery.video (the user's own site): what you are launching, a
// budget range, and where to send the idea. Options: video-idea-options.ts.

import {
  IDEA_BUDGETS,
  IDEA_CONTACT_CHANNELS,
  IDEA_SOURCES,
  IDEA_STYLES,
} from "./video-idea-options.js";

export * from "./video-idea-options.js";

const keys = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

const X_HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const X_HOSTS = /^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\//i;
const TG_HANDLE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;
const TG_HOSTS = /^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\//i;

/** "@name", "name" or a profile link to the bare handle, or null. */
function handle(raw: string, pattern: RegExp, hosts: RegExp): string | null {
  const t = raw.trim().replace(hosts, "").replace(/^@/, "").replace(/[/?#].*$/, "");
  return pattern.test(t) ? t : null;
}

// The shared package compiles without DOM or Node types; both runtimes that use
// this file (the browser and Node 18+) have a global WHATWG URL.
declare const URL: new (input: string) => {
  protocol: string;
  hostname: string;
  username: string;
  password: string;
  toString(): string;
};

/** Empty to null; otherwise an http(s) link (a bare domain gets https://). */
const optionalLink = z
  .string()
  .max(500, "That link is too long.")
  .optional()
  .nullable()
  .transform((v, ctx) => {
    const t = v?.trim();
    if (!t) return null;
    const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    try {
      const url = new URL(withScheme);
      if (
        (url.protocol === "http:" || url.protocol === "https:") &&
        url.hostname.includes(".") &&
        !url.username &&
        !url.password
      ) {
        return url.toString();
      }
    } catch {
      // fall through
    }
    ctx.addIssue({ code: "custom", message: "Enter a valid link, like https://yourproduct.com." });
    return z.NEVER;
  });

export const VideoIdeaInputSchema = z
  .object({
    // Whitespace collapsed to single spaces: the brief is echoed into the
    // operator's Telegram alert, where a newline could forge a "Send to:" line.
    brief: z
      .string()
      .transform((v) => v.replace(/\s+/g, " ").trim())
      .pipe(z.string().min(3, "Tell us what you're launching.")
      .max(300, "Please keep it under 300 characters.")),
    budget: z.enum(keys(IDEA_BUDGETS), { error: "Pick a budget range." }),
    style: z
      .enum(keys(IDEA_STYLES))
      .optional()
      .nullable()
      .catch(null)
      .transform((v) => v ?? null),
    contactChannel: z.enum(keys(IDEA_CONTACT_CHANNELS)).catch("email"),
    contactValue: z.string().max(254).default(""),
    productUrl: optionalLink,
    referenceUrl: optionalLink,
    source: z.enum(IDEA_SOURCES).catch("free_idea_page"),
  })
  .transform((d, ctx) => {
    const raw = d.contactValue.trim();
    let value: string | null = null;
    let message = "";
    if (!raw) {
      message = "Tell us where to send your idea.";
    } else if (d.contactChannel === "email") {
      const email = raw.toLowerCase();
      if (z.email().safeParse(email).success) value = email;
      else message = "Enter a valid email, like you@company.com.";
    } else if (d.contactChannel === "x") {
      value = handle(raw, X_HANDLE, X_HOSTS);
      if (!value) message = "Enter your X handle, like @yourname.";
    } else {
      value = handle(raw, TG_HANDLE, TG_HOSTS);
      if (!value) message = "Enter your Telegram username, like @yourname.";
    }
    if (!value) {
      ctx.addIssue({ code: "custom", path: ["contactValue"], message });
      return z.NEVER;
    }
    return { ...d, contactValue: value };
  });

export type VideoIdeaInput = z.infer<typeof VideoIdeaInputSchema>;
