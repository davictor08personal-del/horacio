// Light or dark before the first paint (loaded by index.html). Same rule as src/theme.ts: the user's choice, else the system's.
(function () {
  var pref = 'system'
  try { pref = localStorage.getItem('cuadre-theme') || localStorage.getItem('horacio-theme') || 'system' } catch (e) {}
  var dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  var meta = document.querySelector('meta[name=theme-color]')
  if (meta) meta.content = dark ? '#13121c' : '#ffffff'
})()
