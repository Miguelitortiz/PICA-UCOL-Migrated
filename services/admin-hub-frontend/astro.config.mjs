import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  base: '/admin',
  server: {
    port: 6768,
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
