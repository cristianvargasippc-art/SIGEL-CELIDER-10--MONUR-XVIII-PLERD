import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db.js";
import { loginSchema } from "../schemas.js";
import { validate } from "../middleware/validate.js";
import { verifyToken } from "../middleware/auth.js";
import {
  loginLimiter,
  checkLoginAttempts,
  recordFailedAttempt,
  clearLoginAttempts,
  loginRateLimitConfig,
  loginRateLimitMessage
} from "../middleware/rateLimit.js";

export const authRouter = Router();

authRouter.post("/login", loginLimiter, validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = String(email || "").toLowerCase().trim();
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    const key = `${ip}:${cleanEmail}`;

    const check = checkLoginAttempts(key);
    if (check.blocked) {
      await prisma.audit.create({
        data: {
          userId: null,
          action: "login_bloqueado_demasiados_intentos",
          entityType: "user",
          changes: { ip, email: cleanEmail, retryAfterMinutes: check.retryAfter }
        }
      });
      return res.status(429).json({
        error: loginRateLimitMessage(check.retryAfter)
      });
    }

    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user || user.estado !== "activo" || user.deletedAt) {
      recordFailedAttempt(key);
      const newCheck = checkLoginAttempts(key);
      await prisma.audit.create({
        data: {
          userId: null,
          action: "login_fallido_usuario_inexistente",
          entityType: "user",
          changes: { email: cleanEmail, ip }
        }
      });
      if (newCheck.blocked) {
        return res.status(429).json({
          error: loginRateLimitMessage(newCheck.retryAfter)
        });
      }
      return res.status(401).json({
        error: `Credenciales incorrectas. Te quedan ${newCheck.remaining} intento(s). Si se alcanza el limite de ${loginRateLimitConfig.maxAttempts}, intente mas tarde despues de ${loginRateLimitConfig.windowMinutes} minutos.`
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      recordFailedAttempt(key);
      const newCheck = checkLoginAttempts(key);
      await prisma.audit.create({
        data: {
          userId: user.id,
          action: "login_fallido_contrasena_incorrecta",
          entityType: "user",
          entityId: user.id,
          changes: { email: user.email, ip, intentos_restantes: newCheck.remaining ?? 0 }
        }
      });
      if (newCheck.blocked) {
        return res.status(429).json({
          error: loginRateLimitMessage(newCheck.retryAfter)
        });
      }
      return res.status(401).json({
        error: `Credenciales incorrectas. Te quedan ${newCheck.remaining} intento(s). Si se alcanza el limite de ${loginRateLimitConfig.maxAttempts}, intente mas tarde despues de ${loginRateLimitConfig.windowMinutes} minutos.`
      });
    }

    clearLoginAttempts(key);
    await prisma.user.update({ where: { id: user.id }, data: { ultimoLogin: new Date() } });
    await prisma.audit.create({
      data: {
        userId: user.id,
        action: "login",
        entityType: "user",
        entityId: user.id,
        changes: { email: user.email, role: user.role }
      }
    });

    const payload = { id: user.id, email: user.email, role: user.role, distrito_id: user.distritoId, comision_id: user.comisionId };
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: Number(process.env.JWT_EXPIRATION || 3600)
    });
    const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      access_token: accessToken,
      user: payload
    });
  } catch (error) {
    return res.status(401).json({ error: "No se pudo procesar el inicio de sesión. Revisa tus credenciales." });
  }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("refresh_token");
  return res.json({ success: true });
});

authRouter.post("/refresh", async (req, res) => {
  const token = req.cookies.refresh_token;
  if (!token) return res.status(401).json({ error: "Refresh token requerido" });

  try {
    const session = jwt.verify(token, process.env.JWT_SECRET);
    const dbUser = await prisma.user.findUnique({ where: { id: session.id } });
    if (!dbUser || dbUser.estado !== "activo" || dbUser.deletedAt) {
      return res.status(401).json({ error: "Sesion invalida" });
    }
    const accessToken = jwt.sign(
      { id: dbUser.id, email: dbUser.email, role: dbUser.role, distrito_id: dbUser.distritoId, comision_id: dbUser.comisionId },
      process.env.JWT_SECRET,
      { expiresIn: Number(process.env.JWT_EXPIRATION || 3600) }
    );
    return res.json({ access_token: accessToken });
  } catch {
    return res.status(403).json({ error: "Refresh token invalido" });
  }
});

authRouter.get("/me", verifyToken, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { comision: true, distrito: true }
  });

  if (!user || user.estado !== "activo" || user.deletedAt) {
    return res.status(401).json({ error: "Sesion invalida" });
  }

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      distrito_id: user.distritoId,
      distrito: user.distrito?.codigo || null,
      comision_id: user.comisionId,
      comision: user.comision?.nombre || null,
      ultimo_login: user.ultimoLogin
    }
  });
});

authRouter.post("/verify", verifyToken, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  return res.json({ valid: Boolean(user && user.estado === "activo" && !user.deletedAt) });
});

authRouter.post("/change-password", verifyToken, async (req, res) => {
  const { password_actual, password_nuevo } = req.body;
  if (!password_actual || !password_nuevo || password_nuevo.length < 8) {
    return res.status(400).json({ error: "Contrasena invalida" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const valid = await bcrypt.compare(password_actual, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Contrasena actual incorrecta" });

  const hash = await bcrypt.hash(password_nuevo, Number(process.env.BCRYPT_ROUNDS || 10));
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
  return res.json({ success: true });
});
