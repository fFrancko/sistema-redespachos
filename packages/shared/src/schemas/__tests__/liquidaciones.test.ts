import { describe, it, expect } from 'vitest';
import { ZLiquidacion, ZLineaLiquidacion } from '../liquidaciones';
import Decimal from 'decimal.js';

describe('Liquidaciones Schemas', () => {
  describe('ZLineaLiquidacion', () => {
    it('should parse a valid linea liquidacion', () => {
      const result = ZLineaLiquidacion.parse({
        proforma_id: 'prof-1',
        cantidad: 5,
        precio_unitario: '100.50',
        subtotal: '502.50',
      });
      expect(result.proforma_id).toBe('prof-1');
      expect(result.cantidad).toBe(5);
      expect(result.precio_unitario).toEqual(new Decimal('100.50'));
    });

    it('should reject negative precio_unitario', () => {
      expect(() => {
        ZLineaLiquidacion.parse({
          proforma_id: 'prof-1',
          cantidad: 1,
          precio_unitario: '-50',
          subtotal: '0',
        });
      }).toThrow();
    });

    it('should reject non-positive cantidad', () => {
      expect(() => {
        ZLineaLiquidacion.parse({
          proforma_id: 'prof-1',
          cantidad: 0,
          precio_unitario: '50',
          subtotal: '0',
        });
      }).toThrow();
    });
  });

  describe('ZLiquidacion', () => {
    it('should parse a valid liquidacion with matching totals', () => {
      const result = ZLiquidacion.parse({
        id: 'liq-1',
        numero: 'LIQ-2026-001',
        proveedor_id: 'prov-1',
        fecha_inicio_periodo: '2026-09-01T00:00:00Z',
        fecha_fin_periodo: '2026-09-30T23:59:59Z',
        lineas: [
          {
            proforma_id: 'prof-1',
            cantidad: 2,
            precio_unitario: '100',
            subtotal: '200',
          },
          {
            proforma_id: 'prof-2',
            cantidad: 3,
            precio_unitario: '100',
            subtotal: '300',
          },
        ],
        total_deuda: '500',
        estado: 'PENDIENTE',
      });
      expect(result.numero).toBe('LIQ-2026-001');
      expect(result.total_deuda).toEqual(new Decimal('500'));
      expect(result.estado).toBe('PENDIENTE');
    });

    it('should parse with PAGADA estado', () => {
      const result = ZLiquidacion.parse({
        id: 'liq-2',
        numero: 'LIQ-2026-002',
        proveedor_id: 'prov-2',
        fecha_inicio_periodo: new Date('2026-10-01'),
        fecha_fin_periodo: new Date('2026-10-31'),
        lineas: [
          {
            proforma_id: 'prof-3',
            cantidad: 1,
            precio_unitario: '250',
            subtotal: '250',
          },
        ],
        total_deuda: '250',
        estado: 'PAGADA',
      });
      expect(result.estado).toBe('PAGADA');
    });

    it('should parse with PARCIAL estado', () => {
      const result = ZLiquidacion.parse({
        id: 'liq-3',
        numero: 'LIQ-2026-003',
        proveedor_id: 'prov-3',
        fecha_inicio_periodo: new Date(),
        fecha_fin_periodo: new Date(),
        lineas: [
          {
            proforma_id: 'prof-4',
            cantidad: 10,
            precio_unitario: '50',
            subtotal: '500',
          },
        ],
        total_deuda: '500',
        estado: 'PARCIAL',
      });
      expect(result.estado).toBe('PARCIAL');
    });

    it('should reject liquidacion with mismatched totals', () => {
      expect(() => {
        ZLiquidacion.parse({
          id: 'liq-4',
          numero: 'LIQ-2026-004',
          proveedor_id: 'prov-4',
          fecha_inicio_periodo: new Date(),
          fecha_fin_periodo: new Date(),
          lineas: [
            {
              proforma_id: 'prof-5',
              cantidad: 1,
              precio_unitario: '100',
              subtotal: '100',
            },
          ],
          total_deuda: '200', // Wrong: lineas sum is 100
          estado: 'PENDIENTE',
        });
      }).toThrow('total_deuda must equal sum of lineas subtotals');
    });

    it('should parse with empty lineas and zero total', () => {
      const result = ZLiquidacion.parse({
        id: 'liq-5',
        numero: 'LIQ-2026-005',
        proveedor_id: 'prov-5',
        fecha_inicio_periodo: new Date(),
        fecha_fin_periodo: new Date(),
        lineas: [],
        total_deuda: '0',
        estado: 'PENDIENTE',
      });
      expect(result.lineas).toEqual([]);
      expect(result.total_deuda).toEqual(new Decimal('0'));
    });

    it('should reject negative total_deuda', () => {
      expect(() => {
        ZLiquidacion.parse({
          id: 'liq-6',
          numero: 'LIQ-2026-006',
          proveedor_id: 'prov-6',
          fecha_inicio_periodo: new Date(),
          fecha_fin_periodo: new Date(),
          lineas: [
            {
              proforma_id: 'prof-6',
              cantidad: 1,
              precio_unitario: '100',
              subtotal: '100',
            },
          ],
          total_deuda: '-100',
          estado: 'PENDIENTE',
        });
      }).toThrow();
    });

    it('should handle multiple lineas with decimal precision', () => {
      const result = ZLiquidacion.parse({
        id: 'liq-7',
        numero: 'LIQ-2026-007',
        proveedor_id: 'prov-7',
        fecha_inicio_periodo: new Date(),
        fecha_fin_periodo: new Date(),
        lineas: [
          {
            proforma_id: 'prof-7a',
            cantidad: 1,
            precio_unitario: '100.50',
            subtotal: '100.50',
          },
          {
            proforma_id: 'prof-7b',
            cantidad: 2,
            precio_unitario: '75.25',
            subtotal: '150.50',
          },
        ],
        total_deuda: '251.00',
        estado: 'PENDIENTE',
      });
      expect(result.total_deuda).toEqual(new Decimal('251.00'));
    });

    it('should reject liquidacion when total_deuda does not match lineas sum', () => {
      expect(() => {
        ZLiquidacion.parse({
          id: 'liq-8',
          numero: 'LIQ-2026-008',
          proveedor_id: 'prov-8',
          fecha_inicio_periodo: new Date(),
          fecha_fin_periodo: new Date(),
          lineas: [
            {
              proforma_id: 'prof-8a',
              cantidad: 1,
              precio_unitario: '100',
              subtotal: '100',
            },
            {
              proforma_id: 'prof-8b',
              cantidad: 1,
              precio_unitario: '50',
              subtotal: '50',
            },
          ],
          total_deuda: '200', // Wrong: sum is 150
          estado: 'PENDIENTE',
        });
      }).toThrow('total_deuda must equal sum of lineas subtotals');
    });
  });
});
