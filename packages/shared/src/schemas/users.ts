import { z } from 'zod';
import { userStatusSchema, accessRequestStatusSchema } from '../enums.js';
import { controlFieldsShape, emailSchema, refSchema, timestampSchema } from '../primitives.js';
import { roleSchema } from '../roles.js';

// Colección `usuarios` (§2.1). El id del documento es el uid de Auth.
// La arquitectura solo dice "Perfil, rol, sucursales asignadas, estado": los campos son un supuesto.
export const userSchema = z.object({
  email: emailSchema,
  nombre: z.string().min(1),
  rol: roleSchema,
  sucursales: z.array(refSchema), // ids de `sucursales` = norm(cabecera_origen)
  estado: userStatusSchema,
  ...controlFieldsShape,
});
export type User = z.infer<typeof userSchema>;

// Colección `solicitudes_acceso` (§2.1, §3.1). Campos por supuesto (ver PREGUNTAS).
export const accessRequestSchema = z.object({
  uid: refSchema,
  email: emailSchema,
  nombre: z.string().min(1),
  estado: accessRequestStatusSchema,
  creado_en: timestampSchema,
});
export type AccessRequest = z.infer<typeof accessRequestSchema>;
