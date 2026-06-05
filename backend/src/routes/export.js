import { Router } from "express";
import XLSX from "xlsx";
import { prisma } from "../db.js";
import { verifyToken } from "../middleware/auth.js";

export const exportRouter = Router();

exportRouter.get("/excel", verifyToken, async (req, res) => {
  const where = req.user.role === "admin" ? { comisionId: req.user.comision_id } : {};
  const rows = await prisma.delegado.findMany({
    where,
    include: { comision: true, calificacion: true },
    orderBy: { nombre: "asc" }
  });
  const data = rows.map((row) => ({
    Nombre: row.nombre,
    Designacion: row.designacion,
    Comision: row.comision.nombre,
    Oratoria: row.calificacion?.oratoria,
    Argumentacion: row.calificacion?.argumentacion,
    Negociacion: row.calificacion?.negociacion,
    Liderazgo: row.calificacion?.liderazgo,
    Redaccion: row.calificacion?.redaccion,
    Ponderada: row.calificacion?.ponderada,
    Mencion: row.calificacion?.mencion,
    "Pasa MINUME XVII": row.calificacion?.pasaMinumeXvii ? "Si" : "No",
    Feedback: row.calificacion?.feedback
  }));
  const sheet = XLSX.utils.json_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Calificaciones");
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Disposition", "attachment; filename=SIGEL_MONUR_XVIII_R10.xlsx");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  return res.send(buffer);
});
