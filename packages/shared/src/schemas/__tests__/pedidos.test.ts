import { describe, it, expect } from 'vitest';
import { ZPedido, ZLineaPedido, ZEstadoPedido } from '../pedidos';
import Decimal from 'decimal.js';

describe('Pedidos Schemas', () => {
  describe('ZEstadoPedido', () => {
    it('should parse valid estado', () => {
      const result = ZEstadoPedido.parse('PENDIENTE');
      expect(result).toBe('PENDIENTE');
    });

    it('should reject invalid estado', () => {
      expect(() => ZEstadoPedido.parse('INVALIDO')).toThrow();
    });
  });

  describe('ZLineaPedido', () => {
    it('should parse a valid linea pedido', () => {
      const result = ZLineaPedido.parse({
        pedido_id: 'p-1',
        numero_linea: 1,
        descripcion: 'Caja de libros',
        peso_kg: '5.5',
        cantidad: 1,
        valor_unitario: '100.50',
      });
      expect(result.numero_linea).toBe(1);
      expect(result.peso_kg).toEqual(new Decimal('5.5'));
    });

    it('should parse with null valor_unitario', () => {
      const result = ZLineaPedido.parse({
        pedido_id: 'p-1',
        numero_linea: 2,
        descripcion: 'Documentos',
        peso_kg: '0.5',
        cantidad: 10,
        valor_unitario: null,
      });
      expect(result.valor_unitario).toBeNull();
    });

    it('should reject negative peso_kg', () => {
      expect(() => {
        ZLineaPedido.parse({
          pedido_id: 'p-1',
          numero_linea: 1,
          descripcion: 'Test',
          peso_kg: '-1',
          cantidad: 1,
          valor_unitario: '100',
        });
      }).toThrow();
    });

    it('should reject non-positive cantidad', () => {
      expect(() => {
        ZLineaPedido.parse({
          pedido_id: 'p-1',
          numero_linea: 1,
          descripcion: 'Test',
          peso_kg: '5',
          cantidad: 0,
          valor_unitario: '100',
        });
      }).toThrow();
    });
  });

  describe('ZPedido', () => {
    it('should parse a valid pedido', () => {
      const result = ZPedido.parse({
        id: 'ped-1',
        numero_expediente: 'EXP-2026-001',
        cliente_id: 'cli-1',
        fecha_creacion: '2026-10-01T10:00:00Z',
        codigo_postal_destino: '1425',
        peso_total_kg: '25.5',
        volumen_m3: null,
        valor_declarado: '1000',
        requiere_redespacho: false,
        estado: 'PENDIENTE',
        expreso_seleccionado_id: null,
        precio_final_cotizado: null,
      });
      expect(result.id).toBe('ped-1');
      expect(result.origen).toBe('Buenos Aires'); // default
      expect(result.origen_estricto).toBe(true); // default
    });

    it('should apply default origen if not provided', () => {
      const result = ZPedido.parse({
        id: 'ped-2',
        numero_expediente: 'EXP-2026-002',
        cliente_id: 'cli-2',
        fecha_creacion: new Date(),
        codigo_postal_destino: '2000',
        peso_total_kg: '10',
        estado: 'COTIZADO',
      });
      expect(result.origen).toBe('Buenos Aires');
    });

    it('should parse with requiere_redespacho true', () => {
      const result = ZPedido.parse({
        id: 'ped-3',
        numero_expediente: 'EXP-2026-003',
        cliente_id: 'cli-3',
        fecha_creacion: new Date(),
        codigo_postal_destino: '5000',
        peso_total_kg: '50',
        requiere_redespacho: true,
        estado: 'REDESPACHO_PENDIENTE',
      });
      expect(result.requiere_redespacho).toBe(true);
    });

    it('should reject non-positive peso_total_kg', () => {
      expect(() => {
        ZPedido.parse({
          id: 'ped-4',
          numero_expediente: 'EXP-2026-004',
          cliente_id: 'cli-4',
          fecha_creacion: new Date(),
          codigo_postal_destino: '1425',
          peso_total_kg: '0',
          estado: 'PENDIENTE',
        });
      }).toThrow();
    });

    it('should reject negative precio_final_cotizado', () => {
      expect(() => {
        ZPedido.parse({
          id: 'ped-5',
          numero_expediente: 'EXP-2026-005',
          cliente_id: 'cli-5',
          fecha_creacion: new Date(),
          codigo_postal_destino: '1425',
          peso_total_kg: '15',
          estado: 'COTIZADO',
          precio_final_cotizado: '-100',
        });
      }).toThrow();
    });

    it('should parse with metadata', () => {
      const result = ZPedido.parse({
        id: 'ped-6',
        numero_expediente: 'EXP-2026-006',
        cliente_id: 'cli-6',
        fecha_creacion: new Date(),
        codigo_postal_destino: '1425',
        peso_total_kg: '20',
        estado: 'PENDIENTE',
        metadata: { tracking: 'xyz123', notes: 'Frágil' },
      });
      expect(result.metadata).toEqual({ tracking: 'xyz123', notes: 'Frágil' });
    });
  });
});
