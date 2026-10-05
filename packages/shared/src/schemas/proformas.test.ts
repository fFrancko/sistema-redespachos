import { describe, expect, it } from 'vitest';
import { proformaSchema, supplierResponseSchema } from './proformas.js';

describe('proformas', () => {
  const valid = {
    lote_id: 'lote-1',
    id_proveedor: 'EXPRESO-UNO',
    pedido_ids: ['SUCURSAL NORTE_SINT-0001', 'SUCURSAL NORTE_SINT-0002'],
    totales: { cantidad: 2, neto: 684166, iva: 143675, total: 827841 },
    plantilla_id: 'pl1',
    email_id: 'em1',
    adjunto_path: 'adjuntos/proforma-1.xlsx',
    enviada_por: 'uid-1',
    enviada_en: '2026-10-01T10:00:00-03:00',
    estado: 'ENVIADA',
  };

  it.each(['ENVIADA', 'ERROR_COMUNICACION', 'RESPONDIDA_PARCIAL', 'RESPONDIDA'])(
    'acepta el estado %s',
    (estado) => {
      expect(proformaSchema.safeParse({ ...valid, estado }).success).toBe(true);
    },
  );

  it.each([
    ['total como string', { totales: { ...valid.totales, total: '827841' } }],
    ['neto decimal', { totales: { ...valid.totales, neto: 6841.66 } }],
    ['iva negativo', { totales: { ...valid.totales, iva: -1 } }],
    ['cantidad decimal', { totales: { ...valid.totales, cantidad: 1.5 } }],
    ['estado inventado', { estado: 'BORRADOR' }],
    ['pedido_ids con un id vacío', { pedido_ids: [''] }],
    ['enviada_en sin offset', { enviada_en: '2026-10-01T10:00:00' }],
    ['adjunto_path vacío', { adjunto_path: '' }],
  ])('rechaza %s', (_label, override) => {
    expect(proformaSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});

describe('respuestas_proveedor', () => {
  const valid = {
    proforma_id: 'pf1',
    pedidos: [
      { pedido_id: 'p1', resultado: 'ACEPTA' },
      { pedido_id: 'p2', resultado: 'ACEPTA' },
    ],
    evidencia_paths: ['evidencias/pf1/mail.eml'],
    fecha_respuesta: '2026-10-02',
    registrado_por: 'uid-2',
    registrado_en: '2026-10-02T11:00:00-03:00',
  };
  const withRejection = {
    ...valid,
    pedidos: [
      { pedido_id: 'p1', resultado: 'ACEPTA' },
      { pedido_id: 'p2', resultado: 'RECHAZA' },
    ],
  };

  it('acepta una respuesta sin rechazos y sin justificacion', () => {
    expect(supplierResponseSchema.safeParse(valid).success).toBe(true);
  });

  it('acepta una respuesta con rechazos y justificacion', () => {
    expect(
      supplierResponseSchema.safeParse({
        ...withRejection,
        justificacion: 'Tarifa desactualizada',
      }).success,
    ).toBe(true);
  });

  it('justificacion es obligatoria si algún pedido es RECHAZA', () => {
    const result = supplierResponseSchema.safeParse(withRejection);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['justificacion']);
    expect(supplierResponseSchema.safeParse({ ...withRejection, justificacion: '' }).success).toBe(
      false,
    );
  });

  it('evidencia_paths exige al menos un elemento', () => {
    expect(supplierResponseSchema.safeParse({ ...valid, evidencia_paths: [] }).success).toBe(false);
    expect(supplierResponseSchema.safeParse({ ...valid, evidencia_paths: [''] }).success).toBe(
      false,
    );
  });

  it.each([
    ['resultado inventado', { pedidos: [{ pedido_id: 'p1', resultado: 'TAL_VEZ' }] }],
    ['fecha_respuesta inexistente', { fecha_respuesta: '2026-02-30' }],
    ['fecha_respuesta en otro formato', { fecha_respuesta: '02/10/2026' }],
    ['pedido_id vacío', { pedidos: [{ pedido_id: '', resultado: 'ACEPTA' }] }],
    ['registrado_por vacío', { registrado_por: '' }],
  ])('rechaza %s', (_label, override) => {
    expect(supplierResponseSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});
