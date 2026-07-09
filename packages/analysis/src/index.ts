// Public surface of @kol-fit/analysis. Unit 12: website/docs content ingestion.
export { fetchUrlContent } from "./ingestion/fetch-content.js";
export { ingestOrgContext } from "./ingestion/org-context.js";
export {
  extractFromHtml,
  extractFromPlainText,
  decodeEntities,
  collapseWhitespace,
  extractTitle,
} from "./ingestion/extract.js";
export {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_TEXT_CHARS,
  type SourceKind,
  type SourceStatus,
  type IngestErrorCode,
  type SourceContent,
  type OrgContext,
  type IngestOptions,
  type FetchImpl,
} from "./ingestion/types.js";
