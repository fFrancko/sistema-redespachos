import { z } from 'zod';
import { supplierStatusSchema } from '../enums.js';
import { controlFieldsShape, emailListSchema, percentSchema, refSchema } from '../primitives.js';

const CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

// 11 dígitos sin guiones y dígito verificador válido (módulo 11 de AFIP).
export function isValidCuit(cuit: string): boolean {
  if (!/^\d{11}$/.test(cuit)) return false;
  const sum = CUIT_WEIGHTS.reduce((acc, weight, index) => acc + weight * Number(cuit[index]), 0);
  const remainder = sum % 11;
  const expected = remainder === 0 ? 0 : 11 - remainder;
  // Si el cálculo da 10 no existe dígito que coincida: el CUIT es inválido.
  return expected === Number(cuit[10]);
}

// §2.2: mayúsculas y sin espacios.
const supplierIdSchema = z
  .string()
  .min(1)
  .refine(
    (value) => value === value.toUpperCase() && !/\s/.test(value),
    'id_proveedor debe estar en mayúsculas y sin espacios',
  );

const emailConfigSchema = z.object({
  plantilla_id: refSchema.optional(),
  para_extra: emailListSchema,
  cc: emailListSchema,
  cco: emailListSchema,
});

// Colección `proveedores` (§2.2). Id del documento: id_proveedor.
// La unicidad de CUIT y de alias entre proveedores no se valida acá (callable, transacción).
export const supplierSchema = z
  .object({
    id_proveedor: supplierIdSchema,
    razon_social: z.string().min(1),
    alias: z.array(z.string().min(1)).optional(),
    cuit: z.string().refine(isValidCuit, 'CUIT inválido: 11 dígitos con dígito verificador'),
    email_contacto: emailListSchema.min(1),
    telefono: z.string().min(1),
    estado: supplierStatusSchema,
    condicion_pago: z.string().min(1),
    iva_porcentaje: percentSchema,
    aplica_seguro: z.boolean(),
    porcentaje_seguro: percentSchema.optional(),
    email_config: emailConfigSchema.optional(),
    datos_adicionales: z.record(z.string(), z.string()).optional(),
    ...controlFieldsShape,
  })
  .superRefine((supplier, ctx) => {
    if (supplier.aplica_seguro && supplier.porcentaje_seguro === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['porcentaje_seguro'],
        message: 'porcentaje_seguro es obligatorio si aplica_seguro',
      });
    }
  });
export type Supplier = z.infer<typeof supplierSchema>;

// Colección `indice_cuit` (§2.1). Id del documento: CUIT sin guiones.
export const cuitIndexSchema = z.object({
  id_proveedor: refSchema,
});
export type CuitIndex = z.infer<typeof cuitIndexSchema>;
