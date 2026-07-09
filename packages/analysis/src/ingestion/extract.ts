// Pure, deterministic HTML -> text extraction. Regex-based, no DOM library
// (avoids heavy deps). All functions are side-effect free and never throw.

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Decode a small, common set of HTML entities (named + numeric). */
export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body[0] === "#") {
      const isHex = body[1] === "x" || body[1] === "X";
      const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return match;
        }
      }
      return match;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named ?? match;
  });
}

/** Collapse whitespace: trim lines, drop blank runs, collapse repeated spaces. */
export function collapseWhitespace(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();
}

/** Extract the first <title>, entity-decoded and capped. */
export function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return undefined;
  const title = collapseWhitespace(decodeEntities(m[1])).slice(0, 300);
  return title.length > 0 ? title : undefined;
}

/** Strip HTML to compact text. Returns { title?, text }. Never throws. */
export function extractFromHtml(html: string): { title?: string; text: string } {
  const title = extractTitle(html);

  let body = html
    // non-content regions
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // block-level boundaries -> newlines
  body = body
    .replace(/<\/(p|div|section|article|header|footer|li|ul|ol|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(head|title)[^>]*>/gi, " ");

  // strip all remaining tags, decode, collapse
  const stripped = body.replace(/<[^>]+>/g, " ");
  const text = collapseWhitespace(decodeEntities(stripped));
  return { title, text };
}

/** Plain text / markdown path: decode + collapse only (no tag stripping). */
export function extractFromPlainText(raw: string): { text: string } {
  return { text: collapseWhitespace(decodeEntities(raw)) };
}
