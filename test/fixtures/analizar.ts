/**
 * Analiza una tabla maestra: distribucion de precios, monotonicidad de los
 * tramos, huecos de cobertura y casos que merecen revision.
 *
 *   npx tsx test/fixtures/analizar.ts <tabla.json> [etiqueta]
 */
import { readFileSync } from 'node:fs';

interface Regla {
  tipo_regla: 'PESO' | 'VOLUMEN';
  provincia_origen: string;
  provincia_destino: string;
  localidad_destino: string;
  zona_destino: string;
  kg_min?: string;
  kg_max?: string;
  m3_min?: string;
  m3_max?: string;
  precio_kg_base?: string;
  precio_m3_base?: string;
  precio_kg_excedente?: string;
  precio_m3_excedente?: string;
  costo_base_viaje: string;
  aplica_colecta: boolean;
}

const ruta = process.argv[2] ?? 'test/fixtures/output/hacha.json';
const etiqueta = process.argv[3] ?? ruta;
const t = JSON.parse(readFileSync(ruta, 'utf8')) as {
  metadata: { conteos: Record<string, number>; advertencias: string[] };
  reglas: Regla[];
};
const reglas = t.reglas;

process.stdout.write(`\n${'='.repeat(78)}\n${etiqueta.toUpperCase()}\n${'='.repeat(78)}\n`);
process.stdout.write(`reglas: ${reglas.length}\n`);

const peso = reglas.filter((r) => r.tipo_regla === 'PESO');
const volumen = reglas.filter((r) => r.tipo_regla === 'VOLUMEN');

// --- Zonas ---------------------------------------------------------------
const zonas = new Map<string, number>();
for (const r of reglas) zonas.set(r.zona_destino, (zonas.get(r.zona_destino) ?? 0) + 1);
process.stdout.write(`\nZONAS (${zonas.size})\n`);
for (const [z, n] of [...zonas].sort((a, b) => b[1] - a[1])) {
  process.stdout.write(`  ${z.padEnd(18)} ${String(n).padStart(6)} reglas\n`);
}

// --- Rangos --------------------------------------------------------------
function rangoDe(r: Regla): { min: number; max: number; excedente: boolean } {
  const min = Number(r.tipo_regla === 'PESO' ? r.kg_min : r.m3_min);
  const max = Number(r.tipo_regla === 'PESO' ? r.kg_max : r.m3_max);
  const excedente =
    r.tipo_regla === 'PESO'
      ? r.precio_kg_excedente !== undefined
      : r.precio_m3_excedente !== undefined;
  return { min, max, excedente };
}
function precioDe(r: Regla): number {
  return Number(
    r.precio_kg_base ?? r.precio_m3_base ?? r.precio_kg_excedente ?? r.precio_m3_excedente,
  );
}

for (const [tipo, set] of [
  ['PESO', peso],
  ['VOLUMEN', volumen],
] as const) {
  const rangos = new Set(set.map((r) => `${rangoDe(r).min}-${rangoDe(r).max}`));
  const mins = [...new Set(set.map((r) => rangoDe(r).min))].sort((a, b) => a - b);
  const maxs = [...new Set(set.map((r) => rangoDe(r).max))].sort((a, b) => a - b);
  const precios = set.map(precioDe);
  const excedentes = set.filter((r) => rangoDe(r).excedente).length;

  process.stdout.write(`\n${tipo}\n`);
  process.stdout.write(`  tramos distintos : ${rangos.size}\n`);
  process.stdout.write(`  desde            : ${mins[0]}\n`);
  process.stdout.write(`  hasta (tope max) : ${maxs[maxs.length - 1]}\n`);
  process.stdout.write(
    `  tramos excedente : ${excedentes > 0 ? 'si' : 'NO -> lo que pase el ultimo tope no tiene precio'}\n`,
  );
  process.stdout.write(
    `  precio           : min ${Math.min(...precios).toFixed(2)} | max ${Math.max(...precios).toFixed(2)}\n`,
  );
  if (precios.length > 0) {
    const largos = precios.filter((p) => String(p).replace('-', '').replace('.', '').length > 6).length;
    process.stdout.write(
      `  con >6 decimales : ${largos} de ${precios.length} (${((largos / precios.length) * 100).toFixed(0)}%)\n`,
    );
  }
}

// --- Continuidad y solapamiento de rangos -------------------------------
process.stdout.write(`\nCONTINUIDAD DE RANGOS (por ruta+zona)\n`);
const grupos = new Map<string, Regla[]>();
for (const r of peso) {
  const k = [r.provincia_origen, r.provincia_destino, r.localidad_destino, r.zona_destino].join(' | ');
  grupos.set(k, [...(grupos.get(k) ?? []), r]);
}

let huecos = 0;
let solapes = 0;
let noMonotonos = 0;
let sinTopeInfinito = 0;
const ejemplosNoMonotono: string[] = [];
const ejemplosHueco: string[] = [];

for (const [k, set] of grupos) {
  const orden = set
    .map((r) => ({ ...rangoDe(r), p: precioDe(r) }))
    .sort((a, b) => a.min - b.min);

  for (let i = 1; i < orden.length; i += 1) {
    const prev = orden[i - 1]!;
    const cur = orden[i]!;
    if (cur.min > prev.max) {
      huecos += 1;
      if (ejemplosHueco.length < 3) ejemplosHueco.push(`${k}: ${prev.max} -> ${cur.min}`);
    } else if (cur.min < prev.max) {
      solapes += 1;
    }
  }

  // La monotonicidad solo se evalúa entre tramos con precio BASE. El precio
  // de excedente es una tarifa por unidad (450 el kg) y no es comparable con
  // el precio del tramo (3300 el envío): compararlos produce falsos positivos.
  const base = orden.filter((o) => !o.excedente);
  for (let i = 1; i < base.length; i += 1) {
    const prev = base[i - 1]!;
    const cur = base[i]!;
    if (cur.p < prev.p) {
      noMonotonos += 1;
      if (ejemplosNoMonotono.length < 3) {
        ejemplosNoMonotono.push(
          `${k}: ${prev.min}-${prev.max}=${prev.p.toFixed(2)} > ${cur.min}-${cur.max}=${cur.p.toFixed(2)}`,
        );
      }
    }
  }

  const ultimo = orden[orden.length - 1];
  if (ultimo && !ultimo.excedente) sinTopeInfinito += 1;
}

process.stdout.write(`  grupos ruta+zona      : ${grupos.size}\n`);
process.stdout.write(`  huecos entre tramos  : ${huecos}${huecos ? ` -> ${ejemplosHueco.join('; ')}` : ''}\n`);
process.stdout.write(`  solapamientos        : ${solapes}\n`);
process.stdout.write(
  `  precios que BAJAN al aumentar el peso: ${noMonotonos}` +
    (noMonotonos ? ` -> ${ejemplosNoMonotono.join('; ')}` : ' (monotonos, correcto)'),
);
process.stdout.write(
  `  rutas sin tramo excedente: ${sinTopeInfinito} de ${grupos.size} ` +
    `(por encima del ultimo tope no hay precio definido)\n`,
);

// --- Destinos con mas de una zona ---------------------------------------
const porDestino = new Map<string, Set<string>>();
for (const r of reglas) {
  const k = [r.provincia_destino, r.localidad_destino].join(' | ');
  porDestino.set(k, new Set([...(porDestino.get(k) ?? []), r.zona_destino]));
}
const multiZona = [...porDestino].filter(([, zs]) => zs.size > 1);
process.stdout.write(`\nDESTINOS CON MAS DE UNA ZONA (${multiZona.length})\n`);
for (const [d, zs] of multiZona) process.stdout.write(`  ${d} -> ${[...zs].join(', ')}\n`);

// --- Costo base y colecta -----------------------------------------------
const conCostoBase = reglas.filter((r) => r.costo_base_viaje !== '0').length;
const conColecta = reglas.filter((r) => r.aplica_colecta === true).length;
process.stdout.write(`\nVARIOS\n`);
process.stdout.write(`  reglas con costo_base_viaje != 0 : ${conCostoBase}\n`);
process.stdout.write(`  reglas con aplica_colecta = true  : ${conColecta}\n`);
process.stdout.write(`\nAVISOS DEL SCRIPT: ${t.metadata.advertencias.length}\n`);
for (const a of t.metadata.advertencias) process.stdout.write(`  - ${a}\n`);
process.stdout.write('\n');
