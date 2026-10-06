import { Decimal } from 'decimal.js';
import { decToDecimal } from '@sistema-redespachos/shared';
import type { DiscardReason, RuleType } from '@sistema-redespachos/shared';
import type { Candidate } from './types.js';

export type Rule = Candidate['reglas_peso'][number];

export type SelectedBracket = {
  regla: Rule;
  // Magnitud sobre el tope del último tramo (kg o m3); 0 si el valor cae dentro de un tramo.
  excedente: Decimal;
  precio_excedente: Decimal;
};

export type BracketResult =
  | { tipo: 'SIN_REGLAS' }
  | ({ tipo: 'TRAMO' } & SelectedBracket)
  | { tipo: 'DESCARTE'; motivo: DiscardReason };

// `tariffRuleSchema` exige los límites del tipo de la regla: decToDecimal falla si faltan.
export function bracketLimits(regla: Rule): { min: Decimal; max: Decimal } {
  return regla.tipo_regla === 'PESO'
    ? { min: decToDecimal(regla.kg_min ?? ''), max: decToDecimal(regla.kg_max ?? '') }
    : { min: decToDecimal(regla.m3_min ?? ''), max: decToDecimal(regla.m3_max ?? '') };
}

const EXCEEDED_REASON: Record<RuleType, DiscardReason> = {
  PESO: 'PESO_EXCEDIDO_SIN_REGLA',
  VOLUMEN: 'VOLUMEN_EXCEDIDO_SIN_REGLA',
};

// §3.3 paso 3: tramo (min, max] que contiene el valor; sobre el último, el último más el excedente.
// Con datos que D3 no admite (hueco o tramos solapados) no hay un único tramo: se descarta.
export function selectBracket(reglas: Rule[], valor: Decimal, tipo: RuleType): BracketResult {
  if (reglas.length === 0) return { tipo: 'SIN_REGLAS' };

  const conLimites = reglas.map((regla) => ({ regla, ...bracketLimits(regla) }));

  const contienen = conLimites.filter((t) => valor.gt(t.min) && valor.lte(t.max));
  if (contienen.length === 1) {
    return {
      tipo: 'TRAMO',
      regla: contienen[0].regla,
      excedente: new Decimal(0),
      precio_excedente: new Decimal(0),
    };
  }
  if (contienen.length > 1) return { tipo: 'DESCARTE', motivo: 'SIN_TARIFA' };

  const tope = Decimal.max(...conLimites.map((t) => t.max));
  if (!valor.gt(tope)) return { tipo: 'DESCARTE', motivo: 'SIN_TARIFA' };

  const ultimos = conLimites.filter((t) => t.max.eq(tope));
  if (ultimos.length > 1) return { tipo: 'DESCARTE', motivo: 'SIN_TARIFA' };

  const ultimo = ultimos[0].regla;
  const precio = tipo === 'PESO' ? ultimo.precio_kg_excedente : ultimo.precio_m3_excedente;
  if (precio === undefined) return { tipo: 'DESCARTE', motivo: EXCEEDED_REASON[tipo] };

  return {
    tipo: 'TRAMO',
    regla: ultimo,
    excedente: valor.minus(tope),
    precio_excedente: decToDecimal(precio),
  };
}
