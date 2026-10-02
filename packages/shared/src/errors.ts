import { z } from 'zod';

// Códigos compartidos entre grupos: se declaran una sola vez.
const DUPLICADO = 'DUPLICADO' as const;
const CP_NO_EN_CANALIZADOR = 'CP_NO_EN_CANALIZADOR' as const;

// §3.8: errores de negocio que las callables devuelven como HttpsError.
export const BUSINESS_ERROR_CODES = [
  DUPLICADO,
  'TRANSICION_INVALIDA',
  'PEDIDO_NO_EXPORTABLE',
  'MISMO_USUARIO',
  'TARIFARIO_INVALIDO',
  'PROVEEDOR_NO_ENCONTRADO',
] as const;
export type BusinessErrorCode = (typeof BUSINESS_ERROR_CODES)[number];
export const businessErrorCodeSchema = z.enum(BUSINESS_ERROR_CODES);

// §3.2: errores de fila (bloquean).
export const ROW_ERROR_CODES = [
  'CAMPO_OBLIGATORIO',
  'FORMATO_INVALIDO',
  'PESO_INVALIDO',
  'VOLUMEN_INVALIDO',
  'CABECERA_NO_PERMITIDA',
  DUPLICADO,
] as const;
export type RowErrorCode = (typeof ROW_ERROR_CODES)[number];
export const rowErrorCodeSchema = z.enum(ROW_ERROR_CODES);

// §3.2: observaciones (no bloquean).
export const OBSERVATION_CODES = [
  'VOLUMEN_INCONSISTENTE',
  'AFORADO_MENOR_A_PESO',
  'AFORADO_CERO',
  'VALOR_DECLARADO_FALTANTE',
  'DESTINO_DIFIERE_TMS',
  CP_NO_EN_CANALIZADOR,
  'CP_AMBIGUO',
  'PROVINCIA_DIFIERE',
] as const;
export type ObservationCode = (typeof OBSERVATION_CODES)[number];
export const observationCodeSchema = z.enum(OBSERVATION_CODES);

// §3.3: motivos de descarte de una candidata del motor.
export const DISCARD_REASONS = [
  'PESO_EXCEDIDO_SIN_REGLA',
  'VOLUMEN_EXCEDIDO_SIN_REGLA',
  'SIN_TARIFA',
] as const;
export type DiscardReason = (typeof DISCARD_REASONS)[number];
export const discardReasonSchema = z.enum(DISCARD_REASONS);

// §2.3: advertencias al publicar un tarifario (no bloquean).
export const TARIFF_WARNING_CODES = ['TARIFARIO_SOSPECHOSO', CP_NO_EN_CANALIZADOR] as const;
export type TariffWarningCode = (typeof TARIFF_WARNING_CODES)[number];
export const tariffWarningCodeSchema = z.enum(TARIFF_WARNING_CODES);

// Error de dominio: functions lo traduce a HttpsError conservando el `code`.
export class DomainError extends Error {
  readonly code: BusinessErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: BusinessErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
