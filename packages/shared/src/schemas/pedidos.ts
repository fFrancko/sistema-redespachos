import { z } from 'zod';
import { ZDecimal, ZTimestamp, ZCodigoPostal } from './base';

// EstadoPedido enum (string para legibilidad en logs/DB)
export const ZEstadoPedido = z.enum([
  'PENDIENTE',
  'COTIZADO',
  'REVISADO',
  'CANCELADO',
  'REDESPACHO_PENDIENTE',
  'REDESPACHO_EN_PROCESO',
  'REDESPACHO_COMPLETADO',
  'ENTREGADO',
]);

export type EstadoPedido = z.infer<typeof ZEstadoPedido>;

// LineaPedido: item dentro de un pedido
export const ZLineaPedido = z.object({
  pedido_id: z.string(),
  numero_linea: z.number().int().positive(),
  descripcion: z.string(),
  peso_kg: ZDecimal.refine(
    (val) => val.greaterThan(0),
    'peso_kg must be positive'
  ),
  cantidad: z.number().int().positive(),
  valor_unitario: ZDecimal.refine(
    (val) => val.greaterThanOrEqualTo(0),
    'valor_unitario must be non-negative'
  ).nullable(),
});

export type LineaPedido = z.infer<typeof ZLineaPedido>;

// Pedido: orden de envío
export const ZPedido = z.object({
  id: z.string(),
  numero_expediente: z.string(),
  cliente_id: z.string(),
  fecha_creacion: ZTimestamp,
  codigo_postal_destino: ZCodigoPostal,
  origen: z.string().default('Buenos Aires'),
  origen_estricto: z.boolean().default(true),
  peso_total_kg: ZDecimal.refine(
    (val) => val.greaterThan(0),
    'peso_total_kg must be positive'
  ),
  volumen_m3: ZDecimal.refine(
    (val) => val.greaterThan(0),
    'volumen_m3 must be positive'
  ).nullable().optional(),
  valor_declarado: ZDecimal.refine(
    (val) => val.greaterThanOrEqualTo(0),
    'valor_declarado must be non-negative'
  ).nullable().optional(),
  requiere_redespacho: z.boolean().default(false),
  estado: ZEstadoPedido,
  expreso_seleccionado_id: z.string().nullable().optional(),
  precio_final_cotizado: ZDecimal.refine(
    (val) => val.greaterThanOrEqualTo(0),
    'precio_final_cotizado must be non-negative'
  ).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type Pedido = z.infer<typeof ZPedido>;
