import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const hasRedis = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const redis = hasRedis ? Redis.fromEnv() : null;

const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export function checkLoginAttempts(key) {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record) return { blocked: false, remaining: MAX_ATTEMPTS };
  if (now - record.windowStart > WINDOW_MS) {
    loginAttempts.delete(key);
    return { blocked: false, remaining: MAX_ATTEMPTS };
  }
  if (record.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((record.windowStart + WINDOW_MS - now) / 1000 / 60);
    return { blocked: true, retryAfter: Math.max(1, retryAfter) };
  }
  return { blocked: false, remaining: Math.max(0, MAX_ATTEMPTS - record.count) };
}

export function recordFailedAttempt(key) {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record || now - record.windowStart > WINDOW_MS) {
    loginAttempts.set(key, { count: 1, windowStart: now });
  } else {
    record.count += 1;
  }
}

export function clearLoginAttempts(key) {
  loginAttempts.delete(key);
}

function passthrough() {
  return async (_req, _res, next) => next();
}

function limiter(ratelimit, keyFactory) {
  if (!ratelimit) return passthrough();
  return async (req, res, next) => {
    const key = keyFactory(req);
    const { success } = await ratelimit.limit(key);
    if (!success) return res.status(429).json({ error: "Demasiadas solicitudes. Intente nuevamente en 15 minutos." });
    return next();
  };
}

export const loginLimiter = limiter(
  hasRedis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "15 m"), prefix: "sigel:login" }) : null,
  (req) => req.ip
);

export const rankingLimiter = limiter(
  hasRedis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "1 m"), prefix: "sigel:ranking" }) : null,
  (req) => req.ip
);

export const calificacionesLimiter = limiter(
  hasRedis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "1 m"), prefix: "sigel:calificaciones" }) : null,
  (req) => req.user?.id || req.ip
);
