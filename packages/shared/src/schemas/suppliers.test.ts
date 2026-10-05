import { describe, expect, it } from 'vitest';
import { cuitIndexSchema, isValidCuit, supplierSchema } from './suppliers.js';

const validSupplier = {
  id_proveedor: 'EXPRESO-UNO',
  razon_social: 'Expreso Uno S.A.',
  alias: ['Expreso Uno', 'EXPRESO UNO SA'],
  cuit: '20123456786',
  email_contacto: ['contacto@expreso.example'],
  telefono: '011-5555-0000',
  estado: 'ACTIVO',
  condicion_pago: '30 días',
  iva_porcentaje: '21',
  aplica_seguro: true,
  porcentaje_seguro: '0.5',
  email_config: { para_extra: [], cc: ['cc@expreso.example'], cco: [] },
  datos_adicionales: { contacto_gestion: 'Persona Inventada' },
  creado_por: 'uid-admin',
  creado_en: new Date(),
  actualizado_por: 'uid-admin',
  actualizado_en: new Date(),
};

describe('isValidCuit', () => {
  it.each(['20123456786', '20001555554'])('acepta %s', (cuit) => {
    expect(isValidCuit(cuit)).toBe(true);
  });

  it.each([
    ['dígito verificador incorrecto', '20123456787'],
    ['con guiones', '20-12345678-6'],
    ['10 dígitos', '2012345678'],
    ['12 dígitos', '201234567860'],
    ['con letras', '2012345678A'],
    ['vacío', ''],
  ])('rechaza %s', (_label, cuit) => {
    expect(isValidCuit(cuit)).toBe(false);
  });

  it('rechaza cuando el cálculo da 10 (no existe dígito válido)', () => {
    for (let digit = 0; digit <= 9; digit += 1) {
      expect(isValidCuit(`2600000000${digit}`)).toBe(false);
    }
  });
});

describe('proveedores', () => {
  it('acepta un proveedor válido', () => {
    expect(supplierSchema.safeParse(validSupplier).success).toBe(true);
  });

  it('acepta un proveedor sin seguro, sin alias y sin email_config', () => {
    const { alias, email_config, datos_adicionales, porcentaje_seguro, ...rest } = validSupplier;
    void alias;
    void email_config;
    void datos_adicionales;
    void porcentaje_seguro;
    expect(supplierSchema.safeParse({ ...rest, aplica_seguro: false }).success).toBe(true);
  });

  it.each([
    ['cuit con dígito verificador inválido', { cuit: '20123456787' }],
    ['cuit con guiones', { cuit: '20-12345678-6' }],
    ['id_proveedor en minúsculas', { id_proveedor: 'expreso-uno' }],
    ['id_proveedor con espacios', { id_proveedor: 'EXPRESO UNO' }],
    ['id_proveedor vacío', { id_proveedor: '' }],
    ['email_contacto vacío', { email_contacto: [] }],
    ['email_contacto con un email inválido', { email_contacto: ['no-es-email'] }],
    ['iva_porcentaje mayor a 100', { iva_porcentaje: '100.5' }],
    ['iva_porcentaje como number', { iva_porcentaje: 21 }],
    ['porcentaje_seguro mayor a 100', { porcentaje_seguro: '101' }],
    ['estado desconocido', { estado: 'BAJA' }],
    ['condicion_pago vacía', { condicion_pago: '' }],
    ['email_config con cc inválido', { email_config: { para_extra: [], cc: ['x'], cco: [] } }],
  ])('rechaza %s', (_label, override) => {
    expect(supplierSchema.safeParse({ ...validSupplier, ...override }).success).toBe(false);
  });

  it('aplica_seguro exige porcentaje_seguro', () => {
    const { porcentaje_seguro, ...withoutPercent } = validSupplier;
    void porcentaje_seguro;
    const result = supplierSchema.safeParse(withoutPercent);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['porcentaje_seguro']);
  });

  it('porcentajes en los bordes del rango [0, 100]', () => {
    expect(
      supplierSchema.safeParse({
        ...validSupplier,
        iva_porcentaje: '0',
        porcentaje_seguro: '100',
      }).success,
    ).toBe(true);
  });
});

describe('indice_cuit', () => {
  it('acepta y rechaza', () => {
    expect(cuitIndexSchema.safeParse({ id_proveedor: 'EXPRESO-UNO' }).success).toBe(true);
    expect(cuitIndexSchema.safeParse({ id_proveedor: '' }).success).toBe(false);
  });
});
