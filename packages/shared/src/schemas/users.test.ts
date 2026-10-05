import { describe, expect, it } from 'vitest';
import { ROLES } from '../roles.js';
import { accessRequestSchema, userSchema } from './users.js';

const validUser = {
  email: 'ana@qx.example',
  nombre: 'Ana Prueba',
  rol: 'ANALISTA',
  sucursales: ['SUCURSAL NORTE'],
  estado: 'ACTIVO',
  creado_por: 'uid-admin',
  creado_en: '2026-10-01T10:00:00-03:00',
  actualizado_por: 'uid-admin',
  actualizado_en: new Date('2026-10-01T13:00:00Z'),
};

describe('usuarios', () => {
  it('acepta un usuario válido y entrega timestamps como Date', () => {
    const parsed = userSchema.parse(validUser);
    expect(parsed.rol).toBe('ANALISTA');
    expect(parsed.creado_en).toBeInstanceOf(Date);
  });

  it.each(ROLES)('acepta el rol %s', (rol) => {
    expect(userSchema.safeParse({ ...validUser, rol }).success).toBe(true);
  });

  it('rechaza COMERCIAL (Fase 2) y roles inventados', () => {
    expect(userSchema.safeParse({ ...validUser, rol: 'COMERCIAL' }).success).toBe(false);
    expect(userSchema.safeParse({ ...validUser, rol: 'OPERADOR' }).success).toBe(false);
  });

  it.each([
    ['email inválido', { email: 'ana@' }],
    ['estado desconocido', { estado: 'SUSPENDIDO' }],
    ['nombre vacío', { nombre: '' }],
    ['sucursales que no es array', { sucursales: 'SUCURSAL NORTE' }],
    ['creado_en inválido', { creado_en: '01/10/2026' }],
  ])('rechaza %s', (_label, override) => {
    expect(userSchema.safeParse({ ...validUser, ...override }).success).toBe(false);
  });
});

describe('solicitudes_acceso', () => {
  const valid = {
    uid: 'uid-1',
    email: 'nuevo@qx.example',
    nombre: 'Nuevo Usuario',
    estado: 'PENDIENTE',
    creado_en: new Date(),
  };

  it('acepta una solicitud válida', () => {
    expect(accessRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('rechaza uid vacío y estado desconocido', () => {
    expect(accessRequestSchema.safeParse({ ...valid, uid: '' }).success).toBe(false);
    expect(accessRequestSchema.safeParse({ ...valid, estado: 'APROBADA' }).success).toBe(false);
  });
});
