import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    include: [
      'test/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      'vitest-browser-example/sparrow/**/*.{test,spec}.?(c|m)[jt]s?(x)'
    ],
    browser: {
      enabled: true,
      provider: playwright(),
      // https://vitest.dev/config/browser/playwright
      instances: [{ browser: 'chromium' }]
    }
  }
})
