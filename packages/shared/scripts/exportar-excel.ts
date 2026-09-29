#!/usr/bin/env -S npx tsx
/**
 * packages/shared/scripts/exportar-excel.ts
 * ---------------------------------------------------------------------------
 * Convierte una tabla maestra `reglas_tarifa` (JSON) en un Excel legible por
 * personas: tarifario por proveedor, matriz de precios por zona y detalle.
 *
 * Por qué existe: el JSON es para Firestore, no para mirar. Estas hojas
 * sirven para que operaciones y comercial revisen precios sin abrir un editor de
 * documentos ni escribir una consulta.
 *
 * USO
 *   npx tsx packages/shared/scripts/exportar-excel.ts \
 *     --tabla=./output/tabla_maestra.json \
 *     --output=./output/tarifa_por_proveedor.xlsx
 *
 *   Se pueden pasar varias tablas para comparar proveedores en un mismo libro:
 *     --tabla=./output/expreso_alfa.json --tabla=./output/logicargo.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import XLSX from 'xlsx';

import type { ReglaTarifa } from '@shared/tarifas';

interface Tabla {
  metadata: {
    id_proveedor: string;
    tarifario_id: string;
    generado_en: string;
    fuente: { cobertura: string; tarifas: string };
    conteos: Record<string, number>;
    zonas_sin_cobertura: string[];
    resolucion_zonas?: Array<{ zona: string; contra: string; via: string }>;
    filas_descartadas?: Array<{ motivo: string; origen: string }>;
    advertencias: string[];
  };
  reglas: ReglaTarifa[];
}

const AYUDA = `
exportar-excel.ts — convierte una tabla maestra JSON en un Excel de tarifas.

REQUERIDOS
  --tabla=<ruta>     Tabla maestra (formato json con metadata + reglas).
                     Repetible para comparar varios proveedores.
  --output=<ruta>    Excel de salida. Default: ./output/tarifa_por_proveedor.xlsx
  -h, --help         Esta ayuda.
`.trim();

function parsearArgs(argv: string[]): { tablas: string[]; output: string; ayuda: boolean } {
  const tablas: string[] = [];
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
    else if (nombre === 'output') output = valor;
  }

  return { tablas, output, ayuda };
}

/** Lee la tabla y normaliza los nombres de hoja (Excel no admite : \ / ? * [ ]). */
function cargarTabla(ruta: string): Tabla {
  const absoluta = resolve(ruta);
  if (!existsSync(absoluta)) {
    throw new Error(`No existe la tabla: ${ruta}`);
  }
  const tabla = JSON.parse(readFileSync(absoluta, 'utf8')) as Tabla;
  if (!Array.isArray(tabla.reglas)) {
    throw new Error(
      `${ruta} no tiene un arreglo "reglas". ` +
        `Usa --formato=json al correr el transformador (no array ni jsonl).`,
    );
  }
  return tabla;
}

function nombreHojaSeguro(base: string): string {
  return base.replace(/[\\/?*[\]:]/g, '-').slice(0, 31);
}

// ===========================================================================
// Hojas
// ===========================================================================

function precioDe(r: ReglaTarifa, tipo: 'PESO' | 'VOLUMEN'): number | null {
  const crudo =
    tipo === 'PESO'
      ? (r.precio_kg_base ?? r.precio_kg_excedente)
      : (r.precio_m3_base ?? r.precio_m3_excedente);
  return crudo === undefined ? null : Number(crudo);
}

function etiquetaRango(r: ReglaTarifa, tipo: 'PESO' | 'VOLUMEN'): string {
  const min = tipo === 'PESO' ? r.kg_min : r.m3_min;
  const max = tipo === 'PESO' ? r.kg_max : r.m3_max;
  const esExcedente =
    tipo === 'PESO' ? r.precio_kg_excedente !== undefined : r.precio_m3_excedente !== undefined;
  if (esExcedente) return `> ${max} (excedente)`;
  return min === max ? String(max) : `${min} a ${max}`;
}

/** "Resumen": de dónde salió todo, y qué quedó afuera. */
function hojaResumen(tablas: Tabla[]): XLSX.WorkSheet {
  const filas: unknown[][] = [['Reporte de tarifas por proveedor']];
  filas.push([]);
  filas.push(['Generado', new Date().toLocaleString('es-AR')]);

  for (const t of tablas) {
    filas.push([]);
    filas.push(['PROVEEDOR', t.metadata.id_proveedor]);
    filas.push(['Tarifario (id)', t.metadata.tarifario_id]);
    filas.push(['Generado el', t.metadata.generado_en]);
    filas.push(['Archivo cobertura', t.metadata.fuente.cobertura]);
    filas.push(['Archivo tarifas', t.metadata.fuente.tarifas]);
    filas.push([]);
    filas.push(['Métrica', 'Valor']);
    for (const [k, v] of Object.entries(t.metadata.conteos)) {
      filas.push([k, v]);
    }

    const zonas = t.metadata.resolucion_zonas ?? [];
    if (zonas.length > 0) {
      filas.push([]);
      filas.push(['Zona en cobertura', 'Columna en tarifario', 'Resolución']);
      for (const z of zonas) filas.push([z.zona, z.contra, z.via]);
    }

    const descartadas = t.metadata.filas_descartadas ?? [];
    if (descartadas.length > 0) {
      filas.push([]);
      filas.push(['Rutas descartadas', 'Motivo']);
      for (const d of descartadas) filas.push([d.origen, d.motivo]);
    }

    if (t.metadata.zonas_sin_cobertura.length > 0) {
      filas.push([]);
      filas.push(['Zonas sin cobertura', t.metadata.zonas_sin_cobertura.join(', ')]);
    }

    const avisos = t.metadata.advertencias ?? [];
    if (avisos.length > 0) {
      filas.push([]);
      filas.push(['Avisos']);
      for (const a of avisos) filas.push([a]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(filas);
  ws['!cols'] = [{ wch: 34 }, { wch: 60 }, { wch: 16 }];
  return ws;
}

/**
 * "Tarifa por proveedor": el crux de lacomparison.
 *
 * Filas = ruta + tipo + rango. Columnas = un proveedor cada una. Al
 * varias tablas en un mismo libro, sirve para comparar precios del mismo
 * tramo entre transportes.
 */
function hojaPorProveedor(tablas: Tabla[]): XLSX.WorkSheet {
  const proveedores = tablas.map((t) => t.metadata.id_proveedor);
  const encabezado = [
    'Origen',
    'Provincia destino',
    'Localidad destino',
    'Zona',
    'Tipo',
    'Rango',
    ...proveedores,
  ];

  // Indexamos (ruta, tipo, rango) -> precio por proveedor.
  // La clave es un JSON del vector de campos, no una concatenación con
  // separador: partir strings en variables delimitadas se rompe en
  // silencio cuando un dato trae el propio separador.
  type Clave = readonly [string, string, string, string, 'PESO' | 'VOLUMEN', string];
  const indice = new Map<string, Map<string, number | null>>();
  const campos = new Map<string, Clave>();

  for (const t of tablas) {
    const prov = t.metadata.id_proveedor;
    for (const r of t.reglas) {
      const tipo = r.tipo_regla;
      const clave: Clave = [
        r.provincia_origen,
        r.provincia_destino,
        r.localidad_destino,
        r.zona_destino,
        tipo,
        etiquetaRango(r, tipo),
      ];
      const k = JSON.stringify(clave);
      campos.set(k, clave);
      let porProv = indice.get(k);
      if (!porProv) {
        porProv = new Map();
        indice.set(k, porProv);
      }
      porProv.set(prov, precioDe(r, tipo));
    }
  }

  const claves = [...indice.keys()].sort((a, b) =>
    a.localeCompare(b, 'es', { numeric: true }),
  );

  const filas: unknown[][] = [encabezado];
  for (const k of claves) {
    const [provOrigen, provDestino, locDestino, zona, tipo, rango] = campos.get(k)!;
    const porProv = indice.get(k)!;
    filas.push([
      provOrigen,
      provDestino,
      locDestino,
      zona,
      tipo,
      rango,
      ...proveedores.map((p) => porProv.get(p) ?? null),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(filas);
  ws['!cols'] = [
    { wch: 16 },
    { wch: 20 },
    { wch: 30 },
    { wch: 18 },
    { wch: 10 },
    { wch: 20 },
    ...proveedores.map(() => ({ wch: 20 })),
  ];
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length - 1, c: encabezado.length - 1 } }),
  };
  return ws;
}

/**
 * "PESO - <proveedor>": matriz de precios por zona, la forma en que un
 * transporte presenta su tarifario. Filas = ruta + rango de peso,
 * columnas = zonas.
 */
function hojaMatriz(tabla: Tabla, tipo: 'PESO' | 'VOLUMEN'): XLSX.WorkSheet {
  const zonas = [...new Set(tabla.reglas.map((r) => r.zona_destino))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  );

  const encabezado = [
    'Origen',
    'Provincia destino',
    'Localidad destino',
    tipo === 'PESO' ? 'Rango (kg)' : 'Rango (m3)',
    ...zonas,
  ];

  type Clave = readonly [string, string, string, string];
  const mapa = new Map<string, Map<string, number | null>>();
  const campos = new Map<string, Clave>();

  for (const r of tabla.reglas) {
    if (r.tipo_regla !== tipo) continue;
    const clave: Clave = [
      r.provincia_origen,
      r.provincia_destino,
      r.localidad_destino,
      etiquetaRango(r, tipo),
    ];
    const k = JSON.stringify(clave);
    campos.set(k, clave);
    const fila = mapa.get(k) ?? new Map<string, number | null>();
    fila.set(r.zona_destino, precioDe(r, tipo));
    mapa.set(k, fila);
  }

  const filas: unknown[][] = [encabezado];
  for (const [k, porZona] of [...mapa].sort((a, b) =>
    a[0].localeCompare(b[0], 'es', { numeric: true }),
  )) {
    const [provOrigen, provDestino, locDestino, rango] = campos.get(k)!;
    filas.push([
      provOrigen,
      provDestino,
      locDestino,
      rango,
      ...zonas.map((z) => porZona.get(z) ?? null),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(filas);
  ws['!cols'] = [
    { wch: 16 },
    { wch: 22 },
    { wch: 30 },
    { wch: 18 },
    ...zonas.map(() => ({ wch: 18 })),
  ];
  return ws;
}

/**
 * "Reglas": el detalle campo por campo, con los importes como texto exacto.
 *
 * A diferencia de las hojas de precios, acá los importes van como string
 * decimal tal cual van a Firestore. Sirve para auditar contra el JSON.
 */
function hojaReglas(tabla: Tabla): XLSX.WorkSheet {
  const columnas = [
    'id_proveedor',
    'tarifario_id',
    'tipo_regla',
    'provincia_origen',
    'localidad_origen',
    'provincia_destino',
    'localidad_destino',
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

  const filas: unknown[][] = [columnas.map((c) => c)];
  for (const r of tabla.reglas) {
    filas.push(columnas.map((c) => (r[c] === undefined ? '' : r[c])));
  }

  const ws = XLSX.utils.aoa_to_sheet(filas);
  ws['!cols'] = columnas.map((c) => ({ wch: Math.max(c.length, 16) }));
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length - 1, c: columnas.length - 1 } }),
  };
  return ws;
}

// ===========================================================================
// Principal
// ===========================================================================

function ejecutar(): void {
  const { tablas: rutas, output, ayuda } = parsearArgs(process.argv.slice(2));
  if (ayuda) {
    process.stdout.write(`${AYUDA}\n`);
    return;
  }
  if (rutas.length === 0) {
    throw new Error(`Falta --tabla. Ver --help.`);
  }

  const tablas = rutas.map(cargarTabla);
  const destino = resolve(output === '' ? './output/tarifa_por_proveedor.xlsx' : output);

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hojaResumen(tablas), 'Resumen');
  XLSX.utils.book_append_sheet(
    libro,
    hojaPorProveedor(tablas),
    nombreHojaSeguro('Tarifa por proveedor'),
  );
  for (const t of tablas) {
    for (const tipo of ['PESO', 'VOLUMEN'] as const) {
      const n = t.reglas.filter((r) => r.tipo_regla === tipo).length;
      if (n === 0) continue;
      XLSX.utils.book_append_sheet(
        libro,
        hojaMatriz(t, tipo),
        nombreHojaSeguro(`${tipo} - ${t.metadata.id_proveedor}`),
      );
    }
  }
  // Con un solo proveedor el detalle no aporta; con varios, cada uno por separado.
  if (tablas.length === 1) {
    XLSX.utils.book_append_sheet(libro, hojaReglas(tablas[0]!), 'Reglas');
  } else {
    for (const t of tablas) {
      XLSX.utils.book_append_sheet(
        libro,
        hojaReglas(t),
        nombreHojaSeguro(`Reglas - ${t.metadata.id_proveedor}`),
      );
    }
  }

  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, XLSX.write(libro, { type: 'buffer' }), 'utf8');

  const resumen = tablas
    .map((t) => `${t.metadata.id_proveedor}=${t.reglas.length} reglas`)
    .join(' | ');
  process.stdout.write(`OK  ${destino}\n    ${resumen}\n`);
  process.stdout.write(
    `    hojas: ${libro.SheetNames.join(' | ')}\n` +
      `    proveedores comparados: ${
        new Set(tablas.map((t) => t.metadata.id_proveedor)).size
      }\n`,
  );
}

try {
  ejecutar();
} catch (error) {
  process.stderr.write(
    `\nERROR: ${error instanceof Error ? error.message : String(error)}\n\n`,
  );
  process.exitCode = 1;
}
