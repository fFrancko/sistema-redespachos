import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { selectBracket } from './tramos.js';
import { regla } from '../test/fixtures/motor.js';

const peso = [
  regla({ id: 'P1', tipo: 'PESO', min: '0', max: '10', precio: '100' }),
  regla({ id: 'P2', tipo: 'PESO', min: '10', max: '50', precio: '200', excedente: '3' }),
];
const volumen = [
  regla({ id: 'V1', tipo: 'VOLUMEN', min: '0', max: '0.5', precio: '100' }),
  regla({ id: 'V2', tipo: 'VOLUMEN', min: '0.5', max: '2', precio: '200', excedente: '7' }),
];

function elegido(reglas: typeof peso, valor: string, tipo: 'PESO' | 'VOLUMEN') {
  const r = selectBracket(reglas, new Decimal(valor), tipo);
  if (r.tipo !== 'TRAMO') throw new Error(`esperaba TRAMO y vino ${JSON.stringify(r)}`);
  return { id: r.regla.id, excedente: r.excedente.toFixed(), precio: r.precio_excedente.toFixed() };
}

describe('Paso 3: selectBracket', () => {
  it('10 kg cae en (0, 10] y no en (10, 50]; 10.0001 kg cae en (10, 50]', () => {
    expect(elegido(peso, '10', 'PESO').id).toBe('P1');
    expect(elegido(peso, '10.0001', 'PESO').id).toBe('P2');
    expect(elegido(peso, '0.0001', 'PESO').id).toBe('P1');
  });

  it('el borde de volumen es (min, max]', () => {
    expect(elegido(volumen, '0.5', 'VOLUMEN').id).toBe('V1');
    expect(elegido(volumen, '0.5001', 'VOLUMEN').id).toBe('V2');
  });

  it('igual al tope del último tramo no cobra excedente; tope + 0.0001 sí', () => {
    expect(elegido(peso, '50', 'PESO')).toEqual({ id: 'P2', excedente: '0', precio: '0' });
    expect(elegido(peso, '50.0001', 'PESO')).toEqual({
      id: 'P2',
      excedente: '0.0001',
      precio: '3',
    });
    expect(elegido(volumen, '2', 'VOLUMEN')).toEqual({ id: 'V2', excedente: '0', precio: '0' });
    expect(elegido(volumen, '2.0001', 'VOLUMEN')).toEqual({
      id: 'V2',
      excedente: '0.0001',
      precio: '7',
    });
  });

  it('el último tramo es el de mayor tope, sin importar el orden de las reglas', () => {
    expect(elegido([...peso].reverse(), '60', 'PESO')).toEqual({
      id: 'P2',
      excedente: '10',
      precio: '3',
    });
  });

  it('sin precio de excedente descarta con el motivo de su tipo', () => {
    const pesoSinExc = [regla({ id: 'P1', tipo: 'PESO', min: '0', max: '10', precio: '1' })];
    const volSinExc = [regla({ id: 'V1', tipo: 'VOLUMEN', min: '0', max: '1', precio: '1' })];
    expect(selectBracket(pesoSinExc, new Decimal('10.0001'), 'PESO')).toEqual({
      tipo: 'DESCARTE',
      motivo: 'PESO_EXCEDIDO_SIN_REGLA',
    });
    expect(selectBracket(volSinExc, new Decimal('1.0001'), 'VOLUMEN')).toEqual({
      tipo: 'DESCARTE',
      motivo: 'VOLUMEN_EXCEDIDO_SIN_REGLA',
    });
  });

  it('sin reglas del tipo devuelve SIN_REGLAS (aporta 0)', () => {
    expect(selectBracket([], new Decimal('5'), 'PESO')).toEqual({ tipo: 'SIN_REGLAS' });
  });

  it('datos fuera de D3 (hueco, solapamiento, dos últimos tramos) descartan con SIN_TARIFA', () => {
    const hueco = [
      regla({ id: 'P1', tipo: 'PESO', min: '0', max: '10', precio: '1' }),
      regla({ id: 'P2', tipo: 'PESO', min: '20', max: '30', precio: '2', excedente: '1' }),
    ];
    expect(selectBracket(hueco, new Decimal('15'), 'PESO')).toEqual({
      tipo: 'DESCARTE',
      motivo: 'SIN_TARIFA',
    });

    const solapados = [
      regla({ id: 'P1', tipo: 'PESO', min: '0', max: '20', precio: '1' }),
      regla({ id: 'P2', tipo: 'PESO', min: '10', max: '30', precio: '2' }),
    ];
    expect(selectBracket(solapados, new Decimal('15'), 'PESO')).toEqual({
      tipo: 'DESCARTE',
      motivo: 'SIN_TARIFA',
    });

    const dosUltimos = [
      regla({ id: 'P1', tipo: 'PESO', min: '0', max: '30', precio: '1', excedente: '1' }),
      regla({ id: 'P2', tipo: 'PESO', min: '10', max: '30', precio: '2', excedente: '1' }),
    ];
    expect(selectBracket(dosUltimos, new Decimal('40'), 'PESO')).toEqual({
      tipo: 'DESCARTE',
      motivo: 'SIN_TARIFA',
    });
  });
});
