import { describe, expect, it } from 'vitest';
import { auditEntrySchema, paramsSchema } from './system.js';

describe('auditoria', () => {
  const valid = {
    entidad: 'proveedores',
    entidad_id: 'EXPRESO-UNO',
    accion: 'UPDATE',
    usuario: 'uid-1',
    antes: { estado: 'ACTIVO' },
    despues: { estado: 'INACTIVO' },
    timestamp: '2026-10-01T10:00:00-03:00',
  };

  it('acepta un cambio y una alta (antes nulo)', () => {
    expect(auditEntrySchema.safeParse(valid).success).toBe(true);
    expect(auditEntrySchema.safeParse({ ...valid, antes: null, accion: 'CREATE' }).success).toBe(
      true,
    );
  });

  it.each([
    ['entidad vacía', { entidad: '' }],
    ['usuario vacío', { usuario: '' }],
    ['despues que no es objeto', { despues: 'x' }],
    ['timestamp inválido', { timestamp: 'ayer' }],
    ['antes ausente', { antes: undefined }],
  ])('rechaza %s', (_label, override) => {
    expect(auditEntrySchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});

describe('parametros', () => {
  const valid = {
    condiciones_pago: ['30 días', 'Contado'],
    tolerancia_volumen_pct: '5',
    email_cdg: ['cdg@qx.example'],
    origen_estricto: true,
    oc_constantes: {
      moneda: 'PES',
      moneda_cotizacion: 'PES',
      cotizacion: '1',
      preciosobre: '1',
      workflow: 'CPRA-SERCON',
      cantidad_por_pedido: 1,
    },
    formato_fecha_oc: 'dd/MM/yyyy',
  };

  it('acepta los parámetros globales válidos', () => {
    expect(paramsSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['tolerancia_volumen_pct como number', { tolerancia_volumen_pct: 5 }],
    ['tolerancia_volumen_pct mayor a 100', { tolerancia_volumen_pct: '101' }],
    ['email_cdg con un email inválido', { email_cdg: ['x'] }],
    ['origen_estricto como string', { origen_estricto: 'true' }],
    ['condiciones_pago con un valor vacío', { condiciones_pago: [''] }],
    ['formato_fecha_oc vacío', { formato_fecha_oc: '' }],
    [
      'oc_constantes.cotizacion como number',
      { oc_constantes: { ...valid.oc_constantes, cotizacion: 1 } },
    ],
    [
      'oc_constantes.cantidad_por_pedido en 0',
      { oc_constantes: { ...valid.oc_constantes, cantidad_por_pedido: 0 } },
    ],
  ])('rechaza %s', (_label, override) => {
    expect(paramsSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});
