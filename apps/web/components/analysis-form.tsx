"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronDown, Loader2, Search } from "lucide-react";
import {
  AnalysisRequestInputSchema,
  CAMPAIGN_GOAL_LABELS,
  nextLimitTier,
  PRODUCT_STAGE_LABELS,
  TIER_LIMITS,
  type ApiResponse,
} from "@kol-fit/shared";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type FieldName =
  | "orgHandle"
  | "kolHandle"
  | "websiteUrl"
  | "docsUrl"
  | "productCategory"
  | "targetUser"
  | "campaignGoal"
  | "stage"
  | "region";

type FormValues = Record<FieldName, string>;

const EMPTY_VALUES: FormValues = {
  orgHandle: "",
  kolHandle: "",
  websiteUrl: "",
  docsUrl: "",
  productCategory: "",
  targetUser: "",
  campaignGoal: "",
  stage: "",
  region: "",
};

const OPTIONAL_FIELDS: FieldName[] = [
  "websiteUrl",
  "docsUrl",
  "productCategory",
  "targetUser",
  "campaignGoal",
  "stage",
  "region",
];

// Sentinel for the "not specified" Select option (Radix disallows an empty
// string item value); mapped back to "" (omitted from the payload).
const NONE = "__none__";

type AnalysisCreated = {
  id: string;
  jobId: string;
  status: string;
  createdAt: string;
};

function buildPayload(values: FormValues): Record<string, string> {
  const payload: Record<string, string> = {
    orgHandle: values.orgHandle.trim(),
    kolHandle: values.kolHandle.trim(),
  };
  for (const field of OPTIONAL_FIELDS) {
    const value = values[field].trim();
    if (value) payload[field] = value;
  }
  return payload;
}

/** Small label + control + inline-error row for consistent field markup. */
function Field({
  id,
  label,
  error,
  optional,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>
          {label}
          {!optional && <span className="text-error"> *</span>}
        </Label>
        {hint && (
          <span className="text-xs text-muted-foreground">{hint}</span>
        )}
      </div>
      {children}
      {error && (
        <p className="text-xs text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function AnalysisForm() {
  const router = useRouter();
  const [values, setValues] = React.useState<FormValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = React.useState<
    Partial<Record<string, string>>
  >({});
  const [formError, setFormError] = React.useState<string | null>(null);
  // Tier gate (Unit 34): which funnel wall the API answered with, if any.
  const [gate, setGate] = React.useState<"login_required" | "upgrade_required" | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [showOptional, setShowOptional] = React.useState(false);
  // Quota indicator (Unit 39): remaining analyses in the current tier.
  // `signedInLimit` is the authenticated allowance whatever the caller's tier —
  // the anonymous login wall needs it to say how many signing in unlocks.
  const [quota, setQuota] = React.useState<{
    used: number;
    limit: number;
    signedInLimit: number;
  } | null>(null);

  // Tier-wall copy reads the SERVER's resolved allowances (the env can override
  // them); TIER_LIMITS is only the fallback for a quota fetch that hasn't landed.
  // Each wall only renders for its own tier, so `quota.limit` is already that
  // tier's allowance — but the two walls need DIFFERENT fallbacks, since an
  // unresolved quota at the upgrade wall must not claim the anonymous number.
  const anonLimit = quota?.limit ?? TIER_LIMITS.anonLifetime;
  const accountLimit = quota?.limit ?? TIER_LIMITS.userLifetime;
  const signedInLimit = quota?.signedInLimit ?? TIER_LIMITS.userLifetime;
  // The next self-serve rung this account can request (10 → 25 → 50), or null at
  // the ceiling — drives whether the upgrade wall offers "Request more" (Unit 47).
  const upgradeTier = nextLimitTier(accountLimit);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/analyses/quota", { cache: "no-store" })
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled && body?.ok) setQuota(body.data);
      })
      .catch(() => {
        /* hide silently */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function setField(name: FieldName, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setGate(null);
    setFieldErrors({});

    const payload = buildPayload(values);
    const parsed = AnalysisRequestInputSchema.safeParse(payload);
    if (!parsed.success) {
      const errors: Partial<Record<string, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!errors[key]) errors[key] = issue.message;
      }
      // Friendlier messages for the empty required fields.
      if (!payload.orgHandle) errors.orgHandle = "Your brand's handle is required.";
      if (!payload.kolHandle) errors.kolHandle = "The creator's handle is required.";
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as ApiResponse<AnalysisCreated>;
      if (body.ok) {
        // Keep loading during navigation to the status page.
        router.push(`/analyses/${body.data.id}`);
        return;
      }
      if (
        body.error.code === "login_required" ||
        body.error.code === "upgrade_required"
      ) {
        setGate(body.error.code);
      }
      setFormError(body.error.message);
      setLoading(false);
    } catch {
      setFormError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">New analysis</CardTitle>
        <CardDescription>
          Compare your brand against any creator on X. Only the two
          handles are required.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-6">
          {/* Primary inputs */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="orgHandle" label="Your brand" error={fieldErrors.orgHandle}>
              <Input
                id="orgHandle"
                name="orgHandle"
                placeholder="@yourbrand"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={loading}
                aria-invalid={Boolean(fieldErrors.orgHandle)}
                value={values.orgHandle}
                onChange={(e) => setField("orgHandle", e.target.value)}
              />
            </Field>
            <Field id="kolHandle" label="Creator to check" error={fieldErrors.kolHandle}>
              <Input
                id="kolHandle"
                name="kolHandle"
                placeholder="@creator"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={loading}
                aria-invalid={Boolean(fieldErrors.kolHandle)}
                value={values.kolHandle}
                onChange={(e) => setField("kolHandle", e.target.value)}
              />
            </Field>
          </div>

          {/* Context nudge (Unit 37): collaborative tone ("give more context,
              we'll give better results"), with an explicit clickable
              affordance — this is a form section, not a pitch. */}
          <button
            type="button"
            onClick={() => setShowOptional((v) => !v)}
            aria-expanded={showOptional}
            className={cn(
              "group w-full cursor-pointer rounded-xl border border-default bg-surface px-4 py-3.5 text-left transition-all duration-150",
              "hover:border-accent/60 hover:bg-elevated",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
              showOptional && "border-accent/50 bg-elevated"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-[2px] bg-accent-primary" />
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-foreground">
                    Give us more context, and we&apos;ll give you better results
                  </span>
                  <p className="mt-0.5 text-xs text-secondary-foreground">
                    A few quick details about your product, audience, and goal
                    help the analysis reflect <em>your</em> situation. All
                    optional, always free.
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-lg border border-accent/50 px-2.5 py-1.5 text-xs font-medium text-accent-ink transition-colors",
                  "group-hover:bg-accent group-hover:text-accent-foreground group-hover:border-accent"
                )}
              >
                {showOptional ? "Hide" : "Add context"}
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    showOptional && "rotate-180"
                  )}
                />
              </span>
            </div>
          </button>

          {showOptional && (
            <div className="space-y-4">
              <Separator />
              <p className="text-xs text-muted-foreground">
                Everything here is optional, but every field you do fill makes
                the verdict more yours. Skip anything unknown.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="websiteUrl" label="Website URL" optional hint="helps us understand your product" error={fieldErrors.websiteUrl}>
                  <Input
                    id="websiteUrl"
                    name="websiteUrl"
                    type="url"
                    inputMode="url"
                    placeholder="https://example.com"
                    disabled={loading}
                    aria-invalid={Boolean(fieldErrors.websiteUrl)}
                    value={values.websiteUrl}
                    onChange={(e) => setField("websiteUrl", e.target.value)}
                  />
                </Field>
                <Field id="docsUrl" label="Docs URL" optional error={fieldErrors.docsUrl}>
                  <Input
                    id="docsUrl"
                    name="docsUrl"
                    type="url"
                    inputMode="url"
                    placeholder="https://docs.example.com"
                    disabled={loading}
                    aria-invalid={Boolean(fieldErrors.docsUrl)}
                    value={values.docsUrl}
                    onChange={(e) => setField("docsUrl", e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="productCategory" label="Product category" optional error={fieldErrors.productCategory}>
                  <Input
                    id="productCategory"
                    name="productCategory"
                    placeholder="e.g. DeFi perps, L2, wallet"
                    disabled={loading}
                    aria-invalid={Boolean(fieldErrors.productCategory)}
                    value={values.productCategory}
                    onChange={(e) => setField("productCategory", e.target.value)}
                  />
                </Field>
                <Field id="region" label="Region / language" optional error={fieldErrors.region}>
                  <Input
                    id="region"
                    name="region"
                    placeholder="e.g. English, SEA, LATAM"
                    disabled={loading}
                    aria-invalid={Boolean(fieldErrors.region)}
                    value={values.region}
                    onChange={(e) => setField("region", e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="campaignGoal" label="Campaign goal" optional hint="changes the verdict">
                  <Select
                    value={values.campaignGoal || undefined}
                    onValueChange={(v) =>
                      setField("campaignGoal", v === NONE ? "" : v)
                    }
                    disabled={loading}
                  >
                    <SelectTrigger id="campaignGoal">
                      <SelectValue placeholder="Select a goal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Any / not specified</SelectItem>
                      {Object.entries(CAMPAIGN_GOAL_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="stage" label="Stage" optional>
                  <Select
                    value={values.stage || undefined}
                    onValueChange={(v) => setField("stage", v === NONE ? "" : v)}
                    disabled={loading}
                  >
                    <SelectTrigger id="stage">
                      <SelectValue placeholder="Select a stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Any / not specified</SelectItem>
                      {Object.entries(PRODUCT_STAGE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field id="targetUser" label="Target user" optional hint="the audience we match against" error={fieldErrors.targetUser}>
                <Textarea
                  id="targetUser"
                  name="targetUser"
                  rows={3}
                  placeholder="Who is the ideal user? e.g. active DeFi traders and LPs on L2s."
                  disabled={loading}
                  aria-invalid={Boolean(fieldErrors.targetUser)}
                  value={values.targetUser}
                  onChange={(e) => setField("targetUser", e.target.value)}
                />
              </Field>
            </div>
          )}

          {formError && gate === null && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-error/40 bg-error/10 px-3 py-2.5 text-sm text-error"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Tier walls (Unit 34) — friendly funnel panels, not error styling. */}
          {gate === "login_required" && (
            <div
              role="alert"
              className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3.5 text-sm"
            >
              <p className="font-semibold text-foreground">
                You&apos;ve used your {anonLimit} free analyses
              </p>
              <p className="mt-1 text-secondary-foreground">
                Sign in with Google to unlock{" "}
                {Math.max(0, signedInLimit - anonLimit)} more. It takes ten
                seconds, and your existing reports come with you.
              </p>
              <Button asChild className="mt-3">
                <a href="/login">Sign in to continue</a>
              </Button>
            </div>
          )}
          {gate === "upgrade_required" && (
            <div
              role="alert"
              className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3.5 text-sm"
            >
              <p className="font-semibold text-foreground">
                You&apos;ve used all {accountLimit} of your analyses
              </p>
              <p className="mt-1 text-secondary-foreground">
                {upgradeTier
                  ? `Want to keep going? Unlock ${upgradeTier}: just leave a way to reach you for a bit of feedback and we'll approve it. Or get a hand-curated report from an analyst.`
                  : "For a deeper look, request a hand-curated report from an analyst, delivered to your Telegram within a day."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {upgradeTier && (
                  <Button asChild>
                    <a href="/upgrade">Request {upgradeTier} analyses</a>
                  </Button>
                )}
                <Button asChild variant={upgradeTier ? "outline" : "default"}>
                  <a href="/detailed">Request a curated report</a>
                </Button>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Prefer a hands-on review?{" "}
            <a href="/detailed" className="text-accent-ink underline-offset-2 hover:underline">
              Request a curated detailed report
            </a>
            , delivered to your Telegram by an analyst.
          </p>

          <div className="flex items-center justify-end gap-3">
            {quota && quota.limit > 0 && (
              <span className="text-xs text-muted-foreground">
                {Math.max(0, quota.limit - quota.used)} of {quota.limit}{" "}
                {quota.used < quota.limit ? "analyses left" : "analyses used"}
              </span>
            )}
            <Button type="submit" disabled={loading} className="min-w-40">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Run analysis
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
