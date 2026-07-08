import { z } from "zod";

// Normalizes a Twitter/X handle: trims whitespace, strips leading "@", and
// lowercases. Handles are case-insensitive; storing the normalized form keeps
// lookups and dedupe consistent.
export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@+/, "").toLowerCase();
}

export const HandleSchema = z
  .string()
  .transform((v) => normalizeHandle(v))
  .refine((v) => /^[a-z0-9_]{1,15}$/.test(v), {
    message:
      "Handle must be a valid Twitter/X username (1-15 letters, digits, or underscores).",
  });
export type Handle = z.infer<typeof HandleSchema>;
