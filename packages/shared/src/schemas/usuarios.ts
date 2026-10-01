import { z } from 'zod';
import { ZEmail, ZTimestamp } from './base';

// Rol enum (string para legibilidad)
export const ZRol = z.enum([
  'ADMIN',
  'TRANSPORTISTA',
  'CLIENTE',
  'OPERADOR',
  'AUDITOR',
]);

export type Rol = z.infer<typeof ZRol>;

// Permiso: acciones permitidas (scope: leer/escribir por recurso)
export const ZPermiso = z.enum([
  'leer:pedidos',
  'escribir:pedidos',
  'leer:tarifas',
  'escribir:tarifas',
  'leer:usuarios',
  'escribir:usuarios',
  'leer:proveedores',
  'escribir:proveedores',
  'leer:liquidaciones',
  'escribir:liquidaciones',
  'leer:proformas',
  'escribir:proformas',
  'admin:auditoría',
]);

export type Permiso = z.infer<typeof ZPermiso>;

// Usuario
export const ZUsuario = z.object({
  id: z.string(),
  email: ZEmail,
  nombre: z.string(),
  rol: ZRol,
  permisos: z.array(ZPermiso),
  activo: z.boolean(),
  fecha_creacion: ZTimestamp,
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type Usuario = z.infer<typeof ZUsuario>;
