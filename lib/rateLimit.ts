// Minimal in-memory rate limiter for public API routes. Honest limitation:
// this only limits requests within a single serverless function instance's
// memory — on Vercel, multiple concurrent instances each track their own
// count, so this is a soft speed bump against casual abuse, not a hard
// distributed limit. A real limit would need a shared store (e.g. Upstash
// Redis), which isn't part of this project's infrastructure yet.
const hits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;

export function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }

  entry.count += 1;
  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - entry.count };
}
