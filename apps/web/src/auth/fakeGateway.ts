import type { AuthGateway, AuthUser } from './gateway';

// Auth simulado para los tests de componente: no toca Firebase.
export interface FakeGateway extends AuthGateway {
  calls: { signIn: number; signOut: number };
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

  const gateway: FakeGateway = {
    calls: { signIn: 0, signOut: 0 },
    onAuthStateChanged(next) {
      listener = next;
      next(user);
      return () => {
        listener = undefined;
      };
    },
    async getRoleClaim() {
      return claim;
    },
    async signInWithGoogle() {
      gateway.calls.signIn++;
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
