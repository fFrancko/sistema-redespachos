import { describe, expect, it } from 'vitest';
import { norm, normProvincia, variantId } from './normalize.js';

describe('norm', () => {
  it.each([
    ['  Córdoba  ', 'CORDOBA'],
    ['Neuquén', 'NEUQUEN'],
    ['Tucumán,', 'TUCUMAN'],
    ['Santiago del Estero.', 'SANTIAGO DEL ESTERO'],
    ['buenos   aires', 'BUENOS AIRES'],
    ['Río Negro ;. ', 'RIO NEGRO'],
    ['Güemes', 'GUEMES'],
    ['  ', ''],
    ['', ''],
  ])('norm(%j) = %j', (input, expected) => {
    expect(norm(input)).toBe(expected);
  });

  it('conserva la Ñ (solo quita acentos)', () => {
    expect(norm('Ñandú')).toBe('ÑANDU');
    expect(norm('año')).toBe('AÑO');
    expect(norm('Cañuelas')).toBe('CAÑUELAS');
  });

  it('no quita puntuación interna', () => {
    expect(norm('Sta. Fe')).toBe('STA. FE');
  });

  it('es idempotente', () => {
    for (const input of ['Córdoba', 'Ñandú ', 'Capital   Federal.']) {
      expect(norm(norm(input))).toBe(norm(input));
    }
  });
});

describe('normProvincia', () => {
  it('RIOJA se unifica siempre', () => {
    expect(normProvincia('Rioja', { contraCanalizador: false })).toBe('LA RIOJA');
    expect(normProvincia('Rioja', { contraCanalizador: true })).toBe('LA RIOJA');
    expect(normProvincia('La Rioja', { contraCanalizador: false })).toBe('LA RIOJA');
  });

  it('CAPITAL FEDERAL y CABA solo se unifican contra el canalizador', () => {
    expect(normProvincia('Capital Federal', { contraCanalizador: true })).toBe('BUENOS AIRES');
    expect(normProvincia('CABA', { contraCanalizador: true })).toBe('BUENOS AIRES');
    expect(normProvincia('Capital Federal', { contraCanalizador: false })).toBe('CAPITAL FEDERAL');
    expect(normProvincia('CABA', { contraCanalizador: false })).toBe('CABA');
  });

  it('no inventa otros alias', () => {
    expect(normProvincia('Córdoba', { contraCanalizador: true })).toBe('CORDOBA');
    expect(normProvincia('Bs As', { contraCanalizador: true })).toBe('BS AS');
    expect(normProvincia('Tierra del Fuego', { contraCanalizador: true })).toBe('TIERRA DEL FUEGO');
  });
});

describe('variantId', () => {
  it('arma {cp}|{norm(localidad)}|{norm(zona)}', () => {
    expect(variantId('1406', 'Caballito ', 'Zona 1.')).toBe('1406|CABALLITO|ZONA 1');
  });

  it('dos grafías de la misma variante dan el mismo id', () => {
    expect(variantId('5000', 'Córdoba', 'Ramal  Norte')).toBe(
      variantId('5000', 'CORDOBA.', 'ramal norte'),
    );
  });
});
