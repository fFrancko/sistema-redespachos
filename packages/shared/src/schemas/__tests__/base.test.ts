import { describe, it, expect } from 'vitest';
import { ZDecimal, ZTimestamp, ZEmail, ZCodigoPostal } from '../base';
import Decimal from 'decimal.js';

describe('Base Schemas', () => {
  describe('ZDecimal', () => {
    it('should parse a valid numeric string', () => {
      const result = ZDecimal.parse('123.45');
      expect(result).toEqual(new Decimal('123.45'));
    });

    it('should parse a Decimal instance', () => {
      const decimal = new Decimal('100');
      const result = ZDecimal.parse(decimal);
      expect(result).toEqual(decimal);
    });

    it('should reject raw number input (must use string or Decimal instance)', () => {
      expect(() => ZDecimal.parse(99)).toThrow();
    });

    it('should reject invalid numeric string', () => {
      expect(() => ZDecimal.parse('abc')).toThrow();
    });

    it('should reject NaN', () => {
      expect(() => ZDecimal.parse(NaN)).toThrow();
    });

    it('should reject Infinity', () => {
      expect(() => ZDecimal.parse(Infinity)).toThrow();
      expect(() => ZDecimal.parse(-Infinity)).toThrow();
    });

    it('should parse negative numeric strings', () => {
      const result = ZDecimal.parse('-50.5');
      expect(result).toEqual(new Decimal('-50.5'));
    });
  });

  describe('ZTimestamp', () => {
    it('should parse a Date instance', () => {
      const date = new Date('2026-10-01');
      const result = ZTimestamp.parse(date);
      expect(result instanceof Date).toBe(true);
    });

    it('should parse an ISO string', () => {
      const isoString = '2026-10-01T12:00:00Z';
      const result = ZTimestamp.parse(isoString);
      expect(result instanceof Date).toBe(true);
      expect(result.getUTCHours()).toBe(12);
      expect(result.getUTCDate()).toBe(1);
      expect(result.getUTCMonth()).toBe(9); // October
      expect(result.getUTCFullYear()).toBe(2026);
    });

    it('should reject invalid date string', () => {
      expect(() => ZTimestamp.parse('not-a-date')).toThrow();
    });
  });

  describe('ZEmail', () => {
    it('should parse a valid email', () => {
      const result = ZEmail.parse('user@example.com');
      expect(result).toBe('user@example.com');
    });

    it('should reject invalid email format', () => {
      expect(() => ZEmail.parse('invalid-email')).toThrow();
    });

    it('should reject empty string', () => {
      expect(() => ZEmail.parse('')).toThrow();
    });
  });

  describe('ZCodigoPostal', () => {
    it('should parse a valid 4-digit postal code', () => {
      const result = ZCodigoPostal.parse('1425');
      expect(result).toBe('1425');
    });

    it('should reject code with letters', () => {
      expect(() => ZCodigoPostal.parse('142A')).toThrow();
    });

    it('should reject code with less than 4 digits', () => {
      expect(() => ZCodigoPostal.parse('142')).toThrow();
    });

    it('should reject code with more than 4 digits', () => {
      expect(() => ZCodigoPostal.parse('14250')).toThrow();
    });
  });
});
