import { describe, expect, it } from 'vitest';
import {
  BUSINESS_ERROR_CODES,
  DISCARD_REASONS,
  DomainError,
  OBSERVATION_CODES,
  ROW_ERROR_CODES,
  TARIFF_WARNING_CODES,
  businessErrorCodeSchema,
} from './errors.js';

describe('catálogos de códigos', () => {
  it('errores de negocio (§3.8)', () => {
    expect([...BUSINESS_ERROR_CODES]).toEqual([
      'DUPLICADO',
      'TRANSICION_INVALIDA',
      'PEDIDO_NO_EXPORTABLE',
      'MISMO_USUARIO',
      'TARIFARIO_INVALIDO',
      'PROVEEDOR_NO_ENCONTRADO',
    ]);
  });

  it('errores de fila (§3.2)', () => {
    expect([...ROW_ERROR_CODES]).toEqual([
      'CAMPO_OBLIGATORIO',
      'FORMATO_INVALIDO',
      'PESO_INVALIDO',
      'VOLUMEN_INVALIDO',
      'CABECERA_NO_PERMITIDA',
      'DUPLICADO',
    ]);
  });

  it('observaciones (§3.2)', () => {
    expect([...OBSERVATION_CODES]).toEqual([
      'VOLUMEN_INCONSISTENTE',
      'AFORADO_MENOR_A_PESO',
      'AFORADO_CERO',
      'VALOR_DECLARADO_FALTANTE',
      'DESTINO_DIFIERE_TMS',
      'CP_NO_EN_CANALIZADOR',
      'CP_AMBIGUO',
      'PROVINCIA_DIFIERE',
    ]);
  });

  it('motivos de descarte del motor (§3.3)', () => {
    expect([...DISCARD_REASONS]).toEqual([
      'PESO_EXCEDIDO_SIN_REGLA',
      'VOLUMEN_EXCEDIDO_SIN_REGLA',
      'SIN_TARIFA',
    ]);
  });

  it('advertencias de tarifario (§2.3)', () => {
    expect([...TARIFF_WARNING_CODES]).toEqual(['TARIFARIO_SOSPECHOSO', 'CP_NO_EN_CANALIZADOR']);
  });

  it('DUPLICADO y CP_NO_EN_CANALIZADOR son el mismo literal en los grupos que los comparten', () => {
    expect(BUSINESS_ERROR_CODES).toContain('DUPLICADO');
    expect(ROW_ERROR_CODES).toContain('DUPLICADO');
    expect(OBSERVATION_CODES).toContain('CP_NO_EN_CANALIZADOR');
    expect(TARIFF_WARNING_CODES).toContain('CP_NO_EN_CANALIZADOR');
  });
});

describe('DomainError', () => {
  it('conserva el code tipado, el mensaje y el detalle', () => {
    const error = new DomainError('MISMO_USUARIO', 'No podés responder tu propia proforma', {
      proforma_id: 'p1',
    });
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
    expect(error.name).toBe('DomainError');
    expect(error.code).toBe('MISMO_USUARIO');
    expect(error.message).toBe('No podés responder tu propia proforma');
    expect(error.details).toEqual({ proforma_id: 'p1' });
  });

  it('el detalle es opcional', () => {
    expect(new DomainError('DUPLICADO', 'x').details).toBeUndefined();
  });

  it('el code es siempre uno de los códigos de negocio', () => {
    expect(businessErrorCodeSchema.safeParse(new DomainError('DUPLICADO', 'x').code).success).toBe(
      true,
    );
    expect(businessErrorCodeSchema.safeParse('SIN_TARIFA').success).toBe(false);
  });
});
