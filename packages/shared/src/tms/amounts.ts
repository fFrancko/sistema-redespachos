import { centsSchema, decToDecimal, decimalToCents, decSchema } from '../primitives';
import type { Cents, Dec } from '../primitives';

// D28: coma de miles y punto decimal (`349,731.72`). La coma solo es válida como separador de
// miles (grupos de tres dígitos); cualquier otra forma es ambigua o inválida. Además, el archivo
// real trae pesos sin cero entero (`.5`): se aceptan y se normalizan a `0.5` (decisión de Franco).
const TMS_AMOUNT_PATTERN = /^(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)$/;

// Devuelve el `dec` equivalente o null si el formato es inválido (incluye negativos, notación
// científica, coma decimal y más de 4 decimales).
export function parseTmsAmount(text: string): Dec | null {
  const trimmed = text.trim();
  if (!TMS_AMOUNT_PATTERN.test(trimmed)) return null;
  const plain = trimmed.replace(/,/g, '');
  const normalized = plain.startsWith('.') ? `0${plain}` : plain;
  return decSchema.safeParse(normalized).success ? normalized : null;
}

export function parseTmsInteger(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}

// Importe en pesos (`dec`) a centavos, con redondeo half-up. Null si no entra como `cents`.
export function tmsAmountToCents(amount: Dec): Cents | null {
  try {
    return centsSchema.parse(decimalToCents(decToDecimal(amount)));
  } catch {
    return null;
  }
}
