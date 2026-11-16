---
name: plan-gemini
description: Use when Victor asks for a new feature, a large change or "un plan" in Cuadre (horacio) to be built with Gemini, or types /plan-gemini. Plan with superpowers, wait for his approval, then execute with Antigravity (agy) — Gemini 4 Hydrogen for visual work (CSS, layout, animation), Argon for pure logic and tests — while Claude supervises, reviews and integrates, and ask again before committing. Not for trivial changes.
---

# Plan con superpowers y ejecución con Gemini (Hydrogen + Argon) — Cuadre

Copiado de `isla-pomodoro/.claude/skills/plan-gemini` el 2026-11-16 y adaptado a Cuadre (React + Vite + TypeScript + Supabase). Cambios triviales (una línea, un texto, un color): directos, sin este flujo.

## Quién hace qué

| Agente | Modelo (`--model`) | Para |
|---|---|---|
| **Hydrogen** | `gemini-4-hydrogen-high` (`-xhigh` si es muy difícil) | CSS, maquetación, tarjetas, animación, componentes visuales |
| **Argon** | `gemini-4-argon-medium` (`-high` para diseño) | lógica pura en `src/logic.ts`, tipos, tests de vitest |
| **Claude** | — | plan, revisión, `tsc`/`vitest`, capturas, arreglos pequeños, commits con permiso |
| **Codex** | `codex exec` | segunda revisión del diff (`/codex-review:code`) |

Solo la suscripción de Victor (sesión de `agy`), nunca una API de pago. `agy models` lista lo disponible. Si un modelo se atasca dos veces en lo mismo, pasa la tarea al otro o hazla tú, y anótalo.

## Fase 1 — Plan (sin tocar código)

1. `brainstorming` si es ambiguo; si no, `writing-plans`.
2. Diseño en `docs/superpowers/specs/` y plan en `docs/superpowers/plans/AAAA-MM-DD-<tema>.md`. Cada tarea: quién, archivos permitidos, interfaces exactas, criterios verificables.
3. Separa lógica pura (testeable con vitest) de la vista: Argon la primera, Hydrogen la segunda, en paralelo solo si no comparten archivos.
4. **PARA. Espera el «sí» de Victor.**

## Fase 2 — Ejecución con agy

1. Rama `feat/<tema>`. `npm test` y `npx tsc --noEmit` en verde como base.
2. Encargo en un `.md` UTF-8 en el scratchpad (nunca por línea de comandos: los acentos se rompen) con: ruta del plan y tarea, archivos permitidos («no toques nada más»), interfaces, criterios y **«NO ejecutes ningún comando de terminal. Usa solo tus herramientas de leer y escribir archivos. Claude ejecuta tests y capturas. No hagas commits.»** Para Hydrogen añade `DISEÑO.md` y las imágenes de referencia como guía de estilo.
3. Lanzar en una pestaña de terminal (`run_in_terminal`):
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Victor D\Desarrollo web\horacio\scripts\run-agy.ps1" -Brief "<encargo.md>" -Log "<log.txt>" -Model gemini-4-hydrogen-high
   ```
   Confirma `AGY-START` en el log.
4. Supervisar con `Monitor`: termina con `AGY-DONE`; si pasan 10 min sin escribir, avisa y relanza con `-Conversation <id>`.
5. Revisar: `npx tsc --noEmit`, `npm test`, diff completo frente al plan, y **grep de cada clase compartida que se toque** (la misma clase se usa en varias pantallas). Correcciones por nuevo encargo o a mano si son triviales.
6. Verificar en el navegador en modo demo (`.env.demo.local`), 393×852, claro y oscuro, **todas** las pantallas. Enseña capturas a Victor antes de integrar.

## Fase 3 — Entrega

Resume qué hizo cada agente (modelo y valoración breve), archivos, salida real de tests y riesgos. **PARA**: el commit y el push (= despliegue en Vercel) solo con permiso de Victor.
