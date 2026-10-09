import { describe, expect, it } from 'vitest';
import { accessListFromEnv, hostedDomain, isAllowed } from './accessList';

const verified = (email: string | null) => ({ email, emailVerified: true });

describe('accessListFromEnv', () => {
  it('separa por coma, recorta espacios, pasa a minúsculas y descarta vacíos', () => {
    const list = accessListFromEnv({
      VITE_ALLOWED_EMAILS: ' Ana.Perez@Gmail.com , ,juan@gmail.com,',
      VITE_ALLOWED_DOMAINS: ' @QXLogistica.com ',
    });
    expect(list).toEqual({
      emails: ['ana.perez@gmail.com', 'juan@gmail.com'],
      domains: ['qxlogistica.com'],
    });
  });

  it('sin variables devuelve listas vacías', () => {
    expect(accessListFromEnv({})).toEqual({ emails: [], domains: [] });
  });
});

describe('isAllowed', () => {
  const list = accessListFromEnv({
    VITE_ALLOWED_EMAILS: 'ana.perez@gmail.com',
    VITE_ALLOWED_DOMAINS: 'qxlogistica.com',
  });

  it('acepta un email de la lista aunque venga con mayúsculas y espacios', () => {
    expect(isAllowed(verified('  ANA.Perez@GMAIL.com '), list)).toBe(true);
  });

  it('rechaza un email que no está en la lista ni en un dominio permitido', () => {
    expect(isAllowed(verified('otra.persona@gmail.com'), list)).toBe(false);
  });

  it('acepta cualquier email del dominio exacto, sin distinguir mayúsculas', () => {
    expect(isAllowed(verified('Alguien@QXLOGISTICA.COM'), list)).toBe(true);
  });

  it('el dominio es exacto: no pasan sufijos, prefijos ni subdominios', () => {
    expect(isAllowed(verified('x@evilqxlogistica.com'), list)).toBe(false);
    expect(isAllowed(verified('x@qxlogistica.com.ar'), list)).toBe(false);
    expect(isAllowed(verified('x@mail.qxlogistica.com'), list)).toBe(false);
    expect(isAllowed(verified('x@qxlogistica.com@evil.com'), list)).toBe(false);
  });

  it('rechaza un email no verificado aunque esté en la lista o el dominio', () => {
    expect(isAllowed({ email: 'ana.perez@gmail.com', emailVerified: false }, list)).toBe(false);
    expect(isAllowed({ email: 'alguien@qxlogistica.com', emailVerified: false }, list)).toBe(false);
  });

  it('rechaza un usuario sin email', () => {
    expect(isAllowed(verified(null), list)).toBe(false);
  });

  it('con las dos listas vacías rechaza a todos', () => {
    const empty = accessListFromEnv({ VITE_ALLOWED_EMAILS: '', VITE_ALLOWED_DOMAINS: ' , ' });
    expect(isAllowed(verified('ana.perez@gmail.com'), empty)).toBe(false);
    expect(isAllowed(verified('alguien@qxlogistica.com'), empty)).toBe(false);
  });
});

describe('hostedDomain', () => {
  it('devuelve el dominio solo si hay exactamente uno', () => {
    expect(hostedDomain(accessListFromEnv({ VITE_ALLOWED_DOMAINS: 'qxlogistica.com' }))).toBe(
      'qxlogistica.com',
    );
    expect(hostedDomain(accessListFromEnv({ VITE_ALLOWED_DOMAINS: '' }))).toBeUndefined();
    expect(
      hostedDomain(accessListFromEnv({ VITE_ALLOWED_DOMAINS: 'a.com,b.com' })),
    ).toBeUndefined();
  });
});
