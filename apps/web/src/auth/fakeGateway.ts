import type { AuthGateway, AuthUser } from './gateway';

// Auth simulado para los tests de componente: no toca Firebase.
export interface FakeGateway extends AuthGateway {
  calls: { signIn: number; signOut: number };
  /** Si no es null, signInWithGoogle rechaza con este error. */
  signInError: Error | null;
  /** La próxima lectura del claim queda pendiente hasta llamar a la función devuelta. */
  deferRoleClaim(): (rol: unknown) => void;
  /** Simula un cambio de sesión (login con Google o expiración). */
  emit(user: AuthUser | null, rol?: unknown): void;
}

export function fakeUser(email: string, emailVerified = true): AuthUser {
  return { uid: `uid-${email}`, email, emailVerified, displayName: null };
}

export function createFakeGateway(initialUser: AuthUser | null = null, rol?: unknown): FakeGateway {
  let user = initialUser;
  let claim = rol;
  let listener: ((user: AuthUser | null) => void) | undefined;
  let deferred: Promise<unknown> | null = null;

  const gateway: FakeGateway = {
    calls: { signIn: 0, signOut: 0 },
    signInError: null,
    deferRoleClaim() {
      let resolve!: (rol: unknown) => void;
      deferred = new Promise((r) => {
        resolve = r;
      });
      return resolve;
    },
    onAuthStateChanged(next) {
      listener = next;
      next(user);
      return () => {
        listener = undefined;
      };
    },
    async getRoleClaim() {
      if (deferred) {
        const pending = deferred;
        deferred = null;
        return pending;
      }
      return claim;
    },
    async signInWithGoogle() {
      gateway.calls.signIn++;
      if (gateway.signInError) throw gateway.signInError;
    },
    async signOut() {
      gateway.calls.signOut++;
      user = null;
      claim = undefined;
      listener?.(null);
    },
    emit(nextUser, nextRol) {
      user = nextUser;
      claim = nextRol;
      listener?.(nextUser);
    },
  };
  return gateway;
}
