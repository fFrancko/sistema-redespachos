import type { Decimal } from 'decimal.js';
import { decToDecimal } from '@sistema-redespachos/shared';
import type { RuleType } from '@sistema-redespachos/shared';
import type { CandidateCost } from './calculo.js';
import { bracketLimits } from './tramos.js';
import type { SelectedBracket } from './tramos.js';

const UNIDAD: Record<RuleType, string> = { PESO: 'kg', VOLUMEN: 'm3' };

// Formato es-AR: punto de miles y coma decimal. `fijo` = cantidad de decimales; sin él, los del valor.
export function formatDecimal(valor: Decimal, fijo?: number): string {
  const texto = fijo === undefined ? valor.toFixed() : valor.toFixed(fijo);
  const [entero, decimales] = texto.split('.');
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimales === undefined ? conMiles : `${conMiles},${decimales}`;
}

export function formatMoney(pesos: Decimal): string {
  return `$${formatDecimal(pesos, 2)}`;
}

function bracketDetail(criterio: RuleType, tramo: SelectedBracket): string {
  const unidad = UNIDAD[criterio];
  const { min, max } = bracketLimits(tramo.regla);
  const precioTramo = formatMoney(decToDecimal(tramo.regla.precio_tramo));
  const partes = [
    `${criterio} ${formatDecimal(min)}–${formatDecimal(max)} ${unidad}: tramo ${precioTramo}`,
  ];
  if (tramo.excedente.gt(0)) {
    partes.push(
      `excedente ${formatDecimal(tramo.excedente)} ${unidad} × ${formatMoney(tramo.precio_excedente)}`,
    );
  }
  const base = decToDecimal(tramo.regla.costo_base_viaje);
  if (base.gt(0)) partes.push(`base ${formatMoney(base)}`);
  return partes.join(' + ');
}

// `detalle_tarifa` (§2.4): la regla del criterio ganador, legible para la proforma.
// Ej.: `PESO 10–50 kg: tramo $1.600,00`. Colecta, seguro e IVA tienen su propio campo.
export function tariffDetail(costo: CandidateCost): string {
  const tramo = costo.criterio === 'PESO' ? costo.tramo_peso : costo.tramo_volumen;
  if (tramo === null) return `${costo.criterio}: sin tramo`;
  return bracketDetail(costo.criterio, tramo);
}
