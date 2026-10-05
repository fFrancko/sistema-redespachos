import { norm } from '../normalize.js';
import { CP_PATTERN, decToDecimal } from '../primitives.js';
import type { Dec } from '../primitives.js';
import type { ObservationCode } from '../errors.js';
import type { OrderImport, OrderRowError } from '../schemas/orders.js';
import { parseTmsAmount, parseTmsInteger, tmsAmountToCents } from './amounts.js';
import { parseTmsDate } from './dates.js';
import { TMS_ALL_COLUMNS, TMS_COLUMN_BY_KEY, normalizeHeader } from './headers.js';

// Fila cruda: encabezado original del archivo → valor de la celda.
export type TmsRawRow = Readonly<Record<string, string | undefined>>;

export interface TmsRowContext {
  // Si llega, `cabecera_origen` debe estar entre estas sucursales (se compara con `norm`).
  sucursales_permitidas?: readonly string[];
  // `parametros.tolerancia_volumen_pct`.
  tolerancia_volumen_pct: Dec;
}

export interface TmsRowResult {
  // Campos de la fila que se pudieron interpretar. Con `errores` vacío cumple `orderImportSchema`.
  datos: Partial<OrderImport>;
  errores: OrderRowError[];
  observaciones: ObservationCode[];
}

type RequiredTextField =
  'nro_pedido' | 'zona_origen' | 'cabecera_origen' | 'localidad' | 'provincia';
type OptionalTextField =
  | 'zona_destino_importada'
  | 'cabecera_destino_importada'
  | 'expreso_manual'
  | 'destinatario'
  | 'direccion'
  | 'numero';
type CpField = 'codigo_postal_origen' | 'codigo_postal';
type DimensionField = 'alto_cm' | 'ancho_cm' | 'largo_cm';

const REQUIRED_TEXT_FIELDS: readonly RequiredTextField[] = [
  'nro_pedido',
  'zona_origen',
  'cabecera_origen',
  'localidad',
  'provincia',
];
const OPTIONAL_TEXT_FIELDS: readonly OptionalTextField[] = [
  'zona_destino_importada',
  'cabecera_destino_importada',
  'expreso_manual',
  'destinatario',
  'direccion',
  'numero',
];
const CP_FIELDS: readonly CpField[] = ['codigo_postal_origen', 'codigo_postal'];
const DIMENSION_FIELDS: readonly DimensionField[] = ['alto_cm', 'ancho_cm', 'largo_cm'];

const CUBIC_CM_PER_M3 = 1_000_000;

// Los mensajes nunca incluyen valores de la fila (destinatarios y direcciones: Ley 25.326).
export function parseTmsRow(fila: TmsRawRow, contexto: TmsRowContext): TmsRowResult {
  const errores: OrderRowError[] = [];
  const observaciones: ObservationCode[] = [];
  const datos: Partial<OrderImport> = {};
  const origen: Record<string, string> = {};
  const byField = new Map<string, string>();

  const fail = (campo: string, codigo: OrderRowError['codigo'], mensaje: string): void => {
    errores.push({ campo, codigo, mensaje });
  };

  // Una pasada para ubicar cada celda en su campo o en `origen_tms`.
  const cells = new Map<string, string>();
  for (const [header, value] of Object.entries(fila)) {
    const column = TMS_COLUMN_BY_KEY.get(normalizeHeader(header));
    if (column !== undefined) cells.set(column.key, (value ?? '').trim());
  }
  for (const column of TMS_ALL_COLUMNS) {
    const cell = cells.get(column.key);
    if (cell === undefined) continue;
    if (column.field !== null) {
      byField.set(column.field, cell);
    } else {
      if (column.kind === 'date' && cell !== '' && parseTmsDate(cell) === null) {
        fail(column.origenKey, 'FORMATO_INVALIDO', 'Fecha con formato inválido');
      }
      origen[column.origenKey] = cell;
    }
  }
  datos.origen_tms = origen;

  const read = (field: string): string => byField.get(field) ?? '';

  for (const field of REQUIRED_TEXT_FIELDS) {
    const value = read(field);
    if (value === '') fail(field, 'CAMPO_OBLIGATORIO', 'Campo obligatorio vacío');
    else datos[field] = value;
  }
  for (const field of OPTIONAL_TEXT_FIELDS) {
    const value = read(field);
    if (value !== '') datos[field] = value;
  }

  if (
    datos.cabecera_origen !== undefined &&
    contexto.sucursales_permitidas !== undefined &&
    !contexto.sucursales_permitidas.map(norm).includes(norm(datos.cabecera_origen))
  ) {
    fail('cabecera_origen', 'CABECERA_NO_PERMITIDA', 'La cabecera de origen no está permitida');
  }

  for (const field of CP_FIELDS) {
    const value = read(field);
    if (value === '') fail(field, 'CAMPO_OBLIGATORIO', 'Campo obligatorio vacío');
    else if (!CP_PATTERN.test(value)) {
      fail(field, 'FORMATO_INVALIDO', 'El código postal debe tener 4 dígitos');
    } else datos[field] = value;
  }

  const fechaInterfaz = read('fecha_interfaz');
  if (fechaInterfaz === '') fail('fecha_interfaz', 'CAMPO_OBLIGATORIO', 'Campo obligatorio vacío');
  else {
    const date = parseTmsDate(fechaInterfaz);
    if (date === null) fail('fecha_interfaz', 'FORMATO_INVALIDO', 'Fecha con formato inválido');
    else datos.fecha_interfaz = date;
  }

  // Peso y volumen: vacío, 0 o negativo son errores de dato; texto ilegible es de formato.
  const parseMeasure = (
    field: 'peso_kgs' | 'volumen_m3',
    invalidCode: 'PESO_INVALIDO' | 'VOLUMEN_INVALIDO',
  ): void => {
    const value = read(field);
    if (value === '') return fail(field, invalidCode, 'Valor vacío');
    const amount = parseTmsAmount(value);
    if (amount === null) return fail(field, 'FORMATO_INVALIDO', 'Importe con formato inválido');
    if (decToDecimal(amount).lte(0)) return fail(field, invalidCode, 'Debe ser mayor que 0');
    datos[field] = amount;
  };
  parseMeasure('peso_kgs', 'PESO_INVALIDO');
  parseMeasure('volumen_m3', 'VOLUMEN_INVALIDO');

  const pesoAforado = read('peso_aforado');
  if (pesoAforado === '') fail('peso_aforado', 'CAMPO_OBLIGATORIO', 'Campo obligatorio vacío');
  else {
    const amount = parseTmsAmount(pesoAforado);
    if (amount === null) fail('peso_aforado', 'FORMATO_INVALIDO', 'Importe con formato inválido');
    else datos.peso_aforado = amount;
  }

  const bultos = read('cantidad_bultos');
  if (bultos === '') fail('cantidad_bultos', 'CAMPO_OBLIGATORIO', 'Campo obligatorio vacío');
  else {
    const count = parseTmsInteger(bultos);
    if (count === null || count <= 0) {
      fail('cantidad_bultos', 'FORMATO_INVALIDO', 'Debe ser un entero mayor que 0');
    } else datos.cantidad_bultos = count;
  }

  const valorDeclarado = read('valor_declarado');
  if (valorDeclarado === '') observaciones.push('VALOR_DECLARADO_FALTANTE');
  else {
    const amount = parseTmsAmount(valorDeclarado);
    const cents = amount === null ? null : tmsAmountToCents(amount);
    if (cents === null) fail('valor_declarado', 'FORMATO_INVALIDO', 'Importe con formato inválido');
    else datos.valor_declarado = cents;
  }

  for (const field of DIMENSION_FIELDS) {
    const value = read(field);
    if (value === '') continue;
    const amount = parseTmsAmount(value);
    if (amount === null) fail(field, 'FORMATO_INVALIDO', 'Importe con formato inválido');
    else datos[field] = amount;
  }

  // Observaciones intrínsecas a la fila (no bloquean).
  if (datos.peso_aforado !== undefined) {
    const aforado = decToDecimal(datos.peso_aforado);
    if (aforado.isZero()) observaciones.push('AFORADO_CERO');
    else if (datos.peso_kgs !== undefined && aforado.lt(decToDecimal(datos.peso_kgs))) {
      observaciones.push('AFORADO_MENOR_A_PESO');
    }
  }

  if (
    datos.alto_cm !== undefined &&
    datos.ancho_cm !== undefined &&
    datos.largo_cm !== undefined &&
    datos.volumen_m3 !== undefined
  ) {
    const control = decToDecimal(datos.alto_cm)
      .times(decToDecimal(datos.ancho_cm))
      .times(decToDecimal(datos.largo_cm))
      .div(CUBIC_CM_PER_M3);
    const declared = decToDecimal(datos.volumen_m3);
    const differencePct = control.minus(declared).abs().div(declared).times(100);
    if (differencePct.gt(decToDecimal(contexto.tolerancia_volumen_pct))) {
      observaciones.push('VOLUMEN_INCONSISTENTE');
    }
  }

  return { datos, errores, observaciones };
}
