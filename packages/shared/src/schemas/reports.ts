import { z } from 'zod';
import { reportStatusSchema } from '../enums.js';
import { centsSchema, refSchema, timestampSchema } from '../primitives.js';

const countSchema = z.number().int().nonnegative();

// Colección `reportes_liquidacion` (§2.5, §3.5). `archivo_path` aparece cuando el reporte pasa a LISTO.
export const settlementReportSchema = z.object({
  generado_por: refSchema,
  generado_en: timestampSchema,
  filtros: z.record(z.string(), z.unknown()),
  cantidad_pedidos: countSchema,
  total_neto_cents: centsSchema,
  total_cents: centsSchema,
  numero: z.number().int().min(1), // correlativo
  archivo_path: z.string().min(1).optional(),
  estado: reportStatusSchema,
});
export type SettlementReport = z.infer<typeof settlementReportSchema>;

// Colección `reportes_oc` (§2.5, §3.6). El estado no tiene valores en §2.5: se usa el de reportes_liquidacion.
export const purchaseOrderReportSchema = z.object({
  generado_por: refSchema,
  generado_en: timestampSchema,
  cantidad_pedidos: countSchema,
  cantidad_oc: countSchema,
  total_cents: centsSchema,
  archivo_path: z.string().min(1).optional(),
  estado: reportStatusSchema,
});
export type PurchaseOrderReport = z.infer<typeof purchaseOrderReportSchema>;
