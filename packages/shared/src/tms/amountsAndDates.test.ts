import { describe, expect, it } from 'vitest';
import { parseTmsAmount, parseTmsInteger, tmsAmountToCents } from './amounts';
import { parseTmsDate } from './dates';

describe('parseTmsAmount (D28)', () => {
  it.each([
    ['349,731.72', '349731.72'],
    ['12.5', '12.5'],
    ['0', '0'],
    ['0.00', '0.00'],
    ['1,234', '1234'],
    ['1,234,567.8901', '1234567.8901'],
    ['  1,250.50  ', '1250.50'],
    ['007', '007'],
    ['.5', '0.5'],
    ['.25', '0.25'],
    ['  .5  ', '0.5'],
    ['.0001', '0.0001'],
  ])('%j → %j', (input, expected) => {
    expect(parseTmsAmount(input)).toBe(expected);
  });

  it.each([
    ['coma decimal', '1,5'],
    ['punto de miles y coma decimal', '1.234,50'],
    ['notación científica', '1e3'],
    ['negativo', '-5'],
    ['texto', 'abc'],
    ['vacío', ''],
    ['más de 4 decimales', '12.34567'],
    ['solo el punto', '.'],
    ['sin parte entera y más de 4 decimales', '.12345'],
    ['sin parte entera y negativo', '-.5'],
    ['sin parte entera con dos puntos', '.5.5'],
    ['sin parte entera con coma', ',5'],
    ['grupo de miles incompleto', '1,23,456'],
    ['coma al final', '1,'],
    ['dos puntos decimales', '1.2.3'],
    ['símbolo de moneda', '$100'],
  ])('rechaza %s', (_label, input) => {
    expect(parseTmsAmount(input)).toBeNull();
  });

  it('parseTmsInteger acepta solo enteros no negativos', () => {
    expect(parseTmsInteger('12')).toBe(12);
    expect(parseTmsInteger(' 3 ')).toBe(3);
    for (const input of ['1.5', '-1', '', 'a', '1,000', '99999999999999999999']) {
      expect(parseTmsInteger(input)).toBeNull();
    }
  });

  it('tmsAmountToCents convierte a centavos con half-up', () => {
    expect(tmsAmountToCents('349731.72')).toBe(34973172);
    expect(tmsAmountToCents('0')).toBe(0);
    expect(tmsAmountToCents('0.005')).toBe(1);
    expect(tmsAmountToCents('0.0049')).toBe(0);
  });

  it('tmsAmountToCents devuelve null si no entra como cents', () => {
    expect(tmsAmountToCents('99999999999999999999')).toBeNull();
  });
});

describe('parseTmsDate (D28)', () => {
  it('convierte dd/MM/yyyy a yyyy-MM-dd', () => {
    expect(parseTmsDate('30/09/2026')).toBe('2026-09-30');
    expect(parseTmsDate('01/01/2026')).toBe('2026-01-01');
    expect(parseTmsDate('29/02/2024')).toBe('2024-02-29');
  });

  it('convierte dd/MM/yyyy HH:mm:ss a la fecha, sin huso', () => {
    expect(parseTmsDate('30/09/2026 08:00:00')).toBe('2026-09-30');
    expect(parseTmsDate('15/10/2026 23:59:59')).toBe('2026-10-15');
    expect(parseTmsDate(' 15/10/2026 00:00:00 ')).toBe('2026-10-15');
  });

  it.each([
    ['fecha inexistente', '31/02/2026'],
    ['29 de febrero en año no bisiesto', '29/02/2026'],
    ['mes 13', '10/13/2026'],
    ['formato ISO', '2026-10-01'],
    ['día sin cero', '1/10/2026'],
    ['hora fuera de rango', '30/09/2026 25:00:00'],
    ['hora sin segundos', '30/09/2026 08:00'],
    ['texto', 'ayer'],
    ['vacío', ''],
    ['00/00/0000', '00/00/0000'],
  ])('rechaza %s', (_label, input) => {
    expect(parseTmsDate(input)).toBeNull();
  });
});
