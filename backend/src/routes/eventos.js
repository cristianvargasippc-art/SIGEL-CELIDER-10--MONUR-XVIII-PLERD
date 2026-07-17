import { Router } from "express";
import multer from "multer";
import XLSX from "xlsx";
import { prisma } from "../db.js";
import { authorize, verifyToken } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { delegadoSchema, eventoSchema } from "../schemas.js";
import { assertExcelFile, pickClean } from "../utils/safeExcel.js";

const upload = multer({ dest: "uploads/", limits: { fileSize: 5 * 1024 * 1024 } });
const DISTRITOS = ["10-01", "10-02", "10-03", "10-04", "10-05", "10-06", "10-07"];
const MAX_EVENTOS_DISTRITO = Number(process.env.MAX_EVENTOS_DISTRITO || 30);

export const eventosRouter = Router();

function scopeWhere(user) {
  if (user.role === "distrito" || user.role === "admin") return { distritoId: user.distrito_id };
  return {};
}

async function canAccessEvent(user, eventoId) {
  const evento = await prisma.evento.findUnique({ where: { id: eventoId } });
  if (!evento) return { error: [404, "Evento no existe"] };
  if ((user.role === "distrito" || user.role === "admin") && evento.distritoId !== user.distrito_id) {
    return { error: [403, "Evento fuera de tu distrito"] };
  }
  return { evento };
}

export async function ensureDistricts() {
  for (const codigo of DISTRITOS) {
    await prisma.distrito.upsert({
      where: { codigo },
      update: {},
      create: { codigo, nombre: `Distrito ${codigo}` }
    });
  }
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
    return res.status(400).json({ error: `Limite de ${MAX_EVENTOS_DISTRITO} eventos alcanzado para este distrito` });
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

    await prisma.$transaction([
      prisma.calificacion.deleteMany({
        where: { delegadoId: { in: delegadoIds } }
      }),
      prisma.delegado.deleteMany({
        where: { eventoId }
      }),
      prisma.comision.deleteMany({
        where: { eventoId }
      }),
      prisma.evento.delete({
        where: { id: eventoId }
      })
    ]);

    await prisma.audit.create({ data: { userId: req.user.id, action: "evento_eliminado", entityType: "evento", entityId: eventoId } });
    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting event:", error);
    return res.status(500).json({ error: "No se pudo eliminar el evento debido a dependencias activas." });
  }
});

eventosRouter.get("/:eventoId/delegados", verifyToken, authorize("superadmin", "regional", "distrito", "admin"), async (req, res) => {
  const eventoId = Number(req.params.eventoId);
  const permission = await canAccessEvent(req.user, eventoId);
  if (permission.error) return res.status(permission.error[0]).json({ error: permission.error[1] });
  const delegados = await prisma.delegado.findMany({
    where: { eventoId },
    include: { comision: true, calificacion: true },
    orderBy: [{ comisionId: "asc" }, { nombre: "asc" }]
  });
  return res.json(delegados);
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
  const delegado = await prisma.delegado.update({ where: { id: delegadoId }, data: { avanzaEtapa: Boolean(req.body.avanza) } });
  return res.json(delegado);
});

eventosRouter.post("/:eventoId/import/delegados", verifyToken, authorize("superadmin", "distrito"), upload.single("file"), async (req, res) => {
  try {
    assertExcelFile(req.file);
    const eventoId = Number(req.params.eventoId);
    const permission = await canAccessEvent(req.user, eventoId);
    if (permission.error) return res.status(permission.error[0]).json({ error: permission.error[1] });
    const workbook = XLSX.readFile(req.file.path, { cellFormula: false });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    console.log("Delegados parsed rows preview:", JSON.stringify(rows.slice(0, 3)));
    let imported = 0;
    const errors = [];
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
          const comision = await prisma.comision.findFirst({
            where: {
              nombre: comisionNombre,
              eventoId
            }
          });
          if (!comision) {
            throw new Error(`La comisión '${comisionNombre}' no existe en este evento. Debe crearla primero o subir la comisión en el paso 1.`);
          }
          comisionId = comision.id;
        }

        await prisma.delegado.create({
          data: {
            nombre,
            apellido,
            eventoId,
            comisionId,
            asistencia: "presente_votando"
          }
        });
        imported += 1;
      } catch (error) {
        errors.push({ row: index + 2, error: error.message });
      }
    }
    
    await prisma.audit.create({
      data: {
        userId: req.user.id,
        action: "excel_delegados_importados",
        entityType: "evento",
        entityId: eventoId,
        changes: { imported_count: imported, error_count: errors.length }
      }
    });

    return res.json({ imported_count: imported, errors });
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
    const workbook = XLSX.readFile(req.file.path, { cellFormula: false });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    console.log("Comisiones parsed rows preview:", JSON.stringify(rows.slice(0, 3)));
    let imported = 0;
    const errors = [];
    for (const [index, row] of rows.entries()) {
      try {
        const nombre = pickClean(row, ["Comisiones", "Comision", "Comisión", "Comite", "Comité", "comisiones"], 180);
        if (!nombre) throw new Error("Columna comisiones requerida");
        await prisma.comision.upsert({
          where: { nombre_eventoId: { nombre, eventoId } },
          update: {},
          create: { nombre, eventoId }
        });
        imported += 1;
      } catch (error) {
        errors.push({ row: index + 2, error: error.message });
      }
    }

    await prisma.audit.create({
      data: {
        userId: req.user.id,
        action: "excel_comisiones_importadas",
        entityType: "evento",
        entityId: eventoId,
        changes: { imported_count: imported, error_count: errors.length }
      }
    });

    return res.json({ imported_count: imported, errors });
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

    await prisma.$transaction([
      prisma.calificacion.deleteMany({ where: { delegadoId: { in: delegadoIds } } }),
      prisma.delegado.deleteMany({ where: { eventoId } })
    ]);

    await prisma.audit.create({ data: { userId: req.user.id, action: "excel_delegados_limpiados", entityType: "evento", entityId: eventoId } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

eventosRouter.delete("/:eventoId/comisiones", verifyToken, authorize("superadmin", "distrito"), async (req, res) => {
  try {
    const eventoId = Number(req.params.eventoId);
    const permission = await canAccessEvent(req.user, eventoId);
    if (permission.error) return res.status(permission.error[0]).json({ error: permission.error[1] });

    const delegados = await prisma.delegado.findMany({ where: { eventoId }, select: { id: true } });
    const delegadoIds = delegados.map((d) => d.id);

    await prisma.$transaction([
      prisma.calificacion.deleteMany({ where: { delegadoId: { in: delegadoIds } } }),
      prisma.delegado.deleteMany({ where: { eventoId } }),
      prisma.comision.deleteMany({ where: { eventoId } })
    ]);

    await prisma.audit.create({ data: { userId: req.user.id, action: "excel_comisiones_limpiadas", entityType: "evento", entityId: eventoId } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

eventosRouter.patch("/:eventoId/comisiones/:comisionId", verifyToken, authorize("superadmin", "distrito"), async (req, res) => {
  try {
    const eventoId = Number(req.params.eventoId);
    const comisionId = Number(req.params.comisionId);
    const permission = await canAccessEvent(req.user, eventoId);
    if (permission.error) return res.status(permission.error[0]).json({ error: permission.error[1] });

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
    return res.status(500).json({ error: error.message });
  }
});

eventosRouter.post("/:eventoId/asignar", verifyToken, authorize("superadmin", "distrito"), async (req, res) => {
  const eventoId = Number(req.params.eventoId);
  const permission = await canAccessEvent(req.user, eventoId);
  if (permission.error) return res.status(permission.error[0]).json({ error: permission.error[1] });
  const comisionId = Number(req.body.comision_id);
  const modo = req.body.modo === "duplas" ? "duplas" : "individual";
  const paises = Array.isArray(req.body.paises) ? req.body.paises.map((p) => String(p).trim()).filter(Boolean) : [];
  const comision = await prisma.comision.findUnique({ where: { id: comisionId } });
  if (!comision || comision.eventoId !== eventoId) return res.status(404).json({ error: "Comision no existe en este evento" });
  const esCorte = /corte internacional de justicia|cij/i.test(comision.nombre);
  if (!esCorte && paises.length === 0) return res.status(400).json({ error: "Selecciona paises para asignar" });
  const delegados = await prisma.delegado.findMany({ where: { eventoId, comisionId, asistencia: "presente_votando" }, orderBy: { nombre: "asc" } });
  const shuffled = [...paises].sort(() => Math.random() - 0.5);
  const updates = [];
  for (let index = 0; index < delegados.length; index += 1) {
    const grupo = modo === "duplas" ? Math.floor(index / 2) : index;
    let primerApellido = "";
    if (delegados[index].apellido) {
      primerApellido = delegados[index].apellido.trim().split(/\s+/)[0];
    } else {
      primerApellido = delegados[index].nombre.trim().split(/\s+/)[0];
    }
    const designacion = esCorte ? `Su Excelencia ${primerApellido}` : shuffled[grupo % shuffled.length];
    updates.push(prisma.delegado.update({ where: { id: delegados[index].id }, data: { designacion, asignacionGrupo: `${modo}-${grupo + 1}` } }));
  }
  await prisma.$transaction([prisma.comision.update({ where: { id: comisionId }, data: { modoAsignacion: modo } }), ...updates]);
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
