import { describe, it, expect } from 'vitest';
import { ZProforma, ZLineaProforma } from '../proformas';
import Decimal from 'decimal.js';

describe('Proformas Schemas', () => {
  describe('ZLineaProforma', () => {
    it('should parse a valid linea proforma', () => {
      const result = ZLineaProforma.parse({
        linea_pedido_id: 'lp-1',
        descripcion: 'Envío de paquete',
        cantidad: 1,
        precio_unitario: '100.50',
        subtotal: '100.50',
      });
      expect(result.linea_pedido_id).toBe('lp-1');
      expect(result.cantidad).toBe(1);
      expect(result.precio_unitario).toEqual(new Decimal('100.50'));
    });

    it('should reject negative precio_unitario', () => {
      expect(() => {
        ZLineaProforma.parse({
          linea_pedido_id: 'lp-1',
          descripcion: 'Test',
          cantidad: 1,
          precio_unitario: '-50',
          subtotal: '0',
        });
      }).toThrow();
    });

    it('should reject negative subtotal', () => {
      expect(() => {
        ZLineaProforma.parse({
          linea_pedido_id: 'lp-1',
          descripcion: 'Test',
          cantidad: 1,
          precio_unitario: '50',
          subtotal: '-50',
        });
      }).toThrow();
    });
  });

  describe('ZProforma', () => {
    it('should parse a valid proforma with matching totals', () => {
      const result = ZProforma.parse({
        id: 'prof-1',
        numero: 'PRF-2026-001',
        pedido_id: 'ped-1',
        proveedor_id: 'prov-1',
        fecha_emision: '2026-10-01T10:00:00Z',
        vigencia_hasta: '2026-10-15T23:59:59Z',
        lineas: [
          {
            linea_pedido_id: 'lp-1',
            descripcion: 'Envío principal',
            cantidad: 1,
            precio_unitario: '100',
            subtotal: '100',
          },
          {
            linea_pedido_id: 'lp-2',
            descripcion: 'Recargo',
            cantidad: 1,
            precio_unitario: '50',
            subtotal: '50',
          },
        ],
        total: '150',
        moneda: 'ARS',
        estado: 'EMITIDA',
      });
      expect(result.numero).toBe('PRF-2026-001');
      expect(result.total).toEqual(new Decimal('150'));
      expect(result.estado).toBe('EMITIDA');
    });

    it('should apply default moneda ARS', () => {
      const result = ZProforma.parse({
        id: 'prof-2',
        numero: 'PRF-2026-002',
        pedido_id: 'ped-2',
        proveedor_id: 'prov-1',
        fecha_emision: new Date(),
        vigencia_hasta: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        lineas: [
          {
            linea_pedido_id: 'lp-3',
            descripcion: 'Test',
            cantidad: 1,
            precio_unitario: '100',
            subtotal: '100',
          },
        ],
        total: '100',
        estado: 'ACEPTADA',
      });
      expect(result.moneda).toBe('ARS');
    });

    it('should reject proforma with mismatched totals', () => {
      expect(() => {
        ZProforma.parse({
          id: 'prof-3',
          numero: 'PRF-2026-003',
          pedido_id: 'ped-3',
          proveedor_id: 'prov-1',
          fecha_emision: new Date(),
          vigencia_hasta: new Date(),
          lineas: [
            {
              linea_pedido_id: 'lp-4',
              descripcion: 'Item',
              cantidad: 1,
              precio_unitario: '100',
              subtotal: '100',
            },
          ],
          total: '150', // Wrong: lineas sum is 100
          estado: 'EMITIDA',
        });
      }).toThrow('Total must equal sum of lineas subtotals');
    });

    it('should parse with empty lineas and zero total', () => {
      const result = ZProforma.parse({
        id: 'prof-4',
        numero: 'PRF-2026-004',
        pedido_id: 'ped-4',
        proveedor_id: 'prov-1',
        fecha_emision: new Date(),
        vigencia_hasta: new Date(),
        lineas: [],
        total: '0',
        estado: 'EMITIDA',
      });
      expect(result.lineas).toEqual([]);
      expect(result.total).toEqual(new Decimal('0'));
    });

    it('should parse all valid estados', () => {
      const estados = ['EMITIDA', 'ACEPTADA', 'RECHAZADA'];
      estados.forEach((estado) => {
        const result = ZProforma.parse({
          id: `prof-${estado}`,
          numero: `PRF-${estado}`,
          pedido_id: 'ped-x',
          proveedor_id: 'prov-x',
          fecha_emision: new Date(),
          vigencia_hasta: new Date(),
          lineas: [
            {
              linea_pedido_id: 'lp-x',
              descripcion: 'Test',
              cantidad: 1,
              precio_unitario: '50',
              subtotal: '50',
            },
          ],
          total: '50',
          estado: estado,
        });
        expect(result.estado).toBe(estado);
      });
    });
  });
});
