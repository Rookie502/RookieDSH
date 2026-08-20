import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../out/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(process.cwd(), 'src/renderer/index.html'),
        floating: path.resolve(process.cwd(), 'src/renderer/floating.html'),
      },
    },
  },
});
