import { z } from "zod";

const hasAtMostTwoDecimals = (num) => Math.abs(num * 100 - Math.round(num * 100)) < 1e-9;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const calificacionSchema = z.object({
  delegado_id: z.number().int().positive(),
  oratoria: z.number().min(0, "Oratoria no puede ser negativa.").max(15, "Oratoria no puede pasar de 15 puntos.").refine(hasAtMostTwoDecimals, "Oratoria puede tener hasta dos decimales.").nullable().optional(),
  argumentacion: z.number().min(0, "Argumentacion no puede ser negativa.").max(25, "Argumentacion no puede pasar de 25 puntos.").refine(hasAtMostTwoDecimals, "Argumentacion puede tener hasta dos decimales.").nullable().optional(),
  negociacion: z.number().min(0, "Negociacion no puede ser negativa.").max(20, "Negociacion no puede pasar de 20 puntos.").refine(hasAtMostTwoDecimals, "Negociacion puede tener hasta dos decimales.").nullable().optional(),
  liderazgo: z.number().min(0, "Liderazgo no puede ser negativo.").max(15, "Liderazgo no puede pasar de 15 puntos.").refine(hasAtMostTwoDecimals, "Liderazgo puede tener hasta dos decimales.").nullable().optional(),
  redaccion: z.number().min(0, "Redaccion no puede ser negativa.").max(25, "Redaccion no puede pasar de 25 puntos.").refine(hasAtMostTwoDecimals, "Redaccion puede tener hasta dos decimales.").nullable().optional(),
  presente_estado: z.enum(["presente_votando", "ausente"]).optional(),
  pasa_minume_xvii: z.boolean().optional(),
  mencion: z.string().max(500).optional(),
  feedback: z.string().max(500).optional()
});

export const calificacionesBulkSchema = z.object({
  calificaciones: z.array(calificacionSchema).min(1).max(500)
});

export const feedbackSchema = z.object({
  feedback: z.string().max(500)
});

export const adminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100).optional(),
  role: z.enum(["regional", "distrito", "admin"]).optional(),
  distrito_id: z.number().int().positive().optional(),
  comision_id: z.number().int().positive().optional()
});

export const publishSchema = z.object({
  publish: z.boolean()
});

export const eventoSchema = z.object({
  nombre: z.string().trim().min(3).max(180),
  fecha: z.string().datetime().optional().or(z.string().date().optional()),
  distrito_id: z.number().int().positive().optional()
});

export const delegadoSchema = z.object({
  nombre: z.string().trim().min(2).max(255),
  designacion: z.string().trim().max(255).optional(),
  apellido: z.string().trim().max(120).optional(),
  evento_id: z.number().int().positive(),
  comision_id: z.number().int().positive().optional()
});
