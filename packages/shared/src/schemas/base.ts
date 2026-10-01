import { z } from 'zod';
import Decimal from 'decimal.js';

// Dinero siempre es Decimal.js, nunca number (rechaza float para evitar precision issues)
export const ZDecimal = z
  .union([
    z.instanceof(Decimal),
    z.string().regex(/^-?\d+(\.\d+)?$/, 'Must be a valid numeric string'),
  ])
  .transform((val) => {
    if (val instanceof Decimal) return val;
    return new Decimal(val);
  });

export type DecimalType = z.infer<typeof ZDecimal>;

// Timestamps: Date o ISO string, parse a Date
export const ZTimestamp = z
  .union([z.date(), z.string().datetime()])
  .transform((val) => (val instanceof Date ? val : new Date(val)));

export type Timestamp = z.infer<typeof ZTimestamp>;

// Email válido
export const ZEmail = z.string().email('Invalid email address');
export type Email = z.infer<typeof ZEmail>;

// Código postal (AR: 1000-9999, extensible)
export const ZCodigoPostal = z
  .string()
  .regex(/^\d{4}$/, 'Código postal must be 4 digits (AR format)');

export type CodigoPostal = z.infer<typeof ZCodigoPostal>;
