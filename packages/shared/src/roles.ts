import { z } from 'zod';

// D21. COMERCIAL se suma en la Fase 2. No hay enum de permisos: la matriz de §3.1 la aplican
// las reglas de seguridad y las callables.
export const ROLES = [
  'ADMIN',
  'ATENCION_PROVEEDOR',
  'ANALISTA',
  'BACKOFFICE',
  'ADMINISTRACION',
] as const;

export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;
