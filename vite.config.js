/**
 * vite.config.js
 * -----------------------------------------------------------
 * Vite configuration for Scene Designer project.
 * - Enforces ES module syntax throughout.
 * - Configures static asset serving from /public.
 * - Supports modern browser targets (ESM).
 * - Handles path alias for src/* if needed.
 * - Ensures ESM-only builds; no legacy global scripts.
 * - Includes plugin for Reactivity Transform if needed.
 * -----------------------------------------------------------
 */

import { defineConfig } from 'vite';

// If you want to use path aliases like '@src', install vite-tsconfig-paths or manually configure
// import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  root: '.', // Project root
  base: './', // Relative base for local dev and GitHub Pages
  publicDir: 'public',
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    minify: 'esbuild',
    emptyOutDir: true,
    rollupOptions: {
      input: './index.html'
    }
  },
  server: {
    port: 8080,
    host: '0.0.0.0',
    open: true,
    strictPort: true,
    // proxy: { '/api': 'http://localhost:3000' } // if needed
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  optimizeDeps: {
    // List all dependencies that need pre-bundling for ESM
    include: [
      'fabric',
      'tabulator-tables',
      'tweakpane',
      'localforage'
    ]
  }
  // plugins: [
  //   tsconfigPaths() // Uncomment if using TypeScript path aliases
  // ]
});
