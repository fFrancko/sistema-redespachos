import { useState } from 'react';
import { Button } from '../components/ui/button';
import logoPositivo from '../app/assets/logo-positivo.png';
import { useAuth } from './AuthProvider';

export function LoginPage() {
  const { state, signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setError(null);
    try {
      await signIn();
    } catch {
      setError('No se pudo iniciar sesión con Google. Probá de nuevo.');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-background p-8 shadow-sm">
        <img src={logoPositivo} alt="QX logística" className="mx-auto h-16 w-auto" />
        <h1 className="text-center text-xl font-semibold text-primary">Sistema de Redespachos</h1>
        {state.status === 'rechazado' && (
          <p role="alert" className="rounded-md bg-secondary/10 p-3 text-sm text-secondary">
            La cuenta {state.email ?? 'elegida'} no tiene acceso al sistema. Ingresá con una cuenta
            autorizada.
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-md bg-secondary/10 p-3 text-sm text-secondary">
            {error}
          </p>
        )}
        <Button className="w-full" onClick={handleSignIn}>
          Ingresar con Google
        </Button>
      </div>
    </main>
  );
}
