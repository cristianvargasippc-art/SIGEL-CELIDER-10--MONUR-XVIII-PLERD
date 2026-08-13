import { Router } from "express";
import multer from "multer";
import XLSX from "xlsx";
import { prisma } from "../db.js";
import { authorize, verifyToken } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { delegadoSchema, eventoSchema } from "../schemas.js";
import { assertExcelFile, pickClean } from "../utils/safeExcel.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const DISTRITOS = ["10-01", "10-02", "10-03", "10-04", "10-05", "10-06", "10-07"];
const MAX_EVENTOS_DISTRITO = Number(process.env.MAX_EVENTOS_DISTRITO || 30);

export const eventosRouter = Router();

function scopeWhere(user) {
  if (user.role === "distrito" || user.role === "admin") return { distritoId: user.distrito_id };
  return {};
}

async function canAccessEvent(user, eventoId) {
  if (!Number.isInteger(eventoId) || eventoId <= 0) return { error: [400, "Evento invalido"] };
  const evento = await prisma.evento.findUnique({ where: { id: eventoId } });
  if (!evento) return { error: [404, "Evento no existe"] };
  if ((user.role === "distrito" || user.role === "admin") && evento.distritoId !== user.distrito_id) {
    return { error: [403, "Evento fuera de tu distrito"] };
  }
  return { evento };
}

async function findDelegadoInEvent(eventoId, delegadoId) {
  if (!Number.isInteger(delegadoId) || delegadoId <= 0) return null;
  return prisma.delegado.findFirst({ where: { id: delegadoId, eventoId } });
}

let districtsEnsured = false;

export async function ensureDistricts() {
  if (districtsEnsured) return;
  const count = await prisma.distrito.count();
  if (count >= DISTRITOS.length) {
    districtsEnsured = true;
    return;
  }
  for (const codigo of DISTRITOS) {
    await prisma.distrito.upsert({
      where: { codigo },
      update: {},
      create: { codigo, nombre: `Distrito ${codigo}` }
    });
  }
  districtsEnsured = true;
}

eventosRouter.get("/distritos", verifyToken, authorize("superadmin", "regional", "distrito", "admin"), async (_req, res) => {
  await ensureDistricts();
  const distritos = await prisma.distrito.findMany({ orderBy: { codigo: "asc" } });
  return res.json(distritos);
});

eventosRouter.get("/", verifyToken, authorize("superadmin", "regional", "distrito", "admin"), async (req, res) => {
  await ensureDistricts();
  const eventos = await prisma.evento.findMany({
    where: scopeWhere(req.user),
    include: {
      distrito: true,
      _count: { select: { delegados: true, comisiones: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  return res.json(eventos);
});

eventosRouter.post("/", verifyToken, authorize("superadmin", "distrito"), validate(eventoSchema), async (req, res) => {
  await ensureDistricts();
  const distritoId = req.user.role === "distrito" ? req.user.distrito_id : req.body.distrito_id;
  if (!distritoId) return res.status(400).json({ error: "Distrito requerido" });

  const count = await prisma.evento.count({ where: { distritoId } });
  if (count >= MAX_EVENTOS_DISTRITO) {
    return res.status(400).json({ error: `Límite de ${MAX_EVENTOS_DISTRITO} eventos alcanzado para este distrito` });
  }

  const evento = await prisma.evento.create({
    data: {
      nombre: req.body.nombre,
      fecha: req.body.fecha ? new Date(req.body.fecha) : null,
      distritoId,
      createdById: req.user.id
    },
    include: { distrito: true }
  });
  await prisma.audit.create({ data: { userId: req.user.id, action: "evento_creado", entityType: "evento", entityId: evento.id } });
  return res.status(201).json(evento);
});

eventosRouter.delete("/:eventoId", verifyToken, authorize("superadmin", "distrito"), async (req, res) => {
  const eventoId = Number(req.params.eventoId);
  const permission = await canAccessEvent(req.user, eventoId);
  if (permission.error) return res.status(permission.error[0]).json({ error: permission.error[1] });
  
  try {
    const delegados = await prisma.delegado.findMany({
      where: { eventoId },
      select: { id: true }
    });
    const delegadoIds = delegados.map((d) => d.id);
    const comisiones = await prisma.comision.findMany({
      where: { eventoId },
      select: { id: true }
    });
    const comisionIds = comisiones.map((c) => c.id);

    const transactionSteps = [];
    if (comisionIds.length > 0) {
      transactionSteps.push(
        prisma.user.updateMany({
          where: { comisionId: { in: comisionIds } },
          data: { comisionId: null }
        })
      );
    }
    if (delegadoIds.length > 0) {
      transactionSteps.push(
        prisma.calificacion.deleteMany({
          where: { delegadoId: { in: delegadoIds } }
        })
      );
    }
    transactionSteps.push(prisma.delegado.deleteMany({ where: { eventoId } }));
    transactionSteps.push(prisma.comision.deleteMany({ where: { eventoId } }));
    transactionSteps.push(prisma.evento.delete({ where: { id: eventoId } }));

    await prisma.$transaction(transactionSteps);

    await prisma.audit.create({ data: { userId: req.user.id, action: "evento_eliminado", entityType: "evento", entityId: eventoId } });
    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting event:", error);
    return res.status(400).json({ error: error.message || "No se pudo eliminar el evento." });
  }
});

eventosRouter.get("/:eventoId/delegados", verifyToken, authorize("superadmin", "regional", "distrito", "admin"), async (req, res) => {
  const eventoId = Number(req.params.eventoId);
  const permission = await canAccessEvent(req.user, eventoId);
  if (permission.error) return res.status(permission.error[0]).json({ error: permission.error[1] });
  const where = req.user.role === "admin" && req.user.comision_id
    ? { eventoId, comisionId: req.user.comision_id }
    : { eventoId };
  const delegados = await prisma.delegado.findMany({
    where,
    include: { comision: true, calificacion: true },
    orderBy: [{ comisionId: "asc" }, { nombre: "asc" }]
  });
  return res.json(delegados);
});

eventosRouter.get("/:eventoId/comisiones", verifyToken, authorize("superadmin", "regional", "distrito", "admin"), async (req, res) => {
  const eventoId = Number(req.params.eventoId);
  const permission = await canAccessEvent(req.user, eventoId);
  if (permission.error) return res.status(permission.error[0]).json({ error: permission.error[1] });
  const comisiones = await prisma.comision.findMany({
    where: { eventoId },
    orderBy: { nombre: "asc" }
  });
  return res.json(comisiones);
});

eventosRouter.post("/:eventoId/delegados", verifyToken, authorize("superadmin", "distrito"), validate(delegadoSchema), async (req, res) => {
  const eventoId = Number(req.params.eventoId);
  const permission = await canAccessEvent(req.user, eventoId);
  if (permission.error) return res.status(permission.error[0]).json({ error: permission.error[1] });
  if (eventoId !== req.body.evento_id) return res.status(400).json({ error: "Evento inconsistente" });
  const delegado = await prisma.delegado.create({
    data: {
      nombre: req.body.nombre,
      designacion: req.body.designacion || null,
      apellido: req.body.apellido || null,
      eventoId,
      comisionId: req.body.comision_id || null
    },
    include: { comision: true, calificacion: true }
  });
  return res.status(201).json(delegado);
});

eventosRouter.patch("/:eventoId/asistencia/:delegadoId", verifyToken, authorize("superadmin", "distrito", "admin"), async (req, res) => {
  const eventoId = Number(req.params.eventoId);
  const delegadoId = Number(req.params.delegadoId);
  const estado = req.body.estado;
  if (!["presente_votando", "ausente"].includes(estado)) return res.status(400).json({ error: "Estado invalido" });
  const permission = await canAccessEvent(req.user, eventoId);
  if (permission.error) return res.status(permission.error[0]).json({ error: permission.error[1] });
  const existing = await findDelegadoInEvent(eventoId, delegadoId);
  if (!existing) return res.status(404).json({ error: "Delegado no existe en este evento" });
  const delegado = await prisma.delegado.update({ where: { id: delegadoId }, data: { asistencia: estado } });
  await prisma.calificacion.upsert({
    where: { delegadoId },
    update: { presenteEstado: estado },
    create: { delegadoId, presenteEstado: estado, ponderada: 0 }
  });
  return res.json(delegado);
});

eventosRouter.patch("/:eventoId/avanza/:delegadoId", verifyToken, authorize("superadmin", "distrito", "admin"), async (req, res) => {
  const eventoId = Number(req.params.eventoId);
  const delegadoId = Number(req.params.delegadoId);
  const permission = await canAccessEvent(req.user, eventoId);
  if (permission.error) return res.status(permission.error[0]).json({ error: permission.error[1] });
  const existing = await findDelegadoInEvent(eventoId, delegadoId);
  if (!existing) return res.status(404).json({ error: "Delegado no existe en este evento" });
  const VALID_ETAPAS = ["no", "distrital", "regional", "minume"];
  const etapa = VALID_ETAPAS.includes(req.body.avanza) ? req.body.avanza : "no";
  const avanza = etapa !== "no";
  await prisma.delegado.update({ where: { id: delegadoId }, data: { avanzaEtapa: avanza } });
  // Store the specific stage label in the calificacion record
  await prisma.calificacion.upsert({
    where: { delegadoId },
    update: { pasaMinumeXvii: etapa === "minume", feedback: `etapa:${etapa}` },
    create: { delegadoId, pasaMinumeXvii: etapa === "minume", ponderada: 0, feedback: `etapa:${etapa}` }
  });
  return res.json({ id: delegadoId, avanzaEtapa: avanza, etapa });
});

eventosRouter.post("/:eventoId/import/delegados", verifyToken, authorize("superadmin", "distrito"), upload.single("file"), async (req, res) => {
  try {
    assertExcelFile(req.file);
    const eventoId = Number(req.params.eventoId);
    const permission = await canAccessEvent(req.user, eventoId);
    if (permission.error) return res.status(permission.error[0]).json({ error: permission.error[1] });
    const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellFormula: false });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    const errors = [];
    const comisiones = await prisma.comision.findMany({ where: { eventoId } });
    const comisionByName = new Map(comisiones.map((c) => [c.nombre.toLowerCase().trim(), c]));
    const delegates = [];
    for (const [index, row] of rows.entries()) {
      try {
        const nombreCompleto = pickClean(row, ["Nombre Completo", "Nombre", "Delegado", "nombre"], 255);
        const comisionNombre = pickClean(row, ["Comision", "Comisión", "comision", "comisión", "Comite", "Comité"], 180);

        if (!nombreCompleto) throw new Error("Nombre es requerido");

        let nombre = nombreCompleto.trim();
        let apellido = pickClean(row, ["Apellido", "apellido"], 120) || "";

        // Dividir el nombre completo de forma inteligente respetando costumbres de nombres en español
        if (!apellido) {
          const parts = nombreCompleto.trim().split(/\s+/);
          if (parts.length === 2) {
            nombre = parts[0];
            apellido = parts[1];
          } else if (parts.length === 3) {
            nombre = parts[0];
            apellido = parts.slice(1).join(" "); // Primer y segundo apellido
          } else if (parts.length >= 4) {
            nombre = parts.slice(0, 2).join(" "); // Primer y segundo nombre
            apellido = parts.slice(2).join(" "); // Primer y segundo apellido
          }
        }

        // Buscar comisión si está especificada en la fila
        let comisionId = null;
        if (comisionNombre) {
          const comision = comisionByName.get(comisionNombre.toLowerCase().trim());
          if (!comision) {
            throw new Error(`La comisión '${comisionNombre}' no existe en este evento. Debe crearla primero o subir la comisión en el paso 1.`);
          }
          comisionId = comision.id;
        }

        delegates.push({ nombre, apellido, eventoId, comisionId, asistencia: "presente_votando" });
      } catch (error) {
        errors.push({ row: index + 2, error: error.message });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: "El archivo contiene filas invalidas. No se importo ningun delegado.", imported_count: 0, errors });
    }

    const importResult = delegates.length
      ? await prisma.delegado.createMany({ data: delegates })
      : { count: 0 };
    
    await prisma.audit.create({
      data: {
        userId: req.user.id,
        action: "excel_delegados_importados",
        entityType: "evento",
        entityId: eventoId,
        changes: { imported_count: importResult.count, error_count: 0 }
      }
    });

    return res.json({ imported_count: importResult.count, errors: [] });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

eventosRouter.post("/:eventoId/import/comisiones", verifyToken, authorize("superadmin", "distrito"), upload.single("file"), async (req, res) => {
  try {
    assertExcelFile(req.file);
    const eventoId = Number(req.params.eventoId);
    const permission = await canAccessEvent(req.user, eventoId);
    if (permission.error) return res.status(permission.error[0]).json({ error: permission.error[1] });
    const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellFormula: false });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    const errors = [];
    const nombres = new Set();
    for (const [index, row] of rows.entries()) {
      try {
        const nombre = pickClean(row, ["Comisiones", "Comision", "Comisión", "Comite", "Comité", "comisiones"], 180);
        if (!nombre) throw new Error("Columna comisiones requerida");
        nombres.add(nombre);
      } catch (error) {
        errors.push({ row: index + 2, error: error.message });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: "El archivo contiene filas invalidas. No se importo ninguna comision.", imported_count: 0, errors });
    }

    await prisma.$transaction([...nombres].map((nombre) => prisma.comision.upsert({
      where: { nombre_eventoId: { nombre, eventoId } },
      update: {},
      create: { nombre, eventoId }
    })));

    await prisma.audit.create({
      data: {
        userId: req.user.id,
        action: "excel_comisiones_importadas",
        entityType: "evento",
        entityId: eventoId,
        changes: { imported_count: nombres.size, error_count: 0 }
      }
    });

    return res.json({ imported_count: nombres.size, errors: [] });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

eventosRouter.delete("/:eventoId/delegados", verifyToken, authorize("superadmin", "distrito"), async (req, res) => {
  try {
    const eventoId = Number(req.params.eventoId);
    const permission = await canAccessEvent(req.user, eventoId);
    if (permission.error) return res.status(permission.error[0]).json({ error: permission.error[1] });

    const delegados = await prisma.delegado.findMany({ where: { eventoId }, select: { id: true } });
    const delegadoIds = delegados.map((d) => d.id);

    const transactionSteps = [];
    if (delegadoIds.length > 0) {
      transactionSteps.push(
        prisma.calificacion.deleteMany({ where: { delegadoId: { in: delegadoIds } } })
      );
    }
    transactionSteps.push(prisma.delegado.deleteMany({ where: { eventoId } }));

    await prisma.$transaction(transactionSteps);

    await prisma.audit.create({ data: { userId: req.user.id, action: "excel_delegados_limpiados", entityType: "evento", entityId: eventoId } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo limpiar los delegados." });
  }
});

eventosRouter.delete("/:eventoId/comisiones", verifyToken, authorize("superadmin", "distrito"), async (req, res) => {
  try {
    const eventoId = Number(req.params.eventoId);
    const permission = await canAccessEvent(req.user, eventoId);
    if (permission.error) return res.status(permission.error[0]).json({ error: permission.error[1] });

    const delegados = await prisma.delegado.findMany({ where: { eventoId }, select: { id: true } });
    const delegadoIds = delegados.map((d) => d.id);
    const comisiones = await prisma.comision.findMany({ where: { eventoId }, select: { id: true } });
    const comisionIds = comisiones.map((c) => c.id);

    const transactionSteps = [];
    if (comisionIds.length > 0) {
      transactionSteps.push(
        prisma.user.updateMany({ where: { comisionId: { in: comisionIds } }, data: { comisionId: null } })
      );
    }
    if (delegadoIds.length > 0) {
      transactionSteps.push(
        prisma.calificacion.deleteMany({ where: { delegadoId: { in: delegadoIds } } })
      );
    }
    transactionSteps.push(prisma.delegado.deleteMany({ where: { eventoId } }));
    transactionSteps.push(prisma.comision.deleteMany({ where: { eventoId } }));

    await prisma.$transaction(transactionSteps);

    await prisma.audit.create({ data: { userId: req.user.id, action: "excel_comisiones_limpiadas", entityType: "evento", entityId: eventoId } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo limpiar las comisiones." });
  }
});

eventosRouter.patch("/:eventoId/comisiones/:comisionId", verifyToken, authorize("superadmin", "distrito"), async (req, res) => {
  try {
    const eventoId = Number(req.params.eventoId);
    const comisionId = Number(req.params.comisionId);
    const permission = await canAccessEvent(req.user, eventoId);
    if (permission.error) return res.status(permission.error[0]).json({ error: permission.error[1] });
    if (!Number.isInteger(comisionId) || comisionId <= 0) return res.status(400).json({ error: "Comisión inválida" });

    const modo = req.body.modo === "duplas" ? "duplas" : "individual";
    await prisma.comision.update({ where: { id: comisionId }, data: { modoAsignacion: modo } });

    await prisma.audit.create({
      data: {
        userId: req.user.id,
        action: "comision_modo_actualizado",
        entityType: "comision",
        entityId: comisionId,
        changes: { modo }
      }
    });

    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo actualizar la comisión." });
  }
});

eventosRouter.post("/:eventoId/asignar", verifyToken, authorize("superadmin", "distrito"), async (req, res) => {
  const eventoId = Number(req.params.eventoId);
  const permission = await canAccessEvent(req.user, eventoId);
  if (permission.error) return res.status(permission.error[0]).json({ error: permission.error[1] });
  const comisionId = Number(req.body.comision_id);
  const modo = req.body.modo === "duplas" ? "duplas" : "individual";
  const paises = Array.isArray(req.body.paises) ? req.body.paises.map((p) => String(p).trim()).filter(Boolean) : [];
  const cantidad = req.body.cantidad ? Number(req.body.cantidad) : null;
  if (!Number.isInteger(comisionId) || comisionId <= 0) return res.status(400).json({ error: "Comisión requerida" });
  if (cantidad !== null && (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 500)) {
    return res.status(400).json({ error: "Cantidad inválida" });
  }
  if (paises.some((pais) => pais.length > 120)) return res.status(400).json({ error: "País inválido" });

  const comision = await prisma.comision.findUnique({ where: { id: comisionId } });
  if (!comision || comision.eventoId !== eventoId) return res.status(404).json({ error: "Comisión no existe en este evento" });

  const esCorte = /corte internacional de justicia|cij/i.test(comision.nombre);
  if (!esCorte && paises.length === 0) return res.status(400).json({ error: "Selecciona países para asignar" });

  const allDelegados = await prisma.delegado.findMany({
    where: {
      eventoId,
      OR: [
        { comisionId },
        { comisionId: null }
      ]
    },
    orderBy: { id: "asc" }
  });
  const sinAsignar = allDelegados.filter((d) => !d.designacion || d.designacion.trim() === "");
  const toAssign = cantidad ? sinAsignar.slice(0, cantidad) : sinAsignar;
  if (cantidad && cantidad > sinAsignar.length) {
    return res.status(400).json({ error: `Solo hay ${sinAsignar.length} delegado(s) sin asignar en esta comisión.` });
  }

  if (toAssign.length === 0) {
    return res.status(400).json({ error: "Todos los delegados de esta comisión ya tienen país asignado." });
  }

  // Validar cantidad de países requeridos para la asignación
  const requiredCountries = esCorte ? 0 : (modo === "duplas" ? Math.ceil(toAssign.length / 2) : toAssign.length);
  if (!esCorte && paises.length < requiredCountries) {
    return res.status(400).json({ error: `Se requieren al menos ${requiredCountries} países para asignar ${toAssign.length} delegados en modo ${modo}.` });
  }

  // Obtener el número de grupo máximo ya asignado en esta comisión para el modo actual para evitar colisiones
  const comisionDelegados = allDelegados.filter((d) => d.comisionId === comisionId);
  let maxGrupo = 0;
  for (const d of comisionDelegados) {
    if (d.asignacionGrupo && d.asignacionGrupo.startsWith(`${modo}-`)) {
      const parts = d.asignacionGrupo.split("-");
      if (parts.length === 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num) && num > maxGrupo) {
          maxGrupo = num;
        }
      }
    }
  }

  const shuffled = [...paises].sort(() => Math.random() - 0.5);
  const updates = [];
  for (let index = 0; index < toAssign.length; index += 1) {
    const batchGrupo = modo === "duplas" ? Math.floor(index / 2) : index;
    const grupo = maxGrupo + batchGrupo;
    let primerApellido = "";
    if (toAssign[index].apellido) {
      primerApellido = toAssign[index].apellido.trim().split(/\s+/)[0];
    } else {
      primerApellido = toAssign[index].nombre.trim().split(/\s+/)[0];
    }
    const designacion = esCorte ? `Su Excelencia ${primerApellido}` : shuffled[batchGrupo % shuffled.length];
    updates.push(prisma.delegado.update({
      where: { id: toAssign[index].id },
      data: { comisionId, designacion, asignacionGrupo: `${modo}-${grupo + 1}` }
    }));
  }
  await prisma.$transaction([
    prisma.comision.update({ where: { id: comisionId }, data: { modoAsignacion: modo } }),
    ...updates
  ]);
  return res.json({ assigned_count: updates.length });
});

eventosRouter.get("/reportes/regional", verifyToken, authorize("superadmin", "regional"), async (_req, res) => {
  const eventos = await prisma.evento.findMany({
    include: { distrito: true, delegados: true, comisiones: true },
    orderBy: { fecha: "desc" }
  });
  const data = eventos.map((evento) => ({
    id: evento.id,
    distrito: evento.distrito.codigo,
    evento: evento.nombre,
    fecha: evento.fecha,
    delegados: evento.delegados.length,
    avanzan: evento.delegados.filter((delegado) => delegado.avanzaEtapa).length,
    comisiones: evento.comisiones.length
  }));
  return res.json(data);
});
