import { describe, expect, it } from 'vitest';
import { importBatchSchema } from './importBatches';

const valid = {
  sucursal_id: 'SUCURSAL NORTE',
  archivo_path: 'lotes/2026-10-01/pedidos.csv',
  fecha_referencia: '2026-10-01',
  total_filas: 538,
  validas: 530,
  con_error: 8,
  sin_cobertura: 3,
  cobertura_qx: 40,
  estado: 'LISTO',
};

describe('lotes_importacion', () => {
  it('acepta un lote válido y uno multi-sucursal', () => {
    expect(importBatchSchema.safeParse(valid).success).toBe(true);
    expect(importBatchSchema.safeParse({ ...valid, sucursal_id: 'MULTIPLE' }).success).toBe(true);
  });

  it.each([
    ['fecha_referencia inexistente', { fecha_referencia: '2026-02-30' }],
    ['total_filas negativo', { total_filas: -1 }],
    ['con_error decimal', { con_error: 1.5 }],
    ['estado desconocido', { estado: 'ERROR' }],
    ['archivo_path vacío', { archivo_path: '' }],
  ])('rechaza %s', (_label, override) => {
    expect(importBatchSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});
