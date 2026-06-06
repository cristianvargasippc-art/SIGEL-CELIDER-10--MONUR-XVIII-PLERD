import { Router } from "express";
import multer from "multer";
import XLSX from "xlsx";
import { prisma } from "../db.js";
import { authorize, verifyToken } from "../middleware/auth.js";
import { getPublished } from "./config.js";

const upload = multer({ dest: "uploads/", limits: { fileSize: 5 * 1024 * 1024 } });
export const delegadosRouter = Router();

delegadosRouter.get("/", verifyToken, async (req, res) => {
  const where = req.user.role === "admin" ? { comisionId: req.user.comision_id } : {};
  const delegados = await prisma.delegado.findMany({
    where,
    include: { comision: true, calificacion: true },
    orderBy: { nombre: "asc" }
  });
  return res.json(delegados);
});

delegadosRouter.get("/search", async (req, res) => {
  if (!(await getPublished())) return res.status(403).json({ error: "Calificaciones no publicadas" });
  const q = String(req.query.q || "");
  const delegados = await prisma.delegado.findMany({
    where: { nombre: { contains: q } },
    include: { comision: true, calificacion: true },
    take: 20,
    orderBy: { nombre: "asc" }
  });
  return res.json(delegados);
});

delegadosRouter.post("/import", verifyToken, authorize("superadmin"), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Archivo requerido" });
  const workbook = XLSX.readFile(req.file.path);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);
  let imported = 0;
  const errors = [];

  for (const row of rows) {
    const nombre = row.Nombre || row.nombre || row.Delegado || row.delegado;
    const designacion = row.Delegacion || row["Delegación"] || row.Designacion || row["Designación"];
    const comisionNombre = row.Comision || row["Comisión"] || row.Comite || row["Comité"];

    if (!nombre || !designacion || !comisionNombre) {
      errors.push({ row, error: "Columnas requeridas incompletas" });
      continue;
    }

    const comision = await prisma.comision.upsert({
      where: { nombre: String(comisionNombre) },
      update: {},
      create: { nombre: String(comisionNombre) }
    });

    await prisma.delegado.create({
      data: {
        nombre: String(nombre),
        designacion: String(designacion),
        comisionId: comision.id
      }
    });
    imported += 1;
  }

  await prisma.audit.create({
    data: {
      userId: req.user.id,
      action: "delegados_importados",
      entityType: "delegados",
      changes: { imported, errors: errors.length }
    }
  });

  return res.json({ imported_count: imported, errors });
});
