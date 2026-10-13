// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import type { Role } from '@sistema-redespachos/shared';
import { accessListFromEnv } from '../auth/accessList';
import { createFakeGateway, fakeUser } from '../auth/fakeGateway';
import { AppProviders } from './providers';
import { AppRoutes } from './router';

// Con `singleFork`, el cleanup automático de Testing Library solo se registra en el primer
// archivo que lo carga: se registra explícito en cada uno.
afterEach(cleanup);

const accessList = accessListFromEnv({ VITE_ALLOWED_DOMAINS: 'qxlogistica.com' });

function CurrentPath() {
  return <output aria-label="ruta">{useLocation().pathname}</output>;
}

function renderAt(path: string, rol: Role) {
  const gateway = createFakeGateway(fakeUser('alguien@qxlogistica.com'), rol);
  render(
    <AppProviders gateway={gateway} accessList={accessList}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <CurrentPath />
      </MemoryRouter>
    </AppProviders>,
  );
}

const ruta = () => screen.getByRole('status', { name: 'ruta' }).textContent;

describe('rutas por rol', () => {
  it.each([
    ['/usuarios', 'ANALISTA'],
    ['/canalizador/algo/profundo', 'BACKOFFICE'],
    ['/tarifas', 'ADMINISTRACION'],
    ['/cotizacion', 'ATENCION_PROVEEDOR'],
    ['/auditoria', 'ATENCION_PROVEEDOR'],
  ] as [string, Role][])(
    'una URL directa a %s con rol %s redirige al inicio',
    async (path, rol) => {
      renderAt(path, rol);
      expect(await screen.findByRole('heading', { name: 'Sistema de Redespachos' })).toBeTruthy();
      expect(ruta()).toBe('/');
    },
  );

  it('una feature de su rol se abre con la pantalla "En construcción"', async () => {
    renderAt('/oc', 'ANALISTA');
    expect(await screen.findByRole('heading', { name: 'Órdenes de compra' })).toBeTruthy();
    expect(screen.getByText('En construcción.')).toBeTruthy();
    expect(ruta()).toBe('/oc');
  });

  it('ADMIN entra a una feature solo de ADMIN', async () => {
    renderAt('/usuarios', 'ADMIN');
    expect(await screen.findByRole('heading', { name: 'Usuarios' })).toBeTruthy();
    expect(ruta()).toBe('/usuarios');
  });

  it('una URL desconocida redirige al inicio', async () => {
    renderAt('/no-existe', 'ADMIN');
    expect(await screen.findByRole('heading', { name: 'Sistema de Redespachos' })).toBeTruthy();
    expect(ruta()).toBe('/');
  });
});
