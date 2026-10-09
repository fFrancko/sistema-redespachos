// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AppProviders } from '../app/providers';
import { AppRoutes } from '../app/router';
import { accessListFromEnv } from './accessList';
import { createFakeGateway, fakeUser, type FakeGateway } from './fakeGateway';
import { SignInError } from './gateway';

// Con `singleFork`, el cleanup automático de Testing Library solo se registra en el primer
// archivo que lo carga: se registra explícito en cada uno.
afterEach(cleanup);

const accessList = accessListFromEnv({ VITE_ALLOWED_EMAILS: 'ana.perez@gmail.com' });

function renderApp(gateway: FakeGateway) {
  return render(
    <AppProviders gateway={gateway} accessList={accessList}>
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('AuthProvider', () => {
  it('signOut antes de que resuelva el claim termina en el login, nunca en el layout', async () => {
    const gateway = createFakeGateway();
    const resolveClaim = gateway.deferRoleClaim();
    renderApp(gateway);

    act(() => gateway.emit(fakeUser('ana.perez@gmail.com'), 'ADMIN'));
    expect(screen.getByRole('status').textContent).toBe('Cargando…');

    await act(async () => gateway.signOut());
    expect(screen.getByRole('button', { name: 'Ingresar con Google' })).toBeTruthy();

    // El claim del usuario que ya salió llega tarde: se descarta.
    await act(async () => resolveClaim('ADMIN'));
    expect(screen.getByRole('button', { name: 'Ingresar con Google' })).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});

describe('LoginPage', () => {
  it('un login cancelado (popup cerrado) no muestra mensaje', async () => {
    const gateway = createFakeGateway();
    gateway.signInError = new SignInError('cancelado', 'auth/popup-closed-by-user');
    renderApp(gateway);
    const button = screen.getByRole('button', { name: 'Ingresar con Google' });
    await act(async () => button.click());
    expect(gateway.calls.signIn).toBe(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un login fallido por otra causa muestra el mensaje de error', async () => {
    const gateway = createFakeGateway();
    gateway.signInError = new SignInError('fallido', 'auth/network-request-failed');
    renderApp(gateway);
    const button = screen.getByRole('button', { name: 'Ingresar con Google' });
    await act(async () => button.click());
    expect(screen.getByRole('alert').textContent).toContain('No se pudo iniciar sesión con Google');
  });
});
