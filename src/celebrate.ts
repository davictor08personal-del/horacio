// A small burst of confetti and stars from an element (a daily task just done). No library: a few spans moved
// with the Web Animations API, removed after a second. Skipped if the phone asks for reduced motion.
const COLORS = ['#a995ff', '#6b4de6','#f5b301', '#2f9e5b', '#2f6fde', '#7b4fd6', '#ff8a3d']

export function celebrate(from: Element | null) {
  if (!from || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const r = from.getBoundingClientRect()
  const layer = document.createElement('div')
  layer.className = 'confetti-layer'
  document.body.append(layer)
  for (let i = 0; i < 22; i++) {
    const star = i % 4 === 0
    const p = document.createElement('span')
    p.className = star ? 'confetti star' : 'confetti'
    if (star) p.textContent = '★'
    const color = COLORS[i % COLORS.length]
    p.style.left = `${r.left + r.width * (0.2 + Math.random() * 0.6)}px`
    p.style.top = `${r.top + r.height * 0.5}px`
    if (star) p.style.color = color
    else p.style.background = color
    layer.append(p)
    // Up and out, then falling a little: a fountain, not an explosion.
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2
    const dist = 45 + Math.random() * 55
    const dx = Math.cos(angle) * dist
    const dy = Math.sin(angle) * dist
    const spin = (Math.random() - 0.5) * 720
    p.animate([
      { transform: 'translate(-50%, -50%) rotate(0deg) scale(0.6)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${spin / 2}deg) scale(1)`, opacity: 1, offset: 0.45 },
      { transform: `translate(calc(-50% + ${dx * 1.3}px), calc(-50% + ${dy + 70}px)) rotate(${spin}deg) scale(0.8)`, opacity: 0 },
    ], { duration: 850 + Math.random() * 350, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)', fill: 'forwards' })
  }
  setTimeout(() => layer.remove(), 1400)
}
