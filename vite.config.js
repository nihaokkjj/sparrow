export default {
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'sparrow',
      fileName: 'sparrow',
      formats: ['es', 'umd']
    }
  },
  test: {
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)']
  }
}
