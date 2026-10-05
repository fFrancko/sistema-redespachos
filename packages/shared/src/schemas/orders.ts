import { z } from 'zod';
import {
  coberturaQxSchema,
  criterionSchema,
  orderStatusSchema,
  quoteOriginSchema,
  responseSchema,
} from '../enums.js';
import { discardReasonSchema, observationCodeSchema, rowErrorCodeSchema } from '../errors.js';
import {
  centsSchema,
  cpSchema,
  dateSchema,
  decSchema,
  percentSchema,
  positiveDecSchema,
  refSchema,
  timestampSchema,
} from '../primitives.js';
import { norm, normProvincia } from '../normalize.js';

// Columnas de la plantilla de importación que usa el sistema (§2.4). Es lo que produce el parser del TMS.
// Las demás columnas de las 47 van tal cual al mapa `origen_tms`, con su nombre snake_case.
export const orderImportSchema = z.object({
  nro_pedido: z.string().min(1),
  peso_kgs: positiveDecSchema,
  volumen_m3: positiveDecSchema,
  peso_aforado: decSchema, // 0 es observación, no error
  cantidad_bultos: z.number().int().positive(),
  valor_declarado: centsSchema.optional(),
  fecha_interfaz: dateSchema,
  zona_origen: z.string().min(1),
  cabecera_origen: z.string().min(1),
  codigo_postal_origen: cpSchema,
  codigo_postal: cpSchema,
  localidad: z.string().min(1),
  provincia: z.string().min(1),
  zona_destino_importada: z.string().optional(),
  cabecera_destino_importada: z.string().optional(),
  expreso_manual: z.string().optional(),
  destinatario: z.string().optional(),
  direccion: z.string().optional(),
  numero: z.string().optional(),
  alto_cm: decSchema.optional(),
  ancho_cm: decSchema.optional(),
  largo_cm: decSchema.optional(),
  origen_tms: z.record(z.string(), z.string()),
});
export type OrderImport = z.infer<typeof orderImportSchema>;

const variantInfoSchema = z.object({
  localidad: z.string(),
  zona: z.string(),
  plazo_estimado_dias: z.number().int().nonnegative().nullable(),
});

// `canalizador` del pedido. `cobertura_qx` es DESCONOCIDA cuando el CP no está en el canalizador;
// en ese caso zona, cabecera, subzona y zona_tarifario no existen (nulos).
export const orderPostalRouterSchema = z.object({
  zona: z.string().nullable(),
  cabecera: z.string().nullable(),
  subzona: z.string().nullable(),
  zona_tarifario: z.string().nullable(),
  cobertura_qx: coberturaQxSchema,
});

// `cotizacion` es una foto: guarda los valores con los que se calculó. Montos en cents.
export const quoteSchema = z
  .object({
    id_proveedor: refSchema,
    tarifario_id: refSchema.nullable(),
    variante_id: z.string().min(1).nullable(),
    variante: variantInfoSchema.nullable(),
    regla_peso_id: refSchema.nullable(),
    regla_volumen_id: refSchema.nullable(),
    criterio: criterionSchema,
    detalle_tarifa: z.string(),
    costo_peso: centsSchema,
    costo_volumen: centsSchema,
    flete: centsSchema,
    colecta: centsSchema,
    seguro: centsSchema,
    neto: centsSchema,
    iva_porcentaje: percentSchema,
    iva: centsSchema,
    total: centsSchema,
    origen: quoteOriginSchema,
    justificacion: z.string().min(1).optional(),
    fecha_referencia: dateSchema,
    motor_version: z.string().min(1),
    calculado_en: timestampSchema,
  })
  .superRefine((quote, ctx) => {
    if (quote.origen === 'MANUAL' && quote.justificacion === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['justificacion'],
        message: 'La cotización manual exige justificacion',
      });
    }
    if (quote.origen === 'MOTOR') {
      for (const field of ['tarifario_id', 'variante_id', 'variante'] as const) {
        if (quote[field] === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `${field} es obligatorio en una cotización del motor`,
          });
        }
      }
    }
  });
export type Quote = z.infer<typeof quoteSchema>;

export const quoteAlternativeSchema = z.object({
  id_proveedor: refSchema,
  variante_id: z.string().min(1),
  variante: variantInfoSchema,
  criterio: criterionSchema,
  neto: centsSchema,
  total: centsSchema,
});
export type QuoteAlternative = z.infer<typeof quoteAlternativeSchema>;

export const quoteDiscardSchema = z.object({
  id_proveedor: refSchema,
  variante_id: z.string().min(1).optional(),
  motivo: discardReasonSchema,
});
export type QuoteDiscard = z.infer<typeof quoteDiscardSchema>;

// `fecha_aceptacion` no va acá: vive en la raíz del pedido (D31).
export const orderConfirmationSchema = z.object({
  respuesta: responseSchema,
  respuesta_id: refSchema,
});
export type OrderConfirmation = z.infer<typeof orderConfirmationSchema>;

export const orderRowErrorSchema = z.object({
  campo: z.string().min(1),
  codigo: rowErrorCodeSchema,
  mensaje: z.string(),
});
export type OrderRowError = z.infer<typeof orderRowErrorSchema>;

const orderContextShape = {
  sucursal_id: z.string().min(1),
  lote_id: refSchema,
  importado_por: refSchema,
  importado_en: timestampSchema,
  observaciones: z.array(observationCodeSchema),
};

// Colección `pedidos` (§2.4), pedidos que pasaron la validación de fila (VALIDADO en adelante).
// Id del documento: `{sucursal_id}_{nro_pedido}`.
export const orderSchema = orderImportSchema
  .extend({
    ...orderContextShape,
    cp_destino_norm: cpSchema,
    provincia_destino_norm: z.string().min(1),
    localidad_destino_norm: z.string().min(1),
    provincia_origen: z.string().min(1).optional(),
    localidad_origen: z.string().min(1).optional(),
    canalizador: orderPostalRouterSchema.optional(),
    estado: orderStatusSchema.exclude(['CON_ERROR']),
    errores: z.array(orderRowErrorSchema).length(0),
    cotizacion: quoteSchema.optional(),
    alternativas: z.array(quoteAlternativeSchema).max(20).optional(),
    descartes: z.array(quoteDiscardSchema).optional(),
    proforma_id: refSchema.optional(),
    // D31: en la raíz, para que el índice `pedidos(estado, fecha_aceptacion)` y los filtros de
    // §3.5 y §7.8 operen sobre un campo propio del pedido.
    fecha_aceptacion: dateSchema.optional(),
    confirmacion: orderConfirmationSchema.optional(),
    reporte_liquidacion_id: refSchema.optional(),
    reporte_oc_id: refSchema.optional(),
  })
  .superRefine((order, ctx) => {
    if (order.confirmacion !== undefined && order.fecha_aceptacion === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fecha_aceptacion'],
        message: 'fecha_aceptacion es obligatoria si hay confirmacion',
      });
    }

    if (order.cp_destino_norm !== order.codigo_postal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cp_destino_norm'],
        message: `cp_destino_norm debe ser "${order.codigo_postal}" (el código postal del destino del TMS)`,
      });
    }

    const expectedProvinciaNorm = normProvincia(order.provincia, { contraCanalizador: true });
    if (order.provincia_destino_norm !== expectedProvinciaNorm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['provincia_destino_norm'],
        message: `provincia_destino_norm debe ser normProvincia(provincia, {contraCanalizador:true}): "${expectedProvinciaNorm}"`,
      });
    }

    if (order.localidad_destino_norm !== norm(order.localidad)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['localidad_destino_norm'],
        message: `localidad_destino_norm debe ser norm(localidad): "${norm(order.localidad)}"`,
      });
    }
  });
export type Order = z.infer<typeof orderSchema>;

// Pedido cuya fila falló la validación: `estado = CON_ERROR`, o `CANCELADO` si se canceló desde
// `CON_ERROR` (§3.7) conservando la traza de `errores`. Los datos de importación pueden faltar.
// Conserva `nro_pedido` y las columnas del TMS en `origen_tms`. Un `CANCELADO` sin errores
// (por ejemplo, desde VALIDADO) valida por `orderSchema`.
export const invalidOrderSchema = orderImportSchema
  .partial()
  .required({ nro_pedido: true, origen_tms: true })
  .extend({
    ...orderContextShape,
    estado: z.enum(['CON_ERROR', 'CANCELADO']),
    errores: z.array(orderRowErrorSchema).min(1),
  });
export type InvalidOrder = z.infer<typeof invalidOrderSchema>;

// Esquema de la colección `pedidos` completa.
export const orderDocumentSchema = z.union([orderSchema, invalidOrderSchema]);
export type OrderDocument = z.infer<typeof orderDocumentSchema>;
