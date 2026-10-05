import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';
import {
  centsSchema,
  centsToDecimal,
  cpSchema,
  dateSchema,
  decSchema,
  decToDecimal,
  decimalToCents,
  decimalToDec,
  emailSchema,
  percentSchema,
  positiveDecSchema,
  refSchema,
  timestampSchema,
} from './primitives.js';

describe('dec', () => {
  it.each(['0', '123.45', '1250.5000', '0.0001', '10'])('acepta %s', (value) => {
    expect(decSchema.parse(value)).toBe(value);
  });

  it.each([
    ['number', 123],
    ['notación científica', '1e3'],
    ['coma decimal', '1,5'],
    ['negativo', '-1'],
    ['más de 4 decimales', '1.23456'],
    ['vacío', ''],
    ['sin parte entera', '.5'],
    ['texto', 'abc'],
    ['coma de miles', '1,000.00'],
  ])('rechaza %s', (_label, value) => {
    expect(decSchema.safeParse(value).success).toBe(false);
  });

  it('percentSchema acepta [0, 100] y rechaza fuera de rango', () => {
    expect(percentSchema.safeParse('0').success).toBe(true);
    expect(percentSchema.safeParse('10.5').success).toBe(true);
    expect(percentSchema.safeParse('100').success).toBe(true);
    expect(percentSchema.safeParse('100.0001').success).toBe(false);
    expect(percentSchema.safeParse('101').success).toBe(false);
  });

  it('positiveDecSchema rechaza 0', () => {
    expect(positiveDecSchema.safeParse('0.0001').success).toBe(true);
    expect(positiveDecSchema.safeParse('0').success).toBe(false);
    expect(positiveDecSchema.safeParse('0.0000').success).toBe(false);
  });

  it('decToDecimal convierte y valida', () => {
    expect(decToDecimal('12.5').equals(new Decimal('12.5'))).toBe(true);
    expect(() => decToDecimal('1e3')).toThrow();
  });

  it('decimalToDec redondea half-up a 4 decimales', () => {
    expect(decimalToDec(new Decimal('1.23455'))).toBe('1.2346');
    expect(decimalToDec(new Decimal('1.23454'))).toBe('1.2345');
    expect(decimalToDec(new Decimal('1.00'))).toBe('1');
    expect(decimalToDec(new Decimal('0.00004'))).toBe('0');
    expect(decimalToDec(new Decimal('1250.5'))).toBe('1250.5');
  });

  it('decimalToDec rechaza negativos y no finitos', () => {
    expect(() => decimalToDec(new Decimal('-1'))).toThrow(RangeError);
    expect(() => decimalToDec(new Decimal(NaN))).toThrow(RangeError);
    expect(() => decimalToDec(new Decimal(Infinity))).toThrow(RangeError);
  });

  it('el resultado de decimalToDec cumple decSchema', () => {
    expect(decSchema.safeParse(decimalToDec(new Decimal('349731.72'))).success).toBe(true);
  });
});

describe('cents', () => {
  it.each([0, 1, 34973172, Number.MAX_SAFE_INTEGER])('acepta %s', (value) => {
    expect(centsSchema.parse(value)).toBe(value);
  });

  it.each([
    ['decimal', 1.5],
    ['negativo', -1],
    ['no seguro', 2 ** 53],
    ['string', '100'],
    ['NaN', NaN],
    ['Infinity', Infinity],
  ])('rechaza %s', (_label, value) => {
    expect(centsSchema.safeParse(value).success).toBe(false);
  });

  it('decimalToCents redondea half-up a centavo', () => {
    expect(decimalToCents(new Decimal('718.3743'))).toBe(71837);
    expect(decimalToCents(new Decimal('10.005'))).toBe(1001);
    expect(decimalToCents(new Decimal('10.004'))).toBe(1000);
    expect(decimalToCents(new Decimal('3420.83'))).toBe(342083);
    expect(decimalToCents(new Decimal('0'))).toBe(0);
  });

  it('decimalToCents rechaza negativos, no finitos y valores fuera de rango seguro', () => {
    expect(() => decimalToCents(new Decimal('-0.01'))).toThrow(RangeError);
    expect(() => decimalToCents(new Decimal(NaN))).toThrow(RangeError);
    expect(() => decimalToCents(new Decimal('1e17'))).toThrow();
  });

  it('centsToDecimal vuelve a pesos', () => {
    expect(centsToDecimal(12345).equals(new Decimal('123.45'))).toBe(true);
    expect(() => centsToDecimal(1.5)).toThrow();
  });
});

describe('date', () => {
  it.each(['2026-10-01', '2024-02-29', '2026-12-31'])('acepta %s', (value) => {
    expect(dateSchema.parse(value)).toBe(value);
  });

  it.each(['2026-02-30', '2026-02-29', '2026-13-01', '2026-00-10', '01/10/2026', '2026-1-1', ''])(
    'rechaza %s',
    (value) => {
      expect(dateSchema.safeParse(value).success).toBe(false);
    },
  );

  it('no convierte a Date', () => {
    expect(typeof dateSchema.parse('2026-10-01')).toBe('string');
  });
});

describe('timestamp', () => {
  it('acepta un Date', () => {
    const date = new Date('2026-10-01T10:00:00Z');
    expect(timestampSchema.parse(date)).toEqual(date);
  });

  it('acepta ISO con offset -03:00 y lo transforma a Date', () => {
    const parsed = timestampSchema.parse('2026-10-01T10:00:00-03:00');
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed.toISOString()).toBe('2026-10-01T13:00:00.000Z');
  });

  it('acepta ISO con Z y con milisegundos', () => {
    expect(timestampSchema.parse('2026-10-01T10:00:00Z').toISOString()).toBe(
      '2026-10-01T10:00:00.000Z',
    );
    expect(timestampSchema.parse('2026-10-01T10:00:00.123Z').getUTCMilliseconds()).toBe(123);
  });

  it.each([
    ['sin offset', '2026-10-01T10:00:00'],
    ['solo fecha', '2026-10-01'],
    ['día inexistente', '2026-02-30T10:00:00Z'],
    ['hora fuera de rango', '2026-10-01T25:00:00Z'],
    ['texto', 'ayer'],
    ['número', 1_700_000_000_000],
  ])('rechaza %s', (_label, value) => {
    expect(timestampSchema.safeParse(value).success).toBe(false);
  });

  it('rechaza un Date inválido', () => {
    expect(timestampSchema.safeParse(new Date('no es una fecha')).success).toBe(false);
  });
});

describe('ref, cp y email', () => {
  it('ref no admite vacío', () => {
    expect(refSchema.safeParse('uid-1').success).toBe(true);
    expect(refSchema.safeParse('').success).toBe(false);
  });

  it('cp exige 4 dígitos', () => {
    expect(cpSchema.safeParse('1406').success).toBe(true);
    for (const value of ['140', '14060', '1406.0', ' 1406', '14A6', '']) {
      expect(cpSchema.safeParse(value).success).toBe(false);
    }
  });

  it('email valida el formato', () => {
    expect(emailSchema.safeParse('ana@qx.example').success).toBe(true);
    expect(emailSchema.safeParse('ana@').success).toBe(false);
  });
});
