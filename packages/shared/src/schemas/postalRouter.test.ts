import { describe, expect, it } from 'vitest';
import { cpRequestSchema, postalRouterEntrySchema } from './postalRouter.js';

describe('canalizador_cp', () => {
  const valid = {
    cp: '1406',
    localidad: 'LOCALIDAD UNO',
    provincia: 'BUENOS AIRES',
    partido: 'PARTIDO UNO',
    zona: 'ZONA UNO',
    cabecera: 'CABECERA UNO',
    subzona: 'SUBZONA UNO',
    zona_tarifario: 'ZT1',
    cobertura_qx: true,
    version: 1,
  };

  it('acepta un registro válido', () => {
    expect(postalRouterEntrySchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['cp con 3 dígitos', { cp: '140' }],
    ['cp con letras', { cp: '14A6' }],
    ['cobertura_qx como enum (es booleano acá)', { cobertura_qx: 'SI' }],
    ['version 0', { version: 0 }],
    ['version decimal', { version: 1.5 }],
  ])('rechaza %s', (_label, override) => {
    expect(postalRouterEntrySchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it('D34: rechaza cobertura_qx=true con subzona="SIN COBERTURA"', () => {
    expect(
      postalRouterEntrySchema.safeParse({
        ...valid,
        subzona: 'SIN COBERTURA',
        cobertura_qx: true,
      }).success,
    ).toBe(false);
  });

  it('D34: rechaza cobertura_qx=false con subzona con cobertura', () => {
    expect(
      postalRouterEntrySchema.safeParse({
        ...valid,
        subzona: 'SUBZONA UNO',
        cobertura_qx: false,
      }).success,
    ).toBe(false);
  });

  it('D34: acepta cobertura_qx robusto con "Sin cobertura " (con espacios)', () => {
    expect(
      postalRouterEntrySchema.safeParse({
        ...valid,
        subzona: 'Sin cobertura ',
        cobertura_qx: false,
      }).success,
    ).toBe(true);
  });
});

describe('solicitudes_cp', () => {
  const valid = {
    cp: '1406',
    localidad: 'LOCALIDAD UNO',
    provincia: 'BUENOS AIRES',
    origen: 'PEDIDO',
    referencia_id: 'SUCURSAL NORTE_SINT-0001',
    referencias: ['SUCURSAL NORTE_SINT-0001', 'SUCURSAL NORTE_SINT-0002'],
    estado: 'PENDIENTE',
    creado_en: '2026-10-01T10:00:00-03:00',
    resuelta_en: null,
  };

  it('acepta una solicitud válida y una resuelta', () => {
    expect(cpRequestSchema.safeParse(valid).success).toBe(true);
    expect(
      cpRequestSchema.safeParse({
        ...valid,
        estado: 'RESUELTA',
        resuelta_en: '2026-10-02T09:00:00Z',
      }).success,
    ).toBe(true);
  });

  it('referencias es acumulativo: incluye la primera aparición y tiene al menos una', () => {
    expect(cpRequestSchema.safeParse({ ...valid, referencias: [] }).success).toBe(false);
    expect(cpRequestSchema.safeParse({ ...valid, referencias: ['otra'] }).success).toBe(false);
    expect(
      cpRequestSchema.safeParse({
        ...valid,
        referencias: [valid.referencia_id],
      }).success,
    ).toBe(true);
  });

  it.each([
    ['cp inválido', { cp: '14060' }],
    ['origen desconocido', { origen: 'LOTE' }],
    ['estado desconocido', { estado: 'DESCARTADA' }],
    ['resuelta_en ausente', { resuelta_en: undefined }],
  ])('rechaza %s', (_label, override) => {
    expect(cpRequestSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});
