import { describe, it, expect } from 'vitest';
import { ZReglaTarifa, ZTramo, ZCobertura } from '../tarifas';
import Decimal from 'decimal.js';

describe('Tarifas Schemas', () => {
  describe('ZTramo', () => {
    it('should parse a valid tramo', () => {
      const result = ZTramo.parse({
        min: new Decimal('0'),
        max: new Decimal('10'),
        precio: new Decimal('50'),
      });
      expect(result.min).toEqual(new Decimal('0'));
      expect(result.max).toEqual(new Decimal('10'));
      expect(result.precio).toEqual(new Decimal('50'));
    });

    it('should parse with string decimals', () => {
      const result = ZTramo.parse({
        min: '5',
        max: '15.5',
        precio: '100.25',
      });
      expect(result.min).toEqual(new Decimal('5'));
    });
  });

  describe('ZCobertura', () => {
    it('should parse a valid cobertura', () => {
      const result = ZCobertura.parse({
        id: 'cov-1',
        expreso_id: 'hacha',
        codigo_postal: '1425',
        zona_destino: 'Capital Federal',
        max_peso_kg: '50',
        es_encomienda: true,
      });
      expect(result.id).toBe('cov-1');
      expect(result.expreso_id).toBe('hacha');
      expect(result.es_encomienda).toBe(true);
    });

    it('should reject cobertura with non-positive max_peso_kg', () => {
      expect(() => {
        ZCobertura.parse({
          id: 'cov-1',
          expreso_id: 'hacha',
          codigo_postal: '1425',
          zona_destino: 'Capital Federal',
          max_peso_kg: '0',
          es_encomienda: false,
        });
      }).toThrow();
    });
  });

  describe('ZReglaTarifa', () => {
    it('should parse a valid regla tarifa', () => {
      const result = ZReglaTarifa.parse({
        id: 'rt-1',
        expreso_id: 'hacha',
        codigo_postal: '1425',
        zona_destino: 'CABA',
        precio_kg_base: '100',
        max_kg_incluido: '20',
        precio_kg_excedente: '50',
        vigencia_desde: '2026-10-01T00:00:00Z',
        vigencia_hasta: '2026-12-31T23:59:59Z',
      });
      expect(result.id).toBe('rt-1');
      expect(result.precio_kg_base).toEqual(new Decimal('100'));
    });

    it('should parse with null vigencia_hasta', () => {
      const result = ZReglaTarifa.parse({
        id: 'rt-2',
        expreso_id: 'logicargo',
        codigo_postal: '2000',
        zona_destino: 'La Plata',
        precio_kg_base: '80',
        max_kg_incluido: '15',
        precio_kg_excedente: '40',
        vigencia_desde: new Date('2026-10-01'),
        vigencia_hasta: null,
      });
      expect(result.vigencia_hasta).toBeNull();
    });

    it('should reject regla with negative precio_kg_base', () => {
      expect(() => {
        ZReglaTarifa.parse({
          id: 'rt-3',
          expreso_id: 'hacha',
          codigo_postal: '1425',
          zona_destino: 'CABA',
          precio_kg_base: '-10',
          max_kg_incluido: '20',
          precio_kg_excedente: '50',
          vigencia_desde: new Date(),
          vigencia_hasta: null,
        });
      }).toThrow();
    });

    it('should reject regla with non-positive max_kg_incluido', () => {
      expect(() => {
        ZReglaTarifa.parse({
          id: 'rt-4',
          expreso_id: 'hacha',
          codigo_postal: '1425',
          zona_destino: 'CABA',
          precio_kg_base: '100',
          max_kg_incluido: '0',
          precio_kg_excedente: '50',
          vigencia_desde: new Date(),
          vigencia_hasta: null,
        });
      }).toThrow();
    });

    it('should parse without vigencia_hasta (indefinite)', () => {
      const result = ZReglaTarifa.parse({
        id: 'rt-5',
        expreso_id: 'hacha',
        codigo_postal: '1425',
        zona_destino: 'CABA',
        precio_kg_base: '100',
        max_kg_incluido: '20',
        precio_kg_excedente: '50',
        vigencia_desde: new Date(),
      });
      expect(result.vigencia_hasta).toBeUndefined();
    });
  });
});
