import { describe, expect, it } from 'vitest';
import { tariffRuleSchema, tariffSchema } from './tariffs.js';

describe('tarifarios', () => {
  const valid = {
    id_proveedor: 'EXPRESO-UNO',
    version: 1,
    vigencia_desde: '2026-10-01',
    vigencia_hasta: null,
    estado: 'BORRADOR',
    creado_por: 'uid-admin',
    creado_en: new Date(),
  };

  it('acepta un borrador sin datos de publicación y un tarifario publicado', () => {
    expect(tariffSchema.safeParse(valid).success).toBe(true);
    expect(
      tariffSchema.safeParse({
        ...valid,
        estado: 'VIGENTE',
        archivo_origen_path: 'tarifarios/maestro.xlsx',
        publicado_por: 'uid-1',
        publicado_en: '2026-10-01T10:00:00-03:00',
      }).success,
    ).toBe(true);
  });

  it('vigencia_hasta puede ser igual a vigencia_desde', () => {
    expect(tariffSchema.safeParse({ ...valid, vigencia_hasta: '2026-10-01' }).success).toBe(true);
  });

  it.each([
    ['vigencia_hasta anterior a vigencia_desde', { vigencia_hasta: '2026-09-30' }],
    ['version 0', { version: 0 }],
    ['version decimal', { version: 1.5 }],
    ['estado desconocido', { estado: 'PUBLICADO' }],
    ['vigencia_desde inexistente', { vigencia_desde: '2026-02-30' }],
    ['vigencia_hasta ausente', { vigencia_hasta: undefined }],
  ])('rechaza %s', (_label, override) => {
    expect(tariffSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it('D35: rechaza la falta de creado_por', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { creado_por, ...noAuthor } = valid;
    expect(tariffSchema.safeParse(noAuthor).success).toBe(false);
  });

  it('D35: rechaza la falta de creado_en', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { creado_en, ...noTimestamp } = valid;
    expect(tariffSchema.safeParse(noTimestamp).success).toBe(false);
  });
});

describe('reglas_tarifa', () => {
  const control = {
    creado_por: 'uid-1',
    creado_en: new Date(),
    actualizado_por: 'uid-1',
    actualizado_en: new Date(),
  };
  const common = {
    tarifario_id: 't1',
    id_proveedor: 'EXPRESO-UNO',
    provincia_origen: 'BUENOS AIRES',
    provincia_destino: 'CORDOBA',
    localidad_destino: 'CORDOBA',
    codigo_postal_destino: '5000',
    zona_destino: 'ZONA UNO',
    variante_id: '5000|CORDOBA|ZONA UNO',
    precio_tramo: '1600',
    costo_base_viaje: '0',
    aplica_colecta: false,
    vigencia_desde: '2026-10-01',
    vigencia_hasta: null,
    estado: 'BORRADOR',
    ...control,
  };
  const weightRule = {
    ...common,
    tipo_regla: 'PESO',
    kg_min: '10',
    kg_max: '50',
    m3_min: null,
    m3_max: null,
  };
  const volumeRule = {
    ...common,
    tipo_regla: 'VOLUMEN',
    kg_min: null,
    kg_max: null,
    m3_min: '0.05',
    m3_max: '0.5',
  };

  it('acepta un tramo PESO y un tramo VOLUMEN válidos', () => {
    expect(tariffRuleSchema.safeParse(weightRule).success).toBe(true);
    expect(tariffRuleSchema.safeParse(volumeRule).success).toBe(true);
  });

  it('acepta excedente solo en el tipo que corresponde', () => {
    expect(tariffRuleSchema.safeParse({ ...weightRule, precio_kg_excedente: '600' }).success).toBe(
      true,
    );
    expect(tariffRuleSchema.safeParse({ ...volumeRule, precio_m3_excedente: '2600' }).success).toBe(
      true,
    );
  });

  it('acepta colecta con costo y los campos reservados', () => {
    expect(
      tariffRuleSchema.safeParse({
        ...weightRule,
        aplica_colecta: true,
        costo_colecta: '320.83',
        precio_bulto: '10',
        precio_pallet: '100',
        plazo_estimado_dias: 3,
        localidad_origen: 'CABA',
        localidad_destino: 'CORDOBA',
      }).success,
    ).toBe(true);
  });

  it.each([
    ['PESO sin kg_min', { ...weightRule, kg_min: null }],
    ['PESO sin kg_max', { ...weightRule, kg_max: null }],
    ['PESO con m3_min', { ...weightRule, m3_min: '0.1' }],
    ['PESO con m3_max', { ...weightRule, m3_max: '0.1' }],
    ['VOLUMEN sin m3_min', { ...volumeRule, m3_min: null }],
    ['VOLUMEN sin m3_max', { ...volumeRule, m3_max: null }],
    ['VOLUMEN con kg_min', { ...volumeRule, kg_min: '1' }],
    ['VOLUMEN con kg_max', { ...volumeRule, kg_max: '1' }],
    ['kg_min igual a kg_max', { ...weightRule, kg_min: '50', kg_max: '50' }],
    ['kg_min mayor que kg_max', { ...weightRule, kg_min: '60' }],
    ['m3_min igual a m3_max', { ...volumeRule, m3_min: '0.5' }],
    ['m3_min mayor que m3_max', { ...volumeRule, m3_min: '1' }],
    ['precio_m3_excedente con PESO', { ...weightRule, precio_m3_excedente: '1' }],
    ['precio_kg_excedente con VOLUMEN', { ...volumeRule, precio_kg_excedente: '1' }],
    ['aplica_colecta sin costo_colecta', { ...weightRule, aplica_colecta: true }],
    ['cp con 3 dígitos', { ...weightRule, codigo_postal_destino: '500' }],
    ['vigencia_hasta anterior a vigencia_desde', { ...weightRule, vigencia_hasta: '2026-09-30' }],
    ['precio_tramo como number', { ...weightRule, precio_tramo: 1600 }],
    ['precio_tramo negativo', { ...weightRule, precio_tramo: '-1' }],
    ['precio_tramo con 5 decimales', { ...weightRule, precio_tramo: '1.00001' }],
    ['tipo_regla desconocido', { ...weightRule, tipo_regla: 'BULTO' }],
    ['zona_destino vacía', { ...weightRule, zona_destino: '' }],
    ['localidad_destino ausente', { ...weightRule, localidad_destino: undefined }],
    ['localidad_destino vacía', { ...weightRule, localidad_destino: '' }],
    ['kg_min como number', { ...weightRule, kg_min: 10 }],
  ])('rechaza %s', (_label, rule) => {
    expect(tariffRuleSchema.safeParse(rule).success).toBe(false);
  });

  it('PESO exige kg_min y kg_max, y el error apunta al campo', () => {
    const result = tariffRuleSchema.safeParse({ ...weightRule, kg_max: null });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.map((issue) => issue.path[0])).toContain('kg_max');
  });

  it('no hereda campos de la herramienta externa (precio_kg_base / precio_m3_base)', () => {
    expect('precio_kg_base' in tariffRuleSchema.innerType().shape).toBe(false);
    expect('precio_m3_base' in tariffRuleSchema.innerType().shape).toBe(false);
  });

  it('D34: rechaza variante_id derivado incorrectamente', () => {
    expect(
      tariffRuleSchema.safeParse({
        ...weightRule,
        variante_id: 'INCORRECTO', // debe ser {cp}|{norm(localidad)}|{norm(zona)}
      }).success,
    ).toBe(false);
  });
});
