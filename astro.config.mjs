import { defineConfig } from 'astro/config';

export default defineConfig({
  base: undefined,
  trailingSlash: 'never',
  build: {
    format: 'directory',
    assets: '_astro',
  },
  vite: {
    server: {
      hmr: process.env.NODE_ENV !== 'production'
    }
  }
});