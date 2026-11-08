// Light / dark. The choice is per device (localStorage); index.html applies it before the first paint with the same rule.
import { useSyncExternalStore } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
export const THEME: Record<ThemePref, string> = { system: 'Automático', light: 'Claro', dark: 'Oscuro' }

const KEY = 'cuadre-theme'
const system = matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

let pref: ThemePref = (() => {
  try { return ((localStorage.getItem(KEY) ?? localStorage.getItem('horacio-theme')) as ThemePref) || 'system' } catch { return 'system' }
})()

function apply() {
  const dark = pref === 'dark' || (pref === 'system' && system.matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#13121c' : '#e9e5fb')
}
// «Automático» follows the phone when it switches (e.g. at sunset).
system.addEventListener('change', apply)

export function setTheme(p: ThemePref) {
  pref = p
  try { localStorage.setItem(KEY, p) } catch { /* only a preference */ }
  apply()
  listeners.forEach((l) => l())
}

export const useTheme = () => useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => pref)
