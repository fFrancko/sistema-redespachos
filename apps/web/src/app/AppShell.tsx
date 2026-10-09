import { NavLink, Outlet } from 'react-router-dom';
import type { Role } from '@sistema-redespachos/shared';
import { Button } from '../components/ui/button';
import { cn } from '../components/ui/utils';
import { useAuth } from '../auth/AuthProvider';
import logoNegativo from './assets/logo-negativo.png';
import { featuresForRole } from './featureRegistry';

export function AppShell({ rol }: { rol: Role }) {
  const { state, signOut } = useAuth();
  const email = state.status === 'con_rol' ? state.user.email : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-primary px-4 py-2 text-primary-foreground">
        <NavLink to="/" aria-label="Inicio">
          <img src={logoNegativo} alt="QX logística" className="h-10 w-auto" />
        </NavLink>
        <div className="flex items-center gap-3 text-sm">
          <span>
            {email} · <strong>{rol}</strong>
          </span>
          <Button variant="secondary" size="sm" onClick={() => void signOut()}>
            Cerrar sesión
          </Button>
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <nav
          aria-label="Principal"
          className="border-b border-border bg-muted md:w-56 md:border-b-0 md:border-r"
        >
          <ul className="flex flex-wrap gap-1 p-2 md:flex-col">
            {featuresForRole(rol).map((feature) => (
              <li key={feature.id}>
                <NavLink
                  to={`/${feature.id}`}
                  className={({ isActive }) =>
                    cn(
                      'block rounded-md px-3 py-2 text-sm text-primary hover:bg-background',
                      isActive && 'bg-background font-semibold text-secondary',
                    )
                  }
                >
                  {feature.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function HomePage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold text-primary">Sistema de Redespachos</h1>
      <p className="text-muted-foreground">Elegí una sección en el menú.</p>
    </section>
  );
}

export function UnderConstructionPage({ label }: { label: string }) {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold text-primary">{label}</h1>
      <p className="text-muted-foreground">En construcción.</p>
    </section>
  );
}
