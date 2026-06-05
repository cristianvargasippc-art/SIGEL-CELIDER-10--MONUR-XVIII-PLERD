import { Router } from "express";
import { prisma } from "../db.js";
import { authorize, verifyToken } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { calificacionSchema, feedbackSchema } from "../schemas.js";
import { calcularPonderada } from "../utils/ponderada.js";
import { calificacionesLimiter } from "../middleware/rateLimit.js";

export const calificacionesRouter = Router();

async function assertCanGrade(user, delegadoId) {
  const delegado = await prisma.delegado.findUnique({ where: { id: delegadoId } });
  if (!delegado) return { error: [404, "Delegado no existe"] };
  if (user.role === "admin" && delegado.comisionId !== user.comision_id) {
    return { error: [403, "Delegado fuera de su comision"] };
  }
  return { delegado };
}

async function saveCalificacion(req, res, delegadoId, payload) {
  const permission = await assertCanGrade(req.user, delegadoId);
  if (permission.error) return res.status(permission.error[0]).json({ error: permission.error[1] });

  const existing = await prisma.calificacion.findUnique({ where: { delegadoId } });
  const data = {
    delegadoId,
    oratoria: payload.oratoria ?? existing?.oratoria,
    argumentacion: payload.argumentacion ?? existing?.argumentacion,
    negociacion: payload.negociacion ?? existing?.negociacion,
    liderazgo: payload.liderazgo ?? existing?.liderazgo,
    redaccion: payload.redaccion ?? existing?.redaccion,
    presenteEstado: payload.presente_estado ?? existing?.presenteEstado,
    pasaMinumeXvii: payload.pasa_minume_xvii ?? existing?.pasaMinumeXvii,
    mencion: payload.mencion ?? existing?.mencion,
    feedback: payload.feedback ?? existing?.feedback
  };
  data.ponderada = calcularPonderada(data);

  const saved = await prisma.calificacion.upsert({
    where: { delegadoId },
    update: data,
    create: data
  });

  await prisma.audit.create({
    data: {
      userId: req.user.id,
      action: existing ? "calificacion_editada" : "calificacion_creada",
      entityType: "calificacion",
      entityId: saved.id,
      changes: { before: existing, after: saved }
    }
  });

  return res.json(saved);
}

calificacionesRouter.post(
  "/",
  verifyToken,
  authorize("admin", "superadmin"),
  calificacionesLimiter,
  validate(calificacionSchema),
  async (req, res) => {
    return saveCalificacion(req, res, req.body.delegado_id, req.body);
  }
);

calificacionesRouter.patch("/:delegadoId", verifyToken, authorize("admin", "superadmin"), calificacionesLimiter, async (req, res) => {
  const payload = { ...req.body, delegado_id: Number(req.params.delegadoId) };
  const result = calificacionSchema.partial().required({ delegado_id: true }).safeParse(payload);
  if (!result.success) {
    return res.status(400).json({ error: "Datos invalidos", details: result.error.flatten() });
  }
  return saveCalificacion(req, res, result.data.delegado_id, result.data);
});

calificacionesRouter.post("/:delegadoId/feedback", verifyToken, authorize("admin", "superadmin"), validate(feedbackSchema), async (req, res) => {
  const delegadoId = Number(req.params.delegadoId);
  const permission = await assertCanGrade(req.user, delegadoId);
  if (permission.error) return res.status(permission.error[0]).json({ error: permission.error[1] });

  await prisma.calificacion.upsert({
    where: { delegadoId },
    update: { feedback: req.body.feedback },
    create: { delegadoId, feedback: req.body.feedback, ponderada: 0 }
  });
  await prisma.audit.create({
    data: {
      userId: req.user.id,
      action: "feedback_creado",
      entityType: "delegado",
      entityId: delegadoId,
      changes: { feedback: true }
    }
  });
  return res.json({ success: true });
});
