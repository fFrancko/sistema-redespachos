import { Decimal } from 'decimal.js';
import { z } from 'zod';

// Tipos de §2 de la arquitectura v3. Los tipos TS se derivan con z.infer, nunca a mano.

// ---------- dec: string decimal no negativo, hasta 4 decimales ----------

export const DEC_PATTERN = /^\d+(\.\d{1,4})?$/;

export const decSchema = z
  .string()
  .regex(DEC_PATTERN, 'dec: string decimal no negativo con hasta 4 decimales');
export type Dec = z.infer<typeof decSchema>;

export const percentSchema = decSchema.refine(
  (value) => new Decimal(value).lte(100),
  'porcentaje fuera del rango [0, 100]',
);

export const positiveDecSchema = decSchema.refine(
  (value) => new Decimal(value).gt(0),
  'debe ser mayor que 0',
);

export function decToDecimal(value: Dec): Decimal {
  return new Decimal(decSchema.parse(value));
}

export function decimalToDec(value: Decimal): Dec {
  if (!value.isFinite()) throw new RangeError('decimalToDec: valor no finito');
  const rounded = value.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  if (rounded.lt(0)) throw new RangeError('decimalToDec: dec no admite negativos');
  return rounded.isZero() ? '0' : rounded.toFixed();
}

// ---------- cents: entero >= 0 (único monto que se guarda como number) ----------

export const centsSchema = z.number().int().nonnegative().safe();
export type Cents = z.infer<typeof centsSchema>;

// `pesos` es un importe en ARS; devuelve centavos con redondeo half-up (§3.3 paso 4).
export function decimalToCents(pesos: Decimal): Cents {
  if (!pesos.isFinite()) throw new RangeError('decimalToCents: valor no finito');
  const cents = pesos.times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  if (cents.lt(0)) throw new RangeError('decimalToCents: cents no admite negativos');
  return centsSchema.parse(cents.toNumber());
}

export function centsToDecimal(cents: Cents): Decimal {
  return new Decimal(centsSchema.parse(cents)).div(100);
}

// ---------- date: yyyy-MM-dd, día calendario válido, sin conversión a Date ----------

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function isValidDateString(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  return (
    match !== null && isValidCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))
  );
}

export const dateSchema = z
  .string()
  .regex(DATE_PATTERN, 'date: formato yyyy-MM-dd')
  .refine(isValidDateString, 'date: día calendario inexistente');
export type DateString = z.infer<typeof dateSchema>;

// ---------- timestamp: Date o ISO 8601 con offset o Z, siempre se entrega como Date ----------

const ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

const isoTimestampStringSchema = z
  .string()
  .refine((value) => {
    const match = ISO_TIMESTAMP_PATTERN.exec(value);
    return (
      match !== null && isValidCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))
    );
  }, 'timestamp: ISO 8601 con offset o Z')
  .transform((value) => new Date(value));

export const timestampSchema = z.union([z.date(), isoTimestampStringSchema]);
export type Timestamp = z.infer<typeof timestampSchema>;

// ---------- ref y otros primitivos comunes ----------

export const refSchema = z.string().min(1);
export type Ref = z.infer<typeof refSchema>;

export const CP_PATTERN = /^\d{4}$/;
export const cpSchema = z.string().regex(CP_PATTERN, 'código postal de 4 dígitos');
export type Cp = z.infer<typeof cpSchema>;

export const emailSchema = z.string().email();
export const emailListSchema = z.array(emailSchema);

// Campos de control que la arquitectura repite en varias colecciones (§2.2, §2.3).
export const controlFieldsShape = {
  creado_por: refSchema,
  creado_en: timestampSchema,
  actualizado_por: refSchema,
  actualizado_en: timestampSchema,
};
