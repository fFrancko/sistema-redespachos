// MVP-15: alta del set inicial de casos dorados sintéticos (AGENTS.md regla 8).
//   pnpm --filter @sistema-redespachos/motor build && node packages/motor/scripts/golden-generar.js
// Solo da de alta casos nuevos: si el archivo ya existe, lo saltea. Nunca reescribe un caso; eso
// es de golden:update. Antes de escribir, compara la salida del motor con los valores calculados a
// mano de cada caso (`aMano`); si alguno no coincide, no escribe nada.
// Todo es inventado: CPs 99xx, localidades, proveedores, precios y el CUIT sintético 20001555554.
import { existsSync, mkdirSync } from 'node:fs';
import {
  postalRouterEntrySchema,
  supplierSchema,
  tariffRuleSchema,
  tariffSchema,
  variantId,
} from '@sistema-redespachos/shared';
import {
  CASOS,
  CHANGELOG,
  GoldenError,
  ID_CASO,
  canonical,
  cargarMotor,
  comoJson,
  ejecutar,
  escribirCaso,
  formatear,
  registrarEnChangelog,
  rutaCaso,
} from './golden-lib.js';

const MOTIVO_ALTA = 'alta: set inicial sintético (MVP-15)';

const CONTROL = {
  creado_por: 'U_SINTETICO',
  creado_en: '2026-01-01T00:00:00.000Z',
  actualizado_por: 'U_SINTETICO',
  actualizado_en: '2026-01-01T00:00:00.000Z',
};
const CUIT_SINTETICO = '20001555554';
const FECHA = '2026-10-06';

const ORIGEN = { cp: '9900', localidad: 'VILLA ORIGEN', provincia: 'BUENOS AIRES' };
const DESTINO = { cp: '9901', localidad: 'PUEBLO DESTINO', provincia: 'SANTA FE' };

function canal(cp, localidad, provincia, subzona = 'SIN COBERTURA') {
  return postalRouterEntrySchema.parse({
    cp,
    localidad,
    provincia,
    partido: 'PARTIDO SINTETICO',
    zona: 'ZONA SINTETICA',
    cabecera: 'CABECERA SINTETICA',
    subzona,
    zona_tarifario: 'ZT SINTETICA',
    cobertura_qx: subzona !== 'SIN COBERTURA',
    version: 1,
  });
}

function prov(id, extra = {}) {
  return supplierSchema.parse({
    id_proveedor: id,
    razon_social: `Expreso Sintético ${id}`,
    cuit: CUIT_SINTETICO,
    email_contacto: [`${id.toLowerCase()}@example.com`],
    telefono: '0000-0000',
    estado: 'ACTIVO',
    condicion_pago: '30 días',
    iva_porcentaje: '0',
    aplica_seguro: false,
    ...CONTROL,
    ...extra,
  });
}

function tarifario(idProveedor, extra = {}) {
  const { id = `TAR_${idProveedor}`, ...resto } = extra;
  return {
    id,
    ...tariffSchema.parse({
      id_proveedor: idProveedor,
      version: 1,
      vigencia_desde: '2026-01-01',
      vigencia_hasta: null,
      estado: 'VIGENTE',
      creado_por: CONTROL.creado_por,
      creado_en: CONTROL.creado_en,
      ...resto,
    }),
  };
}

// Una fila de `reglas_tarifa`. `tipo` PESO usa kg, VOLUMEN usa m3.
function regla(o) {
  const p = o.prov ?? 'EXPA';
  const cp = o.cp ?? DESTINO.cp;
  const localidad = o.localidad ?? DESTINO.localidad;
  const zona = o.zona ?? 'Z1';
  const peso = o.tipo === 'PESO';
  const data = tariffRuleSchema.parse({
    tarifario_id: o.tarifario ?? `TAR_${p}`,
    id_proveedor: p,
    tipo_regla: o.tipo,
    provincia_origen: o.provOrigen ?? '*',
    ...(o.locOrigen === undefined ? {} : { localidad_origen: o.locOrigen }),
    provincia_destino: o.provDestino ?? DESTINO.provincia,
    localidad_destino: localidad,
    codigo_postal_destino: cp,
    zona_destino: zona,
    ...(o.plazo === undefined ? {} : { plazo_estimado_dias: o.plazo }),
    variante_id: variantId(cp, localidad, zona),
    kg_min: peso ? o.min : null,
    kg_max: peso ? o.max : null,
    m3_min: peso ? null : o.min,
    m3_max: peso ? null : o.max,
    precio_tramo: o.precio,
    costo_base_viaje: o.base ?? '0',
    ...(o.exc === undefined
      ? {}
      : { [peso ? 'precio_kg_excedente' : 'precio_m3_excedente']: o.exc }),
    aplica_colecta: o.colecta !== undefined,
    ...(o.colecta === undefined ? {} : { costo_colecta: o.colecta }),
    vigencia_desde: o.desde ?? '2026-01-01',
    vigencia_hasta: o.hasta ?? null,
    estado: o.estado ?? 'VIGENTE',
    ...CONTROL,
  });
  return { id: o.id, ...data };
}

function pedido(extra = {}) {
  return {
    cp_destino_norm: DESTINO.cp,
    localidad_destino_norm: DESTINO.localidad,
    provincia_destino_norm: DESTINO.provincia,
    codigo_postal_origen: ORIGEN.cp,
    peso_kgs: '30',
    volumen_m3: '0.2',
    ...extra,
  };
}

function contexto(o) {
  const proveedores = o.proveedores ?? [prov('EXPA')];
  return {
    canalizador: o.canalizador ?? [
      canal(ORIGEN.cp, ORIGEN.localidad, ORIGEN.provincia),
      canal(DESTINO.cp, DESTINO.localidad, DESTINO.provincia, o.subzona),
    ],
    proveedores,
    tarifarios: o.tarifarios ?? proveedores.map((p) => tarifario(p.id_proveedor)),
    reglas: o.reglas,
    fecha_referencia: o.fecha ?? FECHA,
    origen_estricto: o.origenEstricto ?? true,
  };
}

// Tramo de peso (0, 50] al precio dado: la variante mínima de un proveedor.
function simple(p, precio, extra = {}) {
  return regla({
    id: `${p}_${extra.zona ?? 'Z1'}_P`,
    prov: p,
    tipo: 'PESO',
    min: '0',
    max: '50',
    precio,
    ...extra,
  });
}

const V1 = `${DESTINO.cp}|${DESTINO.localidad}|Z1`;
const V2 = `${DESTINO.cp}|${DESTINO.localidad}|Z2`;
const SIN_OBS = [];

// Cada caso: id, descripcion (qué prueba), entrada y los valores calculados a mano (`aMano`).
// `aMano.cotizacion` es un subconjunto de campos, o null; `alternativas` es `id_proveedor:total`
// (con `@variante_id` si hace falta); `descartes` es `id_proveedor:motivo`.
const CASOS_INICIALES = [
  {
    id: 'referencia-1',
    descripcion:
      'Caso de referencia 1 de §3.3: IVA 21 %, seguro 0,5 %, gana VOLUMEN con colecta; total $4.139,20.',
    pedido: pedido({ peso_kgs: '30', volumen_m3: '0.2', valor_declarado: 10000000 }),
    contexto: contexto({
      proveedores: [
        prov('EXPA', { iva_porcentaje: '21', aplica_seguro: true, porcentaje_seguro: '0.5' }),
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
    // 2.600 + 320,83 + 500 = 3.420,83; IVA 718,3743 → 718,37; total 4.139,20.
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: {
        regla_peso_id: 'P2',
        regla_volumen_id: 'V2',
        criterio: 'VOLUMEN',
        costo_peso: 160000,
        costo_volumen: 260000,
        flete: 260000,
        colecta: 32083,
        seguro: 50000,
        neto: 342083,
        iva: 71837,
        total: 413920,
      },
      descartes: [],
    },
  },
  {
    id: 'referencia-2',
    descripcion:
      'Caso de referencia 2 de §3.3: 1.050 kg sobre el último tramo (900, 1.000] con excedente a $600; flete y total $530.000,00.',
    pedido: pedido({ peso_kgs: '1050', volumen_m3: '0.1' }),
    contexto: contexto({
      reglas: [
        regla({ id: 'P1', tipo: 'PESO', min: '0', max: '900', precio: '400000' }),
        regla({ id: 'P2', tipo: 'PESO', min: '900', max: '1000', precio: '500000', exc: '600' }),
        regla({ id: 'V1', tipo: 'VOLUMEN', min: '0', max: '0.2', precio: '20000' }),
      ],
    }),
    // 500.000 + 50 × 600 = 530.000; sin seguro, IVA ni colecta.
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: {
        regla_peso_id: 'P2',
        regla_volumen_id: 'V1',
        criterio: 'PESO',
        costo_peso: 53000000,
        costo_volumen: 2000000,
        flete: 53000000,
        colecta: 0,
        seguro: 0,
        neto: 53000000,
        iva: 0,
        total: 53000000,
      },
      descartes: [],
    },
  },
  {
    id: 'tramo-limite-superior-inclusivo',
    descripcion: 'Tramos (min, max]: 10 kg exactos caen en (0, 10] y no en (10, 50].',
    pedido: pedido({ peso_kgs: '10' }),
    contexto: contexto({
      reglas: [
        regla({ id: 'P1', tipo: 'PESO', min: '0', max: '10', precio: '900' }),
        regla({ id: 'P2', tipo: 'PESO', min: '10', max: '50', precio: '1600' }),
      ],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: { regla_peso_id: 'P1', regla_volumen_id: null, criterio: 'PESO', total: 90000 },
      descartes: [],
    },
  },
  {
    id: 'tramo-apenas-sobre-limite',
    descripcion:
      'Tramos (min, max]: 10,0001 kg ya cae en (10, 50], con la precisión máxima de dec.',
    pedido: pedido({ peso_kgs: '10.0001' }),
    contexto: contexto({
      reglas: [
        regla({ id: 'P1', tipo: 'PESO', min: '0', max: '10', precio: '900' }),
        regla({ id: 'P2', tipo: 'PESO', min: '10', max: '50', precio: '1600' }),
      ],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: { regla_peso_id: 'P2', criterio: 'PESO', costo_peso: 160000, total: 160000 },
      descartes: [],
    },
  },
  {
    id: 'excedente-volumen',
    descripcion:
      'Excedente de volumen: 1,5 m3 sobre el tope de 1 m3 se cobra a precio_m3_excedente y VOLUMEN gana.',
    pedido: pedido({ peso_kgs: '30', volumen_m3: '1.5' }),
    contexto: contexto({
      reglas: [
        regla({ id: 'P1', tipo: 'PESO', min: '0', max: '100', precio: '3000' }),
        regla({ id: 'V1', tipo: 'VOLUMEN', min: '0', max: '1', precio: '5000', exc: '1234.5678' }),
      ],
    }),
    // 5.000 + 0,5 × 1.234,5678 = 5.617,2839 → 5.617,28.
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: {
        criterio: 'VOLUMEN',
        costo_peso: 300000,
        costo_volumen: 561728,
        flete: 561728,
        total: 561728,
      },
      descartes: [],
    },
  },
  {
    id: 'peso-excedido-sin-regla',
    descripcion:
      'Peso sobre el último tramo sin precio_kg_excedente: descarte PESO_EXCEDIDO_SIN_REGLA y SIN_COBERTURA.',
    pedido: pedido({ peso_kgs: '30' }),
    contexto: contexto({
      reglas: [
        regla({ id: 'P1', tipo: 'PESO', min: '0', max: '20', precio: '1000' }),
        regla({ id: 'V1', tipo: 'VOLUMEN', min: '0', max: '1', precio: '500' }),
      ],
    }),
    aMano: {
      estado_sugerido: 'SIN_COBERTURA',
      observaciones: SIN_OBS,
      cotizacion: null,
      alternativas: [],
      descartes: ['EXPA:PESO_EXCEDIDO_SIN_REGLA'],
    },
  },
  {
    id: 'volumen-excedido-sin-regla',
    descripcion:
      'Volumen sobre el último tramo sin precio_m3_excedente: descarte VOLUMEN_EXCEDIDO_SIN_REGLA.',
    pedido: pedido({ volumen_m3: '0.2' }),
    contexto: contexto({
      reglas: [
        regla({ id: 'P1', tipo: 'PESO', min: '0', max: '50', precio: '1000' }),
        regla({ id: 'V1', tipo: 'VOLUMEN', min: '0', max: '0.1', precio: '500' }),
      ],
    }),
    aMano: {
      estado_sugerido: 'SIN_COBERTURA',
      observaciones: SIN_OBS,
      cotizacion: null,
      descartes: ['EXPA:VOLUMEN_EXCEDIDO_SIN_REGLA'],
    },
  },
  {
    id: 'solo-reglas-volumen',
    descripcion: 'Sin reglas de PESO: el peso aporta 0, gana VOLUMEN y regla_peso_id es null.',
    pedido: pedido(),
    contexto: contexto({
      reglas: [regla({ id: 'V1', tipo: 'VOLUMEN', min: '0', max: '0.5', precio: '2500' })],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: {
        regla_peso_id: null,
        regla_volumen_id: 'V1',
        criterio: 'VOLUMEN',
        costo_peso: 0,
        total: 250000,
      },
      descartes: [],
    },
  },
  {
    id: 'solo-reglas-peso',
    descripcion:
      'Sin reglas de VOLUMEN: el volumen aporta 0, gana PESO y regla_volumen_id es null.',
    pedido: pedido(),
    contexto: contexto({
      reglas: [regla({ id: 'P1', tipo: 'PESO', min: '0', max: '50', precio: '1800' })],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: {
        regla_peso_id: 'P1',
        regla_volumen_id: null,
        criterio: 'PESO',
        costo_volumen: 0,
        total: 180000,
      },
      descartes: [],
    },
  },
  {
    id: 'empate-criterio-gana-peso',
    descripcion:
      'costo_peso = costo_volumen con reglas en ambos: gana PESO (≥) y la colecta sale de la regla de peso.',
    pedido: pedido(),
    contexto: contexto({
      reglas: [
        regla({ id: 'P1', tipo: 'PESO', min: '0', max: '50', precio: '2000', colecta: '100' }),
        regla({ id: 'V1', tipo: 'VOLUMEN', min: '0', max: '0.5', precio: '2000', colecta: '300' }),
      ],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: { criterio: 'PESO', flete: 200000, colecta: 10000, neto: 210000, total: 210000 },
      descartes: [],
    },
  },
  {
    id: 'empate-r7-gana-volumen-con-reglas',
    descripcion:
      'R7: empate en 0 sin reglas de PESO y con un tramo de VOLUMEN a $0 con colecta: gana VOLUMEN y cobra la colecta.',
    pedido: pedido(),
    contexto: contexto({
      reglas: [
        regla({ id: 'V1', tipo: 'VOLUMEN', min: '0', max: '0.5', precio: '0', colecta: '150' }),
      ],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: { criterio: 'VOLUMEN', flete: 0, colecta: 15000, total: 15000 },
      descartes: [],
    },
  },
  {
    id: 'colecta-solo-del-criterio-ganador',
    descripcion: 'D7: gana PESO y la colecta de la regla de VOLUMEN no se cobra.',
    pedido: pedido(),
    contexto: contexto({
      reglas: [
        regla({ id: 'P1', tipo: 'PESO', min: '0', max: '50', precio: '3000' }),
        regla({ id: 'V1', tipo: 'VOLUMEN', min: '0', max: '0.5', precio: '1000', colecta: '500' }),
      ],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: { criterio: 'PESO', colecta: 0, total: 300000 },
      descartes: [],
    },
  },
  {
    id: 'costo-base-viaje',
    descripcion: 'costo_base_viaje se suma al precio del tramo: 250,50 + 1.000 = $1.250,50.',
    pedido: pedido(),
    contexto: contexto({
      reglas: [
        regla({ id: 'P1', tipo: 'PESO', min: '0', max: '50', precio: '1000', base: '250.5' }),
      ],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: { costo_peso: 125050, total: 125050 },
      descartes: [],
    },
  },
  {
    id: 'redondeo-componente-half-up',
    descripcion:
      'Redondeo half-up del componente: 100 + 0,2 kg × $0,125 = 100,025 → $100,03 (half-even daría 100,02).',
    pedido: pedido({ peso_kgs: '10.2' }),
    contexto: contexto({
      reglas: [regla({ id: 'P1', tipo: 'PESO', min: '0', max: '10', precio: '100', exc: '0.125' })],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: { costo_peso: 10003, flete: 10003, total: 10003 },
      descartes: [],
    },
  },
  {
    id: 'redondeo-iva-half-up',
    descripcion:
      'Redondeo half-up del IVA: 102,50 × 21 % = 21,525 → $21,53 (half-even daría 21,52).',
    pedido: pedido(),
    contexto: contexto({
      proveedores: [prov('EXPA', { iva_porcentaje: '21' })],
      reglas: [regla({ id: 'P1', tipo: 'PESO', min: '0', max: '50', precio: '102.5' })],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: { neto: 10250, iva_porcentaje: '21', iva: 2153, total: 12403 },
      descartes: [],
    },
  },
  {
    id: 'redondeo-iva-half-up-centavo-cero',
    descripcion:
      'Redondeo half-up del IVA con centavo anterior 0: 0,50 × 21 % = 0,105 → $0,11 (half-even daría 0,10).',
    pedido: pedido(),
    contexto: contexto({
      proveedores: [prov('EXPA', { iva_porcentaje: '21' })],
      reglas: [regla({ id: 'P1', tipo: 'PESO', min: '0', max: '50', precio: '0.5' })],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: { neto: 50, iva: 11, total: 61 },
      descartes: [],
    },
  },
  {
    id: 'redondeo-seguro-half-up',
    descripcion:
      'Redondeo half-up del seguro: $25 declarados × 0,5 % = 0,125 → $0,13 (half-even daría 0,12).',
    pedido: pedido({ valor_declarado: 2500 }),
    contexto: contexto({
      proveedores: [prov('EXPA', { aplica_seguro: true, porcentaje_seguro: '0.5' })],
      reglas: [regla({ id: 'P1', tipo: 'PESO', min: '0', max: '50', precio: '1000' })],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: { seguro: 13, neto: 100013, total: 100013 },
      descartes: [],
    },
  },
  {
    id: 'seguro-sin-valor-declarado',
    descripcion:
      'D8: el proveedor aplica seguro y falta el valor declarado: seguro 0 y VALOR_DECLARADO_FALTANTE.',
    pedido: pedido(),
    contexto: contexto({
      proveedores: [prov('EXPA', { aplica_seguro: true, porcentaje_seguro: '1' })],
      reglas: [regla({ id: 'P1', tipo: 'PESO', min: '0', max: '50', precio: '1000' })],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: ['VALOR_DECLARADO_FALTANTE'],
      cotizacion: { seguro: 0, total: 100000 },
      descartes: [],
    },
  },
  {
    id: 'proveedor-sin-seguro-con-valor-declarado',
    descripcion:
      'Proveedor que no aplica seguro con valor declarado $50.000: seguro 0 y sin observación.',
    pedido: pedido({ valor_declarado: 5000000 }),
    contexto: contexto({
      reglas: [regla({ id: 'P1', tipo: 'PESO', min: '0', max: '50', precio: '1000' })],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: { seguro: 0, total: 100000 },
      descartes: [],
    },
  },
  {
    id: 'ranking-por-total-con-iva',
    descripcion:
      'D11: el ranking usa el total con IVA: EXPB ($110, IVA 0) le gana a EXPA ($100 + 21 % = $121).',
    pedido: pedido(),
    contexto: contexto({
      proveedores: [prov('EXPA', { iva_porcentaje: '21' }), prov('EXPB')],
      reglas: [simple('EXPA', '100'), simple('EXPB', '110')],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: { id_proveedor: 'EXPB', neto: 11000, total: 11000 },
      alternativas: ['EXPB:11000', 'EXPA:12100'],
      descartes: [],
    },
  },
  {
    id: 'empate-total-entre-proveedores',
    descripcion:
      'Empate de total entre proveedores: gana el menor id_proveedor (EXPB antes que EXPZ).',
    pedido: pedido(),
    contexto: contexto({
      proveedores: [prov('EXPZ'), prov('EXPB')],
      reglas: [simple('EXPZ', '100'), simple('EXPB', '100')],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: { id_proveedor: 'EXPB', total: 10000 },
      alternativas: ['EXPB:10000', 'EXPZ:10000'],
      descartes: [],
    },
  },
  {
    id: 'empate-total-variantes-sin-ambiguedad',
    descripcion:
      'Dos variantes del mismo proveedor con igual total y plazo: gana el menor variante_id y no hay CP_AMBIGUO.',
    pedido: pedido(),
    contexto: contexto({
      reglas: [
        simple('EXPA', '100', { zona: 'Z2', plazo: 3 }),
        simple('EXPA', '100', { plazo: 3 }),
      ],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: { variante_id: V1, total: 10000 },
      alternativas: [`EXPA@${V1}:10000`, `EXPA@${V2}:10000`],
      descartes: [],
    },
  },
  {
    id: 'cp-ambiguo-por-total',
    descripcion:
      'Mismo proveedor con dos variantes de total distinto: CP_AMBIGUO y la cotización es la más barata.',
    pedido: pedido(),
    contexto: contexto({
      reglas: [simple('EXPA', '100'), simple('EXPA', '150', { zona: 'Z2' })],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: ['CP_AMBIGUO'],
      cotizacion: { variante_id: V1, total: 10000 },
      alternativas: [`EXPA@${V1}:10000`, `EXPA@${V2}:15000`],
      descartes: [],
    },
  },
  {
    id: 'cp-ambiguo-por-plazo',
    descripcion:
      'Mismo proveedor, dos variantes de igual total y plazo distinto (2 y 4 días): CP_AMBIGUO.',
    pedido: pedido(),
    contexto: contexto({
      reglas: [
        simple('EXPA', '100', { plazo: 2 }),
        simple('EXPA', '100', { zona: 'Z2', plazo: 4 }),
      ],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: ['CP_AMBIGUO'],
      cotizacion: {
        variante_id: V1,
        variante: { localidad: DESTINO.localidad, zona: 'Z1', plazo_estimado_dias: 2 },
      },
      descartes: [],
    },
  },
  {
    id: 'variantes-de-proveedores-distintos-sin-ambiguedad',
    descripcion:
      'Variantes distintas pero de proveedores distintos (EXPA Z1, EXPB Z2): no hay CP_AMBIGUO.',
    pedido: pedido(),
    contexto: contexto({
      proveedores: [prov('EXPA'), prov('EXPB')],
      reglas: [simple('EXPA', '100'), simple('EXPB', '150', { zona: 'Z2' })],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      alternativas: [`EXPA@${V1}:10000`, `EXPB@${V2}:15000`],
      descartes: [],
    },
  },
  {
    id: 'filtro-provincia-destino',
    descripcion:
      'Variantes del CP en dos provincias: se conserva la de la provincia del pedido aunque la otra sea más barata.',
    pedido: pedido(),
    contexto: contexto({
      reglas: [
        simple('EXPA', '200'),
        simple('EXPA', '100', {
          id: 'EXPA_CBA_P',
          localidad: 'PARAJE INVENTADO',
          provDestino: 'CORDOBA',
        }),
      ],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: { variante_id: V1, total: 20000 },
      alternativas: [`EXPA@${V1}:20000`],
      descartes: [],
    },
  },
  {
    id: 'provincia-difiere',
    descripcion:
      'Ninguna variante coincide con la provincia del pedido: se conservan todas con PROVINCIA_DIFIERE.',
    pedido: pedido(),
    contexto: contexto({
      reglas: [simple('EXPA', '100', { provDestino: 'ENTRE RIOS' })],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: ['PROVINCIA_DIFIERE'],
      cotizacion: { total: 10000 },
      descartes: [],
    },
  },
  {
    id: 'origen-estricto-provincia-distinta',
    descripcion:
      'origen_estricto = true: la regla con origen CORDOBA no aplica a un pedido desde BUENOS AIRES; SIN_TARIFA.',
    pedido: pedido(),
    contexto: contexto({
      reglas: [simple('EXPA', '100', { provOrigen: 'CORDOBA' })],
    }),
    aMano: {
      estado_sugerido: 'SIN_COBERTURA',
      observaciones: SIN_OBS,
      cotizacion: null,
      descartes: ['EXPA:SIN_TARIFA'],
    },
  },
  {
    id: 'origen-no-estricto-unica-provincia',
    descripcion:
      'origen_estricto = false: la única provincia de origen distinta (CORDOBA) se acepta para el pedido.',
    pedido: pedido(),
    contexto: contexto({
      origenEstricto: false,
      reglas: [simple('EXPA', '100', { provOrigen: 'CORDOBA' })],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: { regla_peso_id: 'EXPA_Z1_P', total: 10000 },
      descartes: [],
    },
  },
  {
    id: 'origen-no-estricto-dos-provincias',
    descripcion:
      'origen_estricto = false con dos provincias de origen distintas (CORDOBA y MENDOZA): no se elige ninguna; SIN_TARIFA.',
    pedido: pedido(),
    contexto: contexto({
      origenEstricto: false,
      reglas: [
        simple('EXPA', '100', { id: 'EXPA_CBA', provOrigen: 'CORDOBA' }),
        simple('EXPA', '200', { id: 'EXPA_MZA', provOrigen: 'MENDOZA' }),
      ],
    }),
    aMano: {
      estado_sugerido: 'SIN_COBERTURA',
      observaciones: SIN_OBS,
      cotizacion: null,
      descartes: ['EXPA:SIN_TARIFA'],
    },
  },
  {
    id: 'precedencia-origen-localidad',
    descripcion:
      'Precedencia de origen: la regla con localidad de origen gana a la de provincia y a la de `*`.',
    pedido: pedido(),
    contexto: contexto({
      reglas: [
        simple('EXPA', '300', { id: 'R_ASTERISCO' }),
        simple('EXPA', '200', { id: 'R_PROVINCIA', provOrigen: ORIGEN.provincia }),
        simple('EXPA', '100', {
          id: 'R_LOCALIDAD',
          provOrigen: ORIGEN.provincia,
          locOrigen: ORIGEN.localidad,
        }),
      ],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: { regla_peso_id: 'R_LOCALIDAD', total: 10000 },
      descartes: [],
    },
  },
  {
    id: 'precedencia-origen-provincia',
    descripcion:
      'Precedencia de origen: sin regla por localidad, la de provincia gana a la de `*`.',
    pedido: pedido(),
    contexto: contexto({
      reglas: [
        simple('EXPA', '300', { id: 'R_ASTERISCO' }),
        simple('EXPA', '200', { id: 'R_PROVINCIA', provOrigen: ORIGEN.provincia }),
      ],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: { regla_peso_id: 'R_PROVINCIA', total: 20000 },
      descartes: [],
    },
  },
  {
    id: 'sin-caida-a-grupo-general',
    descripcion:
      'El grupo por localidad de origen existe pero no tiene tramo para 10 kg: se descarta y no cae a `*`.',
    pedido: pedido({ peso_kgs: '10' }),
    contexto: contexto({
      reglas: [
        regla({ id: 'R_ASTERISCO', tipo: 'PESO', min: '0', max: '50', precio: '300' }),
        regla({
          id: 'R_LOCALIDAD',
          tipo: 'PESO',
          min: '20',
          max: '50',
          precio: '100',
          provOrigen: ORIGEN.provincia,
          locOrigen: ORIGEN.localidad,
        }),
      ],
    }),
    aMano: {
      estado_sugerido: 'SIN_COBERTURA',
      observaciones: SIN_OBS,
      cotizacion: null,
      descartes: ['EXPA:SIN_TARIFA'],
    },
  },
  {
    id: 'cobertura-qx-con-expresos',
    descripcion:
      'cobertura_qx = SI con candidatas: COBERTURA_QX y la mejor opción de expreso queda como sugerencia.',
    pedido: pedido(),
    contexto: contexto({ subzona: 'SUBZONA QX', reglas: [simple('EXPA', '100')] }),
    aMano: {
      estado_sugerido: 'COBERTURA_QX',
      observaciones: SIN_OBS,
      canalizador: { cobertura_qx: 'SI', subzona: 'SUBZONA QX' },
      cotizacion: { id_proveedor: 'EXPA', total: 10000 },
      descartes: [],
    },
  },
  {
    id: 'cobertura-qx-sin-expresos',
    descripcion: 'cobertura_qx = SI sin candidatas: COBERTURA_QX igual, sin cotización.',
    pedido: pedido(),
    contexto: contexto({ subzona: 'SUBZONA QX', reglas: [] }),
    aMano: {
      estado_sugerido: 'COBERTURA_QX',
      observaciones: SIN_OBS,
      canalizador: { cobertura_qx: 'SI' },
      cotizacion: null,
      alternativas: [],
      descartes: [],
    },
  },
  {
    id: 'cp-destino-fuera-del-canalizador',
    descripcion:
      'CP de destino ausente del canalizador: cobertura DESCONOCIDA, CP_NO_EN_CANALIZADOR y la cotización sigue por CP.',
    pedido: pedido({ cp_destino_norm: '9902', localidad_destino_norm: 'COLONIA FICTICIA' }),
    contexto: contexto({
      reglas: [simple('EXPA', '100', { cp: '9902', localidad: 'COLONIA FICTICIA' })],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: ['CP_NO_EN_CANALIZADOR'],
      canalizador: { cobertura_qx: 'DESCONOCIDA', zona: null },
      cotizacion: { variante_id: '9902|COLONIA FICTICIA|Z1', total: 10000 },
      descartes: [],
    },
  },
  {
    id: 'cp-origen-fuera-del-canalizador',
    descripcion:
      'CP de origen ausente del canalizador: sin provincia de origen solo aplica la regla `*`, con CP_NO_EN_CANALIZADOR.',
    pedido: pedido({ codigo_postal_origen: '9909' }),
    contexto: contexto({
      reglas: [
        simple('EXPA', '300', { id: 'R_ASTERISCO' }),
        simple('EXPA', '200', { id: 'R_PROVINCIA', provOrigen: ORIGEN.provincia }),
      ],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: ['CP_NO_EN_CANALIZADOR'],
      canalizador: { cobertura_qx: 'NO' },
      cotizacion: { regla_peso_id: 'R_ASTERISCO', total: 30000 },
      descartes: [],
    },
  },
  {
    id: 'vigencia-tarifario-vigente',
    descripcion:
      'Dos versiones de tarifario: con fecha_referencia 2026-10-06 se usa la vigente desde 2026-07-01, no la histórica.',
    pedido: pedido(),
    contexto: versionado(FECHA),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: { tarifario_id: 'TAR_EXPA_V2', regla_peso_id: 'V2_P', total: 15000 },
      descartes: [],
    },
  },
  {
    id: 'vigencia-tarifario-historico',
    descripcion:
      'Mismos tarifarios con fecha_referencia 2026-03-15: se usa la versión HISTORICO que cubre esa fecha.',
    pedido: pedido(),
    contexto: versionado('2026-03-15'),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: {
        tarifario_id: 'TAR_EXPA_V1',
        regla_peso_id: 'V1_P',
        total: 10000,
        fecha_referencia: '2026-03-15',
      },
      descartes: [],
    },
  },
  {
    id: 'tarifario-borrador-no-aplica',
    descripcion: 'Un tarifario en BORRADOR no participa aunque sea más barato: solo queda EXPB.',
    pedido: pedido(),
    contexto: contexto({
      proveedores: [prov('EXPA'), prov('EXPB')],
      tarifarios: [tarifario('EXPA', { estado: 'BORRADOR' }), tarifario('EXPB')],
      reglas: [simple('EXPA', '50', { estado: 'BORRADOR' }), simple('EXPB', '100')],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      alternativas: ['EXPB:10000'],
      descartes: [],
    },
  },
  {
    id: 'proveedor-inactivo',
    descripcion: 'Un proveedor INACTIVO no es candidato ni aparece en descartes: solo queda EXPB.',
    pedido: pedido(),
    contexto: contexto({
      proveedores: [prov('EXPA', { estado: 'INACTIVO' }), prov('EXPB')],
      reglas: [simple('EXPA', '50'), simple('EXPB', '100')],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      alternativas: ['EXPB:10000'],
      descartes: [],
    },
  },
  {
    id: 'cp-sin-reglas',
    descripcion:
      'El CP está en el canalizador sin cobertura QX y ningún proveedor tiene reglas: SIN_COBERTURA sin descartes.',
    pedido: pedido(),
    contexto: contexto({
      reglas: [simple('EXPA', '100', { cp: '9903', localidad: 'OTRA VILLA' })],
    }),
    aMano: {
      estado_sugerido: 'SIN_COBERTURA',
      observaciones: SIN_OBS,
      cotizacion: null,
      alternativas: [],
      descartes: [],
    },
  },
  {
    id: 'tramos-solapados',
    descripcion:
      'Tramos solapados (0, 50] y (20, 60] con 30 kg: no hay un único tramo y la candidata se descarta con SIN_TARIFA.',
    pedido: pedido({ peso_kgs: '30' }),
    contexto: contexto({
      reglas: [
        regla({ id: 'P1', tipo: 'PESO', min: '0', max: '50', precio: '100' }),
        regla({ id: 'P2', tipo: 'PESO', min: '20', max: '60', precio: '200' }),
      ],
    }),
    aMano: {
      estado_sugerido: 'SIN_COBERTURA',
      observaciones: SIN_OBS,
      cotizacion: null,
      descartes: ['EXPA:SIN_TARIFA'],
    },
  },
  {
    id: 'descartes-y-validas-mezcladas',
    descripcion:
      'Una válida y dos descartadas (excedido sin regla y origen que no aplica): descartes ordenados por id_proveedor.',
    pedido: pedido({ peso_kgs: '30' }),
    contexto: contexto({
      proveedores: [prov('EXPC'), prov('EXPA'), prov('EXPB')],
      reglas: [
        simple('EXPC', '100', { provOrigen: 'CORDOBA' }),
        simple('EXPB', '100', { max: '20' }),
        simple('EXPA', '400'),
      ],
    }),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: { id_proveedor: 'EXPA', total: 40000 },
      alternativas: ['EXPA:40000'],
      descartes: ['EXPB:PESO_EXCEDIDO_SIN_REGLA', 'EXPC:SIN_TARIFA'],
    },
  },
  {
    id: 'tope-20-alternativas',
    descripcion:
      '§2.4: con 21 proveedores válidos, alternativas guarda las 20 más baratas y deja afuera la más cara (EXP21).',
    pedido: pedido(),
    contexto: (() => {
      const ids = Array.from({ length: 21 }, (_, i) => `EXP${String(i + 1).padStart(2, '0')}`);
      return contexto({
        proveedores: ids.map((id) => prov(id)),
        reglas: ids.map((id, i) => simple(id, String(100 + i))),
      });
    })(),
    aMano: {
      estado_sugerido: 'VALORIZADO',
      observaciones: SIN_OBS,
      cotizacion: { id_proveedor: 'EXP01', total: 10000 },
      alternativas: Array.from(
        { length: 20 },
        (_, i) => `EXP${String(i + 1).padStart(2, '0')}:${(100 + i) * 100}`,
      ),
      descartes: [],
    },
  },
];

// EXPA con dos versiones: V1 HISTORICO (ene–jun, $100) y V2 VIGENTE (desde jul, $150).
function versionado(fecha) {
  return contexto({
    fecha,
    tarifarios: [
      tarifario('EXPA', {
        id: 'TAR_EXPA_V1',
        vigencia_hasta: '2026-06-30',
        estado: 'HISTORICO',
      }),
      tarifario('EXPA', { id: 'TAR_EXPA_V2', version: 2, vigencia_desde: '2026-07-01' }),
    ],
    reglas: [
      simple('EXPA', '100', {
        id: 'V1_P',
        tarifario: 'TAR_EXPA_V1',
        hasta: '2026-06-30',
        estado: 'HISTORICO',
      }),
      simple('EXPA', '150', { id: 'V2_P', tarifario: 'TAR_EXPA_V2', desde: '2026-07-01' }),
    ],
  });
}

function alternativa(a, conVariante) {
  return `${a.id_proveedor}${conVariante ? `@${a.variante_id}` : ''}:${a.total}`;
}

// Diferencias entre la salida del motor y los valores calculados a mano.
function controlarAMano(salida, aMano) {
  const errores = [];
  const igual = (campo, esperado, obtenido) => {
    if (canonical(esperado) !== canonical(obtenido)) {
      errores.push(`${campo}: a mano ${canonical(esperado)}, motor ${canonical(obtenido)}`);
    }
  };
  igual('estado_sugerido', aMano.estado_sugerido, salida.estado_sugerido);
  igual('observaciones', aMano.observaciones, salida.observaciones);
  igual(
    'descartes',
    aMano.descartes,
    salida.descartes.map((d) => `${d.id_proveedor}:${d.motivo}`),
  );
  if (aMano.cotizacion === null) {
    igual('cotizacion', null, salida.cotizacion);
  } else if (aMano.cotizacion !== undefined) {
    if (salida.cotizacion === null) errores.push('cotizacion: a mano con valor, motor null');
    else {
      for (const [k, v] of Object.entries(aMano.cotizacion)) {
        igual(`cotizacion.${k}`, v, salida.cotizacion[k]);
      }
    }
  }
  if (aMano.alternativas !== undefined) {
    const conVariante = aMano.alternativas.some((a) => a.includes('@'));
    igual(
      'alternativas',
      aMano.alternativas,
      salida.alternativas.map((a) => alternativa(a, conVariante)),
    );
  }
  for (const [k, v] of Object.entries(aMano.canalizador ?? {})) {
    igual(`canalizador.${k}`, v, salida.canalizador[k]);
  }
  return errores;
}

await ejecutar(async () => {
  const { cotizar } = await cargarMotor();
  const ids = new Set();
  const nuevos = [];
  const errores = [];

  for (const c of CASOS_INICIALES) {
    if (!ID_CASO.test(c.id)) throw new GoldenError(`id inválido: ${c.id}`);
    if (ids.has(c.id)) throw new GoldenError(`id repetido: ${c.id}`);
    ids.add(c.id);

    const salida = comoJson(cotizar(c.pedido, c.contexto));
    for (const e of controlarAMano(salida, c.aMano)) errores.push(`${c.id} → ${e}`);
    if (existsSync(rutaCaso(c.id))) continue;
    nuevos.push({
      id: c.id,
      descripcion: c.descripcion,
      entrada: comoJson({ pedido: c.pedido, contexto: c.contexto }),
      salida,
    });
  }

  if (errores.length > 0) {
    throw new GoldenError(`el motor no coincide con el cálculo a mano:\n  ${errores.join('\n  ')}`);
  }

  mkdirSync(CASOS, { recursive: true });
  for (const caso of nuevos) {
    escribirCaso(caso);
    registrarEnChangelog(caso.id, caso, MOTIVO_ALTA);
  }
  if (nuevos.length > 0) formatear([...nuevos.map((c) => rutaCaso(c.id)), CHANGELOG]);
  console.log(
    `golden: ${CASOS_INICIALES.length} casos controlados a mano; ${nuevos.length} dados de alta.`,
  );
});
