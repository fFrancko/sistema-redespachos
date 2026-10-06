import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { componentCost, evaluateCandidate, insuranceCost, roundToCent } from './calculo.js';
import type { CandidateCost } from './calculo.js';
import type { Candidate } from './types.js';
import { pedido, proveedor, regla } from '../test/fixtures/motor.js';
import type { ReglaOpts } from '../test/fixtures/motor.js';

function candidata(reglas: ReturnType<typeof regla>[]): Candidate {
  return {
    id_proveedor: 'PROV1',
    variante_id: reglas[0]?.variante_id ?? '2000|ROSARIO|Z1',
    tarifario_id: 'TAR_PROV1',
    variante: { localidad: 'ROSARIO', zona: 'Z1', plazo_estimado_dias: null },
    reglas_peso: reglas.filter((r) => r.tipo_regla === 'PESO'),
    reglas_volumen: reglas.filter((r) => r.tipo_regla === 'VOLUMEN'),
  };
}

function costo(
  reglas: ReglaOpts[],
  opts: { peso?: string; volumen?: string; valor?: number; prov?: Record<string, unknown> } = {},
): CandidateCost {
  const r = evaluateCandidate(
    candidata(reglas.map(regla)),
    proveedor('PROV1', opts.prov),
    pedido({
      peso_kgs: opts.peso ?? '5',
      volumen_m3: opts.volumen ?? '0.5',
      ...(opts.valor === undefined ? {} : { valor_declarado: opts.valor }),
    }),
  );
  if (!r.valida) throw new Error(`descartada: ${r.motivo}`);
  return r.costo;
}

// Exige que el monto ya venga redondeado a centavo: toFixed(2) solo no detectaría un faltante.
const pesos = (d: Decimal) => {
  expect(d.decimalPlaces()).toBeLessThanOrEqual(2);
  return d.toFixed(2);
};

describe('Pasos 4 y 5: evaluateCandidate', () => {
  it('roundToCent es half-up: …,xx5 sube y …,xx49 baja', () => {
    expect(pesos(roundToCent(new Decimal('1.005')))).toBe('1.01');
    expect(pesos(roundToCent(new Decimal('1.0049')))).toBe('1.00');
  });

  it('costo_peso redondea half-up en el borde', () => {
    const sube = costo([{ id: 'P', tipo: 'PESO', min: '0', max: '10', precio: '100.005' }]);
    const baja = costo([{ id: 'P', tipo: 'PESO', min: '0', max: '10', precio: '100.0049' }]);
    expect(pesos(sube.costo_peso)).toBe('100.01');
    expect(pesos(baja.costo_peso)).toBe('100.00');
  });

  it('costo_volumen redondea half-up en el borde', () => {
    const sube = costo([{ id: 'V', tipo: 'VOLUMEN', min: '0', max: '1', precio: '100.005' }]);
    const baja = costo([{ id: 'V', tipo: 'VOLUMEN', min: '0', max: '1', precio: '100.0049' }]);
    expect(pesos(sube.costo_volumen)).toBe('100.01');
    expect(pesos(baja.costo_volumen)).toBe('100.00');
  });

  it('seguro redondea half-up en el borde (valor_declarado × % / 100)', () => {
    const prov = { aplica_seguro: true, porcentaje_seguro: '0.5' };
    const tramo: ReglaOpts = { id: 'P', tipo: 'PESO', min: '0', max: '10', precio: '1' };
    // $1,00 × 0,5 % = 0,005 → 0,01; $0,98 × 0,5 % = 0,0049 → 0,00
    expect(pesos(costo([tramo], { valor: 100, prov }).seguro)).toBe('0.01');
    expect(pesos(costo([tramo], { valor: 98, prov }).seguro)).toBe('0.00');
  });

  it('iva redondea half-up en el borde (neto × % / 100)', () => {
    const tramo: ReglaOpts = { id: 'P', tipo: 'PESO', min: '0', max: '10', precio: '1' };
    // neto $1,00: 0,5 % = 0,005 → 0,01; 0,49 % = 0,0049 → 0,00
    expect(pesos(costo([tramo], { prov: { iva_porcentaje: '0.5' } }).iva)).toBe('0.01');
    expect(pesos(costo([tramo], { prov: { iva_porcentaje: '0.49' } }).iva)).toBe('0.00');
  });

  it('la colecta (dec de 4 decimales) redondea half-up a centavo (PREGUNTA 1)', () => {
    const conColecta = (colecta: string) =>
      costo([{ id: 'P', tipo: 'PESO', min: '0', max: '10', precio: '1', colecta }]).colecta;
    expect(pesos(conColecta('320.835'))).toBe('320.84');
    expect(pesos(conColecta('320.8349'))).toBe('320.83');
  });

  it('el excedente se suma sin redondear y costo_peso se redondea una sola vez (PREGUNTA 3)', () => {
    // 10,0025 + 0,0001 kg × 25 = 10,005 → 10,01. Redondeando cada término daría 10,00.
    const c = costo(
      [{ id: 'P', tipo: 'PESO', min: '0', max: '10', precio: '10.0025', excedente: '25' }],
      { peso: '10.0001' },
    );
    expect(pesos(c.costo_peso)).toBe('10.01');
  });

  it('costo_base_viaje entra en costo_peso y en costo_volumen', () => {
    const c = costo([
      { id: 'P', tipo: 'PESO', min: '0', max: '10', precio: '100', base: '10' },
      { id: 'V', tipo: 'VOLUMEN', min: '0', max: '1', precio: '50', base: '70.5' },
    ]);
    expect(pesos(c.costo_peso)).toBe('110.00');
    expect(pesos(c.costo_volumen)).toBe('120.50');
    expect(c.criterio).toBe('VOLUMEN');
    expect(pesos(c.flete)).toBe('120.50');
  });

  it('criterio PESO si costo_peso ≥ costo_volumen (empate → PESO)', () => {
    const c = costo([
      { id: 'P', tipo: 'PESO', min: '0', max: '10', precio: '100' },
      { id: 'V', tipo: 'VOLUMEN', min: '0', max: '1', precio: '100' },
    ]);
    expect(c.criterio).toBe('PESO');
  });

  it('D7: la colecta sale solo de la regla del criterio ganador', () => {
    const ganaPeso = costo([
      { id: 'P', tipo: 'PESO', min: '0', max: '10', precio: '300', colecta: '11' },
      { id: 'V', tipo: 'VOLUMEN', min: '0', max: '1', precio: '200', colecta: '22' },
    ]);
    expect(ganaPeso.criterio).toBe('PESO');
    expect(pesos(ganaPeso.colecta)).toBe('11.00');

    const ganaVolumenSinColecta = costo([
      { id: 'P', tipo: 'PESO', min: '0', max: '10', precio: '100', colecta: '11' },
      { id: 'V', tipo: 'VOLUMEN', min: '0', max: '1', precio: '200' },
    ]);
    expect(ganaVolumenSinColecta.criterio).toBe('VOLUMEN');
    expect(pesos(ganaVolumenSinColecta.colecta)).toBe('0.00');
  });

  it('un tipo sin reglas aporta 0; con costo_volumen 0 el ≥ literal da PESO sin tramo (decisión 7)', () => {
    const soloVolumen = costo([{ id: 'V', tipo: 'VOLUMEN', min: '0', max: '1', precio: '80' }]);
    expect(pesos(soloVolumen.costo_peso)).toBe('0.00');
    expect(soloVolumen.criterio).toBe('VOLUMEN');

    const volumenCero = costo([
      { id: 'V', tipo: 'VOLUMEN', min: '0', max: '1', precio: '0', colecta: '50' },
    ]);
    expect(volumenCero.criterio).toBe('PESO');
    expect(volumenCero.tramo_peso).toBeNull();
    expect(pesos(volumenCero.colecta)).toBe('0.00');
    expect(pesos(volumenCero.total)).toBe('0.00');
  });

  it('D8: sin aplica_seguro, o sin valor declarado, el seguro es 0; valor 0 da 0', () => {
    const tramo: ReglaOpts = { id: 'P', tipo: 'PESO', min: '0', max: '10', precio: '1' };
    expect(pesos(costo([tramo], { valor: 10000000 }).seguro)).toBe('0.00');
    const prov = { aplica_seguro: true, porcentaje_seguro: '1' };
    expect(pesos(costo([tramo], { prov }).seguro)).toBe('0.00');
    expect(pesos(costo([tramo], { valor: 0, prov }).seguro)).toBe('0.00');
    expect(pesos(costo([tramo], { valor: 10000000, prov }).seguro)).toBe('1000.00');
  });

  it('neto = flete + colecta + seguro; total = neto + iva', () => {
    const c = costo(
      [{ id: 'P', tipo: 'PESO', min: '0', max: '10', precio: '1000', colecta: '100' }],
      {
        valor: 5000000,
        prov: { iva_porcentaje: '10.5', aplica_seguro: true, porcentaje_seguro: '2' },
      },
    );
    expect(pesos(c.neto)).toBe('2100.00');
    expect(pesos(c.iva)).toBe('220.50');
    expect(pesos(c.total)).toBe('2320.50');
  });

  it('sin reglas de ningún tipo descarta con SIN_TARIFA; propaga el descarte del tramo', () => {
    const prov = proveedor('PROV1');
    expect(evaluateCandidate(candidata([]), prov, pedido())).toEqual({
      valida: false,
      motivo: 'SIN_TARIFA',
    });
    const soloVolumen = candidata([
      regla({ id: 'V', tipo: 'VOLUMEN', min: '0', max: '0.1', precio: '1' }),
    ]);
    expect(evaluateCandidate(soloVolumen, prov, pedido({ volumen_m3: '0.2' }))).toEqual({
      valida: false,
      motivo: 'VOLUMEN_EXCEDIDO_SIN_REGLA',
    });
    // Peso y volumen excedidos sin precio: el motivo es el de peso, que se evalúa primero.
    const ambos = candidata([
      regla({ id: 'P', tipo: 'PESO', min: '0', max: '1', precio: '1' }),
      regla({ id: 'V', tipo: 'VOLUMEN', min: '0', max: '0.1', precio: '1' }),
    ]);
    expect(evaluateCandidate(ambos, prov, pedido({ peso_kgs: '2', volumen_m3: '0.2' }))).toEqual({
      valida: false,
      motivo: 'PESO_EXCEDIDO_SIN_REGLA',
    });
  });

  it('componentCost(null) es 0 e insuranceCost exige porcentaje_seguro si aplica_seguro', () => {
    expect(pesos(componentCost(null))).toBe('0.00');
    const invalido = { ...proveedor('PROV1'), aplica_seguro: true };
    expect(() => insuranceCost(invalido, 100)).toThrow();
  });
});
