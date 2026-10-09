// Lista de acceso de la app (§3.1). Mientras QX no tenga Google Workspace se usa solo la lista
// de emails; cuando exista el dominio se carga en VITE_ALLOWED_DOMAINS sin cambiar el código.
// Es un filtro de la UI: la verificación en backend llega en MVP-08.

export interface AccessList {
  emails: readonly string[];
  domains: readonly string[];
}

export interface AccessCandidate {
  email: string | null;
  emailVerified: boolean;
}

interface AccessEnv {
  VITE_ALLOWED_EMAILS?: string;
  VITE_ALLOWED_DOMAINS?: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function parseList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map(normalize)
    .filter((item) => item !== '');
}

export function accessListFromEnv(env: AccessEnv): AccessList {
  return {
    emails: parseList(env.VITE_ALLOWED_EMAILS),
    domains: parseList(env.VITE_ALLOWED_DOMAINS).map((domain) => domain.replace(/^@/, '')),
  };
}

// Con las dos listas vacías no entra nadie.
export function isAllowed(candidate: AccessCandidate, list: AccessList): boolean {
  if (!candidate.emailVerified || !candidate.email) return false;
  const email = normalize(candidate.email);
  if (list.emails.includes(email)) return true;
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  return list.domains.includes(email.slice(at + 1));
}

// Google acepta un solo dominio en `hd`: con varios configurados no se envía.
export function hostedDomain(list: AccessList): string | undefined {
  return list.domains.length === 1 ? list.domains[0] : undefined;
}
