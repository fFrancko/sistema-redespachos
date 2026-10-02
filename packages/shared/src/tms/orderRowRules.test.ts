import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { describe, expect, it } from 'vitest';
import { normalizeHeader } from './headers';
import { parseTmsRow } from './orderRow';
import type { TmsRawRow, TmsRowContext } from './orderRow';

const records = parse(
  readFileSync(
    fileURLToPath(new URL('../../test/fixtures/pedidos_tms_sintetico.csv', import.meta.url)),
    'utf8',
  ),
  { columns: true, skip_empty_lines: true },
) as Record<string, string>[];

const context: TmsRowContext = {
  sucursales_permitidas: ['SUCURSAL NORTE', 'SUCURSAL SUR'],
  tolerancia_volumen_pct: '5',
};

// Fila válida completa del fixture (SINT-0001).
const base = records[0] as Record<string, string>;

// Reemplaza (o quita, si value es undefined) una celda por su encabezado normalizado.
function setCells(
  row: Record<string, string>,
  changes: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const targets = new Set(Object.keys(changes).map(normalizeHeader));
  const next = Object.fromEntries(
    Object.entries(row).filter(([key]) => !targets.has(normalizeHeader(key))),
  );
  for (const [header, value] of Object.entries(changes)) {
    if (value !== undefined) next[header] = value;
  }
  return next;
}

const errorKeys = (row: TmsRawRow, ctx: TmsRowContext = context): string[] =>
  parseTmsRow(row, ctx)
    .errores.map((error) => `${error.campo}:${error.codigo}`)
    .sort();

describe('parseTmsRow: reglas puntuales', () => {
  it('la fila base es válida', () => {
    expect(errorKeys(base)).toEqual([]);
  });

  it('sin sucursales_permitidas no se valida la cabecera', () => {
    const row = setCells(base, { 'Cabecera Origen': 'SUCURSAL OESTE' });
    expect(errorKeys(row, { tolerancia_volumen_pct: '5' })).toEqual([]);
    expect(errorKeys(row)).toEqual(['cabecera_origen:CABECERA_NO_PERMITIDA']);
  });

  it('la cabecera se compara con norm (tildes, mayúsculas y espacios)', () => {
    expect(errorKeys(setCells(base, { 'Cabecera Origen': '  súcursal   NORTE ' }))).toEqual([]);
  });

  it('la tolerancia de volumen sale del contexto', () => {
    const row = setCells(base, {
      alto_cm: '100',
      ancho_cm: '100',
      largo_cm: '100',
    });
    expect(parseTmsRow(row, context).observaciones).toEqual(['VOLUMEN_INCONSISTENTE']);
    expect(parseTmsRow(row, { ...context, tolerancia_volumen_pct: '2000' }).observaciones).toEqual(
      [],
    );
  });

  it('una diferencia dentro de la tolerancia no genera observación', () => {
    // 0.08 m3 declarados contra 0.0816 de control: 2% de diferencia.
    const row = setCells(base, {
      alto_cm: '51',
      ancho_cm: '40',
      largo_cm: '40',
    });
    expect(parseTmsRow(row, context).observaciones).toEqual([]);
  });

  it('el volumen de control no genera observación sin las tres dimensiones', () => {
    const row = setCells(base, {
      alto_cm: '100',
      ancho_cm: '',
      largo_cm: '100',
    });
    expect(parseTmsRow(row, context).observaciones).toEqual([]);
  });

  it('dimensiones con formato inválido son FORMATO_INVALIDO', () => {
    expect(errorKeys(setCells(base, { alto_cm: '5,5' }))).toEqual(['alto_cm:FORMATO_INVALIDO']);
  });

  it('AFORADO_CERO y AFORADO_MENOR_A_PESO son excluyentes', () => {
    expect(parseTmsRow(setCells(base, { 'Peso Aforado': '0' }), context).observaciones).toEqual([
      'AFORADO_CERO',
    ]);
    expect(parseTmsRow(setCells(base, { 'Peso Aforado': '12.50' }), context).observaciones).toEqual(
      [],
    );
    expect(parseTmsRow(setCells(base, { 'Peso Aforado': '12.49' }), context).observaciones).toEqual(
      ['AFORADO_MENOR_A_PESO'],
    );
  });

  it('peso_aforado vacío es CAMPO_OBLIGATORIO; en 0 no es error', () => {
    expect(errorKeys(setCells(base, { 'Peso Aforado': '' }))).toEqual([
      'peso_aforado:CAMPO_OBLIGATORIO',
    ]);
    expect(errorKeys(setCells(base, { 'Peso Aforado': '0' }))).toEqual([]);
  });

  it('peso y volumen: vacío o 0 son errores de dato; texto ilegible es de formato', () => {
    expect(errorKeys(setCells(base, { 'Volumen M3': '' }))).toEqual([
      'volumen_m3:VOLUMEN_INVALIDO',
    ]);
    expect(errorKeys(setCells(base, { 'Volumen M3': '0,08' }))).toEqual([
      'volumen_m3:FORMATO_INVALIDO',
    ]);
    expect(errorKeys(setCells(base, { 'Peso Kgs': 'doce' }))).toEqual([
      'peso_kgs:FORMATO_INVALIDO',
    ]);
    expect(errorKeys(setCells(base, { 'Peso Kgs': '0.0000' }))).toEqual(['peso_kgs:PESO_INVALIDO']);
  });

  it('valor_declarado vacío no es error: genera la observación', () => {
    const result = parseTmsRow(setCells(base, { 'Valor Declarado': '' }), context);
    expect(result.errores).toEqual([]);
    expect(result.observaciones).toEqual(['VALOR_DECLARADO_FALTANTE']);
    expect(result.datos.valor_declarado).toBeUndefined();
  });

  it('valor_declarado en 0 es un valor válido: no es faltante', () => {
    const result = parseTmsRow(setCells(base, { 'Valor Declarado': '0.00' }), context);
    expect(result.errores).toEqual([]);
    expect(result.observaciones).toEqual([]);
    expect(result.datos.valor_declarado).toBe(0);
  });

  it('valor_declarado se redondea half-up a centavo', () => {
    expect(
      parseTmsRow(setCells(base, { 'Valor Declarado': '10.005' }), context).datos.valor_declarado,
    ).toBe(1001);
  });

  it('un CP con formato distinto de 4 dígitos no se normaliza en silencio', () => {
    for (const cp of ['1406.0', ' 14 06', '140', '14060', 'C1406']) {
      const result = parseTmsRow(setCells(base, { 'Código Postal': cp }), context);
      expect(result.errores.map((error) => error.codigo)).toEqual(['FORMATO_INVALIDO']);
      expect(result.datos.codigo_postal).toBeUndefined();
    }
  });

  it('las columnas ausentes cuentan como vacías', () => {
    expect(errorKeys(setCells(base, { 'Peso Kgs': undefined }))).toEqual([
      'peso_kgs:PESO_INVALIDO',
    ]);
    expect(errorKeys(setCells(base, { 'Nro Pedido': undefined }))).toEqual([
      'nro_pedido:CAMPO_OBLIGATORIO',
    ]);
  });

  it('cantidad_bultos acepta solo enteros mayores que 0', () => {
    expect(errorKeys(setCells(base, { 'Cantidad de Bultos': '' }))).toEqual([
      'cantidad_bultos:CAMPO_OBLIGATORIO',
    ]);
    for (const value of ['0', '1.5', '-1', 'dos']) {
      expect(errorKeys(setCells(base, { 'Cantidad de Bultos': value }))).toEqual([
        'cantidad_bultos:FORMATO_INVALIDO',
      ]);
    }
  });

  it('los campos opcionales de texto vacíos no quedan en datos', () => {
    const result = parseTmsRow(
      setCells(base, { Destinatario: '', 'Codigo de Expreso': '' }),
      context,
    );
    expect(result.datos.destinatario).toBeUndefined();
    expect(result.datos.expreso_manual).toBeUndefined();
    expect(result.errores).toEqual([]);
  });

  it('una fecha inexistente en una columna de origen_tms es FORMATO_INVALIDO con el nombre snake_case', () => {
    expect(errorKeys(setCells(base, { 'Fecha Status': '31/04/2026 10:00:00' }))).toEqual([
      'fecha_status:FORMATO_INVALIDO',
    ]);
  });

  it('las observaciones dependientes del canalizador y DUPLICADO no se calculan acá', () => {
    for (const record of records) {
      const result = parseTmsRow(record, context);
      expect(result.errores.map((error) => error.codigo)).not.toContain('DUPLICADO');
      for (const code of [
        'CP_NO_EN_CANALIZADOR',
        'CP_AMBIGUO',
        'PROVINCIA_DIFIERE',
        'DESTINO_DIFIERE_TMS',
      ]) {
        expect(result.observaciones).not.toContain(code);
      }
    }
  });

  it('ignora columnas desconocidas', () => {
    expect(errorKeys(setCells(base, { 'Columna Rara': 'x' }))).toEqual([]);
  });
});
