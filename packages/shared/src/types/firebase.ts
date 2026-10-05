import type { z } from 'zod';
import {
  accessRequestSchema,
  auditEntrySchema,
  branchSchema,
  cpRequestSchema,
  cuitIndexSchema,
  emailTemplateSchema,
  importBatchSchema,
  orderDocumentSchema,
  outboundEmailSchema,
  paramsSchema,
  postalRouterEntrySchema,
  proformaSchema,
  purchaseOrderReportSchema,
  settlementReportSchema,
  supplierResponseSchema,
  supplierSchema,
  tariffRuleSchema,
  tariffSchema,
  userSchema,
} from '../schemas/index.js';

// Las 19 colecciones de Firestore de la Fase 1 (§2.1), con su nombre literal.
export const COLLECTION_NAMES = [
  'usuarios',
  'solicitudes_acceso',
  'sucursales',
  'canalizador_cp',
  'solicitudes_cp',
  'proveedores',
  'indice_cuit',
  'tarifarios',
  'reglas_tarifa',
  'lotes_importacion',
  'pedidos',
  'plantillas_email',
  'proformas',
  'emails_salida',
  'respuestas_proveedor',
  'reportes_liquidacion',
  'reportes_oc',
  'auditoria',
  'parametros',
] as const;
export type CollectionName = (typeof COLLECTION_NAMES)[number];

// Esquema del cuerpo del documento de cada colección. El id del documento no forma parte del cuerpo.
export const collectionSchemas = {
  usuarios: userSchema,
  solicitudes_acceso: accessRequestSchema,
  sucursales: branchSchema,
  canalizador_cp: postalRouterEntrySchema,
  solicitudes_cp: cpRequestSchema,
  proveedores: supplierSchema,
  indice_cuit: cuitIndexSchema,
  tarifarios: tariffSchema,
  reglas_tarifa: tariffRuleSchema,
  lotes_importacion: importBatchSchema,
  pedidos: orderDocumentSchema,
  plantillas_email: emailTemplateSchema,
  proformas: proformaSchema,
  emails_salida: outboundEmailSchema,
  respuestas_proveedor: supplierResponseSchema,
  reportes_liquidacion: settlementReportSchema,
  reportes_oc: purchaseOrderReportSchema,
  auditoria: auditEntrySchema,
  parametros: paramsSchema,
} satisfies Record<CollectionName, z.ZodTypeAny>;

export type CollectionDocument<Name extends CollectionName> = z.infer<
  (typeof collectionSchemas)[Name]
>;
