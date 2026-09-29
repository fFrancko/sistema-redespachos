/**
 * Perfila un par de Excel del mismo transporte: origenes, zonas, tipo de
 * rango (topes acumulados o intervalos) y columnas de zona duplicadas.
 * Sirve para anticipar el trabajo antes de correr la transformacion.
 *
 *   npx tsx test/fixtures/perfilar.ts "<cobertura.xlsx>" "<tarifas.xlsx>"
 */
import XLSX from 'xlsx';

const [rutaCov, rutaTar] = process.argv.slice(2);
if (!rutaCov || !rutaTar) {
  process.stderr.write('Uso: perfilar.ts <cobertura.xlsx> <tarifas.xlsx>\n');
  process.exit(1);
}

const norm = (v: unknown): string =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const matriz = (hoja: XLSX.WorkSheet): unknown[][] =>
  XLSX.utils.sheet_to_json<unknown[]>(hoja, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  }) as unknown[][];

// ---- Cobertura ------------------------------------------------------------
const libroCov = XLSX.readFile(rutaCov);
const cov = matriz(libroCov.Sheets[libroCov.SheetNames[0]!]!);
const enc = (cov[0] ?? []).map((c) => String(c ?? ''));
const buscar = (pred: (h: string) => boolean): number => enc.findIndex((h) => pred(norm(h)));
const iZona = buscar((h) => h.includes('zona'));
const iOrigen = buscar((h) => h === 'origen' || h.startsWith('provincia origen'));
const iProvDes = buscar((h) => h.startsWith('destino prov') || h === 'provincia destino');
const iLocDes = buscar((h) => h.startsWith('destino loc') || h === 'localidad destino');

const zonas = new Map<string, number>();
const origenes = new Map<string, number>();
const pares = new Set<string>();
for (const fila of cov.slice(1)) {
  const z = String(fila[iZona] ?? '(vacia)');
  zonas.set(z, (zonas.get(z) ?? 0) + 1);
  const o = String(fila[iOrigen] ?? '(vacia)');
  origenes.set(o, (origenes.get(o) ?? 0) + 1);
  pares.add(`${o} | ${String(fila[iProvDes])} | ${String(fila[iLocDes])} | ${z}`);
}

process.stdout.write(`COBERTURA: ${cov.length - 1} filas\n`);
process.stdout.write(`  columnas: ${enc.join(' | ')}\n`);
process.stdout.write(`  origenes: ${[...origenes].map(([k, v]) => `${k}(${v})`).join(', ')}\n`);
process.stdout.write(`  pares origen|prov|loc|zona unicos: ${pares.size}\n`);
process.stdout.write(`  zonas:\n`);
for (const [z, n] of [...zonas].sort((a, b) => b[1] - a[1])) {
  process.stdout.write(`    ${JSON.stringify(z).padEnd(24)} ${n} filas\n`);
}

// ---- Tarifario --------------------------------------------------------------
const libroTar = XLSX.readFile(rutaTar);
for (const nombre of libroTar.SheetNames) {
  const m = matriz(libroTar.Sheets[nombre]!);
  const cabeceras = (m[0] ?? []).map((c) => String(c ?? ''));
  const filas = m.slice(1);
  process.stdout.write(`\nTARIFA "${nombre}": ${filas.length} filas\n`);
  process.stdout.write(`  col rango="${cabeceras[0] ?? ''}" | zonas: ${cabeceras.slice(1).join(' | ')}\n`);

  const rangos = filas.map((f) => f[0]);
  process.stdout.write(
    `  rangos: ${rangos.slice(0, 8).join(', ')}${rangos.length > 8 ? ` ... ${rangos.slice(-4).join(', ')}` : ''}\n`,
  );

  const numericos = rangos.filter((r): r is number => typeof r === 'number');
  const acumulado =
    /^hasta\b/.test(norm(cabeceras[0])) ||
    (numericos.length === rangos.length && numericos.every((v, i) => i === 0 || numericos[i - 1]! < v));
  process.stdout.write(`  tipo: ${acumulado ? 'TOPES ACUMULADOS (hasta N)' : 'intervalos / texto'}\n`);

  // Columnas de zona identicas entre si (suelen ser zonas duplicadas en el Excel).
  const duplicadas: string[] = [];
  for (let a = 1; a < cabeceras.length; a += 1) {
    for (let b = a + 1; b < cabeceras.length; b += 1) {
      if (filas.length > 0 && filas.every((f) => f[a] === f[b])) {
        duplicadas.push(`${cabeceras[a]} == ${cabeceras[b]}`);
      }
    }
  }
  process.stdout.write(
    `  columnas de zona identicas: ${duplicadas.length === 0 ? 'ninguna' : duplicadas.join('; ')}\n`,
  );

  const precios = filas.flatMap((f) => f.slice(1).filter((v): v is number => typeof v === 'number'));
  if (precios.length > 0) {
    const ejemplo = precios[0]!;
    process.stdout.write(`  precio min=${Math.min(...precios)} max=${Math.max(...precios)}\n`);
    process.stdout.write(`  ejemplo crudo: ${ejemplo} (${String(ejemplo).length} caracteres)\n`);
  }
}
