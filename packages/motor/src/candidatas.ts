import type { MotorOrderInput, MotorContext, CandidateSelection, Candidate } from './types.js';
import { resolverDestinoYOrigen } from './destino.js';
import { normProvincia, norm } from '@sistema-redespachos/shared';

export function seleccionarCandidatas(
  pedido: MotorOrderInput,
  contexto: MotorContext,
): CandidateSelection {
  const paso1 = resolverDestinoYOrigen(pedido, contexto);

  const candidatasResult: Candidate[] = [];
  const observaciones = [...paso1.observaciones];

  const proveedoresActivos = new Set(
    contexto.proveedores.filter((p) => p.estado === 'ACTIVO').map((p) => p.id_proveedor),
  );

  const tarifariosValidos = new Map<string, string>();
  for (const t of contexto.tarifarios) {
    if (!proveedoresActivos.has(t.id_proveedor)) continue;
    if (t.estado !== 'VIGENTE' && t.estado !== 'HISTORICO') continue;

    if (t.vigencia_desde > contexto.fecha_referencia) continue;
    if (t.vigencia_hasta !== null && t.vigencia_hasta < contexto.fecha_referencia) continue;

    if (tarifariosValidos.has(t.id_proveedor)) {
      throw new Error(
        `Proveedor ${t.id_proveedor} tiene más de un tarifario vigente para la fecha ${contexto.fecha_referencia}`,
      );
    }
    tarifariosValidos.set(t.id_proveedor, t.id);
  }

  const reglasCP = contexto.reglas.filter(
    (r) =>
      r.codigo_postal_destino === pedido.cp_destino_norm &&
      tarifariosValidos.get(r.id_proveedor) === r.tarifario_id,
  );

  const variantesMap = new Map<string, typeof contexto.reglas>();
  for (const r of reglasCP) {
    const key = `${r.id_proveedor}|${r.variante_id}`;
    const arr = variantesMap.get(key) || [];
    arr.push(r);
    variantesMap.set(key, arr);
  }

  let variantesProcesadas = Array.from(variantesMap.values());
  if (variantesProcesadas.length > 0) {
    const coincidenProv = variantesProcesadas.filter(
      (grupo) =>
        normProvincia(grupo[0].provincia_destino, { contraCanalizador: true }) ===
        pedido.provincia_destino_norm,
    );
    if (coincidenProv.length > 0) {
      variantesProcesadas = coincidenProv;
    } else {
      observaciones.push('PROVINCIA_DIFIERE');
    }
  }

  for (const grupo of variantesProcesadas) {
    const varianteBase = grupo[0];

    const reglasPeso = grupo.filter((r) => r.tipo_regla === 'PESO');
    const reglasVolumen = grupo.filter((r) => r.tipo_regla === 'VOLUMEN');

    const filtrarPorPrecedencia = (reglas: typeof contexto.reglas) => {
      if (reglas.length === 0) return [];

      const conLocalidad = reglas.filter(
        (r) =>
          r.localidad_origen !== undefined &&
          paso1.localidad_origen !== undefined &&
          norm(r.localidad_origen) === paso1.localidad_origen &&
          normProvincia(r.provincia_origen, { contraCanalizador: true }) === paso1.provincia_origen,
      );
      if (conLocalidad.length > 0) return conLocalidad;

      const conProvincia = reglas.filter(
        (r) =>
          r.localidad_origen === undefined &&
          r.provincia_origen !== '*' &&
          paso1.provincia_origen !== undefined &&
          normProvincia(r.provincia_origen, { contraCanalizador: true }) === paso1.provincia_origen,
      );
      if (conProvincia.length > 0) return conProvincia;

      const conAsterisco = reglas.filter(
        (r) => r.provincia_origen === '*' && r.localidad_origen === undefined,
      );
      if (conAsterisco.length > 0) return conAsterisco;

      if (!contexto.origen_estricto && paso1.provincia_origen !== undefined) {
        const reglasOtrasProv = reglas.filter(
          (r) => r.provincia_origen !== '*' && r.localidad_origen === undefined,
        );
        const provinciasDistintas = new Set(
          reglasOtrasProv.map((r) =>
            normProvincia(r.provincia_origen, { contraCanalizador: true }),
          ),
        );
        if (provinciasDistintas.size === 1) {
          return reglasOtrasProv;
        }
      }

      return [];
    };

    const reglasPesoFiltradas = filtrarPorPrecedencia(reglasPeso);
    const reglasVolumenFiltradas = filtrarPorPrecedencia(reglasVolumen);

    candidatasResult.push({
      id_proveedor: varianteBase.id_proveedor,
      variante_id: varianteBase.variante_id,
      tarifario_id: varianteBase.tarifario_id,
      variante: {
        localidad: varianteBase.localidad_destino,
        zona: varianteBase.zona_destino,
        plazo_estimado_dias: varianteBase.plazo_estimado_dias ?? null,
      },
      reglas_peso: reglasPesoFiltradas,
      reglas_volumen: reglasVolumenFiltradas,
    });
  }

  return {
    canalizador: paso1.canalizador,
    provincia_origen: paso1.provincia_origen,
    localidad_origen: paso1.localidad_origen,
    observaciones,
    candidatas: candidatasResult,
  };
}
