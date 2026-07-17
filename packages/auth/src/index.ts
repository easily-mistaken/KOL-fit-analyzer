// Public surface of @kol-fit/auth: the pure, framework-agnostic auth core
// (Unit 28). No Next, Prisma, Supabase, or zod — no runtime dependencies. This
// is the dist-testable core (mirrors how limits live in @kol-fit/shared).
export type { AuthUser, AuthMode, AuthEnv } from "./types.js";
export { resolveAuthMode } from "./mode.js";
