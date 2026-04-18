import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
      '@renderer': path.resolve(rootDir, './src/renderer')
    },
    extensions: ['.js', '.ts', '.vue', '.json']
  },
  build: {
    outDir: 'site-dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(rootDir, 'index.html'),
        rendererTest: path.resolve(rootDir, 'renderer-test.html')
      }
    }
  }
})
