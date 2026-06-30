import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db.js";
import { loginSchema } from "../schemas.js";
import { validate } from "../middleware/validate.js";
import { verifyToken } from "../middleware/auth.js";
import { loginLimiter } from "../middleware/rateLimit.js";

export const authRouter = Router();

authRouter.post("/login", loginLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.estado !== "activo" || user.deletedAt) {
    return res.status(401).json({ error: "Credenciales invalidas" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Credenciales invalidas" });

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

  const payload = { id: user.id, email: user.email, role: user.role, comision_id: user.comisionId };
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
      { id: dbUser.id, email: dbUser.email, role: dbUser.role, comision_id: dbUser.comisionId },
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
    include: { comision: true }
  });

  if (!user || user.estado !== "activo" || user.deletedAt) {
    return res.status(401).json({ error: "Sesion invalida" });
  }

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
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
