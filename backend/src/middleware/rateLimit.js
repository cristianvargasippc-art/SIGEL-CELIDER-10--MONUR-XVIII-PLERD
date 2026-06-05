import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const hasRedis = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const redis = hasRedis ? Redis.fromEnv() : null;

function passthrough() {
  return async (_req, _res, next) => next();
}

function limiter(ratelimit, keyFactory) {
  if (!ratelimit) return passthrough();
  return async (req, res, next) => {
    const key = keyFactory(req);
    const { success } = await ratelimit.limit(key);
    if (!success) return res.status(429).json({ error: "Demasiadas solicitudes" });
    return next();
  };
}

export const loginLimiter = limiter(
  hasRedis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "10 m"), prefix: "sigel:login" }) : null,
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
