import { Router } from "express";
import { prisma } from "../db.js";
import { authorize, verifyToken } from "../middleware/auth.js";

export const auditRouter = Router();

auditRouter.get("/", verifyToken, authorize("superadmin"), async (req, res) => {
  const where = {};
  if (req.query.user_id) where.userId = Number(req.query.user_id);
  if (req.query.action) where.action = String(req.query.action);
  if (req.query.date_from || req.query.date_to) {
    where.createdAt = {};
    if (req.query.date_from) where.createdAt.gte = new Date(String(req.query.date_from));
    if (req.query.date_to) where.createdAt.lte = new Date(String(req.query.date_to));
  }
  const audits = await prisma.audit.findMany({
    where,
    include: { user: { select: { email: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  return res.json(audits);
});
