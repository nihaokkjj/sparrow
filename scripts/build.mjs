import { build } from 'vite'

import baseConfig, { libraryEntries } from '../vite.config.js'

const { build: baseBuildConfig, ...sharedConfig } = baseConfig

const umdNames = {
  sparrow: 'Sparrow',
  plot: 'SparrowPlot',
  guide: 'SparrowGuide',
  views: 'SparrowViews'
}

await build(baseConfig)

for (const [entryName, entry] of Object.entries(libraryEntries)) {
  await build({
    ...sharedConfig,
    build: {
      ...baseBuildConfig,
      emptyOutDir: false,
      lib: {
        entry,
        name: umdNames[entryName],
        formats: ['umd'],
        fileName: () => `${entryName}.umd`
      }
    }
  })
}
