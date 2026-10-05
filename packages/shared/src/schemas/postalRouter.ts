import { z } from 'zod';
import { cpSchema, refSchema, timestampSchema } from '../primitives.js';
import { cpRequestOriginSchema, cpRequestStatusSchema } from '../enums.js';

// Colección `canalizador_cp` (§2.5). Id: `{cp}_{localidad_normalizada}`.
// `cobertura_qx` es booleano acá (derivado de subzona); en `pedidos.canalizador` es el enum SI | NO | DESCONOCIDA.
export const postalRouterEntrySchema = z.object({
  cp: cpSchema,
  localidad: z.string(),
  provincia: z.string(),
  partido: z.string(),
  zona: z.string(),
  cabecera: z.string(),
  subzona: z.string(),
  zona_tarifario: z.string(),
  cobertura_qx: z.boolean(),
  version: z.number().int().min(1),
});
export type PostalRouterEntry = z.infer<typeof postalRouterEntrySchema>;

// Colección `solicitudes_cp` (§2.5). Id: cp.
// `referencia_id` y `origen` son los de la primera aparición; `referencias` es acumulativo e incluye la primera.
export const cpRequestSchema = z
  .object({
    cp: cpSchema,
    localidad: z.string(),
    provincia: z.string(),
    origen: cpRequestOriginSchema,
    referencia_id: refSchema,
    referencias: z.array(refSchema).min(1),
    estado: cpRequestStatusSchema,
    creado_en: timestampSchema,
    resuelta_en: timestampSchema.nullable(),
  })
  .superRefine((request, ctx) => {
    if (!request.referencias.includes(request.referencia_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['referencias'],
        message: 'referencias debe incluir a referencia_id (la primera aparición)',
      });
    }
  });
export type CpRequest = z.infer<typeof cpRequestSchema>;
