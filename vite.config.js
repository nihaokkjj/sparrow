/// <reference types="vitest/config" />

export default {
  build: {
    lib: {
      entry: 'src/renderer/renderer.js',
      name: 'sparrow',
      fileName: 'sparrow',
      formats: ['es', 'umd']
    }
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)']
  }
}
