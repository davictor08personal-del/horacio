// Added to the service worker that vite-plugin-pwa generates (vite.config.ts → workbox.importScripts).
// Shows the notifications sent by api/tick.ts and api/ping.ts, even with the phone locked.
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(self.registration.showNotification(data.title || 'Horacio', {
    body: data.body || '',
    icon: 'pwa-192x192.png',
    tag: data.tag, // the same reminder or summary replaces itself instead of piling up
  }))
})

// Tapping the notification brings the app back.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => (list[0] ? list[0].focus() : self.clients.openWindow('./'))))
})
