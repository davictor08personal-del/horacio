import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

// Generates every icon size from public/icon.png (the violet square): `npm run icons`
const bg = { background: '#6b4de6' }

export default defineConfig({
  preset: {
    ...preset,
    transparent: { ...preset.transparent, padding: 0 },
    maskable: { ...preset.maskable, padding: 0.2, resizeOptions: bg },
    apple: { ...preset.apple, padding: 0, resizeOptions: bg },
  },
  images: ['public/icon.png'],
})
