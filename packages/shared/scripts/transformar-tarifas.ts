#!/usr/bin/env -S npx tsx
/**
 * packages/shared/scripts/transformar-tarifas.ts
 * ---------------------------------------------------------------------------
 * Ingesta de tarifarios de transporte: transforma dos Excel normalizados
 * provistos por un transporte (Cobertura + Tarifario) en la tabla maestra
 * desnormalizada que consume Firestore en la coleccion `reglas_tarifa`.
 *
 * MODELO
 *   El tarifario viene "en columnas por zona" (una columna por zona de
 *   facturacion) y la cobertura viene "por fila" (una fila por par
 *   origen/destino + zona). El cruce de ambos es un JOIN por zona:
 *
 *      cobertura (N filas)  x  tarifario peso (M filas)  =  N x M reglas
 *
 *   La desnormalizacion es deliberada: cada documento de `reglas_tarifa`
 *   ya trae la provincia/localidad/zona resueltas, de modo que la consulta
 *   de tarifas en tiempo de ejecucion es un simple `where` sobre indices
 *   planos, sin joins ni lookups en tiempo de lectura.
 *
 * PRECISION
 *   Todo importe y todo limite de rango viaja como `string` decimal, nunca
 *   como `number`. Ver la nota de `ReglaTarifa` en packages/shared.
 *
 * RANGOS
 *   Todos los rangos se normalizan a intervalos semiabiertos (min, max]:
 *   `min` EXCLUSIVO y `max` INCLUSIVO. Un tarifario de topes acumulados
 *   ("Hasta 10", "Hasta 20") y uno de intervalos ("0 a 10", "10 a 20")
 *   producen la misma salida: (0;10], (10;20]. Asi un peso exacto pertenece
 *   a un unico rango. Las filas de excedente ("> 50") llevan min = max =
 *   limite y aplican a todo lo que supere ese limite.
 *
 * USO
 *   npx tsx packages/shared/scripts/transformar-tarifas.ts \
 *     --proveedor=EXPRESO_ALFA \
 *     --cobertura=./input/cobertura.xlsx \
 *     --tarifas=./input/tarifas.xlsx \
 *     --output=./output/tabla_maestra.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// `xlsx` es CommonJS: bajo ESM hay que tomar el default para llegar a la
// clase XLSX y sus metodos estaticos (readFile, utils...).
import Decimal from 'decimal.js';
import XLSX from 'xlsx';

import type {
  EstadoRegla,
  ReglaTarifa,
  RangoTarifa,
  TipoRegla,
} from '@shared/tarifas';

// Configuramos la aritmetica una sola vez y para todo el proceso: sin esto
// decimal.js usa 20 digitos significativos por defecto, insuficiente para
// sumar muchos terminos de una tarifa sin arrastrar error de redondeo.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

// ===========================================================================
// 1. Errores
// ===========================================================================

/** Falla esperada de validacion de datos de entrada. Sale con codigo 1. */
export class ErrorIngesta extends Error {
  readonly contexto: string[];

  constructor(mensaje: string, contexto: string[] = []) {
    super(mensaje);
    this.name = 'ErrorIngesta';
    this.contexto = contexto;
  }
}

// ===========================================================================
// 2. CLI
// ===========================================================================

type FormatoSalida = 'json' | 'array' | 'jsonl';

interface Opciones {
  proveedor: string;
  cobertura: string;
  tarifas: string;
  output: string;
  tarifarioId: string;
  costoBaseViaje: string;
  formato: FormatoSalida;
  hojaCobertura?: string;
  hojaPeso?: string;
  hojaVolumen?: string;
  estricto: boolean;
  dryRun: boolean;
  ayuda: boolean;
}

const AYUDA = `
transformar-tarifas.ts — genera la tabla maestra \`reglas_tarifa\` de Firestore.

REQUERIDOS
  --proveedor=<id>        Identificador del proveedor (ej: EXPRESO_ALFA).
  --cobertura=<ruta>      Excel de cobertura.
  --tarifas=<ruta>        Excel de tarifario (2 hojas: peso y volumen).
  --output=<ruta>         Archivo JSON de salida.

OPCIONALES
  --tarifario-id=<id>     Id de version del tarifario.
                          Default: nombre del archivo de tarifas sin extension.
  --costo-base-viaje=<n>  Costo fijo de viaje aplicado a cada regla.
                          Default: 0
  --formato=<json|array|jsonl>
                          json   -> { metadata, reglas: [...] }   (default)
                          array  -> ReglaTarifa[] pelado
                          jsonl  -> un documento por linea (import por streaming)
  --hoja-cobertura=<n>    Indice o nombre de la hoja de cobertura.
  --hoja-peso=<n>         Indice o nombre de la hoja de tarifas por peso.
  --hoja-volumen=<n>      Indice o nombre de la hoja de tarifas por volumen.
  --estricto              Falla si alguna zona de la cobertura no existe en el
                          tarifario. Default: solo avisa.
  --dry-run               No escribe el archivo; solo muestra el reporte.
  -h, --help              Muestra esta ayuda.

EJEMPLO
  npx tsx packages/shared/scripts/transformar-tarifas.ts \\
    --proveedor=EXPRESO_ALFA \\
    --cobertura=./input/cobertura.xlsx \\
    --tarifas=./input/tarifas.xlsx \\
    --output=./output/tabla_maestra.json
`.trim();

function parsearArgs(argv: string[]): Opciones {
  const crudos = new Map<string, string>();
  const banderas = new Set<string>();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === '-h' || arg === '--help') {
      banderas.add('help');
      continue;
    }
    if (!arg.startsWith('--')) {
      throw new ErrorIngesta(`Argumento no reconocido: "${arg}". Ver --help.`);
    }

    const cuerpo = arg.slice(2);
    const eq = cuerpo.indexOf('=');
    if (eq !== -1) {
      crudos.set(cuerpo.slice(0, eq), cuerpo.slice(eq + 1));
      continue;
    }

    // Forma "--flag valor" (sin '=').
    const siguiente = argv[i + 1];
    if (siguiente === undefined || siguiente.startsWith('--')) {
      banderas.add(cuerpo);
    } else {
      crudos.set(cuerpo, siguiente);
      i += 1;
    }
  }

  const opciones: Opciones = {
    proveedor: crudos.get('proveedor') ?? '',
    cobertura: crudos.get('cobertura') ?? '',
    tarifas: crudos.get('tarifas') ?? '',
    output: crudos.get('output') ?? '',
    tarifarioId: crudos.get('tarifario-id') ?? '',
    costoBaseViaje: crudos.get('costo-base-viaje') ?? '0',
    formato: 'json',
    estricto: banderas.has('estricto'),
    dryRun: banderas.has('dry-run'),
    ayuda: banderas.has('help'),
  };

  const formato = crudos.get('formato');
  if (formato !== undefined) {
    if (formato !== 'json' && formato !== 'array' && formato !== 'jsonl') {
      throw new ErrorIngesta(
        `Valor invalido para --formato: "${formato}". Use json, array o jsonl.`,
      );
    }
    opciones.formato = formato;
  }

  const hojaCobertura = crudos.get('hoja-cobertura');
  if (hojaCobertura !== undefined) opciones.hojaCobertura = hojaCobertura;
  const hojaPeso = crudos.get('hoja-peso');
  if (hojaPeso !== undefined) opciones.hojaPeso = hojaPeso;
  const hojaVolumen = crudos.get('hoja-volumen');
  if (hojaVolumen !== undefined) opciones.hojaVolumen = hojaVolumen;

  return opciones;
}

function validarOpciones(o: Opciones): void {
  const faltantes: string[] = [];
  if (!o.proveedor.trim()) faltantes.push('--proveedor');
  if (!o.cobertura.trim()) faltantes.push('--cobertura');
  if (!o.tarifas.trim()) faltantes.push('--tarifas');
  if (!o.output.trim()) faltantes.push('--output');

  if (faltantes.length > 0) {
    throw new ErrorIngesta(
      `Faltan argumentos requeridos: ${faltantes.join(', ')}. Ver --help.`,
    );
  }
}

// ===========================================================================
// 3. Normalizacion de texto y numeros
// ===========================================================================

/**
 * Minúsculas, sin tildes y con espacios colapsados. Se usa para comparar
 * encabezados, nombres de zona y valores de cobertura sin depender de cómo
 * los escribió el transporte ("Zona Facturacion" vs "zona facturación").
 */
function normTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convierte el texto de un importe a un Decimal exacto.
 *
 * Convencion es-AR: la coma es el separador decimal y el punto agrupa miles.
 * Formatos aceptados:
 *   `$ 1.234,56` · `1.234,56` · `ARS 1500` · `1234,5` · `0,5` · `-500`
 *   `1.234.567` · `(1.500,00)` (contable, negativo)
 *   `1,234.56` (estilo en-US: si ambos separadores aparecen, el ULTIMO es el
 *   decimal y el otro agrupa miles)
 *
 * Casos de un solo separador (los ambiguos):
 *   - una sola coma            -> decimal:                "1,5"   = 1.5
 *   - varias comas             -> miles (estilo en-US):   "1,234,567"
 *   - un solo punto + 3 digitos y parte entera de 1 a 3 digitos sin cero
 *     inicial                  -> miles (es-AR):          "1.500" = 1500
 *   - cualquier otro punto unico                        -> decimal:
 *                              "0.5", "12.75", "1234.5", "0.125"
 *   - varios puntos            -> miles, cada grupo de 3: "2.400.000"
 *
 * Rechaza (ErrorIngesta) porcentajes, vacios, texto suelto y agrupaciones
 * de miles mal formadas ("1.23.456"). Las celdas numericas de Excel NO pasan
 * por aqui: llegan como `number` y se convierten sin interpretar separadores.
 */
export function decimalDesdeTexto(bruto: string): Decimal {
  const invalido = (): never => {
    throw new ErrorIngesta(`"${bruto}" no es un importe numerico valido.`);
  };

  let t = bruto.trim();
  if (t.includes('%')) {
    throw new ErrorIngesta(`"${bruto}" es un porcentaje, no un importe.`);
  }

  let negativo = false;
  const contable = /^\((.*)\)$/.exec(t);
  if (contable) {
    negativo = true;
    t = (contable[1] ?? '').trim();
  }

  // Moneda y espacios (incluye el espacio duro que suele traer Excel).
  t = t.replace(/^(?:ars|usd|u\$s|\$)\s*/i, '').replace(/[\s\u00a0]+/g, '');
  if (t.startsWith('-') || t.startsWith('\u2212')) {
    negativo = !negativo;
    t = t.slice(1);
    t = t.replace(/^(?:ars|usd|u\$s|\$)/i, '');
  }

  if (!/^\d[\d.,]*$/.test(t)) return invalido();

  const puntos = t.split('.').length - 1;
  const comas = t.split(',').length - 1;
  const grupoMiles = (entero: string, sep: string): boolean =>
    new RegExp(`^\\d{1,3}(?:\\${sep}\\d{3})+$`).test(entero);

  let normalizado: string;
  if (puntos > 0 && comas > 0) {
    const decimalEsComa = t.lastIndexOf(',') > t.lastIndexOf('.');
    const decimal = decimalEsComa ? ',' : '.';
    const miles = decimalEsComa ? '.' : ',';
    const partes = t.split(decimal);
    if (partes.length !== 2) return invalido();
    const [entero, fraccion] = partes as [string, string];
    if (!grupoMiles(entero, miles) || !/^\d+$/.test(fraccion)) return invalido();
    normalizado = `${entero.split(miles).join('')}.${fraccion}`;
  } else if (comas > 0) {
    if (comas === 1) {
      if (!/^\d+,\d+$/.test(t)) return invalido();
      normalizado = t.replace(',', '.');
    } else {
      if (!grupoMiles(t, ',')) return invalido();
      normalizado = t.replace(/,/g, '');
    }
  } else if (puntos > 0) {
    if (puntos === 1) {
      if (!/^\d+\.\d+$/.test(t)) return invalido();
      normalizado = /^[1-9]\d{0,2}\.\d{3}$/.test(t) ? t.replace('.', '') : t;
    } else {
      if (!grupoMiles(t, '.')) return invalido();
      normalizado = t.replace(/\./g, '');
    }
  } else {
    normalizado = t;
  }

  try {
    const valor = new Decimal(normalizado);
    return negativo ? valor.negated() : valor;
  } catch {
    return invalido();
  }
}

/**
 * Pasa una celda de Excel a Decimal sin perder precisión.
 *
 * Un `number` de JS se pasa por `String()` (representación más corta) y NO
 * se redondea: se preserva el valor exacto que trae el Excel.
 */
function celdaADecimal(celda: unknown, contexto: string[]): Decimal {
  if (celda === null || celda === undefined || celda === '') {
    throw new ErrorIngesta('Celda vacia donde se esperaba un importe.', contexto);
  }
  if (typeof celda === 'number') {
    if (!Number.isFinite(celda)) {
      throw new ErrorIngesta(`Valor no finito: ${celda}`, contexto);
    }
    // Sin redondeo: los precios de estos tarifarios traen muchos digitos
    // (7156.0637526420005) y truncar a 10 decimales perderia informacion que
    // el transporte calculo. Se preserva el valor exacto del Excel.
    return new Decimal(String(celda));
  }
  try {
    return decimalDesdeTexto(String(celda));
  } catch (error) {
    // El error de texto no sabe en que celda esta: se le agrega el contexto.
    if (error instanceof ErrorIngesta && error.contexto.length === 0) {
      throw new ErrorIngesta(error.message, contexto);
    }
    throw error;
  }
}

/** Serializa un Decimal a string decimal puro (sin notación exponencial). */
function decimalAString(d: Decimal): string {
  return d.e < -6 ? d.toFixed(Math.min(-d.e, 20)) : d.toString();
}

// ===========================================================================
// 4. Parseo de rangos  ("0 a 50 kg", "51 - 100 kg", "> 100 kg")
// ===========================================================================

/**
 * Número en texto. Acepta coma o punto como separador decimal: los
 * tarifarios argentinos escriben "2,5 m3", no "2.5 m3".
 */
const RE_NUMERO = String.raw`\d+(?:[.,]\d+)?`;

/**
 * Descompone la columna "Rango de kilos" / "Rango de m3" en límites numéricos.
 *
 * Formatos soportados:
 *   "0 a 50 kg"   -> min 0    max 50      (rango)
 *   "51 - 100 kg" -> min 51   max 100     (rango)
 *   "de 0 a 50"   -> min 0    max 50      (rango)
 *   "0,5 - 1 m3"  -> min 0.5  max 1       (rango)
 *   "hasta 50"    -> min 0    max 50      (rango, solo tope)
 *   "> 100"       -> min 100  max 100     EXCEDENTE
 *   "100 o mas"   -> min 100  max 100     EXCEDENTE
 *   "50+"         -> min 50   max 50      EXCEDENTE
 *   "50"          -> min 0    max 50      (rango, solo tope)
 *
 * `min` es lo que dice el texto; `encadenarRangos` lo reemplaza luego por el
 * tope de la fila anterior para dejar intervalos (min, max] sin solapes.
 * `soloTope` marca los textos que solo informan un tope ("hasta 50", "50"):
 * su `min` no es un dato, sino un 0 de relleno.
 */
export interface RangoParseado extends RangoTarifa {
  soloTope: boolean;
}

export function parsearRango(celda: unknown, contexto: string[]): RangoParseado {
  if (celda === null || celda === undefined || String(celda).trim() === '') {
    throw new ErrorIngesta('Rango vacio en el tarifario.', contexto);
  }

  const original = String(celda);

  // 1) Se saca la unidad de medida: "kg", "kilos", "m3", "m³", "mts3"...
  let s = normTexto(original)
    .replace(/\bmts?\s*\^?\s*3\b/g, ' ')
    .replace(/\bm3\b/g, ' ')
    .replace(/\bcm3\b/g, ' ')
    .replace(/\b(kgs?|kilos?|kilogramos?)\b/g, ' ')
    .replace(/\bmetros?\s*cubicos?\b/g, ' ')
    .replace(/\bmetros?\b/g, ' ')
    .replace(/\bcubicos?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (s === '') {
    throw new ErrorIngesta(`Rango ilegible: "${original}".`, contexto);
  }

  // 2) Excedentes: "mas de 100", ">100", "100 o mas", "100+", "100 a mas".
  const esMas = /^(?:>|mas\s+de|desde)\s*(.+)$/.exec(s);
  const esMasSufijo = /^(.+?)\s*(?:o\s*mas|a\s*mas|y\s*mas|\+)$/.exec(s);
  if (esMas || esMasSufijo) {
    const capturado = (esMas?.[1] ?? esMasSufijo?.[1] ?? '').trim();
    const limite = primerNumero(capturado);
    if (limite === null) {
      throw new ErrorIngesta(
        `Rango de excedente ilegible: "${original}".`,
        contexto,
      );
    }
    // El límite queda como min y max: el cálculo real lo resuelve el motor
    // aplicando precio_*_excedente por cada unidad por encima de `min`.
    return {
      min: decimalAString(limite),
      max: decimalAString(limite),
      esExcedente: true,
      soloTope: false,
    };
  }

  // 3) "hasta 50" / "de 50 a 100"
  s = s.replace(/^de\s+/, '').replace(/^hasta\s+/, 'hasta ').trim();
  const soloHasta = /^hasta\s*(.+)$/.exec(s);
  if (soloHasta) {
    const limite = primerNumero(soloHasta[1]!);
    if (limite === null) {
      throw new ErrorIngesta(`Rango ilegible: "${original}".`, contexto);
    }
    return { min: '0', max: decimalAString(limite), esExcedente: false, soloTope: true };
  }

  // 4) Rangos "A - B" / "A a B" / "A al B".
  const partes = s
    .split(/\s*(?:-|–|—|\bal?\b|\bhasta\b)\s*/)
    .map((p) => p.trim())
    .filter((p) => p !== '');

  if (partes.length >= 2) {
    const min = primerNumero(partes[0]!);
    const max = primerNumero(partes[1]!);
    if (min === null || max === null) {
      throw new ErrorIngesta(
        `Rango ilegible: "${original}". Se esperaba "min - max".`,
        contexto,
      );
    }
    if (min.greaterThan(max)) {
      throw new ErrorIngesta(
        `Rango invertido: "${original}" (min ${min} > max ${max}).`,
        contexto,
      );
    }
    return {
      min: decimalAString(min),
      max: decimalAString(max),
      esExcedente: false,
      soloTope: false,
    };
  }

  // 5) Número suelto: se asume "hasta N".
  const suelto = primerNumero(s);
  if (suelto === null) {
    throw new ErrorIngesta(`Rango ilegible: "${original}".`, contexto);
  }
  return { min: '0', max: decimalAString(suelto), esExcedente: false, soloTope: true };
}

/** Extrae el primer número de un fragmento de texto ("2,5" -> Decimal 2.5). */
function primerNumero(texto: string): Decimal | null {
  const m = new RegExp(RE_NUMERO).exec(texto);
  if (!m) return null;
  try {
    // Normalizamos la coma decimal: decimal.js solo acepta punto.
    return new Decimal(m[0].replace(',', '.'));
  } catch {
    return null;
  }
}

// ===========================================================================
// 5. Lectura de Excel
// ===========================================================================

type Matriz = unknown[][];

/**
 * Detecta la fila de encabezados: los tarifarios de los transportes suelen traer
 * títulos o logos en las primeras filas. Buscamos, dentro de las primeras
 * `MAX_FILAS_ENCABEZADO`, la fila que más columnas conocidas reconoce.
 */
const MAX_FILAS_ENCABEZADO = 15;

function normalizarEncabezado(celda: unknown): string {
  return typeof celda === 'string' ? normTexto(celda) : '';
}

/**
 * Detecta la fila de encabezados como la que más columnas conocidas
 * reconoce dentro de las primeras filas.
 *
 * `minimo` es 2 para la cobertura (donde varias columnas son nombradas) y 1
 * para el tarifario: en una hoja de tarifas la única columna con nombre
 * reconocible es la del rango, porque las zonas se llaman como quiera el
 * transporte ("Tucuman", "Ramal Sur"). Exigir 2 ahí impide cualquier
 * tarifario real.
 */
function detectarFilaEncabezado(
  matriz: Matriz,
  alias: string[],
  minimo: number,
): number {
  let mejorIndice = 0;
  let mejorPuntaje = -1;

  const limite = Math.min(matriz.length, MAX_FILAS_ENCABEZADO);
  for (let i = 0; i < limite; i += 1) {
    const fila = matriz[i] ?? [];
    const nombres = fila.map(normalizarEncabezado);
    const puntaje = nombres.filter((n) => alias.includes(n)).length;
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejorIndice = i;
    }
  }

  if (mejorPuntaje < minimo) {
    throw new ErrorIngesta(
      `No se pudo detectar la fila de encabezados ` +
        `(se requieren al menos ${minimo} columnas conocidas de: ${alias.join(', ')}).`,
    );
  }
  return mejorIndice;
}

/** Devuelve la matriz de una hoja, con la fila de encabezados ya consumida. */
function leerMatriz(
  libro: XLSX.WorkBook,
  seleccion: string | undefined,
  aliasConocidos: string[],
  etiqueta: string,
  minimoEncabezado: number,
): { nombres: string[]; crudos: string[]; filas: unknown[][]; hoja: string } {
  const nombresHojas = libro.SheetNames;
  if (nombresHojas.length === 0) {
    throw new ErrorIngesta('El archivo no contiene hojas.');
  }

  let nombreHoja: string;
  if (seleccion === undefined) {
    nombreHoja = mejorHojaPorEncabezado(libro, aliasConocidos);
  } else {
    const porNombre = nombresHojas.find(
      (h) => normTexto(h) === normTexto(seleccion),
    );
    if (porNombre !== undefined) {
      nombreHoja = porNombre;
    } else {
      const indice = Number(seleccion);
      if (!Number.isInteger(indice) || indice < 0 || indice >= nombresHojas.length) {
        throw new ErrorIngesta(
          `No se encontro la hoja "${seleccion}" para ${etiqueta}. ` +
            `Hojas disponibles: ${nombresHojas.join(' | ')}`,
        );
      }
      nombreHoja = nombresHojas[indice]!;
    }
  }

  const matriz = matrizDeHoja(libro, nombreHoja, etiqueta);

  const indiceEncabezado = detectarFilaEncabezado(
    matriz,
    aliasConocidos,
    minimoEncabezado,
  );
  const nombres = (matriz[indiceEncabezado] ?? []).map(normalizarEncabezado);
  const crudos = (matriz[indiceEncabezado] ?? []).map((c) =>
    c === null || c === undefined ? '' : String(c).replace(/\s+/g, ' ').trim(),
  );
  const filas = matriz.slice(indiceEncabezado + 1);

  return { nombres, crudos, filas, hoja: nombreHoja };
}

/** Extrae la matriz cruda de una hoja, respetando el orden de columnas. */
function matrizDeHoja(libro: XLSX.WorkBook, nombreHoja: string, etiqueta: string): Matriz {
  const hoja = libro.Sheets[nombreHoja];
  if (!hoja) {
    throw new ErrorIngesta(`Hoja "${nombreHoja}" vacia o inaccesible (${etiqueta}).`);
  }

  // raw: true -> los numeros se quedan como number (no texto formateado).
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(hoja, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  }) as Matriz;

  if (matriz.length === 0) {
    throw new ErrorIngesta(`La hoja "${nombreHoja}" (${etiqueta}) esta vacia.`);
  }
  return matriz;
}

/**
 * Elige la hoja que mejor se ajusta a los encabezados esperados.
 *
 * Esto importa en el tarifario: sin `--hoja-peso` / `--hoja-volumen`
 * explicitos no podemos asumir que la hoja 1 es la de peso, porque el
 * transporte puede reordenarlas, y leer las dos veces desde la primera hoja
 * generaria reglas de volumen con precios de peso. Puntuar cada hoja por
 * sus encabezados evita esa clase de bug silencioso.
 */
function mejorHojaPorEncabezado(libro: XLSX.WorkBook, alias: string[]): string {
  const nombresHojas = libro.SheetNames;

  let mejor = nombresHojas[0]!;
  let mejorPuntaje = -1;

  for (const nombre of nombresHojas) {
    let matriz: Matriz;
    try {
      matriz = matrizDeHoja(libro, nombre, 'deteccion');
    } catch {
      continue;
    }

    const limite = Math.min(matriz.length, MAX_FILAS_ENCABEZADO);
    let puntaje = 0;
    for (let i = 0; i < limite; i += 1) {
      const nombres = (matriz[i] ?? []).map(normalizarEncabezado);
      puntaje = Math.max(puntaje, nombres.filter((n) => alias.includes(n)).length);
    }

    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = nombre;
    }
  }

  return mejor;
}

/** Busca el índice de la primera columna cuyo encabezado matchea un alias. */
function indiceColumna(nombres: string[], alias: string[], contexto: string[]): number {
  for (const objetivo of alias) {
    const i = nombres.findIndex((n) => n === objetivo);
    if (i !== -1) return i;
  }
  // Segundo intento: coincidencia laxa (el transporte agrego palabras).
  for (const objetivo of alias) {
    const i = nombres.findIndex((n) => n !== '' && n.includes(objetivo));
    if (i !== -1) return i;
  }
  throw new ErrorIngesta(
    `No se encontro la columna ${alias.map((a) => `"${a}"`).join(' o ')}. ` +
      `Columnas detectadas: ${nombres.filter(Boolean).join(' | ')}`,
    contexto,
  );
}

const esVacia = (celda: unknown): boolean =>
  celda === null || celda === undefined || String(celda).trim() === '';

// ===========================================================================
// 6. Zonas de facturacion
// ===========================================================================

/**
 * Llave canónica de zona para el JOIN.
 *
 * En los tarifarios reales la zona es un NOMBRE ("Tucuman", "Ramal Sur"),
 * no un número. Antes se asumía "Zona facturación 1" y se buscaba un dígito,
 * lo que no encuentra ninguna zona en estos archivos. Ahora la clave es el
 * texto normalizado completo, y aparte se detecta el caso numerado para
 * mantener compatibilidad con tarifarios que sí lo usen.
 *
 * Devuelve null si la celda está vacía o es un marcador de posición
 * tipo "-" o "n/d". Una zona llamada como el origen ("Buenos Aires") NO se
 * descarta.
 */
export function claveZona(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const s = normTexto(String(valor));
  if (s === '') return null;
  if (/^[-–—.,/\\*]+$/.test(s)) return null; // celda con guiones de relleno
  if (/^(n\/?d|n\/a|sin\s+dato|no\s+aplica|na)$/.test(s)) return null;

  // Zona numerada: "Zona facturación 2", "Zona 2", "2", "Segunda".
  const conPrefijo = /^zona\s*(?:de\s*)?facturacion\s*(\d+)$/.exec(s);
  if (conPrefijo) return `z${conPrefijo[1]}`;
  if (/^zona\s*(\d+)$/.test(s)) return `z${/^zona\s*(\d+)$/.exec(s)![1]}`;
  if (/^\d+$/.test(s)) return `z${s}`;
  if (/^(primera|1ro|1era)\b/.test(s)) return 'z1';
  if (/^(segunda|2do|2da)\b/.test(s)) return 'z2';
  if (/^(tercera|3er|3ra)\b/.test(s)) return 'z3';
  if (/^(cuarta|4to|4ta)\b/.test(s)) return 'z4';

  // "Buenos Aires" es una zona valida (tambien como destino, aunque coincida
  // con el origen). Solo se unifican las abreviaturas para que cobertura y
  // tarifario crucen aunque uno diga "Bs As" y el otro "Buenos Aires".
  if (/^(bs\.?\s?as\.?|bsas)$/.test(s)) return 'buenos aires';

  // Zona con nombre: la clave es el texto normalizado.
  return s;
}

/**
 * Etiqueta legible de la zona, para persistir en `zona_destino`.
 *
 * Para zonas con nombre se preserva la capitalización del tarifario (que es
 * la fuente autoritativa) en lugar de la versión normalizada en minúsculas.
 */
function etiquetaZona(clave: string, cruda?: string): string {
  if (/^z\d+$/.test(clave)) return `Zona facturación ${clave.slice(1)}`;
  return cruda && cruda !== '' ? cruda : clave;
}

/**
 * Resuelve la zona de la cobertura contra las zonas del tarifario.
 *
 * Los dos archivos no usan siempre el mismo nombre para la misma zona: la
 * cobertura dice "Santiago Del Estero" y el tarifario llama a esa columna
 * "Santiago". Ademas de la coincidencia exacta se acepta un prefijo de
 * PALABRAS, siempre que haya una unica candidata; ante ambiguedad se descarta
 * el cruce y la zona queda reportada como no cubierta en vez de asociarla a
 * la zona equivocada. Ver `resolverZonas` para la competencia entre zonas.
 */
export function resolverZona(
  claveCobertura: string,
  clavesTarifario: string[],
): { clave: string | null; motivo: 'exacta' | 'prefijo' | 'sin_match' | 'ambigua' } {
  if (clavesTarifario.includes(claveCobertura)) {
    return { clave: claveCobertura, motivo: 'exacta' };
  }

  // El prefijo debe terminar en limite de palabra: "salta" NO puede resolverse
  // contra la columna "sal". Aun asi un prefijo de palabras es una HEURISTICA
  // ("santa fe" -> "santa" cumple la regla): por eso el cruce por prefijo
  // siempre se informa como advertencia y `resolverZonas` lo anula si mas de
  // una zona de la cobertura compite por la misma columna.
  //   - `extienden`: columnas del tarifario que empiezan con la zona
  //     ("chubut" -> "chubut norte").
  //   - `prefijos`:  columnas que son prefijo de la zona
  //     ("santiago del estero" -> "santiago"); entre varias gana la mas larga.
  const extienden = clavesTarifario.filter((c) => c.startsWith(`${claveCobertura} `));
  const prefijos = clavesTarifario.filter((c) => claveCobertura.startsWith(`${c} `));

  if (extienden.length === 0 && prefijos.length === 0) {
    return { clave: null, motivo: 'sin_match' };
  }
  if (extienden.length + (prefijos.length > 0 ? 1 : 0) > 1) {
    return { clave: null, motivo: 'ambigua' };
  }
  if (extienden.length === 1) return { clave: extienden[0]!, motivo: 'prefijo' };

  const mejor = prefijos.reduce((a, b) => (b.length > a.length ? b : a));
  return { clave: mejor, motivo: 'prefijo' };
}

/**
 * Resuelve TODAS las zonas de la cobertura contra el catalogo del tarifario.
 *
 * Ademas de `resolverZona`, anula (`ambigua`) los cruces por prefijo que
 * compiten: si dos zonas de la cobertura apuntan a la misma columna
 * ("santa fe" y "santa cruz" -> "santa"), o una columna ya es la coincidencia
 * exacta de otra zona, ninguna de las dos se cruza. Es preferible dejar una
 * ruta sin precio a asignarle la tarifa de otra zona.
 */
export function resolverZonas(
  zonasCobertura: string[],
  clavesTarifario: string[],
): Map<string, ReturnType<typeof resolverZona>> {
  const unicas = [...new Set(zonasCobertura)];
  const resultados = new Map(unicas.map((z) => [z, resolverZona(z, clavesTarifario)] as const));

  const usos = new Map<string, number>();
  for (const r of resultados.values()) {
    if (r.clave !== null) usos.set(r.clave, (usos.get(r.clave) ?? 0) + 1);
  }
  for (const [zona, r] of resultados) {
    if (r.motivo === 'prefijo' && r.clave !== null && (usos.get(r.clave) ?? 0) > 1) {
      resultados.set(zona, { clave: null, motivo: 'ambigua' });
    }
  }
  return resultados;
}

// ===========================================================================
// 7. Modelos intermedios
// ===========================================================================

interface FilaCobertura {
  provinciaOrigen: string;
  localidadOrigen: string;
  provinciaDestino: string;
  localidadDestino: string;
  claveZona: string;
  etiquetaZona: string;
}

export interface FilaRango {
  rango: RangoTarifa;
  /** El texto del rango solo informa un tope ("hasta 50"): su min no es dato. */
  soloTope: boolean;
  /** Fila de datos (1-based) para los mensajes de error. */
  numeroFila: number;
  etiqueta: string;
  /** Precio por clave de zona. `null` = la zona no tiene precio para este rango. */
  precios: Map<string, Decimal>;
}

// ===========================================================================
// 8. Lectura de la cobertura
// ===========================================================================

/**
 * Alias de columnas de cobertura.
 *
 * Incluye typos frecuentes de los archivos de transportes reales: uno de
 * ellos trae "Destino Provicia" (sin la n). Sin esta entrada el script
 * aborta con "No se encontro la columna", y el error esta en el Excel
 * remitido, no en nuestra responsabilidad de datos.
 */
const ALIAS_COBERTURA = [
  'origen',
  'provincia origen',
  'destino provincia',
  'destino provicia',
  'provincia destino',
  'destino localidad',
  'localidad destino',
  'codigo postal',
  'zona facturacion',
  'tiempo de entrega',
];

/** Fila de cobertura descartada, con el motivo, para el reporte final. */
interface FilaDescartada {
  motivo: string;
  origen: string;
}

interface CoberturaLeida {
  filas: FilaCobertura[];
  descartadas: FilaDescartada[];
}

function leerCobertura(ruta: string, hoja: string | undefined): CoberturaLeida {
  const libro = XLSX.readFile(ruta, { cellDates: false });
  const { nombres, filas } = leerMatriz(libro, hoja, ALIAS_COBERTURA, 'cobertura', 2);
  // (los encabezados crudos solo hacen falta en el tarifario)

  const iOrigen = indiceColumnaOpcional(nombres, ['origen', 'origen completo']);
  const iProvOrigen = indiceColumnaOpcional(nombres, ['provincia origen', 'origen provincia']);
  const iLocOrigen = indiceColumnaOpcional(nombres, ['localidad origen', 'origen localidad']);
  // "destino provicia": typo frecuente en archivos de transportes reales.
  const iProvDest = indiceColumna(
    nombres,
    ['destino provincia', 'destino provicia', 'provincia destino'],
    [],
  );
  const iLocDest = indiceColumna(
    nombres,
    ['destino localidad', 'localidad destino'],
    [],
  );
  const iZona = indiceColumna(
    nombres,
    ['zona facturacion', 'zona de facturacion', 'zona'],
    [],
  );

  const salida: FilaCobertura[] = [];
  const filasSinZona: FilaDescartada[] = [];

  for (let i = 0; i < filas.length; i += 1) {
    const fila = filas[i] ?? [];
    const n = i + 1; // 1-based contando desde la fila siguiente al encabezado
    const ctx = [`${ruta} > cobertura`, `fila de datos ${n}`];

    // Filas totalmente vacías (Excel suele dejarlas al final).
    if (fila.every(esVacia)) continue;

    const provinciaDestino = texto(fila[iProvDest], ctx, 'Destino Provincia');

    // La localidad destino puede venir vacía en transportes que agrupan por
    // zona (filas tipo "CABA" / "GBA NORTE" sin localidad). No es un error:
    // la regla aplica a toda esa provincia, igual que hace `localidad_origen`
    // con "*".
    const localidadCruda = fila[iLocDest];
    const localidadDestino = esVacia(localidadCruda) ? '*' : String(localidadCruda).replace(/\s+/g, ' ').trim();

    let provinciaOrigen: string;
    let localidadOrigen: string;
    if (iProvOrigen !== -1) {
      provinciaOrigen = texto(fila[iProvOrigen], ctx, 'Provincia Origen');
      localidadOrigen = iLocOrigen !== -1 ? texto(fila[iLocOrigen], ctx, 'Localidad Origen') : '*';
    } else {
      // La columna "Origen" viene compacta: "Buenos Aires / La Plata".
      // Si no trae localidad explícita, la regla aplica a toda la provincia
      // y se marca con '*' (ver ReglaTarifa.localidad_origen).
      const origen = texto(fila[iOrigen], ctx, 'Origen');
      const partes = origen.split(/\s*[/|]\s*|\s+-\s+/).map((p) => p.trim()).filter(Boolean);
      provinciaOrigen = partes[0] ?? origen;
      localidadOrigen = partes.length > 1 ? partes.slice(1).join(' / ') : '*';
    }

    // La zona puede venir vacía o ser un marcador tipo "-" en transportes que
    // no tarifan desde el mismo origen. No es un error: esas filas se
    // descartan y se informan aparte.
    const zonaCruda = fila[iZona];
    const clave = claveZona(zonaCruda);
    if (clave === null) {
      filasSinZona.push({
        motivo: `zona no reconocida: "${String(zonaCruda ?? '')}"`,
        origen: `${provinciaOrigen} -> ${provinciaDestino}`,
      });
      continue;
    }

    salida.push({
      provinciaOrigen,
      localidadOrigen,
      provinciaDestino,
      localidadDestino,
      claveZona: clave,
      etiquetaZona: etiquetaZona(clave),
    });
  }

  if (salida.length === 0) {
    throw new ErrorIngesta('La cobertura no contiene filas de datos utilizables.', [
      `${ruta} > cobertura`,
    ]);
  }

  return { filas: salida, descartadas: filasSinZona };
}

function indiceColumnaOpcional(nombres: string[], alias: string[]): number {
  for (const objetivo of alias) {
    const i = nombres.findIndex((n) => n === objetivo);
    if (i !== -1) return i;
  }
  return -1;
}

function texto(celda: unknown, contexto: string[], campo: string): string {
  if (esVacia(celda)) {
    throw new ErrorIngesta(`${campo} vacio.`, contexto);
  }
  return String(celda).replace(/\s+/g, ' ').trim();
}

// ===========================================================================
// 9. Lectura del tarifario
// ===========================================================================

/**
 * Alias de la columna de rango.
 *
 * Los tarifarios reales usan "Hasta KG" / "Hasta M3", que NO son intervalos
 * sino topes acumulados (el precio de la fila 10 aplica a todo lo que pesa
 * hasta 10 kg). `parsearRango` los reconoce por el prefijo "hasta" y el
 * llamador los convierte a intervalos usando la fila anterior como min.
 */
const ALIAS_RANGO_PESO = [
  'rango de kilos',
  'rango kg',
  'rango de peso',
  'hasta kg',
  'hasta kilos',
  'kg',
  'kilos',
  'rango',
];
const ALIAS_RANGO_M3 = [
  'rango de m3',
  'rango m3',
  'rango de volumen',
  'hasta m3',
  'm3',
  'volumen',
  'rango',
];

/** Nombres de columna de zona usados solo para detectar la fila de encabezado. */
const ALIAS_ZONAS = Array.from({ length: 12 }, (_, i) => `zona facturacion ${i + 1}`);

interface HojaTarifario {
  tipo: TipoRegla;
  filas: FilaRango[];
  nombre: string;
  /** Etiqueta legible por clave de zona, tomada del encabezado del Excel. */
  etiquetas: Map<string, string>;
}

function leerTarifario(
  ruta: string,
  hoja: string | undefined,
  tipo: TipoRegla,
  advertencias: string[],
): HojaTarifario {
  const alias = tipo === 'PESO' ? ALIAS_RANGO_PESO : ALIAS_RANGO_M3;

  const libro = XLSX.readFile(ruta, { cellDates: false });
  // La deteccion de encabezado necesita reconocer tambien las columnas de
  // zona: en una hoja de tarifario la unica columna "conocida" por nombre es
  // la del rango, y con el umbral de 2 eso daria falso negativo.
  // minimo 1: en el tarifario real solo la columna del rango tiene nombre
  // reconocible; las zonas se llaman como quiera el transporte.
  const { nombres, crudos: crudosEncabezado, filas } = leerMatriz(
    libro,
    hoja,
    [...alias, ...ALIAS_ZONAS],
    `tarifario ${tipo}`,
    1,
  );

  const iRango = indiceColumna(nombres, alias, []);

  // ¿La columna de rango es un tope acumulado ("Hasta KG") en vez de un
  // intervalo? Se decide por el encabezado, no por los valores: los valores
  // crecientes son ambiguos entre ambos formatos.
  const encabezadoRango = nombres[iRango] ?? '';
  const esAcumulado = /^hasta\b/.test(encabezadoRango);

  // Las columnas de zona se detectan por encabezado, no por posición:
  // el transporte puede agregar o quitar zonas sin romper el importador.
  // Guardamos el texto original del encabezado (no la clave normalizada)
  // para que `zona_destino` conserve la capitalización con la que el
  // transporte nombra la zona ("Ramal Sur", no "ramal sur").
  const columnasZona: Array<{
    indice: number;
    clave: string;
    etiqueta: string;
    cruda: string;
  }> = [];
  const crudos = crudosEncabezado;
  nombres.forEach((nombre, indice) => {
    if (indice === iRango || nombre === '') return;
    const clave = claveZona(nombre);
    if (clave === null) return;
    const cruda = String(crudos[indice] ?? nombre).replace(/\s+/g, ' ').trim();
    columnasZona.push({ indice, clave, etiqueta: etiquetaZona(clave, cruda), cruda });
  });

  if (columnasZona.length === 0) {
    throw new ErrorIngesta(
      `La hoja de tarifas ${tipo} no tiene columnas de zona de facturacion. ` +
        `Encabezados leidos: ${nombres.filter(Boolean).join(' | ')}`,
      [`${ruta} > ${tipo}`],
    );
  }

  const salida: FilaRango[] = [];

  for (let i = 0; i < filas.length; i += 1) {
    const fila = filas[i] ?? [];
    const n = i + 1;
    const ctx = [`${ruta} > tarifas ${tipo}`, `fila de datos ${n}`];
    if (fila.every(esVacia)) continue;

    const rangoCrudo = fila[iRango];
    if (esVacia(rangoCrudo)) {
      throw new ErrorIngesta('Rango de la cabecera vacio.', ctx);
    }
    const rango = parsearRango(rangoCrudo, ctx);

    const precios = new Map<string, Decimal>();
    for (const col of columnasZona) {
      const celda = fila[col.indice];
      if (esVacia(celda)) continue; // zona sin cobertura para este rango
      const precio = celdaADecimal(celda, [
        ...ctx,
        `columna "${nombres[col.indice]}"`,
      ]);
      if (precio.isNegative()) {
        throw new ErrorIngesta(
          `Precio negativo (${precio.toString()}) en la zona ${col.etiqueta}.`,
          ctx,
        );
      }
      precios.set(col.clave, precio);
    }

    if (precios.size === 0) {
      throw new ErrorIngesta(
        'La fila de rango no tiene ningun precio cargado.',
        ctx,
      );
    }

    const { soloTope, ...rangoBase } = rango;
    salida.push({
      rango: rangoBase,
      soloTope,
      numeroFila: n,
      etiqueta: String(rangoCrudo),
      precios,
    });
  }

  if (salida.length === 0) {
    throw new ErrorIngesta(`La hoja de tarifas ${tipo} no contiene filas.`, [
      `${ruta} > ${tipo}`,
    ]);
  }

  encadenarRangos(salida, esAcumulado, tipo, `${ruta} > tarifas ${tipo}`, advertencias);

  return {
    tipo,
    filas: salida,
    nombre: tipo,
    etiquetas: new Map(columnasZona.map((c) => [c.clave, c.etiqueta])),
  };
}

/**
 * Deja los rangos de una hoja como intervalos contiguos (min, max]: `min`
 * exclusivo, `max` inclusivo, sin huecos ni solapes.
 *
 *   - Topes ("Hasta 10", "Hasta 20", o encabezado "Hasta KG"): min = tope de
 *     la fila anterior (0 en la primera).
 *   - Intervalos ("0 a 10", "10 a 25"): se respeta el min del texto si es
 *     igual al tope anterior. Si lo supera en un paso entero ("51 a 100"
 *     despues de "0 a 50": paso 1 kg; 0,01 m3) se lo alinea al tope anterior
 *     para no dejar pesos como 50,5 sin regla. Un hueco mayor se conserva y
 *     se informa. Un solape ("0 a 10" y "5 a 20") es un error de datos.
 *   - Excedente ("> 50"): debe ser la ultima fila; su limite deberia coincidir
 *     con el tope anterior (si no, se informa).
 *
 * Muta `filas` (sus `rango.min` / `rango.max`).
 */
export function encadenarRangos(
  filas: FilaRango[],
  acumulado: boolean,
  tipo: TipoRegla,
  contexto: string,
  advertencias: string[],
): void {
  const paso = new Decimal(tipo === 'PESO' ? 1 : 0.01);
  let tope = new Decimal(0);
  let hayExcedente = false;

  for (const fila of filas) {
    const ctx = [contexto, `fila de datos ${fila.numeroFila}`];
    if (hayExcedente) {
      throw new ErrorIngesta(
        `La fila "${fila.etiqueta}" viene despues de una fila de excedente; ` +
          `el excedente debe ser la ultima.`,
        ctx,
      );
    }

    const { rango } = fila;

    if (rango.esExcedente) {
      hayExcedente = true;
      if (!new Decimal(rango.min).equals(tope)) {
        advertencias.push(
          `${tipo}: el excedente "${fila.etiqueta}" empieza en ${rango.min} pero el ` +
            `rango anterior termina en ${tope.toString()} (fila ${fila.numeroFila}).`,
        );
      }
      continue;
    }

    const max = new Decimal(rango.max);
    let min: Decimal;

    if (acumulado || fila.soloTope) {
      min = tope;
    } else {
      const minTexto = new Decimal(rango.min);
      if (minTexto.lessThan(tope)) {
        throw new ErrorIngesta(
          `Rangos solapados: "${fila.etiqueta}" empieza en ${minTexto.toString()} ` +
            `pero el rango anterior llega hasta ${tope.toString()}.`,
          ctx,
        );
      }
      const hueco = minTexto.minus(tope);
      if (hueco.greaterThan(paso)) {
        advertencias.push(
          `${tipo}: hueco de cobertura entre ${tope.toString()} y ${minTexto.toString()} ` +
            `antes de "${fila.etiqueta}" (fila ${fila.numeroFila}).`,
        );
        min = minTexto;
      } else {
        min = tope;
      }
    }

    if (!max.greaterThan(min)) {
      throw new ErrorIngesta(
        `Rango fuera de orden: "${fila.etiqueta}" termina en ${max.toString()} ` +
          `y el rango anterior ya llegaba a ${min.toString()}.`,
        ctx,
      );
    }

    rango.min = decimalAString(min);
    rango.max = decimalAString(max);
    tope = max;
  }
}

// ===========================================================================
// 10. Cruce (JOIN por zona de facturacion)
// ===========================================================================

interface ResultadoTransformacion {
  reglas: ReglaTarifa[];
  duplicadosEliminados: number;
  celdasSinPrecio: number;
  zonasFaltantes: string[];
  /** Zonas de la cobertura que sí se cruzaron, y como se resolvieron. */
  resueltas: Array<{ zona: string; contra: string; via: string }>;
}

function transformar(
  cobertura: FilaCobertura[],
  peso: HojaTarifario,
  volumen: HojaTarifario,
  opciones: Opciones,
  advertencias: string[],
): ResultadoTransformacion {
  const costoBase = decimalDesdeTexto(opciones.costoBaseViaje);
  const costoBaseStr = decimalAString(costoBase);
  const estado: EstadoRegla = 'BORRADOR';

  // Indice de zonas presentes en cada tarifario, para detectar joins rotos.
  const zonasTarifa = (hoja: FilaRango[]): Set<string> => {
    const set = new Set<string>();
    for (const fila of hoja) for (const clave of fila.precios.keys()) set.add(clave);
    return set;
  };

  const zonasPeso = zonasTarifa(peso.filas);
  const zonasVolumen = zonasTarifa(volumen.filas);

  // Cualquiera de las dos hojas sirve para resolver nombres de zona: en un
  // tarifario consistente ambas comparten el mismo catálogo. Se usa la unión
  // para que una zona presente solo en peso no se descarte por falta de
  // columna en volumen (el faltante real se detecta después, por celda).
  const catalogoZonas = Array.from(new Set([...zonasPeso, ...zonasVolumen])).sort();

  // Resolvemos cada zona de la cobertura contra el catálogo del tarifario
  // una sola vez. Las no resolubles se reportan y se omiten del cruce.
  const mapaZona = new Map<string, string>();
  const resueltas: Array<{ zona: string; contra: string; via: string }> = [];
  const noResueltas: string[] = [];

  // Etiquetas legibles por clave de zona, tomadas del encabezado original
  // del tarifario, para que `zona_destino` conserve mayúsculas y acentos.
  const etiquetaDeClave = new Map<string, string>([...peso.etiquetas, ...volumen.etiquetas]);

  const resolucion = resolverZonas(
    cobertura.map((c) => c.claveZona),
    catalogoZonas,
  );
  for (const [zona, r] of resolucion) {
    if (r.clave === null) {
      noResueltas.push(zona);
      if (r.motivo === 'ambigua') {
        advertencias.push(
          `La zona "${zona}" coincide con mas de una columna del tarifario, o compite ` +
            `con otra zona de la cobertura por la misma columna; no se cruzo para no ` +
            `asignarle una tarifa equivocada.`,
        );
      }
      continue;
    }
    mapaZona.set(zona, r.clave);
    resueltas.push({ zona, contra: r.clave, via: r.motivo });
    if (r.motivo === 'prefijo') {
      advertencias.push(
        `La zona "${zona}" de la cobertura se cruzo por prefijo con la columna ` +
          `"${r.clave}" del tarifario. Confirmar que sea la misma zona.`,
      );
    }
  }

  if (noResueltas.length > 0) {
    const detalle = noResueltas.map((z) => `"${z}"`).join(', ');
    const mensaje =
      `${noResueltas.length} zona(s) de la cobertura no tienen columna en el ` +
      `tarifario: ${detalle}. Las rutas de esas zonas quedan sin precio. ` +
      `Zonas del tarifario: ${catalogoZonas.join(', ')}`;
    if (opciones.estricto) {
      throw new ErrorIngesta(mensaje);
    }
    advertencias.push(mensaje);
  }

  // Zonas resueltas pero sin precio en alguna de las dos hojas.
  const faltantes = [...mapaZona.entries()]
    .filter(([, clave]) => !zonasPeso.has(clave) || !zonasVolumen.has(clave))
    .map(([origen, clave]) => `${origen} -> ${clave}`);

  // Orden estable: primero por zona, luego por rango del tarifario, luego
  // por origen/destino. Un orden deterministico hace que los diffs de git
  // entre corridas sean utiles.
  const reglas: ReglaTarifa[] = [];
  const vistas = new Set<string>();
  let duplicadosEliminados = 0;
  let celdasSinPrecio = 0;

  const procesar = (origen: FilaCobertura, tipo: TipoRegla, filas: FilaRango[]): void => {
    // La zona puede haberse resuelto por prefijo ("Santiago Del Estero" ->
    // "Santiago"); el precio se busca con la clave del tarifario, no con la
    // de la cobertura.
    const clave = mapaZona.get(origen.claveZona);
    if (clave === undefined) return;

    for (const fila of filas) {
      const precio = fila.precios.get(clave);
      if (precio === undefined) {
        celdasSinPrecio += 1;
        continue;
      }

      const { rango } = fila;

      // `exactOptionalPropertyTypes` esta activo: los opcionales que no
      // aplican se omiten del objeto en vez de asignarse a undefined.
      const base: ReglaTarifa = {
        id_proveedor: opciones.proveedor.trim(),
        tarifario_id: opciones.tarifarioId,
        tipo_regla: tipo,
        provincia_origen: origen.provinciaOrigen,
        localidad_origen: origen.localidadOrigen,
        provincia_destino: origen.provinciaDestino,
        localidad_destino: origen.localidadDestino,
        zona_destino: etiquetaDeClave.get(clave) ?? etiquetaZona(clave),
        costo_base_viaje: costoBaseStr,
        aplica_colecta: false,
        estado,
        ...(tipo === 'PESO'
          ? { kg_min: rango.min, kg_max: rango.max }
          : { m3_min: rango.min, m3_max: rango.max }),
        ...(rango.esExcedente
          ? tipo === 'PESO'
            ? { precio_kg_excedente: decimalAString(precio) }
            : { precio_m3_excedente: decimalAString(precio) }
          : tipo === 'PESO'
            ? { precio_kg_base: decimalAString(precio) }
            : { precio_m3_base: decimalAString(precio) }),
      };

      // Deduplicacion por contenido: el tarifario no tiene codigo postal ni
      // tiempo de entrega (no son parte de ReglaTarifa), asi que varias
      // filas de cobertura pueden colapsar al mismo documento. Sin esto,
      // una misma ruta con 5 CP generaria 5 documentos identicos.
      const huella = JSON.stringify(base);
      if (vistas.has(huella)) {
        duplicadosEliminados += 1;
        continue;
      }
      vistas.add(huella);
      reglas.push(base);
    }
  };

  // Ordenamos la cobertura para que la salida sea estable.
  const coberturaOrdenada = [...cobertura].sort((a, b) => {
    const porZona = a.claveZona.localeCompare(b.claveZona, 'es');
    if (porZona !== 0) return porZona;
    const porProvincia = a.provinciaDestino.localeCompare(b.provinciaDestino, 'es');
    if (porProvincia !== 0) return porProvincia;
    return a.localidadDestino.localeCompare(b.localidadDestino, 'es');
  });

  for (const origen of coberturaOrdenada) {
    procesar(origen, 'PESO', peso.filas);
    procesar(origen, 'VOLUMEN', volumen.filas);
  }

  return {
    reglas,
    duplicadosEliminados,
    celdasSinPrecio,
    zonasFaltantes: faltantes,
    resueltas,
  };
}

// ===========================================================================
// 11. Salida
// ===========================================================================

interface Metadata {
  id_proveedor: string;
  tarifario_id: string;
  generado_en: string;
  fuente: { cobertura: string; tarifas: string };
  conteos: {
    filas_cobertura: number;
    filas_cobertura_descartadas: number;
    rangos_peso: number;
    rangos_volumen: number;
    reglas_generadas: number;
    documentos_duplicados_eliminados: number;
    celdas_sin_precio: number;
  };
  /** Zonas de la cobertura que no tienen columna en el tarifario. */
  zonas_sin_cobertura: string[];
  /** Zonas que sí se cruzaron y cómo se resolvió el nombre. */
  resolucion_zonas: Array<{ zona: string; contra: string; via: string }>;
  filas_descartadas: FilaDescartada[];
  advertencias: string[];
}

function escribirSalida(
  ruta: string,
  reglas: ReglaTarifa[],
  metadata: Metadata,
  formato: FormatoSalida,
): void {
  const destino = resolve(ruta);
  mkdirSync(dirname(destino), { recursive: true });

  let contenido: string;
  switch (formato) {
    case 'array':
      contenido = `${JSON.stringify(reglas, null, 2)}\n`;
      break;
    case 'jsonl':
      contenido = `${reglas.map((r) => JSON.stringify(r)).join('\n')}\n`;
      break;
    default:
      contenido = `${JSON.stringify({ metadata, reglas }, null, 2)}\n`;
  }

  writeFileSync(destino, contenido, 'utf8');
}

// ===========================================================================
// 12. Punto de entrada
// ===========================================================================

function idPorDefecto(rutaTarifas: string): string {
  const base = rutaTarifas.split(/[\\/]/).pop() ?? 'tarifas';
  return base.replace(/\.xlsx?$/i, '');
}

function ejecutar(): void {
  const opciones = parsearArgs(process.argv.slice(2));

  if (opciones.ayuda) {
    process.stdout.write(`${AYUDA}\n`);
    return;
  }

  validarOpciones(opciones);

  if (opciones.tarifarioId.trim() === '') {
    opciones.tarifarioId = idPorDefecto(opciones.tarifas);
  }

  for (const [etiqueta, ruta] of [
    ['--cobertura', opciones.cobertura],
    ['--tarifas', opciones.tarifas],
  ] as const) {
    if (!existsSync(resolve(ruta))) {
      throw new ErrorIngesta(`No existe el archivo indicado por ${etiqueta}: ${ruta}`);
    }
  }

  // Validamos el costo base una vez, acá, para fallar temprano.
  decimalDesdeTexto(opciones.costoBaseViaje);

  const advertencias: string[] = [];

  const cobertura = leerCobertura(resolve(opciones.cobertura), opciones.hojaCobertura);
  const peso = leerTarifario(resolve(opciones.tarifas), opciones.hojaPeso, 'PESO', advertencias);
  const volumen = leerTarifario(
    resolve(opciones.tarifas),
    opciones.hojaVolumen,
    'VOLUMEN',
    advertencias,
  );

  const { reglas, duplicadosEliminados, celdasSinPrecio, zonasFaltantes, resueltas } =
    transformar(cobertura.filas, peso, volumen, opciones, advertencias);

  if (cobertura.descartadas.length > 0) {
    advertencias.push(
      `${cobertura.descartadas.length} fila(s) de la cobertura se descartaron por ` +
        `zona vacia o no reconocida (detalle en metadata.filas_descartadas).`,
    );
  }
  if (celdasSinPrecio > 0) {
    advertencias.push(
      `${celdasSinPrecio} combinaciones (ruta x rango x zona) quedaron sin precio ` +
        `porque la celda del tarifario estaba vacia.`,
    );
  }
  if (reglas.length === 0) {
    throw new ErrorIngesta(
      'No se genero ninguna regla. Revisar que las zonas de la cobertura ' +
        'existan en el tarifario y que el tarifario tenga precios cargados.',
    );
  }

  const metadata: Metadata = {
    id_proveedor: opciones.proveedor.trim(),
    tarifario_id: opciones.tarifarioId,
    generado_en: new Date().toISOString(),
    fuente: {
      cobertura: opciones.cobertura,
      tarifas: opciones.tarifas,
    },
    conteos: {
      filas_cobertura: cobertura.filas.length,
      filas_cobertura_descartadas: cobertura.descartadas.length,
      rangos_peso: peso.filas.length,
      rangos_volumen: volumen.filas.length,
      reglas_generadas: reglas.length,
      documentos_duplicados_eliminados: duplicadosEliminados,
      celdas_sin_precio: celdasSinPrecio,
    },
    zonas_sin_cobertura: zonasFaltantes,
    resolucion_zonas: resueltas,
    filas_descartadas: cobertura.descartadas,
    advertencias,
  };

  if (opciones.dryRun) {
    process.stdout.write(`[dry-run] No se escribio ningun archivo.\n`);
  } else {
    escribirSalida(opciones.output, reglas, metadata, opciones.formato);
    process.stdout.write(
      `OK  ${reglas.length} reglas escritas en ${resolve(opciones.output)}\n`,
    );
  }

  process.stdout.write(
    `    proveedor=${opciones.proveedor}  tarifario=${opciones.tarifarioId}\n` +
      `    cobertura=${cobertura.filas.length} filas` +
      (cobertura.descartadas.length > 0
        ? ` (${cobertura.descartadas.length} descartadas)`
        : '') +
      ` | peso=${peso.filas.length} rangos | volumen=${volumen.filas.length} rangos\n` +
      `    duplicados eliminados=${duplicadosEliminados} | sin precio=${celdasSinPrecio}\n`,
  );

  if (zonasFaltantes.length > 0) {
    process.stdout.write(
      `    ZONAS SIN COBERTURA EN EL TARIFARIO: ${zonasFaltantes.join(', ')}\n`,
    );
  }
  for (const advertencia of advertencias) {
    process.stdout.write(`    aviso: ${advertencia}\n`);
  }
}

export function principal(): void {
  try {
    ejecutar();
  } catch (error) {
    if (error instanceof ErrorIngesta) {
      process.stderr.write(`\nERROR de ingesta: ${error.message}\n`);
      if (error.contexto.length > 0) {
        process.stderr.write(`  contexto: ${error.contexto.join(' > ')}\n`);
      }
      process.stderr.write(
        `\nRevisá el archivo de entrada o ejecutá con --help para ver las opciones.\n\n`,
      );
    } else {
      process.stderr.write(
        `\nERROR inesperado: ${
          error instanceof Error ? (error.stack ?? error.message) : String(error)
        }\n\n`,
      );
    }
    process.exitCode = 1;
  }
}

// Solo se ejecuta como CLI; al importarlo (tests) no corre nada.
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal();
}
