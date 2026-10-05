import { z } from 'zod';
import { attachmentColumnSchema, attachmentFormatSchema, emailStatusSchema } from '../enums.js';
import { emailListSchema, refSchema } from '../primitives.js';

// Colección `plantillas_email` (§2.5): estructura parametrizable de la proforma.
export const emailTemplateSchema = z.object({
  nombre: z.string().min(1),
  asunto: z.string().min(1),
  cuerpo_html: z.string().min(1), // Handlebars; el catálogo de variables lo valida la callable
  columnas_adjunto: z.array(attachmentColumnSchema),
  formato_adjunto: attachmentFormatSchema,
  para_extra: emailListSchema,
  cc: emailListSchema,
  cco: emailListSchema,
  es_default: z.boolean(),
});
export type EmailTemplate = z.infer<typeof emailTemplateSchema>;

// Colección `emails_salida` (§2.5): outbox de correos. También lo usan los avisos internos
// (solicitudes de acceso y de CP), que no tienen proforma ni adjunto: por eso son opcionales.
export const outboundEmailSchema = z.object({
  para: emailListSchema,
  cc: emailListSchema,
  cco: emailListSchema,
  asunto: z.string().min(1),
  cuerpo_html: z.string(),
  adjunto_path: z.string().min(1).optional(),
  proforma_id: refSchema.optional(),
  estado: emailStatusSchema,
  intentos: z.number().int().min(0).max(3),
  ultimo_error: z.string().optional(),
});
export type OutboundEmail = z.infer<typeof outboundEmailSchema>;
