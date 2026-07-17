import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { authorize, verifyToken } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { adminSchema } from "../schemas.js";

export const adminsRouter = Router();

adminsRouter.get("/comisiones", verifyToken, authorize("superadmin"), async (_req, res) => {
  const comisiones = await prisma.comision.findMany({
    where: { eventoId: null },
    orderBy: { nombre: "asc" }
  });
  return res.json(comisiones);
});

adminsRouter.get("/", verifyToken, authorize("superadmin"), async (_req, res) => {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["regional", "distrito", "admin"] }, deletedAt: null },
    include: { comision: true, distrito: true },
    orderBy: { email: "asc" }
  });
  return res.json(admins);
});

adminsRouter.post("/", verifyToken, authorize("superadmin"), validate(adminSchema), async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (existing && !existing.deletedAt) return res.status(409).json({ error: "Ya existe un usuario con ese correo" });
  const password = req.body.password || Math.random().toString(36).slice(2, 12) + "A1";
  const hash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 10));
  const role = req.body.role || "distrito";
  const admin = await prisma.user.create({
    data: {
      email: req.body.email,
      passwordHash: hash,
      role,
      distritoId: req.body.distrito_id || null,
      comisionId: req.body.comision_id || null,
      deletedAt: null,
      estado: "activo"
    }
  });
  await prisma.audit.create({
    data: {
      userId: req.user.id,
      action: "admin_creado",
      entityType: "user",
      entityId: admin.id,
      changes: { email: admin.email, role, distrito_id: admin.distritoId, comision_id: admin.comisionId, password_definida: Boolean(req.body.password) }
    }
  });
  return res.status(201).json({ id: admin.id, email: admin.email, password_temp: password });
});

adminsRouter.delete("/:adminId", verifyToken, authorize("superadmin"), async (req, res) => {
  if (Number(req.params.adminId) === req.user.id) return res.status(400).json({ error: "No puedes desactivar tu propio usuario" });
  await prisma.user.update({
    where: { id: Number(req.params.adminId) },
    data: { estado: "inactivo", deletedAt: new Date() }
  });
  await prisma.audit.create({
    data: {
      userId: req.user.id,
      action: "admin_desactivado",
      entityType: "user",
      entityId: Number(req.params.adminId)
    }
  });
  return res.json({ success: true });
});
