import { BrowserRouter } from 'react-router-dom';
import type { AccessList } from './auth/accessList';
import type { AuthGateway } from './auth/gateway';
import { AppProviders } from './app/providers';
import { AppRoutes } from './app/router';

interface AppProps {
  gateway: AuthGateway;
  accessList: AccessList;
}

// No importa firebase.ts: main.tsx inyecta el gateway real y los tests uno falso.
export default function App({ gateway, accessList }: AppProps) {
  return (
    <BrowserRouter>
      <AppProviders gateway={gateway} accessList={accessList}>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  );
}
