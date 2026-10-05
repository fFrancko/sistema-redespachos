import { z } from 'zod';
import { batchStatusSchema } from '../enums.js';
import { dateSchema } from '../primitives.js';

const countSchema = z.number().int().nonnegative();

// Colección `lotes_importacion` (§2.5).
export const importBatchSchema = z.object({
  sucursal_id: z.string().min(1), // `MULTIPLE` si el archivo mezcla cabeceras
  archivo_path: z.string().min(1),
  fecha_referencia: dateSchema,
  total_filas: countSchema,
  validas: countSchema,
  con_error: countSchema,
  sin_cobertura: countSchema,
  cobertura_qx: countSchema,
  estado: batchStatusSchema,
});
export type ImportBatch = z.infer<typeof importBatchSchema>;
