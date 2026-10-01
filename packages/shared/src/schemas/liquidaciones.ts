import { z } from 'zod';
import Decimal from 'decimal.js';
import { ZDecimal, ZTimestamp } from './base';

// LineaLiquidacion: item dentro de una liquidación
export const ZLineaLiquidacion = z.object({
  proforma_id: z.string(),
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

export type LineaLiquidacion = z.infer<typeof ZLineaLiquidacion>;

// Liquidacion: factura/resumen al proveedor
export const ZLiquidacion = z
  .object({
    id: z.string(),
    numero: z.string(),
    proveedor_id: z.string(),
    fecha_inicio_periodo: ZTimestamp,
    fecha_fin_periodo: ZTimestamp,
    lineas: z.array(ZLineaLiquidacion),
    total_deuda: ZDecimal.refine(
      (val) => val.greaterThanOrEqualTo(0),
      'total_deuda must be non-negative'
    ),
    estado: z.enum(['PENDIENTE', 'PAGADA', 'PARCIAL']),
  })
  .refine(
    (data) => {
      const lineasTotal = data.lineas.reduce((sum, linea) => {
        return sum.plus(linea.subtotal);
      }, new Decimal(0));
      return lineasTotal.equals(data.total_deuda);
    },
    {
      message: 'total_deuda must equal sum of lineas subtotals',
      path: ['total_deuda'],
    }
  );

export type Liquidacion = z.infer<typeof ZLiquidacion>;
