import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'node:path';

export default defineConfig({
  // Keep the renderer resolver scoped to RookieDSH. The local research tree
  // contains independent projects with intentionally incomplete tsconfig bases.
  plugins: [react(), tsconfigPaths({ projects: [path.resolve(process.cwd(), 'tsconfig.json')] })],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../out/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(process.cwd(), 'src/renderer/index.html'),
        floating: path.resolve(process.cwd(), 'src/renderer/floating.html'),
        controlCenter: path.resolve(process.cwd(), 'src/renderer/controlCenter.html'),
      },
    },
  },
});
