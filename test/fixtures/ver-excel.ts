/** Muestra en consola como queda cada hoja del Excel generado. */
import XLSX from 'xlsx';

const ruta = process.argv[2] ?? './output/tarifa_EXPRESO_ALFA.xlsx';
const maxFilas = Number(process.argv[3] ?? 20);

const libro = XLSX.readFile(ruta, { cellDates: false });

for (const nombre of libro.SheetNames) {
  const m = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[nombre]!, {
    header: 1,
    defval: '',
    raw: true,
    blankrows: false,
  }) as unknown[][];

  const ancho = Math.max(0, ...m.map((f) => f.length));
  const limite = Math.min(m.length, maxFilas);
  const anchos: number[] = [];
  for (let c = 0; c < ancho; c += 1) {
    let w = 0;
    for (let r = 0; r < limite; r += 1) {
      w = Math.max(w, String(m[r]?.[c] ?? '').length);
    }
    anchos.push(Math.min(w, 26));
  }

  process.stdout.write(`\n${'='.repeat(Math.min(ancho * 17, 200))}\n`);
  process.stdout.write(`HOJA "${nombre}"  (${m.length} filas x ${ancho} col)\n`);
  process.stdout.write(`${'='.repeat(Math.min(ancho * 17, 200))}\n`);

  for (let r = 0; r < limite; r += 1) {
    const celdas: string[] = [];
    for (let c = 0; c < ancho; c += 1) {
      const v = m[r]?.[c] ?? '';
      let s = typeof v === 'number' ? String(v) : String(v);
      if (s.length > 26) s = `${s.slice(0, 24)}..`;
      celdas.push(s.padEnd(anchos[c] ?? 0));
    }
    process.stdout.write(`${celdas.join(' | ')}\n`);
  }
  if (m.length > limite) {
    process.stdout.write(`... (+${m.length - limite} filas)\n`);
  }
}
