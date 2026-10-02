import { describe, expect, it } from 'vitest';
import { purchaseOrderReportSchema, settlementReportSchema } from './reports';

describe('reportes_liquidacion', () => {
  const valid = {
    generado_por: 'uid-1',
    generado_en: '2026-10-05T10:00:00-03:00',
    filtros: { sucursal: 'SUCURSAL NORTE', proveedor: 'EXPRESO-UNO' },
    cantidad_pedidos: 12,
    total_neto_cents: 684166,
    total_cents: 827841,
    numero: 1,
    archivo_path: 'reportes/liquidacion-1.xlsx',
    estado: 'LISTO',
  };

  it('acepta un reporte LISTO y uno PROCESANDO sin archivo todavía', () => {
    expect(settlementReportSchema.safeParse(valid).success).toBe(true);
    const { archivo_path, ...processing } = valid;
    void archivo_path;
    expect(settlementReportSchema.safeParse({ ...processing, estado: 'PROCESANDO' }).success).toBe(
      true,
    );
  });

  it.each([
    ['total_cents decimal', { total_cents: 8278.41 }],
    ['total_neto_cents como string', { total_neto_cents: '684166' }],
    ['numero 0 (el correlativo empieza en 1)', { numero: 0 }],
    ['cantidad_pedidos negativa', { cantidad_pedidos: -1 }],
    ['estado inventado', { estado: 'ERROR' }],
    ['filtros que no es un objeto', { filtros: 'todos' }],
  ])('rechaza %s', (_label, override) => {
    expect(settlementReportSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});

describe('reportes_oc', () => {
  const valid = {
    generado_por: 'uid-3',
    generado_en: new Date(),
    cantidad_pedidos: 12,
    cantidad_oc: 2,
    total_cents: 827841,
    archivo_path: 'reportes/oc-1.xlsx',
    estado: 'LISTO',
  };

  it('acepta un reporte válido', () => {
    expect(purchaseOrderReportSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['total_cents decimal', { total_cents: 1.5 }],
    ['cantidad_oc negativa', { cantidad_oc: -1 }],
    ['generado_por vacío', { generado_por: '' }],
    ['estado inventado', { estado: 'PENDIENTE' }],
  ])('rechaza %s', (_label, override) => {
    expect(purchaseOrderReportSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});
