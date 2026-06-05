import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const calificacionSchema = z.object({
  delegado_id: z.number().int().positive(),
  oratoria: z.number().int().min(0).max(15).optional(),
  argumentacion: z.number().int().min(0).max(25).optional(),
  negociacion: z.number().int().min(0).max(20).optional(),
  liderazgo: z.number().int().min(0).max(15).optional(),
  redaccion: z.number().int().min(0).max(25).optional(),
  presente_estado: z.enum(["presente_votando", "presente_ausente"]).optional(),
  pasa_minume_xvii: z.boolean().optional(),
  mencion: z.string().max(500).optional(),
  feedback: z.string().max(500).optional()
});

export const feedbackSchema = z.object({
  feedback: z.string().max(500)
});

export const adminSchema = z.object({
  email: z.string().email(),
  comision_id: z.number().int().positive().optional()
});

export const publishSchema = z.object({
  publish: z.boolean()
});
