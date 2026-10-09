import { Button } from '../components/ui/button';
import logoPositivo from '../app/assets/logo-positivo.png';
import { useAuth } from './AuthProvider';

// La callable auth.requestAccess llega en MVP-06: hasta entonces el botón queda deshabilitado.
export function PendingAccessPage() {
  const { state, signOut } = useAuth();
  const email = state.status === 'pendiente' ? state.user.email : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-background p-8 shadow-sm">
        <img src={logoPositivo} alt="QX logística" className="mx-auto h-16 w-auto" />
        <h1 className="text-center text-xl font-semibold text-primary">Acceso pendiente</h1>
        <p className="text-sm text-muted-foreground">
          La cuenta {email} todavía no tiene un rol asignado. Un administrador tiene que habilitarla
          para que puedas usar el sistema.
        </p>
        <div className="space-y-1">
          <Button className="w-full" disabled>
            Solicitar acceso
          </Button>
          <p className="text-center text-xs text-muted-foreground">Disponible próximamente</p>
        </div>
        <Button variant="outline" className="w-full" onClick={() => void signOut()}>
          Cerrar sesión
        </Button>
      </div>
    </main>
  );
}
