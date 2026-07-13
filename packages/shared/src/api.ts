import { z } from "zod";

// Standard API response and error shapes (code-standards.md -> API Routes).
// Provider-specific raw errors are never surfaced; they map to "provider_error".

export const ApiErrorCodeSchema = z.enum([
  "validation_error",
  "unauthorized", // failed an auth gate (Unit 27: the admin password)
  "not_found",
  "conflict",
  "rate_limited",
  "provider_error",
  "internal_error",
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export type ApiError = { code: ApiErrorCode; message: string };

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export const ok = <T>(data: T): ApiResponse<T> => ({ ok: true, data });

export const err = (
  code: ApiErrorCode,
  message: string
): ApiResponse<never> => ({ ok: false, error: { code, message } });
