import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  // El .env.local se lee de la raíz del repo, junto a .env.local.template (docs/FIREBASE.md).
  envDir: '../../',
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@motor': path.resolve(__dirname, '../../packages/motor/src'),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
