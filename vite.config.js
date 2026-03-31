/// <reference types="vitest/config" />
import path from 'node:path'

export default {
  build: {
    lib: {
      entry: {
        sparrow: path.resolve(__dirname, './src/index.js'),
        plot: path.resolve(__dirname, './src/plot/index.js'),
        guide: path.resolve(__dirname, './src/guide/index.js'),
        views: path.resolve(__dirname, './src/views/index.js')
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) =>
        `${entryName}.${format === 'es' ? 'js' : 'cjs'}`
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@renderer': path.resolve(__dirname, './src/renderer')
    },
    extensions: ['.js', '.ts', '.vue', '.json']
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)']
  }
}
