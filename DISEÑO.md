# Cuadre: diseño

La app de organización y productividad de Victor (antes «Horacio», el mayordomo; desde el 2026-11-06 es Cuadre: en Venezuela *cuadrar* es organizar, «¿cuadramos para mañana?»). Le dice **qué hacer hoy**, **qué puede esperar** y le **avisa**. Se usa en el iPhone (PWA instalada). Objetivo: menos carga mental, no acumular tareas.

## Decisiones

| Decisión | Elegido | Por qué |
| --- | --- | --- |
| Tipo de app | **PWA** (como Músculo y Platero) | Gratis, se instala desde Safari y puede recibir avisos push (iOS 16.4+). |
| Frontend | **React + Vite + TypeScript** | El mismo stack que ya conoces: lo aprendido en Músculo sirve aquí. |
| Datos | **Supabase** (Postgres en la nube), con login de email + contraseña | Aquí la app **manda**: tareas, proyectos, turnos y tests viven en un solo sitio que otras herramientas (tu asistente de Obsidian) podrán leer. En Músculo los datos vivían en el móvil; aquí no, porque un servidor tiene que leerlos para avisarte aunque el móvil esté bloqueado. |
| Seguridad de los datos | **RLS** (Row Level Security) en cada tabla | La clave pública de Supabase va en la app, así que lo que protege los datos son reglas en la base: cada fila solo la ve su dueño. |
| IA | **Gemini Flash** (Google AI Studio, nivel gratis) desde `api/capture.ts` | Entiende texto, fotos y audio con una sola llamada. Se llama desde el servidor para que la clave nunca llegue al navegador. Modelo `gemini-flash-latest` (alias que Google mueve al Flash más nuevo); se cambia con `AI_MODEL` sin tocar código. Ojo: en el nivel gratis Google puede usar lo que le mandas para mejorar sus productos. |
| Publicación | **Vercel** | Igual que Músculo: cada `git push` publica. |
| Avisos | **Supabase pg_cron** cada minuto → llama a `api/tick` en Vercel → **Web Push** | El cron gratis de Vercel solo va una vez al día. `pg_cron` (incluido gratis en Supabase) puede ir cada minuto; la función de Vercel ya sabe enviar push (lo hicimos en Músculo con `web-push`), así que no hace falta aprender las Edge Functions de Supabase. |

## Pantallas

Barra inferior flotante (como Músculo): **Hoy · Tareas · Notas · Proyectos** (Proyectos ocupó el sitio de Agenda el 2026-11-06; Agenda se abre desde Hoy, «Turnos y FP»), y un botón **＋** grande para capturar.

1. **Hoy**
   - **Cabecera**: el saludo de Horacio según la hora («Buenos días / Buenas tardes / Buenas noches, Victor») y debajo la fecha y el día: «Turno de noche 17:00–23:00 · Libre hasta las 16:30» o «Todo el día libre».
   - **Foco** (máx. 3): las tareas abiertas más importantes. Orden: fecha límite más cercana → prioridad alta → esfuerzo rápido. Tocar el círculo la marca hecha.
   - **Tareas diarias**: lo que haces cada día (gimnasio, Busuu…). **Mantener pulsada** una la marca hecha hoy (se rellena de derecha a izquierda; mantener otra vez la desmarca) y **tocarla** abre su ficha: nombre, icono (emoji o imagen), **racha semanal** (🔥 semanas seguidas haciéndola al menos un día, con los puntos L–D de esta semana), descripción, proyecto (sale como etiqueta) y una **nota** opcional, que aparece también en Notas y en el proyecto con la etiqueta «Diaria». Al día siguiente vuelven sin marcar (`done_on`); cada día hecho queda en `daily_log` para las rachas. «Editar» ordena, añade y quita.
   - **⏳ FP**: «Faltan 6 días para que abra el bloque 2 · 3 unidades sin leer». Solo informativo, sin veredictos.
   - **Puede esperar**: una línea con el resto («7 tareas más · 2 esperando»), que lleva a Tareas.
2. **Tareas**: lista agrupada (En curso, Abiertas, Esperando) y, al final, **Terminadas** (plegada): las hechas y descartadas de los últimos 7 días, tachadas, con cuándo se cerraron; tocar el círculo la reabre. Pasados 7 días desde que se cerró, se borra sola (al abrir la app; `done_at` marca el momento). Tocar una tarea abre su ficha para editar estado, prioridad, esfuerzo, fecha, hora, área, proyecto y su nota.
3. **Notas**: aspecto de Notas de iOS (título grande, buscador, lista agrupada con hora y primera línea; editor a pantalla completa con «‹ Notas» y barra de herramientas de cristal) y funciones de Google Keep: fijar, 7 colores, lista de casillas (lo marcado baja al final), vista en cuadrícula, archivo, compartir y búsqueda sin acentos. Una nota vacía se descarta al salir.
   - **Nota ↔ recordatorio**: un recordatorio es una tarea con fecha (sale en Tareas y en Hoy). Desde una nota, la campana crea uno enlazado; desde la ficha de una tarea, «Crear nota de esta tarea» crea la nota con su título y detalles. La nota lista sus recordatorios y la tarea enlaza a su nota.
4. **Proyectos**: todos los proyectos por estado, cada uno con su **icono** (emoji o imagen; sin él, su inicial), descripción y cuántos pendientes y notas tiene, con un campo para añadir. La ficha muestra la **descripción**, sus **tareas diarias** (se tachan igual que en Hoy), los **recordatorios** (tareas con hora), las **tareas** pendientes (con campo para añadir una) y las **notas** («Nueva nota» ya nace en el proyecto); se edita con «Editar».
5. **Agenda** (desde Hoy): los turnos de esta semana (lunes a domingo) y los tests del FP por materia y bloque (fechas de apertura y cierre, casilla «leída»).
6. **Capturar (＋)**: una hoja con un cuadro de texto (solo texto desde el 2026-11-06: la foto y la voz dependían de Gemini gratis, demasiado saturado; para dictar, el micrófono del teclado). La IA devuelve lo que entendió (tareas, recordatorios, notas, tareas diarias, turnos, tests, proyectos) y lo muestra en tarjetas editables: corriges o quitas lo que sobre y pulsas **Guardar**. Cada tarjeta lleva arriba su tipo (Tarea · Recordatorio · Nota · Diaria) y se cambia con un toque si la IA se equivocó, sin perder lo escrito. Tareas, recordatorios, notas y tareas diarias llevan un selector de proyecto: la IA lo rellena si está claro y, si duda, la tarjeta pregunta «¿De qué proyecto es?». Nada se guarda sin tu confirmación.

## Reglas

- **Turnos**: Opening 10:00–17:30 · Día 11:40–17:30 · Noche 17:00 (o 17:30)–23:00, sábado hasta 24:00 · Libre. Un turno por día; uno nuevo para el mismo día sustituye al anterior.
- **Hueco libre**: el día cuenta de 9:30 a 23:30. Antes de un turno, libre hasta 30 min antes de empezar; después, desde la hora de salida.
- **Foco**: tareas `abierto` o `en_curso`, ordenadas como arriba; las 3 primeras. El resto, y las `esperando`, van a «Puede esperar».
- **FP**: el siguiente bloque = la fecha de apertura futura más cercana; se cuentan sus unidades sin leer.
- **Captura**: la fecha se calcula en hora de Madrid («mañana», «el viernes»). «Urgente» = prioridad alta. Si no se dice, prioridad media y esfuerzo medio.
- **Tipos**: **recordatorio** = «recuérdame / avísame» o una hora concreta (tarea con día y hora); **tarea** = algo que hacer sin hora fija; **nota** = algo para guardar o consultar (ideas, datos, listas → lista de casillas); **tarea diaria** = «todos los días / a diario». Recordatorios y tareas van en la misma tabla: lo que los distingue es la hora.

## Modelo de datos (Supabase, `supabase/setup.sql`)

Todas las tablas llevan `user_id` y RLS «solo el dueño».
- `tasks`: id, title, notes, status (`abierto`/`en_curso`/`esperando`/`hecho`/`descartado`), priority (`alta`/`media`/`baja`), effort (`rapido`/`medio`/`grande`), due_date, due_time, area, project_id, note_id, created_at, done_at.
- `projects`: id, name, status (`activo`/`pausado`/`hecho`), description, icon (emoji o imagen de 160 px como `data:` URL), next_step, area.
- `shifts`: id, day (único por usuario), kind (`opening`/`dia`/`noche`/`libre`), starts_at, ends_at.
- `fp_tests`: id, subject, block, unit, opens_on, closes_on, read.
- `notes`: id, title, body, items (jsonb: lista de casillas, o null), color, project_id, pinned, archived, created_at, updated_at.
- `daily_tasks`: id, title, position, done_on, project_id, description, icon, note_id, created_at.
- `daily_log`: daily_id, day (un registro por día hecho; de aquí salen las rachas semanales).
- `tasks.note_id` → `notes`: una nota puede tener varios recordatorios; un recordatorio, una nota. Si se borra la nota, el recordatorio se queda.
- `ai_usage` + función `ai_hit()`: límite de llamadas a la IA por día (copiado de Músculo).

## La idea de fondo

Cuadre es una app de **organización y productividad**: le escribes, entiende qué es cada cosa (tarea, recordatorio, nota, tarea diaria, de qué proyecto) y te dice qué hacer hoy y qué puede esperar. Trabaja **junto a Google Calendar** en vez de tener un calendario propio: los recordatorios con fecha se mandan allí con un toque.

## Hoja de ruta

Hecho: **v1** (Hoy, Tareas/Proyectos, Agenda, captura con IA), **Notas** enlazadas con recordatorios y los bloques 1 a 3; el 4 está programado y falta publicarlo (✅ abajo).

El orden sigue las dependencias: primero lo pequeño y lo que cambia los datos, después la IA que usa esos datos, luego la imagen y por último lo que necesita la app publicada.

**Bloque 1 · Hoy y los datos (cosas pequeñas, base de todo lo demás)**
1. ✅ **Bienvenida en Hoy**: «Buenos días, Victor» según la hora. Pequeño, y es la primera frase del futuro mayordomo.
2. ✅ **Tareas diarias** en lugar de «Si te sobra tiempo»: se tachan y vuelven a aparecer cada día (no hace falta un cron: se guarda el día en que se marcó y, si no es hoy, sale sin tachar). Lista editable: añadir, quitar y ordenar.
3. ✅ **Proyectos como eje**: una sección donde anotar todos los proyectos. Cada proyecto tiene su ficha con sus tareas, recordatorios y notas. Las notas también tendrán `project_id`.

**Bloque 2 · Que Horacio entienda (la IA, con los datos ya listos)**
4. ✅ **Captura que distingue** nota / recordatorio / tarea / tarea diaria (además de turnos, tests y proyectos), y **asigna el proyecto**: si está claro lo pone, y si duda **pregunta** en la tarjeta de revisión («¿De qué proyecto es?»).

**Bloque 3 · Identidad (antes de instalarla en el móvil, porque el icono es el logo)**
5. ✅ **Estudio de estilos visuales**: 4 direcciones con la pantalla Hoy real ([lienzo](https://claude.ai/artifact/8GksoTG5hHiwbev1CMBDJi), capturas en `docs/estilos/`). **Elegida: B · Mayordomo**, con el oscuro **Grafito** (1 de 4 variantes de oscuro):
   - **A · Nativo iOS**: lo de ahora llevado a iOS de verdad (grises del sistema, Inter). Lo más seguro y lo que menos se nota.
   - **B · Mayordomo**: serif (Fraunces) y Horacio que habla de usted («Le propongo, por orden»). Muy propio, menos «app de tareas».
   - **C · Bento (Android)**: mosaicos redondeados, anillo de progreso y barra de Android (Material You). Lo más «funcional».
   - **D · Amable**: Horacio en primer plano con un bocadillo, formas redondas (Nunito), el ＋ pasa a ser «hablar con Horacio». La más cercana a la persona media y a la idea del mayordomo.
   Se puede mezclar (p. ej. la estructura de A con el bocadillo de D).
6. ✅ **Logo y mascota a la vez** (2026-11-05, dibujo en `docs/horacio-mascota.webp`; el icono es su busto sobre el azul): el logo *es* Horacio, el mayordomo. Un personaje que funcione como icono pequeño y como compañero en la app.
7. ✅ **Modo claro y oscuro** con la paleta elegida (sigue al sistema, con opción de forzarlo). Va después del estilo para no diseñar dos veces cada paleta.

**Bloque 4 · Publicar (lo que pide un servidor siempre encendido)**
8. ✅ (código) **Vercel + avisos push** (era la v2; falta publicar, pasos en el README): instalar en el iPhone, resumen a las 9:30 y aviso de cada recordatorio a su hora. Sin esto un recordatorio no avisa.
9. **Google Calendar**: ✅ enviar un recordatorio con fecha a Google Calendar con el enlace oficial de «crear evento» (un toque en Guardar, sin login). Siguiente: leer los eventos (cuentan para el hueco libre de Hoy) y crearlos sin ese toque, que necesita login con Google (OAuth, scope de calendario; con la app sin verificar vale para hasta 100 usuarios de prueba).

**Bloque 5 · El mayordomo**
10. **Hablar con Cuadre**: un chat (texto o voz) con la mascota. Lee tus tareas, proyectos, notas y calendario, propone el plan del día y qué dejar para luego, y pide permiso antes de cambiar nada, igual que Claude Code. Va al final porque usa todo lo anterior.

Ideas aparcadas: que el asistente de Obsidian lea Horacio, reenviar correos, repetir tareas.

## Estilo

**Cuadre** (2026-11-06; antes «Mayordomo»).
- **Tipografía**: Bricolage Grotesque (variable, moderna y algo juguetona) para títulos y la letra del sistema para el texto (SF Pro en el iPhone, así se siente nativa). Fuera Inter y Fraunces.
- **Color**: vinotinto como acento (claro `#8b1e3f`, oscuro `#e2718f`, más luminoso para que se lea). Fondos y tarjetas: claro `#f3f5f9` / blanco; oscuro «Grafito» `#121212` / `#1c1c1e`.
- **Tono neutro**, de tú, sin mayordomo: «Prioridades de hoy», «Hoy no trabajas: tienes el día libre».
- **Icono provisional**: cuadrado vinotinto `#7a1e3a` con un cuadro blanco redondeado dentro (cuadrar).
- **Automático** (por defecto) sigue al móvil; en Ajustes (⚙) se puede forzar claro u oscuro. Se guarda por dispositivo.
- Todos los colores son variables en `src/styles.css` (dos bloques: `:root` y `:root[data-theme='dark']`); `index.html` aplica el tema antes de pintar para que no parpadee.
- **Ajustes**: engranaje ⚙ arriba a la derecha en todas las pantallas; abre una pantalla completa con tarjetas por sección (Apariencia, Avisos, Cuenta, Acerca de).
