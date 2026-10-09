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
  /** Si falla, rechaza con un `SignInError`. */
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

// Error de login normalizado por el gateway, para que la UI no dependa de los códigos de Firebase.
// `cancelado`: la persona cerró el popup o abrió otro encima. `code` es el código original.
export class SignInError extends Error {
  readonly reason: 'cancelado' | 'fallido';
  readonly code: string | undefined;

  constructor(reason: 'cancelado' | 'fallido', code?: string) {
    super(code ? `Login con Google ${reason} (${code})` : `Login con Google ${reason}`);
    this.name = 'SignInError';
    this.reason = reason;
    this.code = code;
  }
}
