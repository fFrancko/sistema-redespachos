import { isValidCalendarDate } from '../primitives';
import type { DateString } from '../primitives';

// D28: `dd/MM/yyyy` o `dd/MM/yyyy HH:mm:ss`.
const TMS_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})(?: ([01]\d|2[0-3]):[0-5]\d:[0-5]\d)?$/;

// Devuelve el día como `yyyy-MM-dd` (sin conversión a Date ni huso) o null si el formato es
// inválido o la fecha no existe.
export function parseTmsDate(text: string): DateString | null {
  const match = TMS_DATE_PATTERN.exec(text.trim());
  if (match === null) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!isValidCalendarDate(year, month, day)) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}
