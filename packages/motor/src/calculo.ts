import { Decimal } from 'decimal.js';
import { centsToDecimal, decToDecimal } from '@sistema-redespachos/shared';
import type { Criterion, DiscardReason, Supplier } from '@sistema-redespachos/shared';
import type { Candidate, MotorQuoteInput } from './types.js';
import { selectBracket } from './tramos.js';
import type { SelectedBracket } from './tramos.js';

// Montos en pesos, ya redondeados a centavo. Pasan a `cents` al armar la salida.
export type CandidateCost = {
  candidata: Candidate;
  proveedor: Supplier;
  tramo_peso: SelectedBracket | null;
  tramo_volumen: SelectedBracket | null;
  criterio: Criterion;
  costo_peso: Decimal;
  costo_volumen: Decimal;
  flete: Decimal;
  colecta: Decimal;
  seguro: Decimal;
  neto: Decimal;
  iva: Decimal;
  total: Decimal;
};

export type CandidateEvaluation =
  { valida: true; costo: CandidateCost } | { valida: false; motivo: DiscardReason };

// Half-up a centavo (§3.3 paso 4). Los montos son no negativos.
export function roundToCent(pesos: Decimal): Decimal {
  return pesos.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

// costo = costo_base_viaje + precio_tramo + excedente × precio_excedente, redondeado una sola vez.
export function componentCost(tramo: SelectedBracket | null): Decimal {
  if (tramo === null) return new Decimal(0);
  const { regla, excedente, precio_excedente } = tramo;
  return roundToCent(
    decToDecimal(regla.costo_base_viaje)
      .plus(decToDecimal(regla.precio_tramo))
      .plus(excedente.times(precio_excedente)),
  );
}

// D8: si el proveedor aplica seguro y hay valor declarado; sin valor declarado, 0.
export function insuranceCost(
  proveedor: Supplier,
  valorDeclarado: MotorQuoteInput['valor_declarado'],
): Decimal {
  if (!proveedor.aplica_seguro || valorDeclarado === undefined) return new Decimal(0);
  // `supplierSchema` exige porcentaje_seguro si aplica_seguro: decToDecimal falla si falta.
  const porcentaje = decToDecimal(proveedor.porcentaje_seguro ?? '');
  return roundToCent(centsToDecimal(valorDeclarado).times(porcentaje).div(100));
}

// D7: la colecta sale de la regla del tramo del criterio ganador, si tiene aplica_colecta.
export function collectionCost(tramo: SelectedBracket | null): Decimal {
  if (tramo === null || !tramo.regla.aplica_colecta) return new Decimal(0);
  // `tariffRuleSchema` exige costo_colecta si aplica_colecta: decToDecimal falla si falta.
  return roundToCent(decToDecimal(tramo.regla.costo_colecta ?? ''));
}

// §3.3 pasos 3 a 5 para una candidata (proveedor, variante).
export function evaluateCandidate(
  candidata: Candidate,
  proveedor: Supplier,
  pedido: MotorQuoteInput,
): CandidateEvaluation {
  if (candidata.reglas_peso.length === 0 && candidata.reglas_volumen.length === 0) {
    return { valida: false, motivo: 'SIN_TARIFA' };
  }

  const peso = selectBracket(candidata.reglas_peso, decToDecimal(pedido.peso_kgs), 'PESO');
  if (peso.tipo === 'DESCARTE') return { valida: false, motivo: peso.motivo };
  const volumen = selectBracket(
    candidata.reglas_volumen,
    decToDecimal(pedido.volumen_m3),
    'VOLUMEN',
  );
  if (volumen.tipo === 'DESCARTE') return { valida: false, motivo: volumen.motivo };

  const tramo_peso = peso.tipo === 'TRAMO' ? peso : null;
  const tramo_volumen = volumen.tipo === 'TRAMO' ? volumen : null;

  const costo_peso = componentCost(tramo_peso);
  const costo_volumen = componentCost(tramo_volumen);
  const criterio: Criterion = costo_peso.gte(costo_volumen) ? 'PESO' : 'VOLUMEN';
  const flete = Decimal.max(costo_peso, costo_volumen);
  const colecta = collectionCost(criterio === 'PESO' ? tramo_peso : tramo_volumen);
  const seguro = insuranceCost(proveedor, pedido.valor_declarado);
  const neto = flete.plus(colecta).plus(seguro);
  const iva = roundToCent(neto.times(decToDecimal(proveedor.iva_porcentaje)).div(100));
  const total = neto.plus(iva);

  return {
    valida: true,
    costo: {
      candidata,
      proveedor,
      tramo_peso,
      tramo_volumen,
      criterio,
      costo_peso,
      costo_volumen,
      flete,
      colecta,
      seguro,
      neto,
      iva,
      total,
    },
  };
}
