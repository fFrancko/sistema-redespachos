/**
 * Inspeccion cruda de un Excel: vuelca hojas, dimensiones y las primeras
 * filas tal cual las ve SheetJS, sin interpretar nada. Sirve para entender
 * la forma real de un archivo del transporte antes de procesarlo.
 *
 *   npx tsx test/fixtures/inspeccionar.ts "<ruta.xlsx>" [filas]
 */
import XLSX from 'xlsx';

const ruta = process.argv[2];
const limite = Number(process.argv[3] ?? 12);

if (!ruta) {
  process.stderr.write('Uso: inspeccionar.ts <ruta.xlsx> [filas]\n');
  process.exit(1);
}

const libro = XLSX.readFile(ruta, { cellDates: false });

process.stdout.write(`\nARCHIVO: ${ruta}\nHOJAS: ${libro.SheetNames.length}\n`);

for (const nombre of libro.SheetNames) {
  const hoja = libro.Sheets[nombre]!;
  const ref = hoja['!ref'] ?? '(vacia)';
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(hoja, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  }) as unknown[][];

  process.stdout.write(
    `\n=== HOJA "${nombre}"  ref=${ref}  filas=${matriz.length} ===\n`,
  );

  for (let i = 0; i < Math.min(matriz.length, limite); i += 1) {
    const fila = (matriz[i] ?? []).map((c) => {
      if (c === null || c === undefined) return '∅';
      if (typeof c === 'number') return `#${c}`;
      if (typeof c === 'boolean') return c ? 'true' : 'false';
      return `"${String(c)}"`;
    });
    process.stdout.write(`  f${String(i + 1).padStart(3)} | ${fila.join(' | ')}\n`);
  }
}
process.stdout.write('\n');
