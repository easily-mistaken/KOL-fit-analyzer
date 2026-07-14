import type {
  AudienceClassification,
  ContentFitAssessment,
  EngagedAccountRaw,
  FitReport,
  KolContentClassification,
  OrgClassification,
  ReportVerdict,
  ScoreBreakdown,
  Tweet,
  TwitterUser,
} from "@kol-fit/shared";

// The LLM provider interface. All LLM calls in the system go through this
// interface (Invariant 3); implementations return the shared provider-neutral
// schemas, validated before use (Invariants 9, 12). Capabilities match
// architecture.md -> LLM Provider Interface (four classification/synthesis
// calls + the Unit 29B pair-specific content-fit rubric).
export interface LlmProvider {
  /** Configured model id (from LLM_MODEL). Recorded with reports; never hardcoded. */
  readonly model: string;

  classifyOrgProfile(input: ClassifyOrgInput): Promise<OrgClassification>;
  classifyKolContent(
    input: ClassifyKolContentInput
  ): Promise<KolContentClassification>;
  classifyAudienceAccounts(
    input: ClassifyAudienceInput
  ): Promise<AudienceClassification>;
  /** Pair-specific semantic content-fit rubric (Unit 29B). Bounded 0-5
   *  ordinal ratings + rationale — never a 0-100 score. */
  assessContentFit(input: AssessContentFitInput): Promise<ContentFitAssessment>;
  generateFitReport(input: GenerateFitReportInput): Promise<FitReport>;
}

export type LlmProviderKind = "mock" | "openai";

// --- LLM-call input shapes (compact structured evidence, not raw payloads).
// Provider-neutral; composed from shared types. May be refined in Unit 13.

export type ClassifyOrgInput = {
  handle: string;
  profile: TwitterUser | null;
  recentPosts?: Tweet[];
  // Manual brief from the analysis request; OVERRIDES inferred fields (Invariant 7).
  manualBrief?: Partial<
    Pick<
      OrgClassification,
      "productCategory" | "targetUser" | "stage" | "campaignGoal" | "region"
    >
  >;
  websiteText?: string; // from Unit 12 later; ignored by the mock
};

export type ClassifyKolContentInput = {
  handle: string;
  profile: TwitterUser | null;
  posts: Tweet[];
  replies?: Tweet[];
};

export type ClassifyAudienceInput = {
  accounts: EngagedAccountRaw[];
};

export type AssessContentFitInput = {
  org: { handle: string; classification: OrgClassification };
  kol: {
    handle: string;
    content: KolContentClassification;
    /** KOL profile — the bio is the primary relationship evidence (Unit 29F:
     *  "inventor of X", "co-founder of Y", "crypto news"). */
    profile?: TwitterUser | null;
  };
};

export type GenerateFitReportInput = {
  org: { handle: string; classification: OrgClassification };
  kol: { handle: string; content: KolContentClassification };
  audience: AudienceClassification;
  // Deterministic results from packages/scoring (Unit 14). The LLM does NOT
  // compute these; it places them into the report and writes narrative around
  // them. Optional now (no scoring yet) -> the mock uses marked placeholders.
  scores?: ScoreBreakdown;
  verdict?: ReportVerdict;
  sampleSizes?: Record<string, number>;
};
