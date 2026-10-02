import { describe, expect, it } from 'vitest';
import { ORDER_STATUSES } from './enums';
import type { OrderStatus } from './enums';
import { DomainError } from './errors';
import { ORDER_TRANSITIONS, assertTransition, canTransition } from './orderTransitions';
import { ROLES } from './roles';

// Copia literal de las columnas "Llega desde" y "Puede pasar a" de §3.7 de la arquitectura v3.
// `IMPORTACION` es el origen de los estados iniciales: no es un estado del pedido.
const SECTION_3_7: ReadonlyArray<{
  estado: OrderStatus;
  llegaDesde: readonly (OrderStatus | 'IMPORTACION')[];
  puedePasarA: readonly OrderStatus[];
}> = [
  {
    estado: 'CON_ERROR',
    llegaDesde: ['IMPORTACION'],
    puedePasarA: ['CANCELADO'],
  },
  {
    estado: 'VALIDADO',
    llegaDesde: ['IMPORTACION'],
    puedePasarA: ['VALORIZADO', 'COBERTURA_QX', 'SIN_COBERTURA', 'CANCELADO'],
  },
  {
    estado: 'SIN_COBERTURA',
    llegaDesde: ['VALIDADO', 'COBERTURA_QX', 'VALORIZADO', 'EN_DISPUTA'],
    puedePasarA: ['VALORIZADO', 'COBERTURA_QX', 'CANCELADO'],
  },
  {
    estado: 'COBERTURA_QX',
    llegaDesde: ['VALIDADO', 'SIN_COBERTURA', 'VALORIZADO', 'EN_DISPUTA'],
    puedePasarA: ['VALORIZADO', 'SIN_COBERTURA', 'CANCELADO'],
  },
  {
    estado: 'VALORIZADO',
    llegaDesde: ['VALIDADO', 'SIN_COBERTURA', 'COBERTURA_QX', 'EN_DISPUTA', 'ERROR_COMUNICACION'],
    puedePasarA: [
      'PENDIENTE_CONFIRMACION',
      'ERROR_COMUNICACION',
      'SIN_COBERTURA',
      'COBERTURA_QX',
      'CANCELADO',
    ],
  },
  {
    estado: 'ERROR_COMUNICACION',
    llegaDesde: ['VALORIZADO'],
    puedePasarA: ['PENDIENTE_CONFIRMACION', 'VALORIZADO', 'CANCELADO'],
  },
  {
    estado: 'PENDIENTE_CONFIRMACION',
    llegaDesde: ['VALORIZADO', 'ERROR_COMUNICACION'],
    puedePasarA: ['ACEPTADO_PROVEEDOR', 'EN_DISPUTA'],
  },
  {
    estado: 'EN_DISPUTA',
    llegaDesde: ['PENDIENTE_CONFIRMACION', 'ACEPTADO_PROVEEDOR'],
    puedePasarA: ['VALORIZADO', 'SIN_COBERTURA', 'COBERTURA_QX', 'CANCELADO'],
  },
  {
    estado: 'ACEPTADO_PROVEEDOR',
    llegaDesde: ['PENDIENTE_CONFIRMACION'],
    puedePasarA: ['LISTO_PARA_OC', 'EN_DISPUTA'], // EN_DISPUTA: solo ADMIN
  },
  {
    estado: 'LISTO_PARA_OC',
    llegaDesde: ['ACEPTADO_PROVEEDOR'],
    puedePasarA: ['LIQUIDADO'],
  },
  { estado: 'LIQUIDADO', llegaDesde: ['LISTO_PARA_OC'], puedePasarA: [] },
  {
    estado: 'CANCELADO',
    llegaDesde: [
      'CON_ERROR',
      'VALIDADO',
      'SIN_COBERTURA',
      'COBERTURA_QX',
      'VALORIZADO',
      'ERROR_COMUNICACION',
      'EN_DISPUTA',
    ],
    puedePasarA: [],
  },
];

const sorted = <T extends string>(values: readonly T[]): T[] => [...values].sort();

describe('tabla de transiciones de pedido (§3.7)', () => {
  it('cubre exactamente los 12 estados de la tabla', () => {
    expect(sorted(Object.keys(ORDER_TRANSITIONS) as OrderStatus[])).toEqual(sorted(ORDER_STATUSES));
    expect(sorted(SECTION_3_7.map((row) => row.estado))).toEqual(sorted(ORDER_STATUSES));
  });

  it.each(SECTION_3_7)('$estado: "Puede pasar a" coincide con la tabla', (row) => {
    const destinos = ORDER_TRANSITIONS[row.estado].map((transition) => transition.to);
    expect(sorted(destinos)).toEqual(sorted(row.puedePasarA));
  });

  it.each(SECTION_3_7)('$estado: el conjunto inverso coincide con "Llega desde"', (row) => {
    const derivedFrom = ORDER_STATUSES.filter((estado) =>
      ORDER_TRANSITIONS[estado].some((transition) => transition.to === row.estado),
    );
    const expected = row.llegaDesde.filter(
      (origin): origin is OrderStatus => origin !== 'IMPORTACION',
    );
    expect(sorted(derivedFrom)).toEqual(sorted(expected));
  });

  it('solo ACEPTADO_PROVEEDOR → EN_DISPUTA lleva restricción de rol, y es ADMIN', () => {
    const restricted = ORDER_STATUSES.flatMap((desde) =>
      ORDER_TRANSITIONS[desde]
        .filter((transition) => transition.roles !== undefined)
        .map((transition) => ({
          desde,
          hacia: transition.to,
          roles: transition.roles,
        })),
    );
    expect(restricted).toEqual([
      { desde: 'ACEPTADO_PROVEEDOR', hacia: 'EN_DISPUTA', roles: ['ADMIN'] },
    ]);
  });

  it('ACEPTADO_PROVEEDOR → EN_DISPUTA solo vale con ADMIN', () => {
    expect(canTransition('ACEPTADO_PROVEEDOR', 'EN_DISPUTA', 'ADMIN')).toBe(true);
    expect(canTransition('ACEPTADO_PROVEEDOR', 'EN_DISPUTA')).toBe(false);
    for (const rol of ROLES.filter((role) => role !== 'ADMIN')) {
      expect(canTransition('ACEPTADO_PROVEEDOR', 'EN_DISPUTA', rol)).toBe(false);
    }
  });

  it('las demás transiciones permitidas valen con cualquier rol y sin rol', () => {
    expect(canTransition('PENDIENTE_CONFIRMACION', 'EN_DISPUTA')).toBe(true);
    expect(canTransition('PENDIENTE_CONFIRMACION', 'EN_DISPUTA', 'ATENCION_PROVEEDOR')).toBe(true);
    expect(canTransition('ACEPTADO_PROVEEDOR', 'LISTO_PARA_OC', 'ANALISTA')).toBe(true);
  });

  it('desde los estados finales no hay salidas', () => {
    for (const final of ['CANCELADO', 'LIQUIDADO'] as const) {
      expect(ORDER_TRANSITIONS[final]).toEqual([]);
      for (const hacia of ORDER_STATUSES) {
        expect(canTransition(final, hacia, 'ADMIN')).toBe(false);
      }
    }
  });

  it('canTransition es verdadero solo para los pares de la tabla (12 × 12)', () => {
    for (const row of SECTION_3_7) {
      for (const hacia of ORDER_STATUSES) {
        expect(canTransition(row.estado, hacia, 'ADMIN')).toBe(row.puedePasarA.includes(hacia));
      }
    }
  });

  it('no hay transiciones a sí mismo ni saltos de circuito', () => {
    for (const estado of ORDER_STATUSES) expect(canTransition(estado, estado, 'ADMIN')).toBe(false);
    expect(canTransition('VALORIZADO', 'ACEPTADO_PROVEEDOR', 'ADMIN')).toBe(false);
    expect(canTransition('LISTO_PARA_OC', 'CANCELADO', 'ADMIN')).toBe(false);
    expect(canTransition('ACEPTADO_PROVEEDOR', 'CANCELADO', 'ADMIN')).toBe(false);
  });
});

describe('assertTransition', () => {
  it('no lanza en una transición permitida', () => {
    expect(() => assertTransition('VALIDADO', 'VALORIZADO')).not.toThrow();
    expect(() => assertTransition('ACEPTADO_PROVEEDOR', 'EN_DISPUTA', 'ADMIN')).not.toThrow();
  });

  it('lanza DomainError con code TRANSICION_INVALIDA fuera de la tabla', () => {
    expect.assertions(4);
    try {
      assertTransition('VALIDADO', 'LIQUIDADO');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('TRANSICION_INVALIDA');
      expect((error as DomainError).details).toEqual({
        desde: 'VALIDADO',
        hacia: 'LIQUIDADO',
        rol: null,
      });
    }
    expect(() => assertTransition('CANCELADO', 'VALIDADO', 'ADMIN')).toThrow(DomainError);
  });

  it('lanza si falta el rol exigido', () => {
    expect(() => assertTransition('ACEPTADO_PROVEEDOR', 'EN_DISPUTA', 'ANALISTA')).toThrow(
      DomainError,
    );
    expect(() => assertTransition('ACEPTADO_PROVEEDOR', 'EN_DISPUTA')).toThrow(DomainError);
  });
});
