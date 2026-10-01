import { z } from 'zod';
import { ZDecimal, ZTimestamp, ZCodigoPostal } from './base';

// Tramo: intervalos de precio [min, max)
export const ZTramo = z.object({
  min: ZDecimal,
  max: ZDecimal,
  precio: ZDecimal,
});

export type Tramo = z.infer<typeof ZTramo>;

// Cobertura: por expreso + CP
export const ZCobertura = z.object({
  id: z.string(),
  expreso_id: z.string(), // ej. "hacha", "logicargo"
  codigo_postal: ZCodigoPostal,
  zona_destino: z.string(), // info label
  max_peso_kg: ZDecimal.refine(
    (val) => val.greaterThan(0),
    'max_peso_kg must be positive'
  ),
  es_encomienda: z.boolean(),
});

export type Cobertura = z.infer<typeof ZCobertura>;

// ReglaTarifa: nueva, sin herencia legacy
export const ZReglaTarifa = z.object({
  id: z.string(),
  expreso_id: z.string(),
  codigo_postal: ZCodigoPostal,
  zona_destino: z.string(),
  precio_kg_base: ZDecimal.refine(
    (val) => val.greaterThanOrEqualTo(0),
    'precio_kg_base must be non-negative'
  ),
  max_kg_incluido: ZDecimal.refine(
    (val) => val.greaterThan(0),
    'max_kg_incluido must be positive'
  ),
  precio_kg_excedente: ZDecimal.refine(
    (val) => val.greaterThanOrEqualTo(0),
    'precio_kg_excedente must be non-negative'
  ),
  vigencia_desde: ZTimestamp,
  vigencia_hasta: ZTimestamp.nullable().optional(),
});

export type ReglaTarifa = z.infer<typeof ZReglaTarifa>;
