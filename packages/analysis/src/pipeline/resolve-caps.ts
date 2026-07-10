import {
  ANALYSIS_CAPS,
  CAP_ENV_VARS,
  type AnalysisCaps,
} from "@kol-fit/shared";

function posInt(v: string | undefined, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : def;
}

/**
 * Resolves analysis caps from `ANALYSIS_*` environment overrides on top of the
 * defaults (Unit 19 cost controls). Invalid/absent/non-positive env values
 * fall back to the default. In-process `overrides` win over env, for testing.
 * The pipeline itself stays pure — the worker calls this and passes the result
 * into runAnalysis({ caps }).
 */
export function resolveCaps(
  overrides: Partial<AnalysisCaps> = {},
  env: NodeJS.ProcessEnv = process.env
): AnalysisCaps {
  const out = { ...ANALYSIS_CAPS };
  for (const key of Object.keys(out) as (keyof AnalysisCaps)[]) {
    out[key] = posInt(env[CAP_ENV_VARS[key]], out[key]);
    const override = overrides[key];
    if (
      typeof override === "number" &&
      Number.isFinite(override) &&
      override > 0
    ) {
      out[key] = Math.trunc(override);
    }
  }
  return out;
}
