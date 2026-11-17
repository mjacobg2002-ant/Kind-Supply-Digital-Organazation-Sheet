import { defineConfig } from 'vite';

export default defineConfig({
  server: { proxy: { '/api': 'http://localhost:4174' } },
  build: { target: 'es2022' }
});
