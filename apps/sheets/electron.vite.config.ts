import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    // @mutantcatoffice/* workspace packages ship TS source (no build step, no
    // compiled entry point) — externalizing them makes Node's ESM loader try
    // to resolve their relative imports at runtime and fail. Bundle those;
    // externalize everything else (Electron, zod, node builtins).
    plugins: [
      externalizeDepsPlugin({
        exclude: [
          '@mutantcatoffice/ai-provider',
          '@mutantcatoffice/agent-core',
          '@mutantcatoffice/ai-search',
          '@mutantcatoffice/docx-engine',
          '@mutantcatoffice/file-parse',
          '@mutantcatoffice/electron-utils',
          '@mutantcatoffice/i18n',
          '@mutantcatoffice/pptx-render',
          '@mutantcatoffice/xlsx-gateway',
        ],
      }),
    ],
  },
  preload: {
    // Sandboxed preload scripts cannot require arbitrary npm packages at
    // runtime, so the drop-open bridge must be bundled, not externalized.
    plugins: [externalizeDepsPlugin({ exclude: ['@mutantcatoffice/electron-utils'] })],
  },
  renderer: {
    plugins: [react()],
  },
})
