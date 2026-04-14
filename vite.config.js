/// <reference types="vitest/config" />
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export const libraryEntries = {
  sparrow: path.resolve(rootDir, './src/index.js'),
  plot: path.resolve(rootDir, './src/plot/index.js'),
  guide: path.resolve(rootDir, './src/guide/index.js'),
  views: path.resolve(rootDir, './src/views/index.js')
}

export default defineConfig({
  build: {
    lib: {
      entry: libraryEntries,
      formats: ['es', 'cjs'],
      fileName: (format, entryName) =>
        `${entryName}.${format === 'es' ? 'js' : 'cjs'}`
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
      '@renderer': path.resolve(rootDir, './src/renderer')
    },
    extensions: ['.js', '.ts', '.vue', '.json']
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)']
  }
})
