import { Router } from "express";
import { prisma } from "../db.js";
import { rankingLimiter } from "../middleware/rateLimit.js";
import { getPublished } from "./config.js";

export const rankingRouter = Router();

rankingRouter.use(rankingLimiter);

rankingRouter.get("/comisiones", async (_req, res) => {
  if (!(await getPublished())) return res.status(403).json({ error: "Calificaciones no publicadas" });
  const comisiones = await prisma.comision.findMany({ orderBy: { nombre: "asc" } });
  return res.json(comisiones);
});

rankingRouter.get("/general", async (_req, res) => {
  if (!(await getPublished())) return res.status(403).json({ error: "Calificaciones no publicadas" });
  const rows = await prisma.delegado.findMany({
    include: { comision: true, calificacion: true },
    orderBy: { calificacion: { ponderada: "desc" } }
  });
  return res.json(rows.map((row, index) => ({ posicion: index + 1, ...row })));
});

rankingRouter.get("/comision/:comisionId", async (req, res) => {
  if (!(await getPublished())) return res.status(403).json({ error: "Calificaciones no publicadas" });
  const rows = await prisma.delegado.findMany({
    where: { comisionId: Number(req.params.comisionId) },
    include: { comision: true, calificacion: true },
    orderBy: { calificacion: { ponderada: "desc" } }
  });
  return res.json(rows.map((row, index) => ({ posicion: index + 1, ...row })));
});
