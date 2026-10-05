import { z } from 'zod';
import { proformaStatusSchema, responseSchema } from '../enums.js';
import { centsSchema, dateSchema, refSchema, timestampSchema } from '../primitives.js';

// Colección `proformas` (§2.5): una por proveedor y lote, con totales congelados al enviar.
export const proformaSchema = z.object({
  lote_id: refSchema,
  id_proveedor: refSchema,
  pedido_ids: z.array(refSchema),
  totales: z.object({
    cantidad: z.number().int().nonnegative(),
    neto: centsSchema,
    iva: centsSchema,
    total: centsSchema,
  }),
  plantilla_id: refSchema,
  email_id: refSchema,
  adjunto_path: z.string().min(1),
  enviada_por: refSchema,
  enviada_en: timestampSchema,
  estado: proformaStatusSchema,
});
export type Proforma = z.infer<typeof proformaSchema>;

// Colección `respuestas_proveedor` (§2.5): respuesta registrada por Atención al Proveedor.
// El control por oposición (registrado_por distinto de enviada_por) necesita la proforma: lo hace la callable.
export const supplierResponseSchema = z
  .object({
    proforma_id: refSchema,
    pedidos: z.array(
      z.object({
        pedido_id: refSchema,
        resultado: responseSchema,
      }),
    ),
    justificacion: z.string().min(1).optional(),
    evidencia_paths: z.array(z.string().min(1)).min(1),
    fecha_respuesta: dateSchema,
    registrado_por: refSchema,
    registrado_en: timestampSchema,
  })
  .superRefine((response, ctx) => {
    const hasRejection = response.pedidos.some((pedido) => pedido.resultado === 'RECHAZA');
    if (hasRejection && response.justificacion === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['justificacion'],
        message: 'justificacion es obligatoria si algún pedido es RECHAZA',
      });
    }
  });
export type SupplierResponse = z.infer<typeof supplierResponseSchema>;
