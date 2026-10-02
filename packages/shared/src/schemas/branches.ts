import { z } from 'zod';

// Colección `sucursales` (§2.1, §2.5). El id del documento es norm(cabecera_origen).
export const branchSchema = z.object({
  cabecera_origen: z.string().min(1), // nombre tal cual figura en el TMS
  activa: z.boolean(),
});
export type Branch = z.infer<typeof branchSchema>;
