import { describe, expect, it } from 'vitest';
import {
  invalidOrderSchema,
  orderDocumentSchema,
  orderImportSchema,
  orderSchema,
  quoteSchema,
} from './orders';

const validImport = {
  nro_pedido: 'SINT-0001',
  peso_kgs: '12.50',
  volumen_m3: '0.08',
  peso_aforado: '20.00',
  cantidad_bultos: 2,
  valor_declarado: 34973172,
  fecha_interfaz: '2026-09-30',
  zona_origen: 'ZONA CENTRO',
  cabecera_origen: 'SUCURSAL NORTE',
  codigo_postal_origen: '1000',
  codigo_postal: '1406',
  localidad: 'LOCALIDAD UNO',
  provincia: 'BUENOS AIRES',
  origen_tms: { codigo_de_empresa: 'EMP01' },
};

const validContext = {
  sucursal_id: 'SUCURSAL NORTE',
  lote_id: 'lote-1',
  importado_por: 'uid-1',
  importado_en: '2026-10-01T10:00:00-03:00',
  observaciones: [],
};

const validOrder = {
  ...validImport,
  ...validContext,
  cp_destino_norm: '1406',
  provincia_destino_norm: 'BUENOS AIRES',
  estado: 'VALIDADO',
  errores: [],
};

const confirmation = { respuesta: 'ACEPTA', respuesta_id: 'r1' };

const variante = {
  localidad: 'LOCALIDAD UNO',
  zona: 'ZONA UNO',
  plazo_estimado_dias: 3,
};

const validQuote = {
  id_proveedor: 'EXPRESO-UNO',
  tarifario_id: 't1',
  variante_id: '1406|LOCALIDAD UNO|ZONA UNO',
  variante,
  regla_peso_id: 'r1',
  regla_volumen_id: 'r2',
  criterio: 'VOLUMEN',
  detalle_tarifa: 'VOLUMEN 0,05–0,5 m3: tramo $2.600,00',
  costo_peso: 160000,
  costo_volumen: 260000,
  flete: 260000,
  colecta: 32083,
  seguro: 50000,
  neto: 342083,
  iva_porcentaje: '21',
  iva: 71837,
  total: 413920,
  origen: 'MOTOR',
  fecha_referencia: '2026-10-01',
  motor_version: '1.0.0',
  calculado_en: '2026-10-01T10:00:00-03:00',
};

const alternative = {
  id_proveedor: 'EXPRESO-UNO',
  variante_id: '1406|LOCALIDAD UNO|ZONA UNO',
  variante,
  criterio: 'VOLUMEN',
  neto: 342083,
  total: 413920,
};

describe('columnas de importación de pedidos (§2.4)', () => {
  it('acepta una fila válida', () => {
    expect(orderImportSchema.safeParse(validImport).success).toBe(true);
  });

  it('acepta peso_aforado 0 (es observación, no error)', () => {
    expect(orderImportSchema.safeParse({ ...validImport, peso_aforado: '0' }).success).toBe(true);
  });

  it('acepta los campos opcionales', () => {
    expect(
      orderImportSchema.safeParse({
        ...validImport,
        zona_destino_importada: 'ZONA UNO',
        cabecera_destino_importada: 'CABECERA UNO',
        expreso_manual: 'EXPRESO SINTETICO',
        destinatario: 'CLIENTE SINTETICO',
        direccion: 'CALLE INVENTADA 1',
        numero: '1',
        alto_cm: '50',
        ancho_cm: '40',
        largo_cm: '40',
      }).success,
    ).toBe(true);
  });

  it.each([
    ['peso_kgs en 0', { peso_kgs: '0' }],
    ['peso_kgs como number', { peso_kgs: 12.5 }],
    ['volumen_m3 en 0', { volumen_m3: '0' }],
    ['volumen_m3 negativo', { volumen_m3: '-1' }],
    ['peso_aforado negativo', { peso_aforado: '-1' }],
    ['cantidad_bultos en 0', { cantidad_bultos: 0 }],
    ['cantidad_bultos decimal', { cantidad_bultos: 1.5 }],
    ['valor_declarado decimal (no es cents)', { valor_declarado: 100.5 }],
    ['valor_declarado como string', { valor_declarado: '100' }],
    ['valor_declarado negativo', { valor_declarado: -1 }],
    ['fecha_interfaz con formato dd/MM/yyyy', { fecha_interfaz: '30/09/2026' }],
    ['codigo_postal de 5 dígitos', { codigo_postal: '14060' }],
    ['codigo_postal_origen inválido', { codigo_postal_origen: '10' }],
    ['cabecera_origen vacía', { cabecera_origen: '' }],
    ['origen_tms con valores que no son string', { origen_tms: { a: 1 } }],
    ['alto_cm como number', { alto_cm: 50 }],
  ])('rechaza %s', (_label, override) => {
    expect(orderImportSchema.safeParse({ ...validImport, ...override }).success).toBe(false);
  });
});

describe('pedidos validados', () => {
  it('acepta un pedido VALIDADO mínimo', () => {
    expect(orderSchema.safeParse(validOrder).success).toBe(true);
  });

  it('acepta un pedido completo, valorizado y aceptado', () => {
    const full = {
      ...validOrder,
      estado: 'ACEPTADO_PROVEEDOR',
      provincia_origen: 'BUENOS AIRES',
      localidad_origen: 'LOCALIDAD ORIGEN',
      observaciones: ['AFORADO_MENOR_A_PESO', 'CP_AMBIGUO'],
      canalizador: {
        zona: 'ZONA UNO',
        cabecera: 'CABECERA UNO',
        subzona: 'SUBZONA UNO',
        zona_tarifario: 'ZT1',
        cobertura_qx: 'NO',
      },
      cotizacion: validQuote,
      alternativas: [alternative],
      descartes: [
        { id_proveedor: 'EXPRESO-DOS', motivo: 'SIN_TARIFA' },
        {
          id_proveedor: 'EXPRESO-TRES',
          variante_id: 'x',
          motivo: 'PESO_EXCEDIDO_SIN_REGLA',
        },
      ],
      proforma_id: 'pf1',
      fecha_aceptacion: '2026-10-02',
      confirmacion: { respuesta: 'ACEPTA', respuesta_id: 'r1' },
      reporte_liquidacion_id: 'rl1',
      reporte_oc_id: 'roc1',
    };
    expect(orderSchema.safeParse(full).success).toBe(true);
  });

  it('acepta canalizador DESCONOCIDA con los datos del canalizador nulos', () => {
    expect(
      orderSchema.safeParse({
        ...validOrder,
        canalizador: {
          zona: null,
          cabecera: null,
          subzona: null,
          zona_tarifario: null,
          cobertura_qx: 'DESCONOCIDA',
        },
      }).success,
    ).toBe(true);
  });

  it.each([
    ['estado CON_ERROR (va en invalidOrderSchema)', { estado: 'CON_ERROR' }],
    ['estado inventado', { estado: 'PENDIENTE' }],
    [
      'errores no vacíos en un pedido válido',
      {
        errores: [{ campo: 'peso_kgs', codigo: 'PESO_INVALIDO', mensaje: 'x' }],
      },
    ],
    ['observación inventada', { observaciones: ['OTRA'] }],
    [
      'canalizador con cobertura_qx booleana',
      {
        canalizador: {
          zona: null,
          cabecera: null,
          subzona: null,
          zona_tarifario: null,
          cobertura_qx: true,
        },
      },
    ],
    ['cp_destino_norm inválido', { cp_destino_norm: '14' }],
    ['descarte con motivo inventado', { descartes: [{ id_proveedor: 'X', motivo: 'OTRO' }] }],
    [
      'confirmacion con respuesta inventada',
      {
        fecha_aceptacion: '2026-10-02',
        confirmacion: { respuesta: 'TAL_VEZ', respuesta_id: 'r1' },
      },
    ],
    [
      'confirmacion sin respuesta_id',
      { fecha_aceptacion: '2026-10-02', confirmacion: { respuesta: 'ACEPTA' } },
    ],
    ['confirmacion sin fecha_aceptacion en la raíz', { confirmacion: confirmation }],
    ['fecha_aceptacion inexistente', { fecha_aceptacion: '2026-02-30' }],
    ['fecha_aceptacion con otro formato', { fecha_aceptacion: '02/10/2026' }],
    ['fecha_aceptacion como number', { fecha_aceptacion: 20261002 }],
  ])('rechaza %s', (_label, override) => {
    expect(orderSchema.safeParse({ ...validOrder, ...override }).success).toBe(false);
  });

  it('fecha_aceptacion vive en la raíz (D31): es opcional sin confirmacion y obligatoria con ella', () => {
    expect(orderSchema.safeParse(validOrder).success).toBe(true);
    expect(
      orderSchema.safeParse({
        ...validOrder,
        estado: 'ACEPTADO_PROVEEDOR',
        fecha_aceptacion: '2026-10-02',
        confirmacion: confirmation,
      }).success,
    ).toBe(true);
    const missing = orderSchema.safeParse({ ...validOrder, confirmacion: confirmation });
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.error.issues[0]?.path).toEqual(['fecha_aceptacion']);
  });

  it('confirmacion ya no lleva fecha_aceptacion: la que llegue dentro no se conserva', () => {
    const parsed = orderSchema.parse({
      ...validOrder,
      fecha_aceptacion: '2026-10-02',
      confirmacion: { ...confirmation, fecha_aceptacion: '2026-10-03' },
    });
    expect(parsed.confirmacion).toEqual(confirmation);
    expect(parsed.fecha_aceptacion).toBe('2026-10-02');
  });

  it('alternativas admite como máximo 20 elementos', () => {
    const twenty = Array.from({ length: 20 }, () => alternative);
    expect(orderSchema.safeParse({ ...validOrder, alternativas: twenty }).success).toBe(true);
    expect(
      orderSchema.safeParse({
        ...validOrder,
        alternativas: [...twenty, alternative],
      }).success,
    ).toBe(false);
  });

  it('los montos de las alternativas son cents', () => {
    expect(
      orderSchema.safeParse({
        ...validOrder,
        alternativas: [{ ...alternative, total: 10.5 }],
      }).success,
    ).toBe(false);
    expect(
      orderSchema.safeParse({
        ...validOrder,
        alternativas: [{ ...alternative, neto: '100' }],
      }).success,
    ).toBe(false);
  });
});

describe('cotizacion', () => {
  it('acepta una cotización del motor', () => {
    expect(quoteSchema.safeParse(validQuote).success).toBe(true);
  });

  it('origen MANUAL exige justificacion', () => {
    const manual = { ...validQuote, origen: 'MANUAL' };
    const withoutReason = quoteSchema.safeParse(manual);
    expect(withoutReason.success).toBe(false);
    if (!withoutReason.success)
      expect(withoutReason.error.issues[0]?.path).toEqual(['justificacion']);
    expect(
      quoteSchema.safeParse({
        ...manual,
        justificacion: 'Tarifa acordada por mail',
      }).success,
    ).toBe(true);
    expect(quoteSchema.safeParse({ ...manual, justificacion: '' }).success).toBe(false);
  });

  it('una cotización manual puede no tener tarifario, variante ni reglas', () => {
    expect(
      quoteSchema.safeParse({
        ...validQuote,
        origen: 'MANUAL',
        justificacion: 'Cotizada a mano',
        tarifario_id: null,
        variante_id: null,
        variante: null,
        regla_peso_id: null,
        regla_volumen_id: null,
      }).success,
    ).toBe(true);
  });

  it('una cotización del motor exige tarifario, variante y variante_id', () => {
    for (const field of ['tarifario_id', 'variante_id', 'variante']) {
      expect(quoteSchema.safeParse({ ...validQuote, [field]: null }).success).toBe(false);
    }
  });

  it.each([
    ['neto decimal', { neto: 3420.83 }],
    ['total como string', { total: '413920' }],
    ['seguro negativo', { seguro: -1 }],
    ['flete no seguro', { flete: 2 ** 53 }],
    ['iva_porcentaje como number', { iva_porcentaje: 21 }],
    ['iva_porcentaje mayor a 100', { iva_porcentaje: '121' }],
    ['criterio inventado', { criterio: 'BULTOS' }],
    ['origen inventado', { origen: 'AUTO' }],
    ['fecha_referencia inexistente', { fecha_referencia: '2026-02-30' }],
    ['calculado_en sin offset', { calculado_en: '2026-10-01T10:00:00' }],
  ])('rechaza %s', (_label, override) => {
    expect(quoteSchema.safeParse({ ...validQuote, ...override }).success).toBe(false);
  });
});

describe('pedidos con error (CON_ERROR)', () => {
  const invalidOrder = {
    nro_pedido: 'SINT-0008',
    origen_tms: { codigo_de_empresa: 'EMP01' },
    cabecera_origen: 'SUCURSAL NORTE',
    ...validContext,
    estado: 'CON_ERROR',
    errores: [
      {
        campo: 'peso_kgs',
        codigo: 'PESO_INVALIDO',
        mensaje: 'Debe ser mayor que 0',
      },
    ],
  };

  it('acepta un pedido CON_ERROR con datos parciales (sin el campo que falló)', () => {
    expect(invalidOrderSchema.safeParse(invalidOrder).success).toBe(true);
  });

  it('acepta un CANCELADO desde CON_ERROR que conserva los errores', () => {
    expect(invalidOrderSchema.safeParse({ ...invalidOrder, estado: 'CANCELADO' }).success).toBe(
      true,
    );
    expect(orderDocumentSchema.safeParse({ ...invalidOrder, estado: 'CANCELADO' }).success).toBe(
      true,
    );
  });

  it('un CANCELADO limpio (sin errores) valida por orderSchema, no por invalidOrderSchema', () => {
    const cancelled = { ...validOrder, estado: 'CANCELADO' };
    expect(orderSchema.safeParse(cancelled).success).toBe(true);
    expect(orderDocumentSchema.safeParse(cancelled).success).toBe(true);
    expect(invalidOrderSchema.safeParse(cancelled).success).toBe(false);
  });

  it('un CANCELADO desde CON_ERROR sin errores no es válido', () => {
    expect(
      invalidOrderSchema.safeParse({ ...invalidOrder, estado: 'CANCELADO', errores: [] }).success,
    ).toBe(false);
  });

  it.each([
    ['sin errores', { errores: [] }],
    ['estado distinto de CON_ERROR y CANCELADO', { estado: 'VALIDADO' }],
    ['sin nro_pedido', { nro_pedido: undefined }],
    ['sin origen_tms', { origen_tms: undefined }],
    ['código de error inventado', { errores: [{ campo: 'x', codigo: 'OTRO', mensaje: 'm' }] }],
    ['dato presente pero mal formado', { codigo_postal: '14' }],
  ])('rechaza %s', (_label, override) => {
    expect(invalidOrderSchema.safeParse({ ...invalidOrder, ...override }).success).toBe(false);
  });

  it('la colección pedidos acepta ambos tipos de documento', () => {
    expect(orderDocumentSchema.safeParse(validOrder).success).toBe(true);
    expect(orderDocumentSchema.safeParse(invalidOrder).success).toBe(true);
    expect(orderDocumentSchema.safeParse({ ...validOrder, peso_kgs: '0' }).success).toBe(false);
    expect(orderDocumentSchema.safeParse({ ...invalidOrder, peso_kgs: '0' }).success).toBe(false);
  });
});
