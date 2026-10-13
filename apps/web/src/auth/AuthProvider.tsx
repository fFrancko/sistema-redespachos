import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { roleSchema, type Role } from '@sistema-redespachos/shared';
import { isAllowed, type AccessList } from './accessList';
import type { AuthGateway, AuthUser } from './gateway';

export type AuthState =
  | { status: 'cargando' }
  | { status: 'anonimo' }
  | { status: 'rechazado'; email: string | null }
  | { status: 'pendiente'; user: AuthUser }
  | { status: 'con_rol'; user: AuthUser; rol: Role };

interface AuthContextValue {
  state: AuthState;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  gateway: AuthGateway;
  accessList: AccessList;
  children: ReactNode;
}

export function AuthProvider({ gateway, accessList, children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({ status: 'cargando' });
  // Email rechazado: se conserva para mostrar el mensaje después del signOut que lo expulsa.
  const rejected = useRef<{ email: string | null } | null>(null);

  useEffect(() => {
    let generation = 0;
    const unsubscribe = gateway.onAuthStateChanged((user) => {
      const current = ++generation;
      if (!user) {
        setState(
          rejected.current
            ? { status: 'rechazado', email: rejected.current.email }
            : { status: 'anonimo' },
        );
        return;
      }
      if (!isAllowed(user, accessList)) {
        rejected.current = { email: user.email };
        setState({ status: 'rechazado', email: user.email });
        void gateway.signOut();
        return;
      }
      rejected.current = null;
      setState({ status: 'cargando' });
      // Sin claim `rol` válido (falta, no es un rol de D21 o falla la lectura) el usuario queda pendiente.
      gateway.getRoleClaim().then(
        (claim) => {
          if (current !== generation) return;
          const parsed = roleSchema.safeParse(claim);
          setState(
            parsed.success
              ? { status: 'con_rol', user, rol: parsed.data }
              : { status: 'pendiente', user },
          );
        },
        () => {
          if (current === generation) setState({ status: 'pendiente', user });
        },
      );
    });
    return () => {
      generation++;
      unsubscribe();
    };
  }, [gateway, accessList]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      async signIn() {
        rejected.current = null;
        await gateway.signInWithGoogle();
      },
      async signOut() {
        rejected.current = null;
        await gateway.signOut();
      },
    }),
    [state, gateway],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth se usa dentro de <AuthProvider>.');
  return value;
}
