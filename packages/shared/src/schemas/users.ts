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
export const accessRequestSchema = z
  .object({
    uid: refSchema,
    email: emailSchema,
    nombre: z.string().min(1),
    estado: accessRequestStatusSchema,
    creado_en: timestampSchema,
    resuelto_por: refSchema.nullable(),
    resuelto_en: timestampSchema.nullable(),
  })
  .superRefine((request, ctx) => {
    const isPendiente = request.estado === 'PENDIENTE';
    const isResolved = request.estado === 'APROBADA' || request.estado === 'RECHAZADA';

    if (isPendiente && (request.resuelto_por !== null || request.resuelto_en !== null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resuelto_por'],
        message: 'resuelto_por y resuelto_en deben ser nulos mientras estado = PENDIENTE',
      });
    }

    if (isResolved && (request.resuelto_por === null || request.resuelto_en === null)) {
      if (request.resuelto_por === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['resuelto_por'],
          message: 'resuelto_por es obligatorio si estado = APROBADA o RECHAZADA',
        });
      }
      if (request.resuelto_en === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['resuelto_en'],
          message: 'resuelto_en es obligatorio si estado = APROBADA o RECHAZADA',
        });
      }
    }
  });
export type AccessRequest = z.infer<typeof accessRequestSchema>;
