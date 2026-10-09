import {
  GoogleAuthProvider,
  getIdTokenResult,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
} from 'firebase/auth';
import type { AuthGateway } from './gateway';

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
      await signInWithPopup(auth, provider);
    },
    async signOut() {
      await signOut(auth);
    },
  };
}
