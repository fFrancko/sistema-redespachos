import { fileURLToPath } from 'node:url';

export default {
  plugins: {
    // Ruta explícita: funciona aunque Vite se lance desde otra carpeta.
    tailwindcss: { config: fileURLToPath(new URL('./tailwind.config.js', import.meta.url)) },
    autoprefixer: {},
  },
};
