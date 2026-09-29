/**
 * Valida una tabla maestra ya generada: importes como strings decimales,
 * campos coherentes con el tipo de regla, rangos (min, max] contiguos y sin
 * solapes, y documentos no duplicados. Opcionalmente contrasta los precios
 * contra el Excel de tarifas original.
 *
 *   npx tsx test/fixtures/verificar.ts <tabla_maestra.json> \
 *     [--proveedor=ID] [--tarifas=<tarifas.xlsx> [--hoja-peso=<nombre|indice>]]
 *
 * Sale con codigo 1 si encuentra problemas.
 */
import { readFileSync } from 'node:fs';
import Decimal from 'decimal.js';
import XLSX from 'xlsx';

const args = process.argv.slice(2);
const opt = (nombre: string): string | undefined =>
  args.find((a) => a.startsWith(`--${nombre}=`))?.slice(nombre.length + 3);
const rutaJson = args.find((a) => !a.startsWith('--'));
if (!rutaJson) {
  process.stderr.write(
    'Uso: verificar.ts <tabla_maestra.json> [--proveedor=ID] [--tarifas=<xlsx>] [--hoja-peso=<n>]\n',
  );
  process.exit(1);
}
const rutaTarifas = opt('tarifas');

interface Salida {
  metadata: {
    id_proveedor: string;
    conteos: Record<string, number>;
    resolucion_zonas?: Array<{ zona: string; contra: string; via: string }>;
    filas_descartadas?: Array<{ motivo: string; origen: string }>;
    zonas_sin_cobertura?: string[];
    advertencias?: string[];
  };
  reglas: Array<Record<string, string | boolean>>;
}
const salida = JSON.parse(readFileSync(rutaJson, 'utf8')) as Salida;
const { reglas, metadata } = salida;
const proveedor = opt('proveedor') ?? metadata.id_proveedor;

process.stdout.write(`archivo: ${rutaJson}\nreglas: ${reglas.length}\n\n`);
process.stdout.write(`-- resolucion de zonas --\n`);
for (const r of metadata.resolucion_zonas ?? []) {
  process.stdout.write(`  ${r.zona.padEnd(24)} -> ${r.contra.padEnd(14)} (${r.via})\n`);
}
process.stdout.write(`\n-- zonas sin cobertura: ${JSON.stringify(metadata.zonas_sin_cobertura ?? [])}\n`);
process.stdout.write(`-- filas descartadas:\n`);
for (const d of metadata.filas_descartadas ?? []) {
  process.stdout.write(`  ${d.origen}  <- ${d.motivo}\n`);
}
process.stdout.write(`-- advertencias:\n`);
for (const a of metadata.advertencias ?? []) process.stdout.write(`  ${a}\n`);

const errores: string[] = [];

// ---- Tipos y campos obligatorios ---------------------------------------
for (const [i, r] of reglas.entries()) {
  if (r.id_proveedor !== proveedor) errores.push(`#${i} id_proveedor=${String(r.id_proveedor)}`);
  if (r.tipo_regla !== 'PESO' && r.tipo_regla !== 'VOLUMEN') {
    errores.push(`#${i} tipo_regla=${String(r.tipo_regla)}`);
  }
  if (r.estado !== 'BORRADOR') errores.push(`#${i} estado=${String(r.estado)}`);
  if (typeof r.aplica_colecta !== 'boolean') errores.push(`#${i} aplica_colecta`);
  if (typeof r.costo_base_viaje !== 'string') errores.push(`#${i} costo_base_viaje`);
}

// Campos numericos: deben ser string decimal, nunca number.
const numericos = [
  'kg_min', 'kg_max', 'm3_min', 'm3_max',
  'costo_base_viaje', 'precio_kg_base', 'precio_m3_base',
  'precio_kg_excedente', 'precio_m3_excedente',
];
const RE_DECIMAL = /^-?\d+(\.\d+)?$/;
for (const [i, r] of reglas.entries()) {
  for (const campo of numericos) {
    const v = r[campo];
    if (v === undefined) continue;
    if (typeof v !== 'string') {
      errores.push(`#${i} ${campo} es ${typeof v}, debe ser string`);
    } else if (!RE_DECIMAL.test(v)) {
      errores.push(`#${i} ${campo}="${v}" no es decimal valido`);
    }
  }
  const esPeso = r.tipo_regla === 'PESO';
  const [pMin, pMax, pBase, pExc] = esPeso
    ? (['kg_min', 'kg_max', 'precio_kg_base', 'precio_kg_excedente'] as const)
    : (['m3_min', 'm3_max', 'precio_m3_base', 'precio_m3_excedente'] as const);
  const [oMin, oMax] = esPeso ? (['m3_min', 'm3_max'] as const) : (['kg_min', 'kg_max'] as const);
  if (r[pMin] === undefined || r[pMax] === undefined) errores.push(`#${i} ${r.tipo_regla} sin ${pMin}/${pMax}`);
  if (r[oMin] !== undefined || r[oMax] !== undefined) errores.push(`#${i} ${r.tipo_regla} con campos del otro tipo`);
  if (r[pBase] === undefined && r[pExc] === undefined) errores.push(`#${i} ${r.tipo_regla} sin precio`);
  if (r[pBase] !== undefined && r[pExc] !== undefined) errores.push(`#${i} ${r.tipo_regla} con precio base y excedente`);

  // Excedente: min == max. Rango: min < max (intervalo (min, max]).
  const lo = Number(r[pMin]);
  const hi = Number(r[pMax]);
  if (r[pExc] !== undefined ? lo !== hi : !(lo < hi)) {
    errores.push(`#${i} ${pMin}=${lo} ${pMax}=${hi} incoherentes para ${r[pExc] !== undefined ? 'excedente' : 'rango'}`);
  }
}

// ---- Rangos (min, max] contiguos y sin solapes, por ruta y tipo ---------
const porRuta = new Map<string, Array<Record<string, string | boolean>>>();
for (const r of reglas) {
  const k = [
    r.tipo_regla, r.provincia_origen, r.localidad_origen,
    r.provincia_destino, r.localidad_destino, r.zona_destino,
  ].join('|');
  const lista = porRuta.get(k) ?? [];
  lista.push(r);
  porRuta.set(k, lista);
}
for (const [k, lista] of porRuta) {
  const peso = lista[0]?.tipo_regla === 'PESO';
  const [cMin, cMax, cExc] = peso
    ? (['kg_min', 'kg_max', 'precio_kg_excedente'] as const)
    : (['m3_min', 'm3_max', 'precio_m3_excedente'] as const);
  const rangos = lista
    .filter((r) => r[cExc] === undefined)
    .sort((a, b) => Number(a[cMin]) - Number(b[cMin]));
  let tope = new Decimal(0);
  for (const r of rangos) {
    const min = new Decimal(String(r[cMin]));
    if (!min.equals(tope)) {
      errores.push(`ruta ${k}: ${cMin}=${min} no continua el tope anterior ${tope} (hueco o solape)`);
    }
    tope = new Decimal(String(r[cMax]));
  }
  for (const r of lista.filter((x) => x[cExc] !== undefined)) {
    if (!new Decimal(String(r[cMin])).equals(tope)) {
      process.stdout.write(`  aviso: ruta ${k}: excedente desde ${String(r[cMin])} y el ultimo rango llega a ${tope}\n`);
    }
  }
}

// ---- Duplicados exactos -------------------------------------------------
const huellas = new Set<string>();
for (const r of reglas) {
  const h = JSON.stringify(r);
  if (huellas.has(h)) errores.push(`documento duplicado: ${h.slice(0, 90)}`);
  huellas.add(h);
}

// ---- Reglas por ruta ----------------------------------------------------
const conteos = [...porRuta.values()].map((l) => l.length);
process.stdout.write(`\n-- reglas por ruta y tipo --\n`);
process.stdout.write(`  grupos: ${porRuta.size} | min=${Math.min(...conteos)} max=${Math.max(...conteos)}\n`);

// ---- Contraste opcional con el Excel de tarifas -------------------------
if (rutaTarifas) {
  const libro = XLSX.readFile(rutaTarifas);
  const hoja = opt('hoja-peso');
  const nombre =
    libro.SheetNames.find((n) => n === hoja) ?? libro.SheetNames[Number(hoja ?? 0)] ?? libro.SheetNames[0]!;
  const m = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[nombre]!, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  }) as unknown[][];
  const preciosSalida = new Set(
    reglas
      .filter((r) => r.tipo_regla === 'PESO')
      .flatMap((r) => [r.precio_kg_base, r.precio_kg_excedente])
      .filter((v): v is string => typeof v === 'string')
      .map((v) => new Decimal(v).toString()),
  );
  const ausentes: string[] = [];
  for (const fila of m.slice(1)) {
    for (const celda of fila.slice(1)) {
      if (typeof celda === 'number' && !preciosSalida.has(new Decimal(String(celda)).toString())) {
        ausentes.push(String(celda));
      }
    }
  }
  process.stdout.write(`\n-- contraste con "${nombre}" (PESO) --\n`);
  process.stdout.write(
    `  precios numericos del Excel ausentes en la salida: ${ausentes.length}` +
      `${ausentes.length > 0 ? ` (p. ej. ${[...new Set(ausentes)].slice(0, 5).join(', ')}; normal si son zonas fuera de la cobertura)` : ''}\n`,
  );
}

process.stdout.write(`\n=== RESULTADO: ${errores.length === 0 ? 'TODO OK' : `${errores.length} PROBLEMAS`} ===\n`);
for (const e of errores.slice(0, 15)) process.stdout.write(`  - ${e}\n`);
if (errores.length > 0) process.exitCode = 1;
