import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { authorize, verifyToken } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { adminSchema } from "../schemas.js";

export const adminsRouter = Router();

adminsRouter.get("/comisiones", verifyToken, authorize("superadmin", "distrito"), async (req, res) => {
  const where = req.user.role === "distrito"
    ? { evento: { distritoId: req.user.distrito_id } }
    : {};
  const comisiones = await prisma.comision.findMany({
    where,
    include: { evento: { include: { distrito: true } } },
    orderBy: [{ eventoId: "desc" }, { nombre: "asc" }]
  });
  return res.json(comisiones);
});

adminsRouter.get("/", verifyToken, authorize("superadmin", "distrito"), async (req, res) => {
  const where = req.user.role === "distrito"
    ? { role: "admin", distritoId: req.user.distrito_id, deletedAt: null }
    : { role: { in: ["regional", "distrito", "admin"] }, deletedAt: null };
  const admins = await prisma.user.findMany({
    where,
    include: { comision: true, distrito: true },
    orderBy: { email: "asc" }
  });
  return res.json(admins);
});

adminsRouter.post("/", verifyToken, authorize("superadmin", "distrito"), validate(adminSchema), async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (existing && !existing.deletedAt && existing.estado === "activo") {
    return res.status(409).json({ error: "Ya existe un usuario activo con ese correo" });
  }
  const password = req.body.password || Math.random().toString(36).slice(2, 12) + "A1";
  const hash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 10));
  const role = req.user.role === "distrito" ? "admin" : req.body.role || "distrito";
  let distritoId = req.user.role === "distrito" ? req.user.distrito_id : req.body.distrito_id || null;
  const comisionId = req.body.comision_id || null;

  if (role === "admin" && !comisionId) {
    return res.status(400).json({ error: "La mesa directiva debe estar asociada a una comisión cargada." });
  }
  if (comisionId) {
    const comision = await prisma.comision.findUnique({ where: { id: comisionId }, include: { evento: true } });
    if (!comision) return res.status(404).json({ error: "Comisión no existe" });
    if (role === "admin" && !comision.evento) {
      return res.status(400).json({ error: "La mesa directiva debe usar una comisión cargada dentro de un evento." });
    }
    if (req.user.role === "distrito" && comision.evento?.distritoId !== req.user.distrito_id) {
      return res.status(403).json({ error: "No puedes asignar mesas a comisiones de otro distrito" });
    }
    if (role === "admin") distritoId = comision.evento.distritoId;
  }

  let admin;
  if (existing) {
    admin = await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: hash,
        role,
        distritoId,
        comisionId,
        deletedAt: null,
        estado: "activo"
      }
    });
  } else {
    admin = await prisma.user.create({
      data: {
        email: req.body.email,
        passwordHash: hash,
        role,
        distritoId,
        comisionId,
        deletedAt: null,
        estado: "activo"
      }
    });
  }

  await prisma.audit.create({
    data: {
      userId: req.user.id,
      action: existing ? "admin_reactivado" : "admin_creado",
      entityType: "user",
      entityId: admin.id,
      changes: { email: admin.email, role, distrito_id: admin.distritoId, comision_id: admin.comisionId, password_definida: Boolean(req.body.password) }
    }
  });
  return res.status(existing ? 200 : 201).json({ id: admin.id, email: admin.email, password_temp: password });
});



adminsRouter.delete("/:adminId", verifyToken, authorize("superadmin", "distrito"), async (req, res) => {
  const adminId = Number(req.params.adminId);
  if (!Number.isInteger(adminId) || adminId <= 0) return res.status(400).json({ error: "Usuario inválido" });
  if (adminId === req.user.id) return res.status(400).json({ error: "No puedes desactivar tu propio usuario" });
  if (req.user.role === "distrito") {
    const target = await prisma.user.findUnique({ where: { id: adminId } });
    if (!target || target.role !== "admin" || target.distritoId !== req.user.distrito_id) {
      return res.status(403).json({ error: "Solo puedes desactivar mesas directivas de tu distrito" });
    }
  }
  await prisma.user.update({
    where: { id: adminId },
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
