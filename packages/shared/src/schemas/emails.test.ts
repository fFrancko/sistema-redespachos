import { describe, expect, it } from 'vitest';
import { emailTemplateSchema, outboundEmailSchema } from './emails.js';

describe('plantillas_email', () => {
  const valid = {
    nombre: 'Proforma por defecto',
    asunto: 'Proforma {{lote.id}}',
    cuerpo_html: '<p>{{proveedor.razon_social}}: {{resumen.cantidad}} pedidos</p>',
    columnas_adjunto: ['nro_pedido', 'criterio', 'detalle_tarifa', 'neto', 'iva', 'total'],
    formato_adjunto: 'XLSX',
    para_extra: [],
    cc: ['cc@qx.example'],
    cco: [],
    es_default: true,
  };

  it('acepta una plantilla válida con ambos formatos de adjunto', () => {
    expect(emailTemplateSchema.safeParse(valid).success).toBe(true);
    expect(emailTemplateSchema.safeParse({ ...valid, formato_adjunto: 'CSV' }).success).toBe(true);
  });

  it.each([
    ['columna fuera del catálogo', { columnas_adjunto: ['nro_pedido', 'km'] }],
    ['formato de adjunto inventado', { formato_adjunto: 'PDF' }],
    ['cc con un email inválido', { cc: ['no-es-email'] }],
    ['asunto vacío', { asunto: '' }],
    ['es_default como string', { es_default: 'SI' }],
  ])('rechaza %s', (_label, override) => {
    expect(emailTemplateSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});

describe('emails_salida', () => {
  const valid = {
    para: ['contacto@expreso.example'],
    cc: [],
    cco: [],
    asunto: 'Proforma lote 1',
    cuerpo_html: '<p>Resumen</p>',
    adjunto_path: 'adjuntos/proforma-1.xlsx',
    proforma_id: 'pf1',
    estado: 'PENDIENTE',
    intentos: 0,
  };

  it('acepta un email de proforma y un aviso interno sin adjunto ni proforma', () => {
    expect(outboundEmailSchema.safeParse(valid).success).toBe(true);
    const { adjunto_path, proforma_id, ...notice } = valid;
    void adjunto_path;
    void proforma_id;
    expect(outboundEmailSchema.safeParse(notice).success).toBe(true);
  });

  it.each([0, 1, 2, 3])('acepta intentos = %s', (intentos) => {
    expect(outboundEmailSchema.safeParse({ ...valid, intentos }).success).toBe(true);
  });

  it.each([-1, 4, 1.5, '1'])('rechaza intentos = %s', (intentos) => {
    expect(outboundEmailSchema.safeParse({ ...valid, intentos }).success).toBe(false);
  });

  it('acepta ultimo_error y estado ERROR; rechaza estados inventados', () => {
    expect(
      outboundEmailSchema.safeParse({
        ...valid,
        estado: 'ERROR',
        intentos: 3,
        ultimo_error: 'timeout',
      }).success,
    ).toBe(true);
    expect(outboundEmailSchema.safeParse({ ...valid, estado: 'REINTENTANDO' }).success).toBe(false);
  });

  it('rechaza destinatarios con un email inválido', () => {
    expect(outboundEmailSchema.safeParse({ ...valid, para: ['x'] }).success).toBe(false);
  });
});
