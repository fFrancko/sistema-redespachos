import { describe, expect, it } from 'vitest';
import { branchSchema } from './branches.js';

describe('sucursales', () => {
  it('acepta una sucursal válida', () => {
    expect(branchSchema.parse({ cabecera_origen: 'SUCURSAL NORTE', activa: true })).toEqual({
      cabecera_origen: 'SUCURSAL NORTE',
      activa: true,
    });
  });

  it('rechaza cabecera vacía y activa que no es booleano', () => {
    expect(branchSchema.safeParse({ cabecera_origen: '', activa: true }).success).toBe(false);
    expect(branchSchema.safeParse({ cabecera_origen: 'X', activa: 'SI' }).success).toBe(false);
  });
});
