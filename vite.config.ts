import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// Shown in Ajustes → Acerca de.
const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version as string
// `npm run preview` sends the same security headers as Vercel (vercel.json), to catch a CSP problem before publishing.
const prodHeaders = Object.fromEntries((JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')).headers[0].headers as { key: string; value: string }[]).map((h) => [h.key, h.value]))

// `npm run dev` only: answers /api/* with the files in api/, the way Vercel does once published.
// With AI_PROVIDER=mock in .env.local the capture works without a key and without cost.
const devApi = (): Plugin => ({
  name: 'dev-api',
  configureServer(server) {
    server.middlewares.use('/api/', async (req, res) => {
      const name = req.url?.split('?')[0].replace(/^\//, '')
      if (!name || !/^[a-z]+$/.test(name)) { res.statusCode = 404; return res.end() }
      let body = ''
      for await (const chunk of req) body += chunk
      const { POST } = await server.ssrLoadModule(`/api/${name}.ts`)
      const headers = Object.fromEntries(Object.entries(req.headers).filter(([, v]) => typeof v === 'string')) as Record<string, string>
      const r: Response = await POST(new Request(`http://localhost/api/${name}`, { method: 'POST', headers, body }))
      res.statusCode = r.status
      res.setHeader('Content-Type', 'application/json')
      res.end(await r.text())
    })
  },
})

export default defineConfig(({ mode }) => {
  // Vite only exposes VITE_* to the app; the server functions read the rest (AI_PROVIDER, keys…) from process.env.
  for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), ''))) process.env[k] ??= v
  return {
    define: { __APP_VERSION__: JSON.stringify(version) },
    build: { rollupOptions: { output: { manualChunks: { supabase: ['@supabase/supabase-js'] } } } },
    preview: { headers: prodHeaders },
    plugins: [
      react(),
      devApi(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
        workbox: { globPatterns: ['**/*.{js,css,html,woff2,png,webp,svg,ico}'], globIgnores: ['icon.png'], importScripts: ['push-sw.js'] },
        manifest: {
          name: 'Cuadre',
          short_name: 'Cuadre',
          description: 'Qué hacer hoy y qué puede esperar',
          lang: 'es',
          theme_color: '#f3f5f9',
          background_color: '#f3f5f9',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
  }
})
