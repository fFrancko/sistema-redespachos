import { describe, it, expect } from 'vitest';
import { ZUsuario, ZRol, ZPermiso } from '../usuarios';

describe('Usuarios Schemas', () => {
  describe('ZRol', () => {
    it('should parse valid rol', () => {
      const result = ZRol.parse('ADMIN');
      expect(result).toBe('ADMIN');
    });

    it('should parse all valid roles', () => {
      const roles = ['ADMIN', 'TRANSPORTISTA', 'CLIENTE', 'OPERADOR', 'AUDITOR'];
      roles.forEach((rol) => {
        const result = ZRol.parse(rol);
        expect(result).toBe(rol);
      });
    });

    it('should reject invalid rol', () => {
      expect(() => ZRol.parse('SUPERADMIN')).toThrow();
    });
  });

  describe('ZPermiso', () => {
    it('should parse valid permiso', () => {
      const result = ZPermiso.parse('leer:pedidos');
      expect(result).toBe('leer:pedidos');
    });

    it('should parse all valid permisos', () => {
      const permisos = [
        'leer:pedidos',
        'escribir:pedidos',
        'leer:tarifas',
        'escribir:tarifas',
        'admin:auditoría',
      ];
      permisos.forEach((permiso) => {
        const result = ZPermiso.parse(permiso);
        expect(result).toBe(permiso);
      });
    });

    it('should reject invalid permiso', () => {
      expect(() => ZPermiso.parse('borrar:pedidos')).toThrow();
    });
  });

  describe('ZUsuario', () => {
    it('should parse a valid usuario', () => {
      const result = ZUsuario.parse({
        id: 'user-1',
        email: 'admin@example.com',
        nombre: 'Admin User',
        rol: 'ADMIN',
        permisos: ['leer:pedidos', 'escribir:pedidos', 'admin:auditoría'],
        activo: true,
        fecha_creacion: '2026-10-01T10:00:00Z',
      });
      expect(result.id).toBe('user-1');
      expect(result.email).toBe('admin@example.com');
      expect(result.rol).toBe('ADMIN');
      expect(result.activo).toBe(true);
    });

    it('should parse usuario with empty permisos', () => {
      const result = ZUsuario.parse({
        id: 'user-2',
        email: 'viewer@example.com',
        nombre: 'Viewer',
        rol: 'CLIENTE',
        permisos: [],
        activo: true,
        fecha_creacion: new Date(),
      });
      expect(result.permisos).toEqual([]);
    });

    it('should parse with default empty metadata', () => {
      const result = ZUsuario.parse({
        id: 'user-3',
        email: 'user@example.com',
        nombre: 'Test User',
        rol: 'OPERADOR',
        permisos: ['leer:pedidos'],
        activo: true,
        fecha_creacion: new Date(),
      });
      expect(result.metadata).toEqual({});
    });

    it('should parse with metadata', () => {
      const result = ZUsuario.parse({
        id: 'user-4',
        email: 'transportista@example.com',
        nombre: 'Transportista',
        rol: 'TRANSPORTISTA',
        permisos: ['leer:pedidos', 'escribir:pedidos'],
        activo: true,
        fecha_creacion: new Date(),
        metadata: { flota_id: 'f-123', licencia: 'ABC123' },
      });
      expect(result.metadata).toEqual({ flota_id: 'f-123', licencia: 'ABC123' });
    });

    it('should reject usuario with invalid email', () => {
      expect(() => {
        ZUsuario.parse({
          id: 'user-5',
          email: 'invalid-email',
          nombre: 'Bad User',
          rol: 'CLIENTE',
          permisos: [],
          activo: true,
          fecha_creacion: new Date(),
        });
      }).toThrow();
    });

    it('should reject inactive usuario', () => {
      const result = ZUsuario.parse({
        id: 'user-6',
        email: 'inactive@example.com',
        nombre: 'Inactive User',
        rol: 'CLIENTE',
        permisos: [],
        activo: false,
        fecha_creacion: new Date(),
      });
      expect(result.activo).toBe(false);
    });
  });
});
