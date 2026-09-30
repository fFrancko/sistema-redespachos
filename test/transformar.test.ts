/**
 * Tests del transformador de tarifas. Correr con:  npm test
 * Unitarios (funciones puras) + extremo a extremo (CLI contra los fixtures).
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

import {
  claveZona,
  decimalDesdeTexto,
  encadenarRangos,
  ErrorIngesta,
  parsearRango,
  resolverZona,
  resolverZonas,
  type FilaRango,
} from '../packages/shared/scripts/transformar-tarifas';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = join(RAIZ, 'packages/shared/scripts/transformar-tarifas.ts');
const TMP = mkdtempSync(join(tmpdir(), 'redespachos-test-'));

const correr = (script: string, args: string[] = []) =>
  spawnSync(process.execPath, ['--import', 'tsx', script, ...args], {
    cwd: RAIZ,
    encoding: 'utf8',
  });

// ---------------------------------------------------------------------------
describe('decimalDesdeTexto', () => {
  const casos: Array<[string, string]> = [
    ['1.500', '1500'],
    ['1.500,00', '1500'],
    ['$ 1.234,56', '1234.56'],
    ['ARS 1500', '1500'],
    ['1,5', '1.5'],
    ['0,5', '0.5'],
    ['0.5', '0.5'],
    ['0.125', '0.125'],
    ['12.75', '12.75'],
    ['1234.5', '1234.5'],
    ['2.400.000', '2400000'],
    ['1,234.56', '1234.56'],
    ['1,234,567', '1234567'],
    ['-500', '-500'],
    ['(1.500,00)', '-1500'],
    ['  $ 1.000,50 ', '1000.5'],
  ];
  for (const [entrada, esperado] of casos) {
    it(`"${entrada}" -> ${esperado}`, () => {
      assert.equal(decimalDesdeTexto(entrada).toString(), esperado);
    });
  }
  for (const malo of ['', 'N/D', 'abc', '12%', '1.23.456', '1,2,3.4', '1..5', '--5']) {
    it(`rechaza "${malo}"`, () => {
      assert.throws(() => decimalDesdeTexto(malo), ErrorIngesta);
    });
  }
});

// ---------------------------------------------------------------------------
describe('parsearRango', () => {
  it('intervalo', () => {
    assert.deepEqual(parsearRango('0 a 10 kg', []), { min: '0', max: '10', esExcedente: false, soloTope: false });
  });
  it('coma decimal en m3', () => {
    const r = parsearRango('0,5 a 1 m3', []);
    assert.equal(r.min, '0.5');
    assert.equal(r.max, '1');
  });
  it('tope', () => {
    assert.deepEqual(parsearRango('Hasta 20', []), { min: '0', max: '20', esExcedente: false, soloTope: true });
  });
  it('excedente con operador', () => {
    assert.deepEqual(parsearRango('> 50 kg', []), { min: '50', max: '50', esExcedente: true, soloTope: false });
  });
  it('excedente semántico sin número (kg, m3, adicional)', () => {
    assert.deepEqual(parsearRango('kg excedente', []), { min: '0', max: '0', esExcedente: true, soloTope: false, inferirTopeAnterior: true });
    assert.deepEqual(parsearRango('m3 excedente', []), { min: '0', max: '0', esExcedente: true, soloTope: false, inferirTopeAnterior: true });
    assert.deepEqual(parsearRango('kilo adicional', []), { min: '0', max: '0', esExcedente: true, soloTope: false, inferirTopeAnterior: true });
    assert.deepEqual(parsearRango('por cada kg excedente', []), { min: '0', max: '0', esExcedente: true, soloTope: false, inferirTopeAnterior: true });
    assert.deepEqual(parsearRango('excedente', []), { min: '0', max: '0', esExcedente: true, soloTope: false, inferirTopeAnterior: true });
  });
  it('rango invertido', () => {
    assert.throws(() => parsearRango('100 a 50 kg', []), ErrorIngesta);
  });
});

// ---------------------------------------------------------------------------
describe('claveZona', () => {
  it('"Buenos Aires" NO se descarta', () => {
    assert.equal(claveZona('Buenos Aires'), 'buenos aires');
  });
  it('"Bs As" se unifica con "Buenos Aires"', () => {
    assert.equal(claveZona('Bs As'), 'buenos aires');
    assert.equal(claveZona('BsAs'), 'buenos aires');
  });
  it('numeradas', () => {
    assert.equal(claveZona('Zona facturación 2'), 'z2');
    assert.equal(claveZona('Zona Facturacion 12'), 'z12');
  });
  it('marcadores vacios', () => {
    assert.equal(claveZona('-'), null);
    assert.equal(claveZona('N/D'), null);
    assert.equal(claveZona(null), null);
  });
});

describe('resolverZona', () => {
  it('exacta', () => {
    assert.deepEqual(resolverZona('tucuman', ['tucuman', 'salta']), { clave: 'tucuman', motivo: 'exacta' });
  });
  it('prefijo en limite de palabra', () => {
    assert.deepEqual(resolverZona('santiago del estero', ['santiago', 'salta']), {
      clave: 'santiago',
      motivo: 'prefijo',
    });
    assert.deepEqual(resolverZona('chubut', ['chubut norte']), { clave: 'chubut norte', motivo: 'prefijo' });
  });
  it('NO cruza prefijos que cortan una palabra', () => {
    assert.equal(resolverZona('salta', ['sal', 'jujuy']).clave, null);
    assert.equal(resolverZona('riojano', ['rio', 'la rioja']).clave, null);
  });
  it('columnas que extienden la zona: ambigua si hay mas de una', () => {
    assert.equal(resolverZona('gba', ['gba norte', 'gba sur']).motivo, 'ambigua');
    assert.equal(resolverZona('gba', ['gba norte', 'gba']).motivo, 'exacta');
  });
  it('prefijo unico anidado: gana el mas largo', () => {
    assert.equal(resolverZona('santiago del estero capital', ['santiago', 'santiago del estero']).clave, 'santiago del estero');
  });
});

describe('resolverZonas', () => {
  it('zonas que compiten por la misma columna se anulan', () => {
    const r = resolverZonas(['santa fe', 'santa cruz'], ['santa', 'cordoba']);
    assert.equal(r.get('santa fe')?.clave, null);
    assert.equal(r.get('santa cruz')?.clave, null);
    assert.equal(r.get('santa fe')?.motivo, 'ambigua');
  });
  it('columna ya tomada por coincidencia exacta no se comparte', () => {
    const r = resolverZonas(['santa', 'santa fe'], ['santa']);
    assert.equal(r.get('santa')?.motivo, 'exacta');
    assert.equal(r.get('santa fe')?.clave, null);
  });
  it('prefijo sin competencia se cruza', () => {
    const r = resolverZonas(['santiago del estero', 'tucuman'], ['santiago', 'tucuman']);
    assert.deepEqual(r.get('santiago del estero'), { clave: 'santiago', motivo: 'prefijo' });
    assert.equal(r.get('tucuman')?.motivo, 'exacta');
  });
});

// ---------------------------------------------------------------------------
describe('encadenarRangos  ->  (min, max]', () => {
  const fila = (texto: string, n: number): FilaRango => {
    const { soloTope, inferirTopeAnterior, ...rango } = parsearRango(texto, []);
    return {
      rango,
      soloTope,
      ...(inferirTopeAnterior !== undefined ? { inferirTopeAnterior } : {}),
      numeroFila: n,
      etiqueta: texto,
      precios: new Map(),
    };
  };
  const armar = (textos: string[]) => textos.map((t, i) => fila(t, i + 1));
  const salida = (filas: FilaRango[]) => filas.map((f) => `${f.rango.min}-${f.rango.max}${f.rango.esExcedente ? '+' : ''}`);

  it('topes acumulados: (0;10], (10;20], (20;50]', () => {
    const f = armar(['Hasta 10', 'Hasta 20', 'Hasta 50']);
    encadenarRangos(f, true, 'PESO', 't', []);
    assert.deepEqual(salida(f), ['0-10', '10-20', '20-50']);
  });
  it('excedente semántico sin número hereda tope anterior (kg)', () => {
    const f = armar(['Hasta 10', 'Hasta 20', 'kg excedente']);
    encadenarRangos(f, true, 'PESO', 't', []);
    assert.deepEqual(salida(f), ['0-10', '10-20', '20-20+']);
  });
  it('excedente semántico sin número hereda tope anterior (m3)', () => {
    const f = armar(['0 a 0.5 m3', '0.5 a 1 m3', 'm3 excedente']);
    encadenarRangos(f, false, 'VOLUMEN', 't', []);
    assert.deepEqual(salida(f), ['0-0.5', '0.5-1', '1-1+']);
  });
  it('excedente como primera fila arroja error', () => {
    assert.throws(() => encadenarRangos(armar(['kg excedente']), false, 'PESO', 't', []), ErrorIngesta);
  });
  it('inconsistencia de unidad genera advertencia', () => {
    const f = armar(['Hasta 10', 'm3 excedente']);
    const av: string[] = [];
    encadenarRangos(f, true, 'PESO', 't', av);
    assert.equal(av.length, 1);
    assert.match(av[0]!, /menciona m3 en una hoja de peso/);
  });
  it('intervalos contiguos se respetan', () => {
    const f = armar(['0 a 10 kg', '10 a 25 kg', '25 a 50 kg', '> 50 kg']);
    const av: string[] = [];
    encadenarRangos(f, false, 'PESO', 't', av);
    assert.deepEqual(salida(f), ['0-10', '10-25', '25-50', '50-50+']);
    assert.deepEqual(av, []);
  });
  it('paso entero "51 a 100" se alinea al tope anterior (sin hueco)', () => {
    const f = armar(['1 a 50 kg', '51 a 100 kg']);
    encadenarRangos(f, false, 'PESO', 't', []);
    assert.deepEqual(salida(f), ['0-50', '50-100']);
  });
  it('hueco mayor al paso: se conserva y avisa', () => {
    const f = armar(['0 a 10 kg', '20 a 30 kg']);
    const av: string[] = [];
    encadenarRangos(f, false, 'PESO', 't', av);
    assert.deepEqual(salida(f), ['0-10', '20-30']);
    assert.equal(av.length, 1);
  });
  it('solape es error', () => {
    assert.throws(() => encadenarRangos(armar(['0 a 10 kg', '5 a 20 kg']), false, 'PESO', 't', []), ErrorIngesta);
  });
  it('topes fuera de orden es error', () => {
    assert.throws(() => encadenarRangos(armar(['Hasta 20', 'Hasta 10']), true, 'PESO', 't', []), ErrorIngesta);
  });
  it('nada puede seguir a un excedente', () => {
    assert.throws(() => encadenarRangos(armar(['0 a 10 kg', '> 10 kg', '10 a 20 kg']), false, 'PESO', 't', []), ErrorIngesta);
  });
});

// ---------------------------------------------------------------------------
describe('CLI contra fixtures', () => {
  before(() => {
    assert.equal(correr(join(RAIZ, 'test/fixtures/generar-fixtures.ts')).status, 0);
    assert.equal(correr(join(RAIZ, 'test/fixtures/bad-gen.ts')).status, 0);
  });

  const base = (extra: string[]) => [
    '--proveedor=EXPRESO_ALFA',
    `--cobertura=${join(RAIZ, 'test/fixtures/input/cobertura.xlsx')}`,
    `--tarifas=${join(RAIZ, 'test/fixtures/input/tarifas.xlsx')}`,
    ...extra,
  ];

  it('genera 48 reglas con rangos (min, max]', () => {
    const out = join(TMP, 'tabla.json');
    const r = correr(SCRIPT, base([`--output=${out}`]));
    assert.equal(r.status, 0, r.stderr);
    const { metadata, reglas } = JSON.parse(readFileSync(out, 'utf8')) as {
      metadata: { conteos: Record<string, number> };
      reglas: Array<Record<string, string>>;
    };
    assert.equal(reglas.length, 48);
    assert.equal(metadata.conteos.documentos_duplicados_eliminados, 8);
    const pesos = reglas
      .filter((x) => x.tipo_regla === 'PESO' && x.localidad_destino === 'Cordoba Capital')
      .map((x) => `${x.kg_min}-${x.kg_max}`);
    assert.deepEqual(pesos, ['0-10', '10-25', '25-50', '50-50']);
    for (const x of reglas) for (const [k, v] of Object.entries(x)) {
      if (/^(kg|m3|precio|costo)/.test(k)) assert.equal(typeof v, 'string', k);
    }
    const cordoba = reglas.find((x) => x.localidad_destino === 'Cordoba Capital');
    assert.equal(cordoba?.codigo_postal, '5000');
    assert.equal(cordoba?.codigo_postal_destino, '5000');
  });

  it('--estricto falla por la zona sin tarifa', () => {
    const r = correr(SCRIPT, base([`--output=${join(TMP, 'x.json')}`, '--estricto']));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /z9/);
  });

  const malos: Array<[string, 'cob' | 'tar', RegExp]> = [
    ['cob.xlsx', 'cob', /Destino Provincia vacio/],
    ['tar_precio.xlsx', 'tar', /no es un importe/],
    ['tar_rango.xlsx', 'tar', /Rango de la cabecera vacio/],
    ['tar_inv.xlsx', 'tar', /Rango invertido/],
    ['tar_neg.xlsx', 'tar', /Precio negativo/],
    ['tar_solape.xlsx', 'tar', /solapados/],
    ['tar_pct.xlsx', 'tar', /porcentaje/],
  ];
  for (const [archivo, lado, patron] of malos) {
    it(`rechaza ${archivo}`, () => {
      const mal = join(RAIZ, 'test/fixtures/bad', archivo);
      const cob = lado === 'cob' ? mal : join(RAIZ, 'test/fixtures/input/cobertura.xlsx');
      const tar = lado === 'tar' ? mal : join(RAIZ, 'test/fixtures/input/tarifas.xlsx');
      const r = correr(SCRIPT, ['--proveedor=X', `--cobertura=${cob}`, `--tarifas=${tar}`, `--output=${join(TMP, 'y.json')}`, '--dry-run']);
      assert.equal(r.status, 1);
      assert.match(r.stderr, patron);
    });
  }

  it('tarifario "Hasta KG" con hojas invertidas y zona "Buenos Aires"', () => {
    const cob = join(TMP, 'cob_acum.xlsx');
    const tar = join(TMP, 'tar_acum.xlsx');
    const libro = (hojas: Array<[string, unknown[][]]>, ruta: string) => {
      const wb = XLSX.utils.book_new();
      for (const [n, filas] of hojas) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), n);
      XLSX.writeFile(wb, ruta);
    };
    libro([['COBERTURA', [
      ['Origen', 'Destino Provincia', 'Destino Localidad', 'Zona Facturacion'],
      ['Buenos Aires / Palermo', 'Buenos Aires', 'La Plata', 'Buenos Aires'],
      ['Buenos Aires / Palermo', 'Santa Fe', 'Rosario', 'Santa Fe'],
    ]]], cob);
    libro([
      ['HOJA VOLUMEN', [['Hasta M3', 'Bs As', 'Santa Fe'], [1, 100, 200], [2, 150, 250]]],
      ['HOJA PESO', [['Hasta KG', 'Bs As', 'Santa Fe'], [5, 10, 20], [10, 15, 25], [20, 18, 30]]],
    ], tar);
    const out = join(TMP, 'acum.json');
    const r = correr(SCRIPT, ['--proveedor=T', `--cobertura=${cob}`, `--tarifas=${tar}`, `--output=${out}`, '--hoja-peso=HOJA PESO', '--hoja-volumen=HOJA VOLUMEN']);
    assert.equal(r.status, 0, r.stderr);
    const { reglas } = JSON.parse(readFileSync(out, 'utf8')) as { reglas: Array<Record<string, string>> };
    const laPlata = reglas
      .filter((x) => x.localidad_destino === 'La Plata' && x.tipo_regla === 'PESO')
      .map((x) => `${x.kg_min}-${x.kg_max}=${x.precio_kg_base}`);
    assert.deepEqual(laPlata, ['0-5=10', '5-10=15', '10-20=18']);
    assert.equal(reglas.filter((x) => x.localidad_destino === 'Rosario').length, 5);
  });
});

