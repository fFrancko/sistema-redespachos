// MVP-15: casos dorados del motor. Criterio de §4: "CI falla si un cambio en el motor altera un
// caso dorado sin actualizarlo explícitamente". Cada JSON de `casos/` trae la entrada completa de
// `cotizar` y la salida esperada; la única forma de cambiarlos es `golden:update`, que deja el
// motivo y la huella en CHANGELOG.md (ver scripts/golden-lib.js, que repite `canonical`).
import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  cpSchema,
  norm,
  normProvincia,
  orderImportSchema,
  postalRouterEntrySchema,
  supplierSchema,
  tariffRuleSchema,
  tariffSchema,
} from '@sistema-redespachos/shared';
import { cotizar } from '../../src/index.js';
import type { MotorContext, MotorQuoteInput } from '../../src/index.js';

const GOLDEN = dirname(fileURLToPath(import.meta.url));
const CASOS = join(GOLDEN, 'casos');

// Ticket: los 2 casos de referencia más al menos 20 de bordes. Control extra al del CHANGELOG.
const MINIMO_DE_CASOS = 22;
const ID_CASO = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const LINEA_CHANGELOG = /^- (\d{4}-\d{2}-\d{2}) · `([^`]+)` · `([0-9a-f]{64})` · (.+)$/;
const CAMPOS_PEDIDO: Array<keyof MotorQuoteInput> = [
  'cp_destino_norm',
  'localidad_destino_norm',
  'provincia_destino_norm',
  'codigo_postal_origen',
  'peso_kgs',
  'volumen_m3',
  'valor_declarado',
];

type CasoDorado = {
  id: string;
  descripcion: string;
  entrada: { pedido: MotorQuoteInput; contexto: MotorContext };
  salida: unknown;
};

// JSON con las claves ordenadas y sin espacios: la huella no depende de Prettier ni del EOL.
function canonical(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(canonical).join(',')}]`;
  if (valor !== null && typeof valor === 'object') {
    const obj = valor as Record<string, unknown>;
    const claves = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return `{${claves.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(valor);
}

function huella(caso: unknown): string {
  return createHash('sha256').update(canonical(caso)).digest('hex');
}

// Cada campo distinto como `ruta: esperado X, obtenido Y`.
function diferencias(esperado: unknown, obtenido: unknown, ruta = 'salida'): string[] {
  if (canonical(esperado) === canonical(obtenido)) return [];
  if (
    esperado === null ||
    obtenido === null ||
    typeof esperado !== 'object' ||
    typeof obtenido !== 'object' ||
    Array.isArray(esperado) !== Array.isArray(obtenido)
  ) {
    return [`${ruta}: esperado ${canonical(esperado)}, obtenido ${canonical(obtenido)}`];
  }
  const e = esperado as Record<string, unknown>;
  const o = obtenido as Record<string, unknown>;
  const claves = new Set([...Object.keys(e), ...Object.keys(o)]);
  return [...claves].flatMap((k) =>
    diferencias(e[k], o[k], Array.isArray(esperado) ? `${ruta}[${k}]` : `${ruta}.${k}`),
  );
}

// Errores de la entrada: los mismos esquemas de `shared` que usa el resto del sistema.
function erroresDeEntrada({ pedido, contexto }: CasoDorado['entrada']): string[] {
  const errores: string[] = [];
  const revisar = (ruta: string, r: { success: boolean; error?: { message: string } }) => {
    if (!r.success) errores.push(`${ruta}: ${r.error?.message}`);
  };

  const sobrantes = Object.keys(pedido).filter(
    (k) => !CAMPOS_PEDIDO.includes(k as keyof MotorQuoteInput),
  );
  if (sobrantes.length > 0) errores.push(`pedido: campos fuera de la entrada: ${sobrantes}`);
  revisar(
    'pedido',
    orderImportSchema
      .pick({ peso_kgs: true, volumen_m3: true, valor_declarado: true, codigo_postal_origen: true })
      .strict()
      .safeParse({
        peso_kgs: pedido.peso_kgs,
        volumen_m3: pedido.volumen_m3,
        valor_declarado: pedido.valor_declarado,
        codigo_postal_origen: pedido.codigo_postal_origen,
      }),
  );
  revisar('pedido.cp_destino_norm', cpSchema.safeParse(pedido.cp_destino_norm));
  // D33: el motor cruza solo con los campos `_norm`, que ya vienen normalizados.
  if (norm(pedido.localidad_destino_norm) !== pedido.localidad_destino_norm) {
    errores.push('pedido.localidad_destino_norm no está normalizada');
  }
  const provincia = normProvincia(pedido.provincia_destino_norm, { contraCanalizador: true });
  if (provincia !== pedido.provincia_destino_norm) {
    errores.push('pedido.provincia_destino_norm no está normalizada');
  }

  contexto.canalizador.forEach((c, i) =>
    revisar(`canalizador[${i}]`, postalRouterEntrySchema.safeParse(c)),
  );
  contexto.proveedores.forEach((p, i) => revisar(`proveedores[${i}]`, supplierSchema.safeParse(p)));
  contexto.tarifarios.forEach(({ id, ...t }, i) => {
    revisar(`tarifarios[${i}]`, tariffSchema.safeParse(t));
    if (typeof id !== 'string' || id === '') errores.push(`tarifarios[${i}]: falta id`);
  });
  contexto.reglas.forEach(({ id, ...r }, i) => {
    revisar(`reglas[${i}]`, tariffRuleSchema.safeParse(r));
    if (typeof id !== 'string' || id === '') errores.push(`reglas[${i}]: falta id`);
  });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(contexto.fecha_referencia)) {
    errores.push('contexto.fecha_referencia no es yyyy-MM-dd');
  }
  if (typeof contexto.origen_estricto !== 'boolean') {
    errores.push('contexto.origen_estricto no es booleano');
  }
  return errores;
}

const archivos = readdirSync(CASOS)
  .filter((f) => f.endsWith('.json'))
  .sort();
const casos: Array<{ archivo: string; caso: CasoDorado }> = archivos.map((archivo) => ({
  archivo,
  caso: JSON.parse(readFileSync(join(CASOS, archivo), 'utf-8')) as CasoDorado,
}));

// Última huella de cada caso en el CHANGELOG.
const huellas = new Map<string, string>();
for (const linea of readFileSync(join(GOLDEN, 'CHANGELOG.md'), 'utf-8').split(/\r?\n/)) {
  const m = LINEA_CHANGELOG.exec(linea);
  if (m) huellas.set(m[2], m[3]);
}

describe('casos dorados: conjunto', () => {
  it(`hay al menos ${MINIMO_DE_CASOS} casos`, () => {
    expect(casos.length).toBeGreaterThanOrEqual(MINIMO_DE_CASOS);
  });

  it('los casos son exactamente los registrados en el CHANGELOG', () => {
    const ids = casos.map(({ caso }) => caso.id).sort();
    expect(ids).toEqual([...huellas.keys()].sort());
  });

  it('cada id es único, válido y coincide con el nombre del archivo', () => {
    const malos = casos
      .filter(({ archivo, caso }) => !ID_CASO.test(caso.id) || archivo !== `${caso.id}.json`)
      .map(({ archivo }) => archivo);
    expect(malos).toEqual([]);
  });
});

describe.each(casos)('caso dorado $archivo', ({ caso }) => {
  it('tiene una descripción de qué prueba', () => {
    expect(caso.descripcion.trim().length).toBeGreaterThan(10);
  });

  it('la huella coincide con la última del CHANGELOG (solo cambia con golden:update)', () => {
    expect(huellas.get(caso.id), `${caso.id}: editado sin golden:update`).toBe(huella(caso));
  });

  it('la entrada es válida para los esquemas de shared', () => {
    expect(erroresDeEntrada(caso.entrada)).toEqual([]);
  });

  it('cotizar devuelve exactamente la salida esperada', () => {
    const obtenido = JSON.parse(
      JSON.stringify(cotizar(caso.entrada.pedido, caso.entrada.contexto)),
    ) as unknown;
    const cambios = diferencias(caso.salida, obtenido);
    expect(
      cambios,
      `${caso.id}: la salida del motor cambió. Si es intencional: ` +
        `pnpm --filter @sistema-redespachos/motor golden:update -- --caso ${caso.id} --motivo "<texto>"`,
    ).toEqual([]);
  });
});
