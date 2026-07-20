# Unit 40: Retry Failed Analyses + Fair Quotas

User-approved improvement #4: a failed analysis currently dead-ends (user
must create a new one) AND still consumes their lifetime tier quota. Both
fixed. Complements the worker's existing AUTO-retry for transient provider
errors (Unit 26's retry policy) with a human-initiated retry for exhausted/
non-retryable failures — near-free thanks to the caches.

## Fair quotas

`countLifetimeAnalyses` (the single source for the tier gate AND the quota
indicator, by design from Unit 39) now excludes analyses whose job is
FAILED: `job: { status: { not: "FAILED" } }`. **Deliberate distinction:**
the DAILY abuse caps (Unit 26) keep counting everything — they are spend
protection and a failing request still burns provider calls; only the
product allowance (3/10 lifetime) is refunded on failure.

## Retry

- `POST /api/analyses/[id]/retry` — owner-gated (same 404-for-strangers
  pattern): requires job.status === FAILED (else 409); attempts < 10 safety
  cap (the worker increments attempts on each QUEUED→RUNNING); daily abuse
  rate limit still applies (a retry re-spends). Resets the job to QUEUED
  (clears errorCode/errorMessage/startedAt/completedAt/failedAt), enqueues
  the same `{requestId, jobId}` payload, stores the new pgBossJobId; an
  enqueue failure reverts the job to FAILED (mirrors the create route).
- UI: the failed panel gains a "Retry analysis" button — on success the
  status page re-enters the queued/running experience via the existing
  reload mechanism. Caches make the re-run fast and cheap.

## Verification

`pnpm build`; manual: fail an analysis (or use an existing FAILED one) →
Retry → runs to completion; quota indicator unchanged by the failed run.
The count-filter change is exercised implicitly by the existing tier
gate/quota paths (DB-backed; no hermetic check).
