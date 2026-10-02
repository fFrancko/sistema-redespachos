import { z } from 'zod';

// Enums de §2 y §3.7, tal cual figuran en la arquitectura v3.

export const ORDER_STATUSES = [
  'CON_ERROR',
  'VALIDADO',
  'SIN_COBERTURA',
  'COBERTURA_QX',
  'VALORIZADO',
  'ERROR_COMUNICACION',
  'PENDIENTE_CONFIRMACION',
  'EN_DISPUTA',
  'ACEPTADO_PROVEEDOR',
  'LISTO_PARA_OC',
  'LIQUIDADO',
  'CANCELADO',
] as const;
export const orderStatusSchema = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const TARIFF_STATUSES = ['BORRADOR', 'VIGENTE', 'HISTORICO'] as const;
export const tariffStatusSchema = z.enum(TARIFF_STATUSES);
export type TariffStatus = z.infer<typeof tariffStatusSchema>;

export const SUPPLIER_STATUSES = ['ACTIVO', 'INACTIVO'] as const;
export const supplierStatusSchema = z.enum(SUPPLIER_STATUSES);
export type SupplierStatus = z.infer<typeof supplierStatusSchema>;

// Supuesto (ver PREGUNTAS): el estado de usuarios y de solicitudes de acceso no tiene valores en §2.
export const USER_STATUSES = ['ACTIVO', 'INACTIVO'] as const;
export const userStatusSchema = z.enum(USER_STATUSES);
export type UserStatus = z.infer<typeof userStatusSchema>;

export const ACCESS_REQUEST_STATUSES = ['PENDIENTE', 'RESUELTA'] as const;
export const accessRequestStatusSchema = z.enum(ACCESS_REQUEST_STATUSES);
export type AccessRequestStatus = z.infer<typeof accessRequestStatusSchema>;

export const BATCH_STATUSES = ['PROCESANDO', 'LISTO', 'CERRADO'] as const;
export const batchStatusSchema = z.enum(BATCH_STATUSES);
export type BatchStatus = z.infer<typeof batchStatusSchema>;

export const CP_REQUEST_STATUSES = ['PENDIENTE', 'RESUELTA'] as const;
export const cpRequestStatusSchema = z.enum(CP_REQUEST_STATUSES);
export type CpRequestStatus = z.infer<typeof cpRequestStatusSchema>;

export const CP_REQUEST_ORIGINS = ['PEDIDO', 'TARIFARIO'] as const;
export const cpRequestOriginSchema = z.enum(CP_REQUEST_ORIGINS);
export type CpRequestOrigin = z.infer<typeof cpRequestOriginSchema>;

export const PROFORMA_STATUSES = [
  'ENVIADA',
  'ERROR_COMUNICACION',
  'RESPONDIDA_PARCIAL',
  'RESPONDIDA',
] as const;
export const proformaStatusSchema = z.enum(PROFORMA_STATUSES);
export type ProformaStatus = z.infer<typeof proformaStatusSchema>;

export const EMAIL_STATUSES = ['PENDIENTE', 'ENVIADO', 'ERROR'] as const;
export const emailStatusSchema = z.enum(EMAIL_STATUSES);
export type EmailStatus = z.infer<typeof emailStatusSchema>;

export const REPORT_STATUSES = ['PROCESANDO', 'LISTO'] as const;
export const reportStatusSchema = z.enum(REPORT_STATUSES);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const RULE_TYPES = ['PESO', 'VOLUMEN'] as const;
export const ruleTypeSchema = z.enum(RULE_TYPES);
export type RuleType = z.infer<typeof ruleTypeSchema>;

export const CRITERIA = ['PESO', 'VOLUMEN'] as const;
export const criterionSchema = z.enum(CRITERIA);
export type Criterion = z.infer<typeof criterionSchema>;

export const QUOTE_ORIGINS = ['MOTOR', 'MANUAL'] as const;
export const quoteOriginSchema = z.enum(QUOTE_ORIGINS);
export type QuoteOrigin = z.infer<typeof quoteOriginSchema>;

export const COBERTURA_QX_VALUES = ['SI', 'NO', 'DESCONOCIDA'] as const;
export const coberturaQxSchema = z.enum(COBERTURA_QX_VALUES);
export type CoberturaQx = z.infer<typeof coberturaQxSchema>;

// Único enum ACEPTA | RECHAZA: lo comparten respuestas_proveedor.pedidos[].resultado
// y pedidos.confirmacion.respuesta.
export const RESPONSES = ['ACEPTA', 'RECHAZA'] as const;
export const responseSchema = z.enum(RESPONSES);
export type ProviderResponse = z.infer<typeof responseSchema>;

export const ATTACHMENT_FORMATS = ['XLSX', 'CSV'] as const;
export const attachmentFormatSchema = z.enum(ATTACHMENT_FORMATS);
export type AttachmentFormat = z.infer<typeof attachmentFormatSchema>;

// Catálogo de columnas del adjunto de la proforma (§2.5, plantillas_email).
export const ATTACHMENT_COLUMNS = [
  'nro_pedido',
  'fecha_interfaz',
  'cabecera_origen',
  'localidad',
  'provincia',
  'codigo_postal',
  'peso_kgs',
  'volumen_m3',
  'cantidad_bultos',
  'criterio',
  'detalle_tarifa',
  'neto',
  'iva',
  'total',
] as const;
export const attachmentColumnSchema = z.enum(ATTACHMENT_COLUMNS);
export type AttachmentColumn = z.infer<typeof attachmentColumnSchema>;
