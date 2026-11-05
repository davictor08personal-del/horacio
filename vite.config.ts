import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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
    plugins: [
      react(),
      devApi(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
        workbox: { globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'] },
        manifest: {
          name: 'Horacio',
          short_name: 'Horacio',
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
