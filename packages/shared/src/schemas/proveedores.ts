import { z } from 'zod';
import { ZEmail, ZTimestamp, ZDecimal, ZCodigoPostal } from './base';

// Proveedor
export const ZProveedor = z.object({
  id: z.string(),
  nombre: z.string(),
  email: ZEmail,
  telefono: z.string(),
  activo: z.boolean(),
  fecha_creacion: ZTimestamp,
});

export type Proveedor = z.infer<typeof ZProveedor>;

// CoberturaPorExpreso: relación Proveedor → zonas cubiertas
export const ZCoberturaPorExpreso = z.object({
  proveedor_id: z.string(),
  expreso_id: z.string(), // ej. "hacha", "logicargo"
  zonas_cubiertas: z.array(ZCodigoPostal),
  max_peso_kg: ZDecimal.refine(
    (val) => val.greaterThan(0),
    'max_peso_kg must be positive'
  ),
});

export type CoberturaPorExpreso = z.infer<typeof ZCoberturaPorExpreso>;
