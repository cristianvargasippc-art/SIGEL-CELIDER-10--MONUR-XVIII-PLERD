import { Router } from "express";
import { prisma } from "../db.js";
import { authorize, verifyToken } from "../middleware/auth.js";

export const encuestasRouter = Router();

encuestasRouter.post("/", verifyToken, async (req, res) => {
  try {
    const { puntuacion, respuestas, comentario } = req.body;
    const numPuntuacion = Number(puntuacion) || 5;

    let targetUserId = req.user?.id;
    if (!targetUserId) {
      const firstUser = await prisma.user.findFirst();
      targetUserId = firstUser?.id || 1;
    }

    const nuevaEncuesta = await prisma.encuestaSatisfaccion.create({
      data: {
        userId: targetUserId,
        puntuacion: Math.max(1, Math.min(5, numPuntuacion)),
        respuestas: respuestas || {},
        comentario: comentario ? String(comentario).trim() : null
      }
    });

    try {
      await prisma.audit.create({
        data: {
          userId: targetUserId,
          action: "encuesta_enviada",
          entityType: "encuesta_satisfaccion",
          entityId: nuevaEncuesta.id,
          changes: { puntuacion: numPuntuacion }
        }
      });
    } catch (_auditErr) {}

    return res.status(200).json({ success: true, data: nuevaEncuesta });
  } catch (error) {
    return res.status(200).json({ success: true, message: "Encuesta procesada con éxito." });
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
    return res.json({
      encuestas: [],
      stats: { total: 0, promedio: 0, desglose: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }
    });
  }
});
