// Fixtures sintéticos del motor (AGENTS.md regla 8): todo pasa por los esquemas de `shared`.
import {
  postalRouterEntrySchema,
  supplierSchema,
  tariffRuleSchema,
  tariffSchema,
  variantId,
} from '@sistema-redespachos/shared';
import type { PostalRouterEntry, Supplier, TariffRule } from '@sistema-redespachos/shared';
import type { MotorContext, MotorQuoteInput } from '../../src/types.js';

const CONTROL = {
  creado_por: 'U1',
  creado_en: '2026-10-01T00:00:00.000Z',
  actualizado_por: 'U1',
  actualizado_en: '2026-10-01T00:00:00.000Z',
};

export const CP_ORIGEN = '1000';
export const CP_DESTINO = '2000';
export const FECHA_REFERENCIA = '2026-10-06';
// CUIT sintético por construcción (docs/ola-0/estado-y-decisiones.md, supuesto 3).
const CUIT_SINTETICO = '20001555554';

export function canalizadorEntry(
  cp: string,
  localidad: string,
  provincia: string,
  subzona = 'SIN COBERTURA',
): PostalRouterEntry {
  return postalRouterEntrySchema.parse({
    cp,
    localidad,
    provincia,
    partido: 'PARTIDO',
    zona: 'ZONA',
    cabecera: 'CABECERA',
    subzona,
    zona_tarifario: 'ZT',
    cobertura_qx: subzona !== 'SIN COBERTURA',
    version: 1,
  });
}

export function proveedor(id_proveedor: string, overrides: Record<string, unknown> = {}): Supplier {
  return supplierSchema.parse({
    id_proveedor,
    razon_social: `Proveedor ${id_proveedor}`,
    cuit: CUIT_SINTETICO,
    email_contacto: ['proveedor@example.com'],
    telefono: '0000',
    estado: 'ACTIVO',
    condicion_pago: '30',
    iva_porcentaje: '0',
    aplica_seguro: false,
    ...CONTROL,
    ...overrides,
  });
}

export type ReglaOpts = {
  id: string;
  tipo: 'PESO' | 'VOLUMEN';
  min: string;
  max: string;
  precio: string;
  proveedor?: string;
  localidad?: string;
  zona?: string;
  plazo?: number;
  base?: string;
  excedente?: string;
  colecta?: string;
};

export function regla(o: ReglaOpts): { id: string } & TariffRule {
  const idProveedor = o.proveedor ?? 'PROV1';
  const localidad = o.localidad ?? 'ROSARIO';
  const zona = o.zona ?? 'Z1';
  const esPeso = o.tipo === 'PESO';
  const data = tariffRuleSchema.parse({
    tarifario_id: `TAR_${idProveedor}`,
    id_proveedor: idProveedor,
    tipo_regla: o.tipo,
    provincia_origen: '*',
    provincia_destino: 'SANTA FE',
    localidad_destino: localidad,
    codigo_postal_destino: CP_DESTINO,
    zona_destino: zona,
    ...(o.plazo === undefined ? {} : { plazo_estimado_dias: o.plazo }),
    variante_id: variantId(CP_DESTINO, localidad, zona),
    kg_min: esPeso ? o.min : null,
    kg_max: esPeso ? o.max : null,
    m3_min: esPeso ? null : o.min,
    m3_max: esPeso ? null : o.max,
    precio_tramo: o.precio,
    costo_base_viaje: o.base ?? '0',
    ...(o.excedente === undefined
      ? {}
      : { [esPeso ? 'precio_kg_excedente' : 'precio_m3_excedente']: o.excedente }),
    aplica_colecta: o.colecta !== undefined,
    ...(o.colecta === undefined ? {} : { costo_colecta: o.colecta }),
    vigencia_desde: '2026-01-01',
    vigencia_hasta: null,
    estado: 'VIGENTE',
    ...CONTROL,
  });
  return { id: o.id, ...data };
}

export function pedido(overrides: Partial<MotorQuoteInput> = {}): MotorQuoteInput {
  return {
    cp_destino_norm: CP_DESTINO,
    localidad_destino_norm: 'ROSARIO',
    provincia_destino_norm: 'SANTA FE',
    codigo_postal_origen: CP_ORIGEN,
    peso_kgs: '30',
    volumen_m3: '0.2',
    ...overrides,
  };
}

export function contexto(o: {
  proveedores: Supplier[];
  reglas: Array<{ id: string } & TariffRule>;
  subzonaDestino?: string;
  canalizador?: PostalRouterEntry[];
}): MotorContext {
  return {
    canalizador: o.canalizador ?? [
      canalizadorEntry(CP_ORIGEN, 'ORIGEN', 'BUENOS AIRES'),
      canalizadorEntry(CP_DESTINO, 'ROSARIO', 'SANTA FE', o.subzonaDestino),
    ],
    proveedores: o.proveedores,
    tarifarios: o.proveedores.map((p) => ({
      id: `TAR_${p.id_proveedor}`,
      ...tariffSchema.parse({
        id_proveedor: p.id_proveedor,
        version: 1,
        vigencia_desde: '2026-01-01',
        vigencia_hasta: null,
        estado: 'VIGENTE',
        creado_por: 'U1',
        creado_en: '2026-10-01T00:00:00.000Z',
      }),
    })),
    reglas: o.reglas,
    fecha_referencia: FECHA_REFERENCIA,
    origen_estricto: true,
  };
}

// Caso de referencia 1 de §3.3: IVA 21 %, seguro 0,5 %, 30 kg, 0,2 m3, valor declarado $100.000.
export function casoReferencia1() {
  return {
    pedido: pedido({ peso_kgs: '30', volumen_m3: '0.2', valor_declarado: 10000000 }),
    contexto: contexto({
      proveedores: [
        proveedor('PROV1', { iva_porcentaje: '21', aplica_seguro: true, porcentaje_seguro: '0.5' }),
      ],
      reglas: [
        regla({ id: 'P1', tipo: 'PESO', min: '0', max: '10', precio: '900' }),
        regla({ id: 'P2', tipo: 'PESO', min: '10', max: '50', precio: '1600' }),
        regla({ id: 'V1', tipo: 'VOLUMEN', min: '0', max: '0.05', precio: '1000' }),
        regla({
          id: 'V2',
          tipo: 'VOLUMEN',
          min: '0.05',
          max: '0.5',
          precio: '2600',
          colecta: '320.83',
        }),
      ],
    }),
  };
}

// Caso de referencia 2 de §3.3 (excedente): sin seguro, IVA ni colecta; 1.050 kg y 0,1 m3.
export function casoReferencia2() {
  return {
    pedido: pedido({ peso_kgs: '1050', volumen_m3: '0.1' }),
    contexto: contexto({
      proveedores: [proveedor('PROV1')],
      reglas: [
        regla({ id: 'P1', tipo: 'PESO', min: '0', max: '900', precio: '400000' }),
        regla({
          id: 'P2',
          tipo: 'PESO',
          min: '900',
          max: '1000',
          precio: '500000',
          excedente: '600',
        }),
        regla({ id: 'V1', tipo: 'VOLUMEN', min: '0', max: '0.2', precio: '20000' }),
      ],
    }),
  };
}
