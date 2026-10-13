// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import { accessListFromEnv } from './auth/accessList';
import { createFakeGateway, fakeUser } from './auth/fakeGateway';

// Con `singleFork`, el cleanup automático de Testing Library solo se registra en el primer
// archivo que lo carga: se registra explícito en cada uno.
afterEach(cleanup);

const accessList = accessListFromEnv({ VITE_ALLOWED_EMAILS: 'ana.perez@gmail.com' });

describe('App', () => {
  it('sin sesión muestra el login', () => {
    render(<App gateway={createFakeGateway()} accessList={accessList} />);
    expect(screen.getByRole('button', { name: 'Ingresar con Google' })).toBeTruthy();
  });

  it('con BrowserRouter, un usuario con rol entra al shell en la URL actual', async () => {
    window.history.pushState({}, '', '/pedidos');
    const gateway = createFakeGateway();
    render(<App gateway={gateway} accessList={accessList} />);
    act(() => gateway.emit(fakeUser('ana.perez@gmail.com'), 'BACKOFFICE'));
    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeTruthy();
    expect(window.location.pathname).toBe('/pedidos');
  });
});
