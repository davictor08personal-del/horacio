import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

// Generates every icon size from public/icon.svg: `npm run icons`
const bg = { background: '#111111' }

export default defineConfig({
  preset: {
    ...preset,
    maskable: { ...preset.maskable, resizeOptions: bg },
    apple: { ...preset.apple, resizeOptions: bg },
  },
  images: ['public/icon.svg'],
})
