import { createHmac, timingSafeEqual } from "crypto";

// Minimal admin auth: one shared password (env ADMIN_PASSWORD), a signed
// cookie carrying an expiry — no session table/database needed. Good enough
// for a single-owner admin panel; swap for real auth (multiple accounts,
// roles for sales agents, etc.) later without touching the public site.

const COOKIE_NAME = "admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error(
      "Missing SESSION_SECRET (or ADMIN_PASSWORD) environment variable."
    );
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createSessionToken(): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `admin:${expires}`;
  const signature = sign(payload);
  return `${payload}:${signature}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(":");
  if (parts.length !== 3) return false;
  const [role, expiresStr, signature] = parts;
  const payload = `${role}:${expiresStr}`;
  const expected = sign(payload);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || Date.now() > expires) return false;

  return role === "admin";
}

export function checkPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
export const ADMIN_COOKIE_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;

// --- Login rate limiting -----------------------------------------------
// In-memory sliding-window lockout keyed by client IP, guarding the single
// shared ADMIN_PASSWORD against unlimited automated guessing. Like the
// write queue in db.ts, this is a single-process-only safety mechanism: it
// resets on restart and is NOT shared across replicas/clusters. Fine for
// this app's current single-instance deployment; must be swapped for a
// shared store (e.g. Redis) before running more than one instance.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 1000 * 60 * 15; // 15 minutes

type LoginAttemptState = { count: number; firstFailureAt: number };
const loginAttempts = new Map<string, LoginAttemptState>();

// Fallback key used when no client IP can be determined at all (e.g. the
// x-forwarded-for header is absent behind an unusual proxy setup). Sharing
// one bucket in that case is intentionally conservative — it still throttles
// guessing, just without per-IP granularity.
const UNKNOWN_IP_KEY = "unknown";

function pruneIfExpired(ip: string): void {
  const state = loginAttempts.get(ip);
  if (state && Date.now() - state.firstFailureAt > LOCKOUT_WINDOW_MS) {
    loginAttempts.delete(ip);
  }
}

// Returns true if this IP is currently allowed to attempt a login.
export function checkLoginRateLimit(ip: string | undefined | null): boolean {
  const key = ip || UNKNOWN_IP_KEY;
  pruneIfExpired(key);
  const state = loginAttempts.get(key);
  if (!state) return true;
  return state.count < MAX_FAILED_ATTEMPTS;
}

export function recordFailedLogin(ip: string | undefined | null): void {
  const key = ip || UNKNOWN_IP_KEY;
  pruneIfExpired(key);
  const state = loginAttempts.get(key);
  if (!state) {
    loginAttempts.set(key, { count: 1, firstFailureAt: Date.now() });
  } else {
    state.count += 1;
  }
}

export function recordSuccessfulLogin(ip: string | undefined | null): void {
  const key = ip || UNKNOWN_IP_KEY;
  loginAttempts.delete(key);
}

// How many whole seconds remain before this IP's lockout window clears.
// Only meaningful to call when checkLoginRateLimit(ip) is already false.
export function getLoginRetryAfterSeconds(ip: string | undefined | null): number {
  const key = ip || UNKNOWN_IP_KEY;
  const state = loginAttempts.get(key);
  if (!state) return 0;
  const remainingMs = LOCKOUT_WINDOW_MS - (Date.now() - state.firstFailureAt);
  return Math.max(0, Math.ceil(remainingMs / 1000));
}
