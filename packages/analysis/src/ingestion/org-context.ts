import { fetchUrlContent } from "./fetch-content.js";
import {
  DEFAULT_MAX_TEXT_CHARS,
  type IngestOptions,
  type OrgContext,
  type SourceContent,
  type SourceKind,
} from "./types.js";

function skipped(kind: SourceKind): SourceContent {
  return { url: "", kind, status: "skipped", extractedText: "", charCount: 0 };
}

/**
 * Ingest the org's provided website and/or docs URLs into a compact context.
 * Each source is fetched independently; a failure in one never affects the
 * other, and this function never throws — so website/docs ingestion can never
 * fail the overall analysis (Invariant 8).
 */
export async function ingestOrgContext(
  input: { websiteUrl?: string; docsUrl?: string },
  options: IngestOptions = {}
): Promise<OrgContext> {
  const maxTextChars = options.maxTextChars ?? DEFAULT_MAX_TEXT_CHARS;

  const website = input.websiteUrl
    ? await fetchUrlContent(input.websiteUrl, "website", options)
    : skipped("website");
  const docs = input.docsUrl
    ? await fetchUrlContent(input.docsUrl, "docs", options)
    : skipped("docs");

  const combinedText = [website, docs]
    .filter((s) => s.status === "fetched" && s.extractedText.length > 0)
    .map((s) => s.extractedText)
    .join("\n\n")
    .slice(0, maxTextChars);

  return { website, docs, combinedText };
}
