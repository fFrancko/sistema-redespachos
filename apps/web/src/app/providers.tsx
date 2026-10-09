import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../auth/AuthProvider';
import type { AccessList } from '../auth/accessList';
import type { AuthGateway } from '../auth/gateway';

interface AppProvidersProps {
  gateway: AuthGateway;
  accessList: AccessList;
  children: ReactNode;
}

export function AppProviders({ gateway, accessList, children }: AppProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider gateway={gateway} accessList={accessList}>
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}
