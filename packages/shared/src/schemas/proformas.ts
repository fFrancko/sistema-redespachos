import { z } from 'zod';
import Decimal from 'decimal.js';
import { ZDecimal, ZTimestamp } from './base';

// LineaProforma: item dentro de una proforma
export const ZLineaProforma = z.object({
  linea_pedido_id: z.string(),
  descripcion: z.string(),
  cantidad: z.number().int().positive(),
  precio_unitario: ZDecimal.refine(
    (val) => val.greaterThanOrEqualTo(0),
    'precio_unitario must be non-negative'
  ),
  subtotal: ZDecimal.refine(
    (val) => val.greaterThanOrEqualTo(0),
    'subtotal must be non-negative'
  ),
});

export type LineaProforma = z.infer<typeof ZLineaProforma>;

// Proforma: cotización de expreso
export const ZProforma = z
  .object({
    id: z.string(),
    numero: z.string(),
    pedido_id: z.string(),
    proveedor_id: z.string(),
    fecha_emision: ZTimestamp,
    vigencia_hasta: ZTimestamp,
    lineas: z.array(ZLineaProforma),
    total: ZDecimal.refine(
      (val) => val.greaterThanOrEqualTo(0),
      'total must be non-negative'
    ),
    moneda: z.string().default('ARS'),
    estado: z.enum(['EMITIDA', 'ACEPTADA', 'RECHAZADA']),
  })
  .refine(
    (data) => {
      const lineasTotal = data.lineas.reduce((sum, linea) => {
        return sum.plus(linea.subtotal);
      }, new Decimal(0));
      return lineasTotal.equals(data.total);
    },
    {
      message: 'Total must equal sum of lineas subtotals',
      path: ['total'],
    }
  );

export type Proforma = z.infer<typeof ZProforma>;
