# Cuadre · nueva estética «Cristal» — diseño y plan (PROPUESTA, sin aprobar)

## Diseño

**Intención.** Dejar atrás el look lavanda/bento (DISEÑO.md → «Estilo») y pasar a uno pulcro, elegante y translúcido, como las 3 referencias: fondo blanco con degradado gris suave, tarjetas de cristal, tipografía grotesca limpia, barra flotante y botón ＋ negro redondo. Proyectos se rehace como la segunda referencia («colecciones»).

**Decidido por Victor (2026-11-16):** toda la app; portada de proyecto = collage de lo que contiene; se mantienen claro y oscuro; Hydrogen = `gemini-4-hydrogen-high` vía `agy` (instalado aquí con la skill `plan-gemini`).

**Metas.** Un solo sistema de diseño (tokens) → todas las pantallas coherentes · sin cambios de base de datos · sin romper funciones (nada de lógica de tareas, notas o IA se toca).
**No-metas.** Fotos de portada nuevas (columna en Supabase) · cambiar navegación o pestañas · rehacer el contenido de las pantallas.
**Anti-metas.** Texto ilegible sobre cristal · jank de `backdrop-filter` en iPhone · modo oscuro roto · una clase compartida cambiada que rompe otra pantalla.

**Mi llamada (corrígeme):**
- Tipografía: **Inter Variable** (`@fontsource-variable/inter`, mismo mecanismo que Outfit hoy) para todo; títulos peso 700 con tracking negativo. Las referencias parecen Inter/Geist; Inter es la más segura y se carga igual. Outfit se quita.
- Color: acento deja de ser violeta. Neutro = blanco/gris cálido + **negro** para acciones primarias (＋, botones) y **azul** (`#2f6bff`) solo para la tarjeta hero/progreso. Los 7 colores de proyecto/nota se conservan pero pasan a **pastel translúcido** (mezcla con blanco, texto oscuro). Oscuro: grafito con cristal `rgb(255 255 255 / .06)`.
- Forma: radio 28 en tarjetas, 999 en píldoras, sombra suave en vez de bordes.

## Enfoques considerados

1. **Re-tokenizar + retocar por pantalla (elegido).** `styles.css` ya es todo variables (`:root` y `[data-theme='dark']`): se cambia el sistema una vez y se afina pantalla a pantalla. Menor riesgo y se publica por fases.
2. Reescribir `styles.css` desde cero (949 líneas): más limpio, pero rompe las clases compartidas por muchas pantallas y es imposible de revisar.
3. Añadir una librería UI (Tailwind/shadcn): reescribe todos los componentes; desproporcionado.

## Plan por fases

Rama `feat/estetica-cristal`. Cada fase termina con `npx tsc --noEmit` + `npm test` + capturas 393×852 (claro y oscuro, modo demo) y **una parada para tu visto bueno**. Nada de commit/push sin permiso.

| # | Fase | Quién | Archivos | Criterio de aceptación |
|---|---|---|---|---|
| 0 | **Base**: rama, capturas «antes» de las 8 pantallas × claro/oscuro, `tsc` y `npm test` en verde | Claude | — | Capturas guardadas en `docs/estilos/antes-cristal/` |
| 1 | **Tokens**: fondo con degradado fijo, Inter, `--glass`/`--blur`/`--shadow`, radios, paleta neutra+negro+azul, pasteles translúcidos, tema claro y oscuro, `theme-color` | Hydrogen | `src/styles.css` (bloques `:root`), `index.html`, `package.json`, `main.tsx` (import de fuente), `theme.ts` | La app arranca con la nueva paleta/tipografía en todas las pantallas aunque no esté pulida; sin texto ilegible |
| 2 | **Marco**: cabecera (avatar → Ajustes + botones redondos de buscar/filtrar), barra inferior flotante de cristal con indicador y ＋ negro aparte, hojas (`Sheet`) y botones/píldoras/`Choice` | Hydrogen | `styles.css` (`.dock`, `.tabs`, `.sheet*`, `.title-row`, `.add-btn`), `App.tsx`, `Page.tsx`, `Sheet.tsx` | Barra y hojas idénticas en feeling a la ref. 2; el ＋ abre Capturar como hoy |
| 3a | **Lógica del collage**: `projectCover(project, data)` → hasta 4 mini-tarjetas (próximas tareas, notas, diarias; imagen del icono si es foto) + contadores y fecha | Argon | `src/logic.ts`, `src/logic.test.ts` | Tests: proyecto vacío, con foto, con >4 elementos, orden estable |
| 3b | **Proyectos**: tarjeta de colección (fondo pastel del color, collage de cristal solapado, botón ＋ blanco en la portada que añade tarea, nombre grande, «fecha · N tareas · M notas», etiquetas como chips) + estado vacío «Empieza con un proyecto» + ficha con la misma portada | Hydrogen | `src/screens/Projects.tsx`, `styles.css` (`.project-*`, `.tile*`) | Las dos vistas (por etiqueta / por estado) y la ficha usan la tarjeta nueva; búsqueda y crear siguen funcionando |
| 4 | **Hoy, Tareas, Notas, Agenda**: hero azul/blanco de prioridades (ref. 1/3), segmentados `Choice` en cristal, filas y mosaicos nuevos, vacíos con ilustración de tarjetas apiladas; tareas diarias con color translúcido | Hydrogen | `screens/Today.tsx`, `Tasks.tsx`, `Notes.tsx`, `Agenda.tsx`, `TaskRow.tsx`, `DailyTasks.tsx`, CSS correspondiente | Misma información y gestos que ahora; hold-to-complete y confeti intactos |
| 5 | **Resto**: Ajustes, Login, Welcome, NewPassword, editor de notas y barra de cristal, ColorPicker | Hydrogen | `Settings.tsx`, `screens/Login.tsx`, `Welcome.tsx`, `NewPassword.tsx`, `NoteEditor.tsx`, `ColorPicker.tsx`, CSS | Ninguna pantalla conserva el look lavanda |
| 6 | **Calidad**: barrido de todas las pantallas claro+oscuro, grep de clases compartidas, contraste (≥4.5:1 en texto sobre cristal), rendimiento de scroll en iPhone | Claude + Opus 5.5 (revisión de diseño) | — | Informe de hallazgos y arreglos |
| 7 | **Revisión cruzada**: `/codex-review:code` del diff completo; correcciones | Codex + Claude | — | Sin hallazgos críticos abiertos |
| 8 | **Cierre**: actualizar «Estilo» en `DISEÑO.md` y `README.md`, icono (cuadrado violeta → neutro/negro) si quieres, y pedirte permiso para commit y push (push = Vercel deploy) | Claude | `DISEÑO.md`, `public/` iconos | Docs al día; despliegue solo con tu «sí» |

**Paralelismo.** 3a (Argon) corre a la vez que 1–2 (Hydrogen) porque solo toca `logic.ts`. Las fases de Hydrogen son secuenciales porque comparten `styles.css`.

**Riesgos.**
- `styles.css` comparte clases entre pantallas (ya nos pasó): grep antes de tocar y barrido tras cada fase.
- `backdrop-filter` en PWA de iOS puede ir pesado con listas largas: se usa solo en barra, hojas y tarjetas pequeñas, no en cada fila.
- Hydrogen tarda 5–15 min en escribir el primer archivo; es normal. Si se atasca 2 veces, lo paso a Argon High o lo hago yo.
- Las imágenes de referencia son de otra app (suscripciones/fotos): copiamos estética, no sus pantallas ni su marca.

**Fuera de este plan.** Imagen de portada propia por proyecto (necesitaría SQL en Supabase), Google Calendar, el chat con Cuadre.
