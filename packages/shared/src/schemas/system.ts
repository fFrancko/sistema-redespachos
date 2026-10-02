import { z } from 'zod';
import {
  decSchema,
  emailListSchema,
  percentSchema,
  refSchema,
  timestampSchema,
} from '../primitives';

// Colección `auditoria` (§2.5). Solo la escribe el backend (withAudit).
export const auditEntrySchema = z.object({
  entidad: z.string().min(1),
  entidad_id: refSchema,
  accion: z.string().min(1),
  usuario: refSchema,
  antes: z.record(z.string(), z.unknown()).nullable(),
  despues: z.record(z.string(), z.unknown()).nullable(),
  timestamp: timestampSchema,
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

const purchaseOrderConstantsSchema = z.object({
  moneda: z.string().min(1),
  moneda_cotizacion: z.string().min(1),
  cotizacion: decSchema,
  preciosobre: decSchema,
  workflow: z.string().min(1),
  cantidad_por_pedido: z.number().int().positive(),
});

// Colección `parametros`, documento `global` (§2.5).
export const paramsSchema = z.object({
  condiciones_pago: z.array(z.string().min(1)),
  tolerancia_volumen_pct: percentSchema,
  email_cdg: emailListSchema,
  origen_estricto: z.boolean(),
  oc_constantes: purchaseOrderConstantsSchema,
  formato_fecha_oc: z.string().min(1),
});
export type Params = z.infer<typeof paramsSchema>;
