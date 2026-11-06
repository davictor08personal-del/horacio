import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

// Generates every icon size from public/icon.png (the vinotinto square): `npm run icons`
const bg = { background: '#7a1e3a' }

export default defineConfig({
  preset: {
    ...preset,
    transparent: { ...preset.transparent, padding: 0 },
    maskable: { ...preset.maskable, padding: 0.2, resizeOptions: bg },
    apple: { ...preset.apple, padding: 0, resizeOptions: bg },
  },
  images: ['public/icon.png'],
})
