import { decimalToCents } from '@sistema-redespachos/shared';
import type {
  ObservationCode,
  QuoteAlternative,
  QuoteDiscard,
  Supplier,
} from '@sistema-redespachos/shared';
import { seleccionarCandidatas } from './candidatas.js';
import { evaluateCandidate } from './calculo.js';
import type { CandidateCost } from './calculo.js';
import { compareText, isAmbiguousCp, rankCandidates } from './ranking.js';
import { tariffDetail } from './formato.js';
import type {
  MotorContext,
  MotorQuote,
  MotorQuoteInput,
  QuoteResult,
  SuggestedStatus,
} from './types.js';

export const MOTOR_VERSION = '1.0.0';

// §2.4: `alternativas` guarda como máximo 20 opciones.
export const MAX_ALTERNATIVAS = 20;

function toQuote(costo: CandidateCost, fecha_referencia: string): MotorQuote {
  const { candidata } = costo;
  return {
    id_proveedor: candidata.id_proveedor,
    tarifario_id: candidata.tarifario_id,
    variante_id: candidata.variante_id,
    variante: candidata.variante,
    regla_peso_id: costo.tramo_peso?.regla.id ?? null,
    regla_volumen_id: costo.tramo_volumen?.regla.id ?? null,
    criterio: costo.criterio,
    detalle_tarifa: tariffDetail(costo),
    costo_peso: decimalToCents(costo.costo_peso),
    costo_volumen: decimalToCents(costo.costo_volumen),
    flete: decimalToCents(costo.flete),
    colecta: decimalToCents(costo.colecta),
    seguro: decimalToCents(costo.seguro),
    neto: decimalToCents(costo.neto),
    iva_porcentaje: costo.proveedor.iva_porcentaje,
    iva: decimalToCents(costo.iva),
    total: decimalToCents(costo.total),
    fecha_referencia,
    motor_version: MOTOR_VERSION,
  };
}

function toAlternative(costo: CandidateCost): QuoteAlternative {
  return {
    id_proveedor: costo.candidata.id_proveedor,
    variante_id: costo.candidata.variante_id,
    variante: costo.candidata.variante,
    criterio: costo.criterio,
    neto: decimalToCents(costo.neto),
    total: decimalToCents(costo.total),
  };
}

function compareDiscards(a: QuoteDiscard, b: QuoteDiscard): number {
  return (
    compareText(a.id_proveedor, b.id_proveedor) ||
    compareText(a.variante_id ?? '', b.variante_id ?? '')
  );
}

function suggestedStatus(
  cobertura: QuoteResult['canalizador']['cobertura_qx'],
  validas: number,
): SuggestedStatus {
  if (cobertura === 'SI') return 'COBERTURA_QX';
  return validas > 0 ? 'VALORIZADO' : 'SIN_COBERTURA';
}

// §3.3: función pura. No lee el reloj ni escribe; devuelve el estado sugerido (paso 7).
export function cotizar(pedido: MotorQuoteInput, contexto: MotorContext): QuoteResult {
  const { candidatas, ...seleccion } = seleccionarCandidatas(pedido, contexto);
  const proveedores = new Map<string, Supplier>(
    contexto.proveedores.map((p) => [p.id_proveedor, p]),
  );

  const validas: CandidateCost[] = [];
  const descartes: QuoteDiscard[] = [];
  let algunoAplicaSeguro = false;
  for (const candidata of candidatas) {
    // seleccionarCandidatas solo devuelve proveedores del contexto.
    const proveedor = proveedores.get(candidata.id_proveedor) as Supplier;
    algunoAplicaSeguro ||= proveedor.aplica_seguro;
    const evaluacion = evaluateCandidate(candidata, proveedor, pedido);
    if (evaluacion.valida) {
      validas.push(evaluacion.costo);
    } else {
      descartes.push({
        id_proveedor: candidata.id_proveedor,
        variante_id: candidata.variante_id,
        motivo: evaluacion.motivo,
      });
    }
  }

  const ranking = rankCandidates(validas);

  const observaciones: ObservationCode[] = [...seleccion.observaciones];
  // D8 y alcance del ticket: falta el valor declarado y algún proveedor candidato aplica seguro.
  if (pedido.valor_declarado === undefined && algunoAplicaSeguro) {
    observaciones.push('VALOR_DECLARADO_FALTANTE');
  }
  if (isAmbiguousCp(ranking)) observaciones.push('CP_AMBIGUO');

  return {
    ...seleccion,
    observaciones,
    estado_sugerido: suggestedStatus(seleccion.canalizador.cobertura_qx, ranking.length),
    cotizacion: ranking.length > 0 ? toQuote(ranking[0], contexto.fecha_referencia) : null,
    alternativas: ranking.slice(0, MAX_ALTERNATIVAS).map(toAlternative),
    descartes: descartes.sort(compareDiscards),
  };
}
