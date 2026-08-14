import { Router } from "express";
import { prisma } from "../db.js";
import { authorize, verifyToken } from "../middleware/auth.js";

export const encuestasRouter = Router();

encuestasRouter.post("/", verifyToken, async (req, res) => {
  try {
    const { puntuacion, respuestas, comentario } = req.body;
    const numPuntuacion = Number(puntuacion);
    if (!numPuntuacion || numPuntuacion < 1 || numPuntuacion > 5) {
      return res.status(400).json({ error: "La puntuación debe ser un número entero entre 1 y 5." });
    }

    const nuevaEncuesta = await prisma.encuestaSatisfaccion.create({
      data: {
        userId: req.user.id,
        puntuacion: numPuntuacion,
        respuestas: respuestas || {},
        comentario: comentario ? String(comentario).trim() : null
      }
    });

    await prisma.audit.create({
      data: {
        userId: req.user.id,
        action: "encuesta_enviada",
        entityType: "encuesta_satisfaccion",
        entityId: nuevaEncuesta.id,
        changes: { puntuacion: numPuntuacion }
      }
    });

    return res.status(201).json({ success: true, data: nuevaEncuesta });
  } catch (error) {
    return res.status(500).json({ error: "Error interno al guardar la encuesta de satisfacción", detail: error.message });
  }
});

encuestasRouter.get("/", verifyToken, authorize("superadmin"), async (_req, res) => {
  try {
    const encuestas = await prisma.encuestaSatisfaccion.findMany({
      include: {
        user: {
          select: { id: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const total = encuestas.length;
    const promedio = total > 0 ? Number((encuestas.reduce((acc, curr) => acc + curr.puntuacion, 0) / total).toFixed(2)) : 0;
    const desglose = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    encuestas.forEach((e) => {
      if (desglose[e.puntuacion] !== undefined) desglose[e.puntuacion]++;
    });

    return res.json({
      encuestas,
      stats: {
        total,
        promedio,
        desglose
      }
    });
  } catch (error) {
    return res.status(500).json({ error: "Error interno al obtener las encuestas", detail: error.message });
  }
});
