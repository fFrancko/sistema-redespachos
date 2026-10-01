import { describe, it, expect } from 'vitest';
import { ZProveedor, ZCoberturaPorExpreso } from '../proveedores';
import Decimal from 'decimal.js';

describe('Proveedores Schemas', () => {
  describe('ZProveedor', () => {
    it('should parse a valid proveedor', () => {
      const result = ZProveedor.parse({
        id: 'prov-1',
        nombre: 'Transportes Hacha',
        email: 'contacto@hacha.com',
        telefono: '+54-11-1234-5678',
        activo: true,
        fecha_creacion: '2026-09-01T10:00:00Z',
      });
      expect(result.id).toBe('prov-1');
      expect(result.nombre).toBe('Transportes Hacha');
      expect(result.activo).toBe(true);
    });

    it('should parse with activo false', () => {
      const result = ZProveedor.parse({
        id: 'prov-2',
        nombre: 'Viejo Expreso',
        email: 'info@viejo.com',
        telefono: '11-9999-9999',
        activo: false,
        fecha_creacion: new Date('2025-01-01'),
      });
      expect(result.activo).toBe(false);
    });

    it('should reject proveedor with invalid email', () => {
      expect(() => {
        ZProveedor.parse({
          id: 'prov-3',
          nombre: 'Bad Provider',
          email: 'not-an-email',
          telefono: '123456',
          activo: true,
          fecha_creacion: new Date(),
        });
      }).toThrow();
    });
  });

  describe('ZCoberturaPorExpreso', () => {
    it('should parse a valid cobertura por expreso', () => {
      const result = ZCoberturaPorExpreso.parse({
        proveedor_id: 'prov-1',
        expreso_id: 'hacha',
        zonas_cubiertas: ['1425', '1426', '2000'],
        max_peso_kg: '100',
      });
      expect(result.proveedor_id).toBe('prov-1');
      expect(result.expreso_id).toBe('hacha');
      expect(result.zonas_cubiertas).toHaveLength(3);
      expect(result.max_peso_kg).toEqual(new Decimal('100'));
    });

    it('should parse with single zona', () => {
      const result = ZCoberturaPorExpreso.parse({
        proveedor_id: 'prov-2',
        expreso_id: 'logicargo',
        zonas_cubiertas: ['5000'],
        max_peso_kg: '50',
      });
      expect(result.zonas_cubiertas).toEqual(['5000']);
    });

    it('should reject with non-positive max_peso_kg', () => {
      expect(() => {
        ZCoberturaPorExpreso.parse({
          proveedor_id: 'prov-3',
          expreso_id: 'otro',
          zonas_cubiertas: ['1425'],
          max_peso_kg: '0',
        });
      }).toThrow();
    });

    it('should reject with invalid codigo postal in zonas_cubiertas', () => {
      expect(() => {
        ZCoberturaPorExpreso.parse({
          proveedor_id: 'prov-4',
          expreso_id: 'expreso',
          zonas_cubiertas: ['14251'], // 5 dígitos, debe ser 4
          max_peso_kg: '50',
        });
      }).toThrow();
    });

    it('should parse with empty zonas_cubiertas array', () => {
      const result = ZCoberturaPorExpreso.parse({
        proveedor_id: 'prov-5',
        expreso_id: 'futuro',
        zonas_cubiertas: [],
        max_peso_kg: '100',
      });
      expect(result.zonas_cubiertas).toEqual([]);
    });
  });
});
