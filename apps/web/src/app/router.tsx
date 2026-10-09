import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useRoutes, type RouteObject } from 'react-router-dom';
import type { Role } from '@sistema-redespachos/shared';
import { useAuth } from '../auth/AuthProvider';
import { LoginPage } from '../auth/LoginPage';
import { PendingAccessPage } from '../auth/PendingAccessPage';
import { AppShell, HomePage, UnderConstructionPage } from './AppShell';
import { FEATURES, type FeatureEntry } from './featureRegistry';

// Puerta de acceso: sin sesión o rechazado → login; sin rol → pendiente; con rol → shell.
// Una URL directa a una feature fuera del rol redirige al inicio.
export function AppRoutes() {
  const { state } = useAuth();

  switch (state.status) {
    case 'cargando':
      return (
        <p role="status" className="p-6 text-muted-foreground">
          Cargando…
        </p>
      );
    case 'anonimo':
    case 'rechazado':
      return <LoginPage />;
    case 'pendiente':
      return <PendingAccessPage />;
    case 'con_rol':
      return (
        <Routes>
          <Route element={<AppShell rol={state.rol} />}>
            <Route index element={<HomePage />} />
            {FEATURES.map((feature) => (
              <Route
                key={feature.id}
                path={`${feature.id}/*`}
                element={
                  <RequireRole rol={state.rol} allowed={feature.roles}>
                    <FeatureRoutes feature={feature} />
                  </RequireRole>
                }
              />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      );
  }
}

function RequireRole({
  rol,
  allowed,
  children,
}: {
  rol: Role;
  allowed: readonly Role[];
  children: ReactNode;
}) {
  return allowed.includes(rol) ? children : <Navigate to="/" replace />;
}

function FeatureRoutes({ feature }: { feature: FeatureEntry }) {
  if (feature.routes.length === 0) return <UnderConstructionPage label={feature.label} />;
  return <FeatureOutlet routes={feature.routes} />;
}

function FeatureOutlet({ routes }: { routes: RouteObject[] }) {
  return useRoutes(routes);
}
