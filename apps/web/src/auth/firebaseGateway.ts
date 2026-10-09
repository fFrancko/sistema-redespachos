import {
  GoogleAuthProvider,
  getIdTokenResult,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
} from 'firebase/auth';
import { SignInError, type AuthGateway } from './gateway';

const CANCELLED_CODES = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

export function toSignInError(error: unknown): SignInError {
  const code =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
  return new SignInError(
    code !== undefined && CANCELLED_CODES.has(code) ? 'cancelado' : 'fallido',
    code,
  );
}

export function createFirebaseGateway(auth: Auth, hostedDomain?: string): AuthGateway {
  return {
    onAuthStateChanged(listener) {
      return onAuthStateChanged(auth, (user) =>
        listener(
          user && {
            uid: user.uid,
            email: user.email,
            emailVerified: user.emailVerified,
            displayName: user.displayName,
          },
        ),
      );
    },
    async getRoleClaim() {
      const user = auth.currentUser;
      if (!user) return undefined;
      // Forzar el refresco trae un rol asignado después del último token.
      const token = await getIdTokenResult(user, true);
      return token.claims.rol;
    },
    async signInWithGoogle() {
      const provider = new GoogleAuthProvider();
      if (hostedDomain) provider.setCustomParameters({ hd: hostedDomain });
      try {
        await signInWithPopup(auth, provider);
      } catch (error) {
        throw toSignInError(error);
      }
    },
    async signOut() {
      await signOut(auth);
    },
  };
}
