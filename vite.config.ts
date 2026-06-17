import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// During `vite` (dev) we serve the demo harness (index.html) and proxy the REST
// contract + uploaded files to the PHP dev server. During `vite build` we emit a
// single self-contained ESM bundle (Lit + cropperjs included) — consumers just
// `import '@charlie404/filemanager'`, no CSS import required.
export default defineConfig({
  resolve: {
    alias: { src: resolve(__dirname, 'src') },
  },
  server: {
    port: Number(process.env.FM_PORT) || 3000,
    proxy: {
      '/api': `http://localhost:${process.env.FM_API_PORT || 8000}`,
      '/uploads': `http://localhost:${process.env.FM_API_PORT || 8000}`,
    },
  },
  build: {
    target: 'es2021',
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'FileManager',
      formats: ['es'],
      fileName: () => 'index.js',
    },
  },
})
