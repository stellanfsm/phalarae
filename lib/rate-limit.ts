/**
 * Rate limiting — Upstash Redis-backed when env vars are present, in-memory fallback for local dev.
 * Required env vars for Upstash: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// ── In-memory fallback (single-instance / local dev) ─────────────────────────

type Bucket = { count: number; windowStart: number };
const buckets = new Map<string, Bucket>();

function checkInMemory(
  key: string,
  max: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.windowStart >= windowMs) {
    b = { count: 0, windowStart: now };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > max) {
    const retryAfterSec = Math.ceil((windowMs - (now - b.windowStart)) / 1000);
    return { ok: false, retryAfterSec: Math.max(1, retryAfterSec) };
  }
  return { ok: true };
}

// ── Upstash Redis lazy singleton ──────────────────────────────────────────────

let _redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (_redis === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    _redis = url && token ? new Redis({ url, token }) : null;
    if (!_redis) console.warn("[rate-limit] Upstash not configured — rate limiting is disabled");
  }
  return _redis;
}

// Cache Ratelimit instances by config key so they are created once per process.
const _limiters = new Map<string, Ratelimit>();

function getRatelimit(max: number, windowSec: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const k = `${max}:${windowSec}`;
  if (!_limiters.has(k)) {
    _limiters.set(
      k,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
        prefix: "phalarae",
        ephemeralCache: new Map(),
      }),
    );
  }
  return _limiters.get(k)!;
}

// ── Core async primitive ──────────────────────────────────────────────────────

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const windowSec = Math.ceil(windowMs / 1000);
  const limiter = getRatelimit(max, windowSec);
  if (limiter) {
    const r = await limiter.limit(key);
    if (r.success) return { ok: true };
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)) };
  }
  return checkInMemory(key, max, windowMs);
}

// ── IP extraction ─────────────────────────────────────────────────────────────

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

// ── Per-route named limiters with structured logging ──────────────────────────

const WINDOW_60S = 60_000;
const WINDOW_15M = 15 * 60_000;

// 5 new sessions per IP per 60 s — prevents session flooding and OpenAI cost spikes.
export async function checkIntakeStart(ip: string): Promise<RateLimitResult> {
  const r = await checkRateLimit(`intake:start:${ip}`, 5, WINDOW_60S);
  if (!r.ok)
    console.warn(`[rate-limit] intake:start blocked ip=${ip} retryAfter=${r.retryAfterSec}s`);
  return r;
}

// 10 disclaimer acks per IP per 60 s — slightly loose to absorb page refreshes.
export async function checkIntakeAcknowledge(ip: string): Promise<RateLimitResult> {
  const r = await checkRateLimit(`intake:ack:${ip}`, 10, WINDOW_60S);
  if (!r.ok)
    console.warn(`[rate-limit] intake:ack blocked ip=${ip} retryAfter=${r.retryAfterSec}s`);
  return r;
}

// 30 message turns per IP+session per 60 s (env-overridable) — permissive for fast typers.
const INTAKE_MSG_MAX = Number(process.env.INTAKE_RATE_LIMIT_PER_MIN ?? 30);

export async function checkIntakeMessage(ip: string, sessionId: string): Promise<RateLimitResult> {
  // Per-session limit: prevents any single session from being spammed.
  const perSession = await checkRateLimit(`intake:msg:${ip}:${sessionId}`, INTAKE_MSG_MAX, WINDOW_60S);
  if (!perSession.ok) {
    console.warn(
      `[rate-limit] intake:message blocked ip=${ip} sessionId=${sessionId} retryAfter=${perSession.retryAfterSec}s`,
    );
    return perSession;
  }
  // Per-IP backstop: caps aggregate message throughput across all sessions from one IP.
  // An attacker who accumulates sessions via the start limiter cannot multiply their
  // effective message rate beyond 2× the per-session cap (60/min default).
  const perIp = await checkRateLimit(`intake:msg-ip:${ip}`, INTAKE_MSG_MAX * 2, WINDOW_60S);
  if (!perIp.ok) {
    console.warn(
      `[rate-limit] intake:message (ip-backstop) blocked ip=${ip} sessionId=${sessionId} retryAfter=${perIp.retryAfterSec}s`,
    );
    return perIp;
  }
  return { ok: true };
}

// 5 login attempts per IP per 15 min — makes brute-forcing an admin account impractical.
export async function checkAdminLogin(ip: string): Promise<RateLimitResult> {
  const r = await checkRateLimit(`admin:login:${ip}`, 5, WINDOW_15M);
  if (!r.ok)
    console.warn(`[rate-limit] admin:login blocked ip=${ip} retryAfter=${r.retryAfterSec}s`);
  return r;
}
