// Marcadores de uso privado para proteger la Ñ mientras se quitan los acentos (decisión: se conserva la Ñ).
const LOWER_N_TILDE = '';
const UPPER_N_TILDE = '';

// Mayúsculas, sin acentos (la Ñ se conserva), sin espacios sobrantes ni signos de puntuación finales.
export function norm(texto: string): string {
  const withoutAccents = texto
    .normalize('NFC')
    .replace(/ñ/g, LOWER_N_TILDE)
    .replace(/Ñ/g, UPPER_N_TILDE)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(new RegExp(LOWER_N_TILDE, 'g'), 'Ñ')
    .replace(new RegExp(UPPER_N_TILDE, 'g'), 'Ñ');
  return withoutAccents
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\p{P}\s]+$/u, '');
}

export interface NormProvinciaOptions {
  contraCanalizador: boolean;
}

// Alias de provincia de la arquitectura (§2): solo estos.
export function normProvincia(texto: string, options: NormProvinciaOptions): string {
  const normalized = norm(texto);
  if (normalized === 'RIOJA') return 'LA RIOJA';
  if (options.contraCanalizador && (normalized === 'CAPITAL FEDERAL' || normalized === 'CABA')) {
    return 'BUENOS AIRES';
  }
  return normalized;
}

// §2.3: `{cp}|{norm(localidad)}|{norm(zona)}`.
export function variantId(
  codigo_postal_destino: string,
  localidad_destino: string,
  zona_destino: string,
): string {
  return `${codigo_postal_destino}|${norm(localidad_destino)}|${norm(zona_destino)}`;
}
