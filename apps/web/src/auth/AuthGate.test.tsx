// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import type { Role } from '@sistema-redespachos/shared';
import { AppProviders } from '../app/providers';
import { AppRoutes } from '../app/router';
import { accessListFromEnv } from './accessList';
import { createFakeGateway, fakeUser, type FakeGateway } from './fakeGateway';

// Con `singleFork`, el cleanup automático de Testing Library solo se registra en el primer
// archivo que lo carga: se registra explícito en cada uno.
afterEach(cleanup);

const accessList = accessListFromEnv({
  VITE_ALLOWED_EMAILS: 'ana.perez@gmail.com',
  VITE_ALLOWED_DOMAINS: 'qxlogistica.com',
});

function renderApp(gateway: FakeGateway, path = '/') {
  return render(
    <AppProviders gateway={gateway} accessList={accessList}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}

function navLabels(): string[] {
  const nav = screen.getByRole('navigation', { name: 'Principal' });
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent ?? '');
}

// Matriz de §3.1 con el ajuste de Franco del 9/10 (`oc` para todos los roles).
const NAV_BY_ROLE: Record<Role, string[]> = {
  ADMIN: [
    'Cotización',
    'Pedidos',
    'Tarifas',
    'Canalizador',
    'Usuarios',
    'Proveedores',
    'Sucursales',
    'Proformas',
    'Liquidación',
    'Órdenes de compra',
    'Auditoría',
    'Parámetros',
  ],
  ATENCION_PROVEEDOR: [
    'Pedidos',
    'Tarifas',
    'Proveedores',
    'Proformas',
    'Liquidación',
    'Órdenes de compra',
  ],
  ANALISTA: ['Cotización', 'Pedidos', 'Proformas', 'Liquidación', 'Órdenes de compra'],
  BACKOFFICE: ['Cotización', 'Pedidos', 'Proformas', 'Liquidación', 'Órdenes de compra'],
  ADMINISTRACION: ['Pedidos', 'Proformas', 'Liquidación', 'Órdenes de compra'],
};

describe('puerta de acceso', () => {
  it('sin sesión muestra el login y el botón dispara el login con Google', async () => {
    const gateway = createFakeGateway();
    renderApp(gateway);
    const button = screen.getByRole('button', { name: 'Ingresar con Google' });
    await act(async () => button.click());
    expect(gateway.calls.signIn).toBe(1);
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('un email externo cierra la sesión y ve el mensaje', async () => {
    const gateway = createFakeGateway(fakeUser('intruso@gmail.com'), 'ADMIN');
    renderApp(gateway);
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('intruso@gmail.com no tiene acceso'),
    );
    expect(gateway.calls.signOut).toBe(1);
    expect(screen.getByRole('button', { name: 'Ingresar con Google' })).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('un email externo que inicia sesión desde el login queda afuera con el mensaje', async () => {
    const gateway = createFakeGateway();
    renderApp(gateway);
    act(() => gateway.emit(fakeUser('x@evilqxlogistica.com'), 'ADMIN'));
    expect((await screen.findByRole('alert')).textContent).toContain('x@evilqxlogistica.com');
    expect(gateway.calls.signOut).toBe(1);
  });

  it('un email de la lista sin verificar se rechaza', async () => {
    const gateway = createFakeGateway(fakeUser('ana.perez@gmail.com', false), 'ADMIN');
    renderApp(gateway);
    expect((await screen.findByRole('alert')).textContent).toContain('no tiene acceso');
    expect(gateway.calls.signOut).toBe(1);
  });

  it('un email interno sin claim `rol` ve la pantalla de acceso pendiente', async () => {
    const gateway = createFakeGateway(fakeUser('ana.perez@gmail.com'));
    renderApp(gateway);
    expect(await screen.findByRole('heading', { name: 'Acceso pendiente' })).toBeTruthy();
    const request = screen.getByRole('button', { name: 'Solicitar acceso' });
    expect(request).toHaveProperty('disabled', true);
    expect(screen.getByText('Disponible próximamente')).toBeTruthy();
    expect(gateway.calls.signOut).toBe(0);
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('un claim `rol` que no es un rol de D21 también deja al usuario pendiente', async () => {
    const gateway = createFakeGateway(fakeUser('alguien@qxlogistica.com'), 'SUPERADMIN');
    renderApp(gateway);
    expect(await screen.findByRole('heading', { name: 'Acceso pendiente' })).toBeTruthy();
  });

  it.each(Object.entries(NAV_BY_ROLE) as [Role, string[]][])(
    'con rol %s ve el layout con la navegación de su rol',
    async (rol, expected) => {
      const gateway = createFakeGateway(fakeUser('alguien@qxlogistica.com'), rol);
      renderApp(gateway);
      expect(await screen.findByRole('navigation', { name: 'Principal' })).toBeTruthy();
      expect(navLabels()).toEqual(expected);
      expect(screen.getByText(rol)).toBeTruthy();
    },
  );

  it('cerrar sesión desde el layout vuelve al login sin mensaje de rechazo', async () => {
    const gateway = createFakeGateway(fakeUser('ana.perez@gmail.com'), 'ANALISTA');
    renderApp(gateway);
    const button = await screen.findByRole('button', { name: 'Cerrar sesión' });
    await act(async () => button.click());
    expect(gateway.calls.signOut).toBe(1);
    expect(screen.getByRole('button', { name: 'Ingresar con Google' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
