/// <reference types="vitest/config" />
import path from 'node:path'
export default {
  build: {
    lib: {
      entry: 'src/renderer/renderer.js',
      name: 'sparrow',
      fileName: 'sparrow',
      formats: ['es', 'umd']
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
