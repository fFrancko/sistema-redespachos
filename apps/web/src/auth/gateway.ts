// Lo mínimo que la app necesita de Firebase Auth. La implementación real está en
// firebaseGateway.ts; los tests usan fakeGateway.ts.

export interface AuthUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
}

export interface AuthGateway {
  onAuthStateChanged(listener: (user: AuthUser | null) => void): () => void;
  /** Valor crudo del custom claim `rol` del usuario actual (sin validar). */
  getRoleClaim(): Promise<unknown>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}
