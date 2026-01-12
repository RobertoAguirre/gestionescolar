import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5173,
    // Proxy deshabilitado - el frontend usa API_URL que apunta a Render
    // Si necesitas usar backend local, configura VITE_API_URL=http://localhost:3000
    proxy: {}
  }
});


