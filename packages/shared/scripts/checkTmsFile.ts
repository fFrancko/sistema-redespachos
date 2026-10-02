// Chequea un CSV real del TMS contra el parser. El archivo vive fuera del repo (regla 8 de AGENTS.md).
// Imprime solo conteos por código: nunca valores de las filas, porque contienen destinatarios y
// direcciones (Ley 25.326).
// Uso: pnpm --filter @sistema-redespachos/shared tms:check <ruta.csv> [--provincias]
import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { norm } from '../src/normalize';
import { TMS_ALL_COLUMNS, resolveTmsHeaders } from '../src/tms/headers';
import { parseTmsRow } from '../src/tms/orderRow';

const TOLERANCIA_VOLUMEN_PCT = '5';

function increment(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function printCounts(title: string, counts: Map<string, number>): void {
  console.log(`${title}:`);
  if (counts.size === 0) {
    console.log('  (ninguno)');
    return;
  }
  for (const [key, count] of [...counts.entries()].sort()) console.log(`  ${key}: ${count}`);
}

function decode(buffer: Buffer): { text: string; encoding: string } {
  try {
    return {
      text: new TextDecoder('utf-8', { fatal: true }).decode(buffer),
      encoding: 'utf-8',
    };
  } catch {
    return {
      text: buffer.toString('latin1'),
      encoding: 'latin1 (el archivo no es UTF-8 válido)',
    };
  }
}

// Cuenta separadores fuera de comillas en el encabezado.
function detectDelimiter(headerLine: string): ',' | ';' {
  let inQuotes = false;
  let commas = 0;
  let semicolons = 0;
  for (const char of headerLine) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && char === ',') commas += 1;
    else if (!inQuotes && char === ';') semicolons += 1;
  }
  return semicolons > commas ? ';' : ',';
}

function main(): number {
  const args = process.argv.slice(2);
  const showProvinces = args.includes('--provincias');
  const filePath = args.find((arg) => !arg.startsWith('--'));
  if (filePath === undefined) {
    console.error('Uso: tms:check <ruta.csv> [--provincias]');
    return 2;
  }

  const { text, encoding } = decode(readFileSync(filePath));
  const withoutBom = text.startsWith(String.fromCharCode(0xfeff)) ? text.slice(1) : text;
  const headerLine = withoutBom.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = detectDelimiter(headerLine);

  let records: Record<string, string>[];
  try {
    records = parse(text, {
      columns: true,
      delimiter,
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
    }) as Record<string, string>[];
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'DESCONOCIDO';
    console.error(`No se pudo leer el CSV (código ${code}).`);
    return 2;
  }

  const headers = Object.keys(records[0] ?? {});
  const resolution = resolveTmsHeaders(headers);

  console.log(`Codificación: ${encoding}`);
  console.log(`Delimitador: ${delimiter === ',' ? 'coma' : 'punto y coma'}`);
  console.log(`Filas leídas: ${records.length}`);
  console.log(
    `Encabezados reconocidos: ${resolution.columnas.size} de ${TMS_ALL_COLUMNS.length} columnas conocidas`,
  );
  console.log(`Encabezados desconocidos: ${resolution.desconocidas.length}`);
  for (const header of resolution.desconocidas) console.log(`  ${header}`);

  console.log(`Errores de archivo: ${resolution.errores_archivo.length}`);
  for (const error of resolution.errores_archivo) console.log(`  ${error.campo}: ${error.codigo}`);
  if (resolution.errores_archivo.length > 0) return 1;

  const formatErrors = new Map<string, number>();
  const formatErrorsByField = new Map<string, number>();
  const dataErrors = new Map<string, number>();
  const dataErrorsByField = new Map<string, number>();
  const observations = new Map<string, number>();
  const provinces = new Map<string, number>();
  let rowsWithErrors = 0;

  for (const record of records) {
    const result = parseTmsRow(record, {
      tolerancia_volumen_pct: TOLERANCIA_VOLUMEN_PCT,
    });
    if (result.errores.length > 0) rowsWithErrors += 1;
    for (const error of result.errores) {
      if (error.codigo === 'FORMATO_INVALIDO') {
        increment(formatErrors, error.codigo);
        increment(formatErrorsByField, `${error.campo}`);
      } else {
        increment(dataErrors, error.codigo);
        increment(dataErrorsByField, `${error.campo}: ${error.codigo}`);
      }
    }
    for (const observation of result.observaciones) increment(observations, observation);
    if (showProvinces && result.datos.provincia !== undefined) {
      increment(provinces, norm(result.datos.provincia));
    }
  }

  console.log(`Filas con al menos un error: ${rowsWithErrors}`);
  console.log(`Filas sin errores: ${records.length - rowsWithErrors}`);
  printCounts('Errores de formato por código', formatErrors);
  printCounts('Errores de formato por campo', formatErrorsByField);
  printCounts('Errores de datos por código', dataErrors);
  printCounts('Errores de datos por campo', dataErrorsByField);
  printCounts('Observaciones por código', observations);
  if (showProvinces) printCounts('Provincias (norm) y cantidad de filas', provinces);

  return formatErrors.size > 0 ? 1 : 0;
}

process.exitCode = main();
