import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { ruleTypeSchema, tariffStatusSchema } from '../enums.js';
import {
  controlFieldsShape,
  cpSchema,
  dateSchema,
  decSchema,
  refSchema,
  timestampSchema,
} from '../primitives.js';
import { checkVigencia } from './common.js';

// Colección `tarifarios` (§2.3): cabecera de versión por proveedor.
// archivo_origen_path, publicado_por y publicado_en son opcionales: un borrador aún no se publicó.
export const tariffSchema = z
  .object({
    id_proveedor: refSchema,
    version: z.number().int().min(1),
    vigencia_desde: dateSchema,
    vigencia_hasta: dateSchema.nullable(),
    estado: tariffStatusSchema,
    archivo_origen_path: z.string().min(1).optional(),
    publicado_por: refSchema.optional(),
    publicado_en: timestampSchema.optional(),
  })
  .superRefine(checkVigencia);
export type Tariff = z.infer<typeof tariffSchema>;

// Colección `reglas_tarifa` (§2.3): cada fila es un tramo `PESO` o `VOLUMEN` con `precio_tramo` fijo.
// El esquema valida una fila aislada; solapamientos y huecos entre tramos son de MVP-11.
// Reemplaza al `ReglaTarifa` de la herramienta externa: no hereda de ningún tipo previo.
export const tariffRuleSchema = z
  .object({
    tarifario_id: refSchema,
    id_proveedor: refSchema,
    tipo_regla: ruleTypeSchema,
    provincia_origen: z.string().min(1), // `*` = cualquier origen
    localidad_origen: z.string().min(1).optional(),
    provincia_destino: z.string().min(1),
    localidad_destino: z.string().min(1), // parte de variante_id y se muestra en las opciones
    codigo_postal_destino: cpSchema,
    zona_destino: z.string().min(1),
    plazo_estimado_dias: z.number().int().nonnegative().optional(),
    variante_id: z.string().min(1), // derivado: ver variantId()
    kg_min: decSchema.nullable(),
    kg_max: decSchema.nullable(),
    m3_min: decSchema.nullable(),
    m3_max: decSchema.nullable(),
    precio_tramo: decSchema,
    costo_base_viaje: decSchema,
    precio_kg_excedente: decSchema.optional(),
    precio_m3_excedente: decSchema.optional(),
    precio_bulto: decSchema.optional(),
    precio_pallet: decSchema.optional(),
    aplica_colecta: z.boolean(),
    costo_colecta: decSchema.optional(),
    vigencia_desde: dateSchema,
    vigencia_hasta: dateSchema.nullable(),
    estado: tariffStatusSchema,
    ...controlFieldsShape,
  })
  .superRefine((rule, ctx) => {
    const isWeight = rule.tipo_regla === 'PESO';
    const [usedMin, usedMax, unusedMin, unusedMax] = isWeight
      ? (['kg_min', 'kg_max', 'm3_min', 'm3_max'] as const)
      : (['m3_min', 'm3_max', 'kg_min', 'kg_max'] as const);

    for (const field of [usedMin, usedMax]) {
      if (rule[field] === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} es obligatorio si tipo_regla = ${rule.tipo_regla}`,
        });
      }
    }
    for (const field of [unusedMin, unusedMax]) {
      if (rule[field] !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} debe ser nulo si tipo_regla = ${rule.tipo_regla}`,
        });
      }
    }

    const min = rule[usedMin];
    const max = rule[usedMax];
    if (min !== null && max !== null && !new Decimal(min).lt(new Decimal(max))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [usedMax],
        message: `${usedMin} debe ser menor que ${usedMax}`,
      });
    }

    const unusedExcess = isWeight ? 'precio_m3_excedente' : 'precio_kg_excedente';
    if (rule[unusedExcess] !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [unusedExcess],
        message: `${unusedExcess} no aplica si tipo_regla = ${rule.tipo_regla}`,
      });
    }

    if (rule.aplica_colecta && rule.costo_colecta === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['costo_colecta'],
        message: 'costo_colecta es obligatorio si aplica_colecta',
      });
    }

    checkVigencia(rule, ctx);
  });
export type TariffRule = z.infer<typeof tariffRuleSchema>;
