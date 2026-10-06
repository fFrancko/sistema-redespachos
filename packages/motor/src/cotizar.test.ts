import { describe, it, expect } from 'vitest';
import { quoteAlternativeSchema, quoteSchema } from '@sistema-redespachos/shared';
import { cotizar, MAX_ALTERNATIVAS, MOTOR_VERSION } from './cotizar.js';
import { evaluateCandidate } from './calculo.js';
import { tariffDetail } from './formato.js';
import type { QuoteResult } from './types.js';
import {
  canalizadorEntry,
  casoReferencia1,
  casoReferencia2,
  contexto,
  CP_ORIGEN,
  FECHA_REFERENCIA,
  pedido,
  proveedor,
  regla,
} from '../test/fixtures/motor.js';

// Una variante con un único tramo de peso (0, 100] al precio dado.
function variante(
  prov: string,
  precio: string,
  extra: { localidad?: string; zona?: string; plazo?: number } = {},
) {
  return regla({
    id: `${prov}_${extra.localidad ?? 'ROSARIO'}_${extra.zona ?? 'Z1'}`,
    tipo: 'PESO',
    min: '0',
    max: '100',
    precio,
    proveedor: prov,
    ...extra,
  });
}

// Agregado 7: completada por MVP-18 con origen y calculado_en, valida con quoteSchema.
function expectSchemas(r: QuoteResult) {
  if (r.cotizacion !== null) {
    const completa = { ...r.cotizacion, origen: 'MOTOR', calculado_en: '2026-10-06T12:00:00Z' };
    expect(quoteSchema.safeParse(completa).success).toBe(true);
  }
  for (const a of r.alternativas) expect(quoteAlternativeSchema.safeParse(a).success).toBe(true);
}

describe('cotizar: casos de referencia de §3.3', () => {
  it('caso 1: cada componente en centavos y total $4.139,20', () => {
    const { pedido: p, contexto: ctx } = casoReferencia1();
    const r = cotizar(p, ctx);
    expect(r.estado_sugerido).toBe('VALORIZADO');
    expect(r.cotizacion).toEqual({
      id_proveedor: 'PROV1',
      tarifario_id: 'TAR_PROV1',
      variante_id: '2000|ROSARIO|Z1',
      variante: { localidad: 'ROSARIO', zona: 'Z1', plazo_estimado_dias: null },
      regla_peso_id: 'P2',
      regla_volumen_id: 'V2',
      criterio: 'VOLUMEN',
      detalle_tarifa: 'VOLUMEN 0,05–0,5 m3: tramo $2.600,00',
      costo_peso: 160000,
      costo_volumen: 260000,
      flete: 260000,
      colecta: 32083,
      seguro: 50000,
      neto: 342083,
      iva_porcentaje: '21',
      iva: 71837,
      total: 413920,
      fecha_referencia: FECHA_REFERENCIA,
      motor_version: MOTOR_VERSION,
    });
    expect(r.alternativas).toEqual([
      {
        id_proveedor: 'PROV1',
        variante_id: '2000|ROSARIO|Z1',
        variante: { localidad: 'ROSARIO', zona: 'Z1', plazo_estimado_dias: null },
        criterio: 'VOLUMEN',
        neto: 342083,
        total: 413920,
      },
    ]);
    expect(r.descartes).toEqual([]);
    expect(r.observaciones).toEqual([]);
    expectSchemas(r);
  });

  it('caso 2: excedente, flete $530.000,00 con criterio PESO', () => {
    const { pedido: p, contexto: ctx } = casoReferencia2();
    const q = cotizar(p, ctx).cotizacion;
    expect(q).toMatchObject({
      costo_peso: 53000000,
      costo_volumen: 2000000,
      flete: 53000000,
      criterio: 'PESO',
      colecta: 0,
      seguro: 0,
      iva: 0,
      neto: 53000000,
      total: 53000000,
      regla_peso_id: 'P2',
      regla_volumen_id: 'V1',
      detalle_tarifa: 'PESO 900–1.000 kg: tramo $500.000,00 + excedente 50 kg × $600,00',
    });
  });
});

describe('cotizar: ranking (paso 6)', () => {
  it('ordena por total ascendente y la primera es la cotización', () => {
    const ctx = contexto({
      proveedores: [proveedor('AAA'), proveedor('BBB'), proveedor('CCC')],
      reglas: [variante('AAA', '300'), variante('BBB', '100'), variante('CCC', '200')],
    });
    const r = cotizar(pedido(), ctx);
    expect(r.alternativas.map((a) => [a.id_proveedor, a.total])).toEqual([
      ['BBB', 10000],
      ['CCC', 20000],
      ['AAA', 30000],
    ]);
    expect(r.cotizacion?.id_proveedor).toBe('BBB');
    expectSchemas(r);
  });

  it('el total incluye el IVA de cada proveedor (D11)', () => {
    const ctx = contexto({
      proveedores: [proveedor('AAA', { iva_porcentaje: '21' }), proveedor('BBB')],
      reglas: [variante('AAA', '100'), variante('BBB', '110')],
    });
    const r = cotizar(pedido(), ctx);
    expect(r.alternativas.map((a) => [a.id_proveedor, a.neto, a.total])).toEqual([
      ['BBB', 11000, 11000],
      ['AAA', 10000, 12100],
    ]);
  });

  it('empate de total entre dos proveedores: menor id_proveedor primero', () => {
    const ctx = contexto({
      proveedores: [proveedor('ZZZ'), proveedor('AAA')],
      reglas: [variante('ZZZ', '100'), variante('AAA', '100')],
    });
    const r = cotizar(pedido(), ctx);
    expect(r.alternativas.map((a) => a.id_proveedor)).toEqual(['AAA', 'ZZZ']);
    expect(r.cotizacion?.id_proveedor).toBe('AAA');
  });

  it('empate entre dos variantes del mismo proveedor: menor variante_id primero', () => {
    const ctx = contexto({
      proveedores: [proveedor('AAA')],
      reglas: [variante('AAA', '100', { zona: 'Z9' }), variante('AAA', '100', { zona: 'Z2' })],
    });
    const r = cotizar(pedido(), ctx);
    expect(r.alternativas.map((a) => a.variante_id)).toEqual([
      '2000|ROSARIO|Z2',
      '2000|ROSARIO|Z9',
    ]);
    expect(r.cotizacion?.variante_id).toBe('2000|ROSARIO|Z2');
    // Mismo total y mismo plazo: no es CP_AMBIGUO.
    expect(r.observaciones).not.toContain('CP_AMBIGUO');
  });

  it(`alternativas guarda como máximo ${MAX_ALTERNATIVAS}, las más baratas`, () => {
    const ids = Array.from({ length: 25 }, (_, i) => `P${String(i).padStart(2, '0')}`);
    const ctx = contexto({
      proveedores: ids.map((id) => proveedor(id)),
      reglas: ids.map((id, i) => variante(id, `${100 + i}`)),
    });
    const r = cotizar(pedido(), ctx);
    expect(r.alternativas).toHaveLength(MAX_ALTERNATIVAS);
    expect(r.alternativas[0].id_proveedor).toBe('P00');
    expect(r.alternativas[MAX_ALTERNATIVAS - 1].id_proveedor).toBe('P19');
    expectSchemas(r);
  });

  it('descartes con su motivo, ordenados por id_proveedor y variante_id', () => {
    const ctx = contexto({
      proveedores: [proveedor('CCC'), proveedor('BBB'), proveedor('AAA')],
      reglas: [
        regla({ id: 'C', tipo: 'PESO', min: '0', max: '1', precio: '1', proveedor: 'CCC' }),
        regla({ id: 'B', tipo: 'VOLUMEN', min: '0', max: '0.1', precio: '1', proveedor: 'BBB' }),
        variante('AAA', '100'),
      ],
    });
    const r = cotizar(pedido({ peso_kgs: '30', volumen_m3: '0.2' }), ctx);
    expect(r.descartes).toEqual([
      { id_proveedor: 'BBB', variante_id: '2000|ROSARIO|Z1', motivo: 'VOLUMEN_EXCEDIDO_SIN_REGLA' },
      { id_proveedor: 'CCC', variante_id: '2000|ROSARIO|Z1', motivo: 'PESO_EXCEDIDO_SIN_REGLA' },
    ]);
    expect(r.alternativas.map((a) => a.id_proveedor)).toEqual(['AAA']);
  });

  it('candidata sin reglas aplicables (origen de otra provincia) se descarta con SIN_TARIFA', () => {
    const otraProvincia = {
      ...variante('AAA', '100'),
      provincia_origen: 'CORDOBA',
    };
    const ctx = contexto({ proveedores: [proveedor('AAA')], reglas: [otraProvincia] });
    const r = cotizar(pedido(), ctx);
    expect(r.descartes).toEqual([
      { id_proveedor: 'AAA', variante_id: '2000|ROSARIO|Z1', motivo: 'SIN_TARIFA' },
    ]);
    expect(r.estado_sugerido).toBe('SIN_COBERTURA');
  });
});

describe('cotizar: CP_AMBIGUO (PREGUNTAS 2 y 4, por proveedor)', () => {
  it('un proveedor con dos variantes válidas de total distinto', () => {
    const ctx = contexto({
      proveedores: [proveedor('AAA')],
      reglas: [variante('AAA', '100', { zona: 'Z1' }), variante('AAA', '150', { zona: 'Z2' })],
    });
    expect(cotizar(pedido(), ctx).observaciones).toContain('CP_AMBIGUO');
  });

  it('un proveedor con dos variantes de igual total y plazo distinto', () => {
    const ctx = contexto({
      proveedores: [proveedor('AAA')],
      reglas: [
        variante('AAA', '100', { zona: 'Z1', plazo: 2 }),
        variante('AAA', '100', { zona: 'Z2', plazo: 5 }),
      ],
    });
    expect(cotizar(pedido(), ctx).observaciones).toEqual(['CP_AMBIGUO']);
  });

  it('proveedores distintos con una variante cada uno no es ambiguo', () => {
    const ctx = contexto({
      proveedores: [proveedor('AAA'), proveedor('BBB')],
      reglas: [
        variante('AAA', '100', { zona: 'ZONA 1', plazo: 2 }),
        variante('BBB', '180', { zona: 'RAMAL NORTE', plazo: 4 }),
      ],
    });
    expect(cotizar(pedido(), ctx).observaciones).not.toContain('CP_AMBIGUO');
  });

  it('una variante descartada no cuenta para la ambigüedad', () => {
    const ctx = contexto({
      proveedores: [proveedor('AAA')],
      reglas: [
        variante('AAA', '100', { zona: 'Z1' }),
        regla({
          id: 'X',
          tipo: 'PESO',
          min: '0',
          max: '1',
          precio: '5',
          proveedor: 'AAA',
          zona: 'Z2',
        }),
      ],
    });
    const r = cotizar(pedido(), ctx);
    expect(r.descartes).toHaveLength(1);
    expect(r.observaciones).not.toContain('CP_AMBIGUO');
  });
});

describe('cotizar: VALOR_DECLARADO_FALTANTE (D8)', () => {
  const reglas = [variante('AAA', '100')];
  const conSeguro = [proveedor('AAA', { aplica_seguro: true, porcentaje_seguro: '1' })];

  it('falta el valor declarado y el proveedor aplica seguro: seguro 0 y observación', () => {
    const r = cotizar(pedido(), contexto({ proveedores: conSeguro, reglas }));
    expect(r.observaciones).toEqual(['VALOR_DECLARADO_FALTANTE']);
    expect(r.cotizacion?.seguro).toBe(0);
  });

  it('sin proveedor que aplique seguro, no se observa', () => {
    const r = cotizar(pedido(), contexto({ proveedores: [proveedor('AAA')], reglas }));
    expect(r.observaciones).toEqual([]);
  });

  it('valor declarado 0 cuenta como informado', () => {
    const r = cotizar(pedido({ valor_declarado: 0 }), contexto({ proveedores: conSeguro, reglas }));
    expect(r.observaciones).toEqual([]);
    expect(r.cotizacion?.seguro).toBe(0);
  });
});

describe('cotizar: resultado sugerido (paso 7)', () => {
  it('VALORIZADO: al menos una válida y sin cobertura QX', () => {
    const r = cotizar(
      pedido(),
      contexto({ proveedores: [proveedor('AAA')], reglas: [variante('AAA', '100')] }),
    );
    expect(r.canalizador.cobertura_qx).toBe('NO');
    expect(r.estado_sugerido).toBe('VALORIZADO');
    expect(r.cotizacion).not.toBeNull();
  });

  it('VALORIZADO con cobertura DESCONOCIDA (CP fuera del canalizador)', () => {
    const ctx = contexto({
      proveedores: [proveedor('AAA')],
      reglas: [variante('AAA', '100')],
      canalizador: [canalizadorEntry(CP_ORIGEN, 'ORIGEN', 'BUENOS AIRES')],
    });
    const r = cotizar(pedido(), ctx);
    expect(r.canalizador.cobertura_qx).toBe('DESCONOCIDA');
    expect(r.observaciones).toEqual(['CP_NO_EN_CANALIZADOR']);
    expect(r.estado_sugerido).toBe('VALORIZADO');
  });

  it('SIN_COBERTURA: ninguna válida y sin cobertura QX, con los motivos', () => {
    const ctx = contexto({
      proveedores: [proveedor('AAA')],
      reglas: [regla({ id: 'X', tipo: 'PESO', min: '0', max: '1', precio: '5', proveedor: 'AAA' })],
    });
    const r = cotizar(pedido(), ctx);
    expect(r.estado_sugerido).toBe('SIN_COBERTURA');
    expect(r.cotizacion).toBeNull();
    expect(r.alternativas).toEqual([]);
    expect(r.descartes).toEqual([
      { id_proveedor: 'AAA', variante_id: '2000|ROSARIO|Z1', motivo: 'PESO_EXCEDIDO_SIN_REGLA' },
    ]);
  });

  it('SIN_COBERTURA sin ningún proveedor con tarifa para el CP', () => {
    const r = cotizar(pedido(), contexto({ proveedores: [proveedor('AAA')], reglas: [] }));
    expect(r.estado_sugerido).toBe('SIN_COBERTURA');
    expect(r.descartes).toEqual([]);
  });

  it('COBERTURA_QX con candidatas de expreso: la mejor queda como sugerencia', () => {
    const ctx = contexto({
      proveedores: [proveedor('AAA'), proveedor('BBB')],
      reglas: [variante('AAA', '200'), variante('BBB', '100')],
      subzonaDestino: 'SUB1',
    });
    const r = cotizar(pedido(), ctx);
    expect(r.canalizador.cobertura_qx).toBe('SI');
    expect(r.estado_sugerido).toBe('COBERTURA_QX');
    expect(r.cotizacion?.id_proveedor).toBe('BBB');
    expect(r.alternativas).toHaveLength(2);
    expectSchemas(r);
  });

  it('COBERTURA_QX sin candidatas de expreso', () => {
    const ctx = contexto({ proveedores: [proveedor('AAA')], reglas: [], subzonaDestino: 'SUB1' });
    const r = cotizar(pedido(), ctx);
    expect(r.estado_sugerido).toBe('COBERTURA_QX');
    expect(r.cotizacion).toBeNull();
    expect(r.alternativas).toEqual([]);
  });
});

describe('cotizar: determinismo (deuda H-4(a) de MVP-13)', () => {
  it('dos corridas y el orden inverso de la entrada dan el mismo resultado, con 2 proveedores y 2 variantes', () => {
    const proveedores = [
      proveedor('AAA', { iva_porcentaje: '21', aplica_seguro: true, porcentaje_seguro: '0.5' }),
      proveedor('BBB', { iva_porcentaje: '10.5' }),
    ];
    const reglas = [
      variante('AAA', '100', { zona: 'Z1', plazo: 2 }),
      variante('AAA', '120', { zona: 'Z2', plazo: 3 }),
      variante('BBB', '100', { zona: 'Z1', plazo: 2 }),
      variante('BBB', '90', { zona: 'Z2', plazo: 4 }),
      regla({
        id: 'BV',
        tipo: 'VOLUMEN',
        min: '0',
        max: '1',
        precio: '95',
        proveedor: 'BBB',
        plazo: 2,
      }),
    ];
    const p = pedido({ valor_declarado: 1234567 });
    const primera = cotizar(p, contexto({ proveedores, reglas }));
    const segunda = cotizar(p, contexto({ proveedores, reglas }));
    const invertida = cotizar(
      p,
      contexto({ proveedores: [...proveedores].reverse(), reglas: [...reglas].reverse() }),
    );
    expect(primera.alternativas).toHaveLength(4);
    expect(segunda).toEqual(primera);
    expect(invertida).toEqual(primera);
  });
});

describe('cotizar: detalle_tarifa', () => {
  it('incluye la base del viaje y formatea decimales y miles en es-AR', () => {
    const ctx = contexto({
      proveedores: [proveedor('AAA')],
      reglas: [
        regla({
          id: 'V',
          tipo: 'VOLUMEN',
          min: '0',
          max: '1.5',
          precio: '1234567.5',
          base: '10.25',
          excedente: '1000',
          proveedor: 'AAA',
        }),
      ],
    });
    const r = cotizar(pedido({ volumen_m3: '1.7501' }), ctx);
    expect(r.cotizacion?.detalle_tarifa).toBe(
      'VOLUMEN 0–1,5 m3: tramo $1.234.567,50 + excedente 0,2501 m3 × $1.000,00 + base $10,25',
    );
  });

  it('R7: empate a 0 sin reglas de peso describe el tramo de volumen', () => {
    const ctx = contexto({
      proveedores: [proveedor('AAA')],
      reglas: [
        regla({ id: 'V', tipo: 'VOLUMEN', min: '0', max: '1', precio: '0', proveedor: 'AAA' }),
      ],
    });
    expect(cotizar(pedido(), ctx).cotizacion).toMatchObject({
      criterio: 'VOLUMEN',
      regla_peso_id: null,
      regla_volumen_id: 'V',
      detalle_tarifa: 'VOLUMEN 0–1 m3: tramo $0,00',
    });
  });

  it('criterio sin tramo: con R7 no lo produce evaluateCandidate, pero tariffDetail lo informa', () => {
    const r = evaluateCandidate(
      {
        id_proveedor: 'AAA',
        variante_id: '2000|ROSARIO|Z1',
        tarifario_id: 'TAR_AAA',
        variante: { localidad: 'ROSARIO', zona: 'Z1', plazo_estimado_dias: null },
        reglas_peso: [],
        reglas_volumen: [regla({ id: 'V', tipo: 'VOLUMEN', min: '0', max: '1', precio: '0' })],
      },
      proveedor('AAA'),
      pedido(),
    );
    if (!r.valida) throw new Error('esperaba una candidata válida');
    expect(tariffDetail({ ...r.costo, criterio: 'PESO' })).toBe('PESO: sin tramo');
  });
});
