#!/usr/bin/env -S npx tsx
/**
 * packages/shared/scripts/exportar-excel.ts
 * ---------------------------------------------------------------------------
 * Exporta una o varias tablas maestras JSON a un único Excel con la hoja
 * "Reglas Proveedores", apilando las reglas de los proveedores una debajo
 * de la otra con el formato exacto de Firestore / TMS.
 *
 * USO:
 *   npx tsx packages/shared/scripts/exportar-excel.ts \
 *     --tabla=./output/hacha_de_piedra.json \
 *     --tabla=./output/logicargo.json \
 *     --output=./output/tarifa_por_proveedor.xlsx
 *
 *   O exportar todos los JSON de una carpeta:
 *     npx tsx packages/shared/scripts/exportar-excel.ts --dir=./output
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import XLSX from 'xlsx';

import type { ReglaTarifa } from '@shared/tarifas';

interface Tabla {
  metadata?: {
    id_proveedor?: string;
    tarifario_id?: string;
  };
  reglas: ReglaTarifa[];
}

const COLUMNAS = [
  'id_proveedor',
  'tarifario_id',
  'tipo_regla',
  'provincia_origen',
  'localidad_origen',
  'provincia_destino',
  'localidad_destino',
  'codigo_postal',
  'zona_destino',
  'kg_min',
  'kg_max',
  'm3_min',
  'm3_max',
  'costo_base_viaje',
  'precio_kg_base',
  'precio_m3_base',
  'precio_kg_excedente',
  'precio_m3_excedente',
  'aplica_colecta',
  'costo_colecta',
  'estado',
] as const;

type NombreColumna = typeof COLUMNAS[number];

const AYUDA = `
exportar-excel.ts — exporta tablas maestras JSON a un único Excel con las reglas de los proveedores.

OPCIONES:
  --tabla=<ruta>     Archivo JSON de tabla maestra (repetible).
  --dir=<carpeta>    Carpeta con archivos JSON a procesar (ej. ./output).
  --output=<ruta>    Ruta del archivo Excel generado. Default: ./output/tarifa_por_proveedor.xlsx
  -h, --help         Muestra esta ayuda.
`.trim();

function parsearArgs(argv: string[]): { tablas: string[]; dir: string; output: string; ayuda: boolean } {
  const tablas: string[] = [];
  let dir = '';
  let output = '';
  let ayuda = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === '-h' || arg === '--help') {
      ayuda = true;
      continue;
    }
    const eq = arg.indexOf('=');
    const nombre = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    const valor = eq === -1 ? argv[++i] ?? '' : arg.slice(eq + 1);
    if (nombre === 'tabla') tablas.push(valor);
    else if (nombre === 'dir') dir = valor;
    else if (nombre === 'output') output = valor;
  }

  return { tablas, dir, output, ayuda };
}

function cargarTabla(ruta: string): Tabla {
  const absoluta = resolve(ruta);
  if (!existsSync(absoluta)) {
    throw new Error(`No existe la tabla: ${ruta}`);
  }
  const tabla = JSON.parse(readFileSync(absoluta, 'utf8')) as Tabla;
  if (!Array.isArray(tabla.reglas)) {
    throw new Error(`${ruta} no contiene un arreglo "reglas".`);
  }
  return tabla;
}

function formatearValor(r: ReglaTarifa, col: NombreColumna): unknown {
  if (col === 'codigo_postal') {
    const cp = r.codigo_postal ?? r.codigo_postal_destino;
    if (cp === undefined || cp === '') return '';
    return /^\d+$/.test(cp) ? Number(cp) : cp;
  }
  const valor = (r as unknown as Record<string, unknown>)[col];
  if (valor === undefined || valor === null) return '';
  return valor;
}

export function construirHojaReglas(tablas: Tabla[]): XLSX.WorkSheet {
  const filas: unknown[][] = [COLUMNAS.map((c) => c)];

  for (const t of tablas) {
    for (const r of t.reglas) {
      filas.push(COLUMNAS.map((col) => formatearValor(r, col)));
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(filas);
  ws['!cols'] = COLUMNAS.map((col) => ({
    wch: Math.max(col.length + 2, col.includes('provincia') || col.includes('localidad') ? 22 : 16),
  }));
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: filas.length - 1, c: COLUMNAS.length - 1 },
    }),
  };
  return ws;
}

function ejecutar(): void {
  const { tablas: tablasArgs, dir, output, ayuda } = parsearArgs(process.argv.slice(2));
  if (ayuda) {
    process.stdout.write(`${AYUDA}\n`);
    return;
  }

  const rutas: string[] = [...tablasArgs];

  if (dir !== '') {
    const dirAbs = resolve(dir);
    if (existsSync(dirAbs) && statSync(dirAbs).isDirectory()) {
      const archivos = readdirSync(dirAbs)
        .filter((f) => f.endsWith('.json'))
        .sort((a, b) => a.localeCompare(b, 'es'))
        .map((f) => join(dirAbs, f));
      rutas.push(...archivos);
    }
  }

  // Si no se pasó ni --tabla ni --dir, pero existe ./output con archivos json, los usa
  if (rutas.length === 0) {
    const outDefault = resolve('./output');
    if (existsSync(outDefault) && statSync(outDefault).isDirectory()) {
      const archivos = readdirSync(outDefault)
        .filter((f) => f.endsWith('.json') && f !== 'package.json')
        .sort((a, b) => a.localeCompare(b, 'es'))
        .map((f) => join(outDefault, f));
      rutas.push(...archivos);
    }
  }

  // Desduplicar rutas
  const rutasUnicas = [...new Set(rutas.map((r) => resolve(r)))];

  if (rutasUnicas.length === 0) {
    throw new Error('No se especificaron tablas para exportar. Usá --tabla=<archivo.json> o --dir=<carpeta>.');
  }

  const tablas: Tabla[] = [];
  for (const r of rutasUnicas) {
    try {
      const t = cargarTabla(r);
      tablas.push(t);
    } catch {
      // Ignorar archivos json que no sean tablas maestras válidas (ej. logs, configs)
    }
  }

  if (tablas.length === 0) {
    throw new Error('Ninguno de los archivos JSON especificados contiene un arreglo "reglas" válido.');
  }

  const destino = resolve(output === '' ? './output/tarifa_por_proveedor.xlsx' : output);
  const libro = XLSX.utils.book_new();
  const ws = construirHojaReglas(tablas);
  XLSX.utils.book_append_sheet(libro, ws, 'Reglas Proveedores');

  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, XLSX.write(libro, { type: 'buffer' }), 'utf8');

  const totalReglas = tablas.reduce((acc, t) => acc + t.reglas.length, 0);
  const proveedores = [...new Set(tablas.flatMap((t) => t.reglas.map((r) => r.id_proveedor)))];

  process.stdout.write(`OK  ${destino}\n`);
  process.stdout.write(`    hoja: "Reglas Proveedores" (${totalReglas} reglas)\n`);
  process.stdout.write(`    proveedores incluidos: ${proveedores.join(', ')}\n`);
}

try {
  ejecutar();
} catch (error) {
  process.stderr.write(
    `\nERROR: ${error instanceof Error ? error.message : String(error)}\n\n`,
  );
  process.exitCode = 1;
}
