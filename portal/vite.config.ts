import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Mobile pins React 19, which npm hoists to the repo root; the portal is on 18. Hoisted libraries
  // (react-router, react-query, react-i18next) must resolve React from here, or the bundle ends up
  // with two copies and hooks fail.
  resolve: { dedupe: ['react', 'react-dom'] },
  server: {
    port: 5173,
  },
});
