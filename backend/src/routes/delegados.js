import { Router } from "express";
import multer from "multer";
import XLSX from "xlsx";
import { prisma } from "../db.js";
import { authorize, verifyToken } from "../middleware/auth.js";
import { assertExcelFile, pickClean } from "../utils/safeExcel.js";

const upload = multer({ dest: "uploads/", limits: { fileSize: 5 * 1024 * 1024 } });
export const delegadosRouter = Router();

delegadosRouter.get("/", verifyToken, async (req, res) => {
  const where = (req.user.role === "distrito" || req.user.role === "admin")
    ? { evento: { distritoId: req.user.distrito_id } }
    : {};
  const delegados = await prisma.delegado.findMany({
    where,
    include: { evento: { include: { distrito: true } }, comision: true, calificacion: true },
    orderBy: { nombre: "asc" }
  });
  return res.json(delegados);
});

delegadosRouter.post("/import", verifyToken, authorize("superadmin"), upload.single("file"), async (req, res) => {
  try {
    assertExcelFile(req.file);
    const workbook = XLSX.readFile(req.file.path, { cellFormula: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    let imported = 0;
    const errors = [];

    for (const [index, row] of rows.entries()) {
      try {
        const nombre = pickClean(row, ["Nombre", "Nombre Completo", "Delegado", "nombre"]);
        const designacion = pickClean(row, ["Delegacion", "Delegación", "Designacion", "Designación"]);
        const comisionNombre = pickClean(row, ["Comision", "Comisión", "Comite", "Comité"], 180);
        if (!nombre || !designacion || !comisionNombre) throw new Error("Columnas requeridas incompletas");

        const comision = await prisma.comision.findFirst({ where: { nombre: comisionNombre, eventoId: null } })
          || await prisma.comision.create({ data: { nombre: comisionNombre } });

        await prisma.delegado.create({ data: { nombre, designacion, comisionId: comision.id } });
        imported += 1;
      } catch (error) {
        errors.push({ row: index + 2, error: error.message });
      }
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
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});
