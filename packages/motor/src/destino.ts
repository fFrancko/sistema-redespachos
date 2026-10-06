import { norm, normProvincia } from '@sistema-redespachos/shared';
import type { MotorOrderInput, MotorContext, CandidateSelection } from './types.js';

export function resolverDestinoYOrigen(
  pedido: MotorOrderInput,
  contexto: Pick<MotorContext, 'canalizador'>,
): Pick<
  CandidateSelection,
  'canalizador' | 'provincia_origen' | 'localidad_origen' | 'observaciones'
> {
  const observaciones: CandidateSelection['observaciones'] = [];

  let canalizadorResult: CandidateSelection['canalizador'] = {
    zona: null,
    cabecera: null,
    subzona: null,
    zona_tarifario: null,
    cobertura_qx: 'DESCONOCIDA',
  };

  const entriesDestino = contexto.canalizador.filter((e) => e.cp === pedido.cp_destino_norm);

  if (entriesDestino.length === 0) {
    observaciones.push('CP_NO_EN_CANALIZADOR');
  } else {
    let match = entriesDestino.find(
      (e) =>
        norm(e.localidad) === pedido.localidad_destino_norm &&
        normProvincia(e.provincia, { contraCanalizador: true }) === pedido.provincia_destino_norm,
    );

    if (!match) {
      if (entriesDestino.length === 1) {
        match = entriesDestino[0];
      } else {
        const matchesProv = entriesDestino.filter(
          (e) =>
            normProvincia(e.provincia, { contraCanalizador: true }) ===
            pedido.provincia_destino_norm,
        );
        if (matchesProv.length === 1) {
          match = matchesProv[0];
        }
      }
    }

    if (match) {
      canalizadorResult = {
        zona: match.zona,
        cabecera: match.cabecera,
        subzona: match.subzona,
        zona_tarifario: match.zona_tarifario,
        cobertura_qx: match.cobertura_qx ? 'SI' : 'NO',
      };
    }
  }

  let provincia_origen: string | undefined;
  let localidad_origen: string | undefined;

  const entriesOrigen = contexto.canalizador.filter((e) => e.cp === pedido.codigo_postal_origen);
  if (entriesOrigen.length === 0) {
    if (!observaciones.includes('CP_NO_EN_CANALIZADOR')) {
      observaciones.push('CP_NO_EN_CANALIZADOR');
    }
  } else {
    const originEntry = entriesOrigen[0];
    provincia_origen = normProvincia(originEntry.provincia, { contraCanalizador: true });
    localidad_origen = norm(originEntry.localidad);
  }

  return {
    canalizador: canalizadorResult,
    provincia_origen,
    localidad_origen,
    observaciones,
  };
}
