import type { CandidateCost } from './calculo.js';

// Comparación por código de carácter, independiente del locale: el orden es determinístico.
export function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

// D11: total ascendente; empate por menor id_proveedor y luego menor variante_id.
export function compareCandidates(a: CandidateCost, b: CandidateCost): number {
  return (
    a.total.comparedTo(b.total) ||
    compareText(a.candidata.id_proveedor, b.candidata.id_proveedor) ||
    compareText(a.candidata.variante_id, b.candidata.variante_id)
  );
}

export function rankCandidates(validas: CandidateCost[]): CandidateCost[] {
  return [...validas].sort(compareCandidates);
}

// CP_AMBIGUO (respuesta de Franco a las PREGUNTAS 2 y 4): un mismo proveedor tiene dos o más
// variantes válidas con total o plazo distintos. Variantes de proveedores distintos no cuentan.
export function isAmbiguousCp(validas: CandidateCost[]): boolean {
  const porProveedor = new Map<string, Set<string>>();
  for (const c of validas) {
    const clave = `${c.total.toFixed(2)}|${c.candidata.variante.plazo_estimado_dias ?? '-'}`;
    const claves = porProveedor.get(c.candidata.id_proveedor) ?? new Set<string>();
    claves.add(clave);
    porProveedor.set(c.candidata.id_proveedor, claves);
  }
  return [...porProveedor.values()].some((claves) => claves.size > 1);
}
