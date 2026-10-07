// Código común de los scripts de casos dorados (MVP-15). Corre con Node sobre `dist`.
// El runner (`test/golden/golden.test.ts`) repite `canonical` y la lectura del CHANGELOG en
// TypeScript; si las dos versiones divergen, el runner falla con todos los casos.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PAQUETE = join(dirname(fileURLToPath(import.meta.url)), '..');
export const GOLDEN = join(PAQUETE, 'test', 'golden');
export const CASOS = join(GOLDEN, 'casos');
export const CHANGELOG = join(GOLDEN, 'CHANGELOG.md');

// Id del caso: minúsculas, dígitos y guiones (también es el nombre del archivo).
export const ID_CASO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Línea del CHANGELOG: `- yyyy-MM-dd · `id` · `sha256` · motivo`.
export const LINEA_CHANGELOG = /^- (\d{4}-\d{2}-\d{2}) · `([^`]+)` · `([0-9a-f]{64})` · (.+)$/;

export class GoldenError extends Error {}

// JSON con las claves ordenadas, sin espacios: no depende del formato ni del fin de línea.
export function canonical(valor) {
  if (Array.isArray(valor)) return `[${valor.map(canonical).join(',')}]`;
  if (valor !== null && typeof valor === 'object') {
    const claves = Object.keys(valor)
      .filter((k) => valor[k] !== undefined)
      .sort();
    return `{${claves.map((k) => `${JSON.stringify(k)}:${canonical(valor[k])}`).join(',')}}`;
  }
  return JSON.stringify(valor);
}

export function huella(caso) {
  return createHash('sha256').update(canonical(caso)).digest('hex');
}

export function rutaCaso(id) {
  return join(CASOS, `${id}.json`);
}

export function leerCaso(id) {
  return JSON.parse(readFileSync(rutaCaso(id), 'utf-8'));
}

export function idsDeCasos() {
  if (!existsSync(CASOS)) return [];
  return readdirSync(CASOS)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -'.json'.length))
    .sort();
}

// Última huella registrada por caso.
export function huellasDelChangelog() {
  const huellas = new Map();
  if (!existsSync(CHANGELOG)) return huellas;
  for (const linea of readFileSync(CHANGELOG, 'utf-8').split(/\r?\n/)) {
    const m = LINEA_CHANGELOG.exec(linea);
    if (m) huellas.set(m[2], m[3]);
  }
  return huellas;
}

// La salida tal como queda en el JSON: sin los campos `undefined`.
export function comoJson(valor) {
  return JSON.parse(JSON.stringify(valor));
}

// Rutas de los campos que difieren, con los dos valores.
export function diferencias(esperado, obtenido, ruta = 'salida') {
  if (canonical(esperado) === canonical(obtenido)) return [];
  const ambosObjetos =
    esperado !== null &&
    obtenido !== null &&
    typeof esperado === 'object' &&
    typeof obtenido === 'object' &&
    Array.isArray(esperado) === Array.isArray(obtenido);
  if (!ambosObjetos) {
    return [`${ruta}: esperado ${canonical(esperado)}, obtenido ${canonical(obtenido)}`];
  }
  const claves = new Set([...Object.keys(esperado), ...Object.keys(obtenido)]);
  return [...claves].flatMap((k) => {
    const sub = Array.isArray(esperado) ? `${ruta}[${k}]` : `${ruta}.${k}`;
    return diferencias(esperado[k], obtenido[k], sub);
  });
}

export function hoy() {
  const d = new Date();
  const dos = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export function escribirCaso(caso) {
  writeFileSync(rutaCaso(caso.id), `${JSON.stringify(caso, null, 2)}\n`, 'utf-8');
}

export function registrarEnChangelog(id, caso, motivo) {
  const motivoEnUnaLinea = motivo.replace(/\s+/g, ' ').trim();
  appendFileSync(
    CHANGELOG,
    `- ${hoy()} · \`${id}\` · \`${huella(caso)}\` · ${motivoEnUnaLinea}\n`,
    'utf-8',
  );
}

// Prettier por `pnpm exec`, sin sumar dependencias al paquete. Rutas relativas (sin espacios).
export function formatear(archivos) {
  const rutas = archivos.map((a) => relative(PAQUETE, a).replace(/\\/g, '/'));
  // Un solo string: en Windows `pnpm` es un .cmd y necesita shell. Las rutas salen de ids
  // validados con ID_CASO y de CHANGELOG.md, sin espacios ni caracteres del shell.
  const comando = ['pnpm exec prettier --write --log-level warn', ...rutas].join(' ');
  const r = spawnSync(comando, { cwd: PAQUETE, stdio: 'inherit', shell: true });
  if (r.status !== 0) throw new GoldenError('prettier falló al formatear los casos');
}

export async function cargarMotor() {
  const dist = join(PAQUETE, 'dist', 'index.js');
  if (!existsSync(dist)) {
    throw new GoldenError('falta packages/motor/dist: compilá el motor antes (pnpm build)');
  }
  return import(pathToFileURL(dist).href);
}

export async function ejecutar(principal) {
  try {
    // pnpm 9 puede pasar el `--` del comando tal cual: con él, parseArgs dejaría de leer opciones.
    await principal(process.argv.slice(2).filter((a) => a !== '--'));
  } catch (e) {
    if (e instanceof GoldenError) {
      console.error(`golden: ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
}
