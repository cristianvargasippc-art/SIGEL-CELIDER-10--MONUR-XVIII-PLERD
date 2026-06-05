import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../db.js";
import { authorize, verifyToken } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { adminSchema } from "../schemas.js";

export const adminsRouter = Router();

adminsRouter.get("/", verifyToken, authorize("superadmin"), async (_req, res) => {
  const admins = await prisma.user.findMany({
    where: { role: "admin", deletedAt: null },
    include: { comision: true },
    orderBy: { email: "asc" }
  });
  return res.json(admins);
});

adminsRouter.post("/", verifyToken, authorize("superadmin"), validate(adminSchema), async (req, res) => {
  const password = crypto.randomBytes(9).toString("base64").replace(/[+/=]/g, "A");
  const hash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 10));
  const admin = await prisma.user.create({
    data: {
      email: req.body.email,
      passwordHash: hash,
      role: "admin",
      comisionId: req.body.comision_id
    }
  });
  await prisma.audit.create({
    data: {
      userId: req.user.id,
      action: "admin_creado",
      entityType: "user",
      entityId: admin.id,
      changes: { email: admin.email, comision_id: admin.comisionId }
    }
  });
  return res.status(201).json({ id: admin.id, email: admin.email, password_temp: password });
});

adminsRouter.delete("/:adminId", verifyToken, authorize("superadmin"), async (req, res) => {
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
