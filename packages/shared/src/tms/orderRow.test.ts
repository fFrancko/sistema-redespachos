import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { describe, expect, it } from 'vitest';
import { orderImportSchema } from '../schemas/orders.js';
import { resolveTmsHeaders } from './headers.js';
import { parseTmsRow } from './orderRow.js';
import type { TmsRowContext } from './orderRow.js';

const FIXTURE_PATH = fileURLToPath(
  new URL('../../test/fixtures/pedidos_tms_sintetico.csv', import.meta.url),
);
const records = parse(readFileSync(FIXTURE_PATH, 'utf8'), {
  columns: true,
  skip_empty_lines: true,
}) as Record<string, string>[];

const context: TmsRowContext = {
  sucursales_permitidas: ['SUCURSAL NORTE', 'SUCURSAL SUR'],
  tolerancia_volumen_pct: '5',
};

// Resultado esperado por fila del fixture (ver scripts/generateTmsFixture.ts).
const EXPECTED: ReadonlyArray<{
  nro: string;
  errores: string[];
  observaciones: string[];
}> = [
  { nro: 'SINT-0001', errores: [], observaciones: [] },
  { nro: 'SINT-0002', errores: [], observaciones: [] },
  {
    nro: 'SINT-0003',
    errores: ['zona_origen:CAMPO_OBLIGATORIO'],
    observaciones: [],
  },
  {
    nro: 'SINT-0004',
    errores: ['cabecera_origen:CAMPO_OBLIGATORIO'],
    observaciones: [],
  },
  {
    nro: 'SINT-0005',
    errores: ['fecha_interfaz:FORMATO_INVALIDO'],
    observaciones: [],
  },
  {
    nro: 'SINT-0006',
    errores: ['codigo_postal:FORMATO_INVALIDO'],
    observaciones: [],
  },
  {
    nro: 'SINT-0007',
    errores: ['valor_declarado:FORMATO_INVALIDO'],
    observaciones: [],
  },
  { nro: 'SINT-0008', errores: ['peso_kgs:PESO_INVALIDO'], observaciones: [] },
  { nro: 'SINT-0009', errores: ['peso_kgs:PESO_INVALIDO'], observaciones: [] },
  {
    nro: 'SINT-0010',
    errores: ['volumen_m3:VOLUMEN_INVALIDO'],
    observaciones: [],
  },
  {
    nro: 'SINT-0011',
    errores: ['cabecera_origen:CABECERA_NO_PERMITIDA'],
    observaciones: [],
  },
  { nro: 'SINT-0012', errores: [], observaciones: ['VOLUMEN_INCONSISTENTE'] },
  { nro: 'SINT-0013', errores: [], observaciones: ['AFORADO_MENOR_A_PESO'] },
  { nro: 'SINT-0014', errores: [], observaciones: ['AFORADO_CERO'] },
  {
    nro: 'SINT-0015',
    errores: [],
    observaciones: ['VALOR_DECLARADO_FALTANTE'],
  },
  {
    nro: 'SINT-0016',
    errores: ['codigo_postal_origen:FORMATO_INVALIDO', 'peso_kgs:PESO_INVALIDO'],
    observaciones: [],
  },
  {
    nro: 'SINT-0017',
    errores: ['cantidad_bultos:FORMATO_INVALIDO'],
    observaciones: [],
  },
  { nro: 'SINT-0018', errores: [], observaciones: [] },
  {
    nro: 'SINT-0019',
    errores: ['fecha_de_alta:FORMATO_INVALIDO'],
    observaciones: [],
  },
  { nro: 'SINT-0020', errores: [], observaciones: [] },
];

describe('fixture sintético del TMS', () => {
  it('tiene unas 20 filas con los 47 + 3 encabezados, algunos con : final', () => {
    expect(records).toHaveLength(20);
    const headers = Object.keys(records[0] ?? {});
    expect(headers).toHaveLength(50);
    expect(headers.filter((header) => header.endsWith(':')).length).toBeGreaterThan(40);
    expect(headers).toContain('Nro Pedido');
  });

  it('los encabezados se reconocen sin errores de archivo', () => {
    const resolution = resolveTmsHeaders(Object.keys(records[0] ?? {}));
    expect(resolution.errores_archivo).toEqual([]);
    expect(resolution.desconocidas).toEqual([]);
    expect(resolution.columnas.size).toBe(50);
  });

  it('cubre montos con coma de miles y ambos formatos de fecha', () => {
    const cells = records.flatMap((record) => Object.values(record));
    expect(cells.some((cell) => /^\d{1,3}(,\d{3})+\.\d{2}$/.test(cell))).toBe(true);
    expect(cells.some((cell) => /^\d{2}\/\d{2}\/\d{4}$/.test(cell))).toBe(true);
    expect(cells.some((cell) => /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(cell))).toBe(true);
  });

  it.each(EXPECTED.map((expected, index) => ({ ...expected, index })))(
    '$nro produce exactamente los códigos esperados',
    ({ index, nro, errores, observaciones }) => {
      const record = records[index] as Record<string, string>;
      const result = parseTmsRow(record, context);
      expect(result.errores.map((error) => `${error.campo}:${error.codigo}`).sort()).toEqual(
        errores,
      );
      expect([...result.observaciones].sort()).toEqual(observaciones);
      if (errores.length === 0) expect(result.datos.nro_pedido).toBe(nro);
    },
  );

  it('hay una fila por cada código de error y por cada observación intrínseca', () => {
    const errorCodes = new Set<string>();
    const observationCodes = new Set<string>();
    for (const record of records) {
      const result = parseTmsRow(record, context);
      result.errores.forEach((error) => errorCodes.add(error.codigo));
      result.observaciones.forEach((code) => observationCodes.add(code));
    }
    expect([...errorCodes].sort()).toEqual([
      'CABECERA_NO_PERMITIDA',
      'CAMPO_OBLIGATORIO',
      'FORMATO_INVALIDO',
      'PESO_INVALIDO',
      'VOLUMEN_INVALIDO',
    ]);
    expect([...observationCodes].sort()).toEqual([
      'AFORADO_CERO',
      'AFORADO_MENOR_A_PESO',
      'VALOR_DECLARADO_FALTANTE',
      'VOLUMEN_INCONSISTENTE',
    ]);
  });

  it('las filas sin errores cumplen orderImportSchema', () => {
    let valid = 0;
    for (const record of records) {
      const result = parseTmsRow(record, context);
      if (result.errores.length === 0) {
        valid += 1;
        expect(orderImportSchema.safeParse(result.datos).success).toBe(true);
      }
    }
    expect(valid).toBe(8);
  });

  it('un peso sin cero entero (.5) se toma como 0.5', () => {
    const result = parseTmsRow(records[17] as Record<string, string>, context);
    expect(result.errores).toEqual([]);
    expect(result.datos.peso_kgs).toBe('0.5');
    expect(orderImportSchema.safeParse(result.datos).success).toBe(true);
  });

  it('un campo que falló nunca queda en datos (no se persiste un valor inválido)', () => {
    const peso0 = parseTmsRow(records[7] as Record<string, string>, context);
    expect(peso0.datos.peso_kgs).toBeUndefined();
    const sinCabecera = parseTmsRow(records[3] as Record<string, string>, context);
    expect(sinCabecera.datos.cabecera_origen).toBeUndefined();
    expect(orderImportSchema.safeParse(peso0.datos).success).toBe(false);
  });

  it('los mensajes de error nunca incluyen valores de la fila', () => {
    for (const record of records) {
      const values = Object.values(record).filter((value) => value.length > 3);
      for (const error of parseTmsRow(record, context).errores) {
        for (const value of values) expect(error.mensaje).not.toContain(value);
      }
    }
  });
});

describe('parseTmsRow: datos de una fila válida completa', () => {
  const result = parseTmsRow(records[0] as Record<string, string>, context);

  it('mapea las columnas a los campos de §2.4', () => {
    expect(result.datos).toMatchObject({
      nro_pedido: 'SINT-0001',
      peso_kgs: '12.50',
      volumen_m3: '0.08',
      peso_aforado: '20.00',
      cantidad_bultos: 2,
      valor_declarado: 34973172, // "349,731.72" → centavos
      fecha_interfaz: '2026-09-30',
      zona_origen: 'ZONA CENTRO',
      cabecera_origen: 'SUCURSAL NORTE',
      codigo_postal_origen: '1000',
      codigo_postal: '1406',
      localidad: 'LOCALIDAD UNO',
      provincia: 'BUENOS AIRES',
      zona_destino_importada: 'ZONA UNO',
      cabecera_destino_importada: 'CABECERA UNO',
      expreso_manual: 'EXPRESO SINTETICO',
      alto_cm: '50',
      ancho_cm: '40',
      largo_cm: '40',
    });
  });

  it('el resto de las columnas va a origen_tms con nombre snake_case y sin convertir', () => {
    expect(result.datos.origen_tms).toMatchObject({
      codigo_de_empresa: 'EMP01',
      codigo_erp: 'ERP-0001',
      nro_de_liquidacion: 'LIQ-0001',
      fecha_de_liquidacion: '15/10/2026 09:30:00',
      valor_calculado_tarifa: '1,250.50',
      total_a_facturar: '1,250.50',
      fecha_status: '01/10/2026 10:15:30',
      usuario_liquidacion: '',
      idliquidacion: '',
    });
    expect(Object.keys(result.datos.origen_tms ?? {})).toHaveLength(28);
  });

  it('las columnas mapeadas no se duplican en origen_tms', () => {
    const keys = Object.keys(result.datos.origen_tms ?? {});
    for (const mapped of [
      'nro_pedido',
      'peso_kgs',
      'codigo_postal',
      'cabecera',
      'cabecera_origen',
    ]) {
      expect(keys).not.toContain(mapped);
    }
  });
});
