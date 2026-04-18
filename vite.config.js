import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../src-dist',
    emptyOutDir: true,
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      input: {
        main: 'src/index.html',
        chrome: 'src/chrome.html',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    open: false,
  },
});
