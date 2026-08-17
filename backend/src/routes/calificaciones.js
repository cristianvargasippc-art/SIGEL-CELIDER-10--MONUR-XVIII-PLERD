import { Router } from "express";
import { prisma } from "../db.js";
import { authorize, verifyToken } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { calificacionSchema, calificacionesBulkSchema, feedbackSchema } from "../schemas.js";
import { calcularPonderada } from "../utils/ponderada.js";
import { calificacionesLimiter } from "../middleware/rateLimit.js";

export const calificacionesRouter = Router();

const SCORE_FIELDS = ["oratoria", "argumentacion", "negociacion", "liderazgo", "redaccion"];

function hasCalificacionContent(data) {
  return SCORE_FIELDS.some((field) => data[field] !== null && data[field] !== undefined)
    || Boolean(data.presenteEstado)
    || data.pasaMinumeXvii === true
    || Boolean(data.mencion)
    || Boolean(data.feedback);
}

async function assertCanGrade(user, delegadoId) {
  const cleanId = Number(delegadoId);
  if (!cleanId || isNaN(cleanId) || cleanId <= 0) {
    return { error: [400, "Identificador de delegado no valido"] };
  }
  const delegado = await prisma.delegado.findUnique({ where: { id: cleanId }, include: { evento: true } });
  if (!delegado) return { error: [404, "Delegado no existe"] };
  if (["distrito", "admin"].includes(user.role) && delegado.evento?.distritoId !== user.distrito_id) {
    return { error: [403, "Delegado fuera de tu distrito"] };
  }
  if (user.role === "admin" && user.comision_id && delegado.comisionId !== user.comision_id) {
    return { error: [403, "Delegado fuera de tu comision"] };
  }
  const onlyAttendance = Object.keys(user.payload || {}).every((key) => key === "presente_estado" || key === "delegado_id");
  if (!onlyAttendance && delegado.asistencia === "ausente") {
    return { error: [400, "El delegado ausente no puede ser calificado"] };
  }
  return { delegado, cleanId };
}

async function persistCalificacion(user, delegadoId, payload, { audit = true } = {}) {
  user.payload = payload;
  const permission = await assertCanGrade(user, delegadoId);
  if (permission.error) {
    const error = new Error(permission.error[1]);
    error.status = permission.error[0];
    throw error;
  }

  const cleanId = permission.cleanId;
  const existing = await prisma.calificacion.findUnique({ where: { delegadoId: cleanId } });

  const sanitizeScore = (val, max, label) => {
    if (val === undefined) return null;
    if (val === null || val === "") return null;
    const num = Number(val);
    if (!Number.isFinite(num) || num < 0) {
      throw new Error(`${label} debe ser un numero entre 0 y ${max}.`);
    }
    if (num > max) {
      throw new Error(`${label} no puede pasar de ${max} puntos.`);
    }
    if (Math.abs(num * 100 - Math.round(num * 100)) >= 1e-9) {
      throw new Error(`${label} puede tener hasta dos decimales.`);
    }
    return Number(num.toFixed(2));
  };

  const data = {
    delegadoId: cleanId,
    oratoria: payload.oratoria !== undefined ? sanitizeScore(payload.oratoria, 15, "Oratoria") : (existing?.oratoria ?? null),
    argumentacion: payload.argumentacion !== undefined ? sanitizeScore(payload.argumentacion, 25, "Argumentacion") : (existing?.argumentacion ?? null),
    negociacion: payload.negociacion !== undefined ? sanitizeScore(payload.negociacion, 20, "Negociacion") : (existing?.negociacion ?? null),
    liderazgo: payload.liderazgo !== undefined ? sanitizeScore(payload.liderazgo, 15, "Liderazgo") : (existing?.liderazgo ?? null),
    redaccion: payload.redaccion !== undefined ? sanitizeScore(payload.redaccion, 25, "Redaccion") : (existing?.redaccion ?? null),
    presenteEstado: payload.presente_estado ?? existing?.presenteEstado ?? null,
    pasaMinumeXvii: payload.pasa_minume_xvii ?? existing?.pasaMinumeXvii ?? false,
    mencion: payload.mencion !== undefined && payload.mencion !== null ? String(payload.mencion).trim() : (existing?.mencion ?? null),
    feedback: payload.feedback !== undefined && payload.feedback !== null ? String(payload.feedback).trim() : (existing?.feedback ?? null)
  };

  data.ponderada = calcularPonderada(data);

  if (!existing && !hasCalificacionContent(data)) {
    return data;
  }

  const saved = await prisma.calificacion.upsert({
    where: { delegadoId: cleanId },
    update: data,
    create: data
  });

  if (audit) try {
    await prisma.audit.create({
      data: {
        userId: user.id,
        action: existing ? "calificacion_editada" : "calificacion_creada",
        entityType: "calificacion",
        entityId: saved.id,
        changes: { before: existing, after: saved }
      }
    });
  } catch (_auditErr) {}

  return saved;
}

async function saveCalificacion(req, res, delegadoId, payload) {
  try {
    const saved = await persistCalificacion(req.user, delegadoId, payload);
    return res.json(saved);
  } catch (error) {
    return res.status(error.status || 400).json({ error: "No se pudo guardar la calificacion debido a un formato no valido.", detail: error.message });
  }
}

calificacionesRouter.post(
  "/",
  verifyToken,
  authorize("admin", "superadmin"),
  calificacionesLimiter,
  validate(calificacionSchema),
  async (req, res) => {
    try {
      return await saveCalificacion(req, res, req.body.delegado_id, req.body);
    } catch (err) {
      return res.status(400).json({ error: "Error en los datos de calificacion enviados.", detail: err.message });
    }
  }
);

calificacionesRouter.post(
  "/bulk",
  verifyToken,
  authorize("admin", "superadmin"),
  calificacionesLimiter,
  validate(calificacionesBulkSchema),
  async (req, res) => {
    try {
      const saved = [];
      for (const payload of req.body.calificaciones) {
        saved.push(await persistCalificacion(req.user, payload.delegado_id, payload, { audit: false }));
      }
      try {
        await prisma.audit.create({
          data: {
            userId: req.user.id,
            action: "calificaciones_guardadas",
            entityType: "calificacion",
            changes: { count: saved.length }
          }
        });
      } catch (_auditErr) {}
      return res.json({ success: true, count: saved.length, calificaciones: saved });
    } catch (err) {
      return res.status(err.status || 400).json({ error: "No se pudieron guardar las calificaciones.", detail: err.message });
    }
  }
);

calificacionesRouter.patch("/:delegadoId", verifyToken, authorize("admin", "superadmin"), calificacionesLimiter, async (req, res) => {
  try {
    const rawId = Number(req.params.delegadoId);
    if (!rawId || isNaN(rawId)) {
      return res.status(400).json({ error: "ID de delegado no valido." });
    }
    const payload = { ...req.body, delegado_id: rawId };
    const result = calificacionSchema.partial().required({ delegado_id: true }).safeParse(payload);
    if (!result.success) {
      return res.status(400).json({
        error: result.error.issues?.[0]?.message || "Datos invalidos",
        details: result.error.flatten()
      });
    }
    return await saveCalificacion(req, res, result.data.delegado_id, result.data);
  } catch (err) {
    return res.status(400).json({ error: "Error procesando actualizacion de calificacion.", detail: err.message });
  }
});

calificacionesRouter.delete("/:delegadoId", verifyToken, authorize("admin", "superadmin"), async (req, res) => {
  try {
    const delegadoId = Number(req.params.delegadoId);
    if (!delegadoId || isNaN(delegadoId)) {
      return res.status(400).json({ error: "ID de delegado no valido." });
    }
    const permission = await assertCanGrade(req.user, delegadoId);
    if (permission.error) return res.status(permission.error[0]).json({ error: permission.error[1] });

    const existing = await prisma.calificacion.findUnique({ where: { delegadoId } });
    if (!existing) return res.json({ success: true });

    await prisma.calificacion.delete({ where: { delegadoId } });

    try {
      await prisma.audit.create({
        data: {
          userId: req.user.id,
          action: "calificacion_eliminada",
          entityType: "calificacion",
          entityId: existing.id,
          changes: { before: existing, after: null }
        }
      });
    } catch (_auditErr) {}

    return res.json({ success: true });
  } catch (err) {
    return res.status(400).json({ error: "No se pudo eliminar la calificacion.", detail: err.message });
  }
});

calificacionesRouter.post("/:delegadoId/feedback", verifyToken, authorize("admin", "superadmin"), validate(feedbackSchema), async (req, res) => {
  try {
    const delegadoId = Number(req.params.delegadoId);
    if (!delegadoId || isNaN(delegadoId)) {
      return res.status(400).json({ error: "ID de delegado no valido." });
    }
    const permission = await assertCanGrade(req.user, delegadoId);
    if (permission.error) return res.status(permission.error[0]).json({ error: permission.error[1] });

    await prisma.calificacion.upsert({
      where: { delegadoId },
      update: { feedback: String(req.body.feedback).trim() },
      create: { delegadoId, feedback: String(req.body.feedback).trim(), ponderada: 0 }
    });

    try {
      await prisma.audit.create({
        data: {
          userId: req.user.id,
          action: "feedback_creado",
          entityType: "delegado",
          entityId: delegadoId,
          changes: { feedback: true }
        }
      });
    } catch (_auditErr) {}

    return res.json({ success: true });
  } catch (err) {
    return res.status(400).json({ error: "No se pudo registrar el comentario o feedback.", detail: err.message });
  }
});
