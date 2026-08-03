import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const calificacionSchema = z.object({
  delegado_id: z.number().int().positive(),
  oratoria: z.number().int().min(0).max(15).nullable().optional(),
  argumentacion: z.number().int().min(0).max(25).nullable().optional(),
  negociacion: z.number().int().min(0).max(20).nullable().optional(),
  liderazgo: z.number().int().min(0).max(15).nullable().optional(),
  redaccion: z.number().int().min(0).max(25).nullable().optional(),
  presente_estado: z.enum(["presente_votando", "ausente"]).optional(),
  pasa_minume_xvii: z.boolean().optional(),
  mencion: z.string().max(500).optional(),
  feedback: z.string().max(500).optional()
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
