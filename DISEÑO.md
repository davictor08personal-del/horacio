# Horacio: diseño

La app de prioridades de Victor. Le dice **qué hacer hoy**, **qué puede esperar** y le **avisa**. Se usa en el iPhone (PWA instalada). Objetivo: menos carga mental, no acumular tareas.

## Decisiones

| Decisión | Elegido | Por qué |
| --- | --- | --- |
| Tipo de app | **PWA** (como Músculo y Platero) | Gratis, se instala desde Safari y puede recibir avisos push (iOS 16.4+). |
| Frontend | **React + Vite + TypeScript** | El mismo stack que ya conoces: lo aprendido en Músculo sirve aquí. |
| Datos | **Supabase** (Postgres en la nube), con login de email + contraseña | Aquí la app **manda**: tareas, proyectos, turnos y tests viven en un solo sitio que otras herramientas (tu asistente de Obsidian) podrán leer. En Músculo los datos vivían en el móvil; aquí no, porque un servidor tiene que leerlos para avisarte aunque el móvil esté bloqueado. |
| Seguridad de los datos | **RLS** (Row Level Security) en cada tabla | La clave pública de Supabase va en la app, así que lo que protege los datos son reglas en la base: cada fila solo la ve su dueño. |
| IA | **Gemini Flash** (Google AI Studio, nivel gratis) desde `api/capture.ts` | Entiende texto, fotos y audio con una sola llamada. Se llama desde el servidor para que la clave nunca llegue al navegador. Modelo `gemini-flash-latest` (alias que Google mueve al Flash más nuevo); se cambia con `AI_MODEL` sin tocar código. Ojo: en el nivel gratis Google puede usar lo que le mandas para mejorar sus productos. |
| Publicación | **Vercel** | Igual que Músculo: cada `git push` publica. |
| Avisos (fase 2) | **Supabase pg_cron** cada minuto → llama a `api/tick` en Vercel → **Web Push** | El cron gratis de Vercel solo va una vez al día. `pg_cron` (incluido gratis en Supabase) puede ir cada minuto; la función de Vercel ya sabe enviar push (lo hicimos en Músculo con `web-push`), así que no hace falta aprender las Edge Functions de Supabase. |

## Pantallas

Barra inferior flotante (como Músculo): **Hoy · Tareas · Agenda**, y un botón **＋** grande para capturar.

1. **Hoy**
   - **Cabecera**: fecha y el día: «Turno de noche 17:00–23:00 · libre hasta las 16:30» o «Libre todo el día».
   - **Foco** (máx. 3): las tareas abiertas más importantes. Orden: fecha límite más cercana → prioridad alta → esfuerzo rápido. Tocar el círculo la marca hecha.
   - **Si te sobra tiempo**: menú fijo de una línea por opción: 🏋️ Gimnasio, 🇫🇷 Una lección de Busuu, 🎬 Una película pendiente, 💻 Algo de programación. En día de turno solo 2 ligeras (Busuu y programación).
   - **⏳ FP**: «Faltan 6 días para que abra el bloque 2 · 3 unidades sin leer». Solo informativo, sin veredictos.
   - **Puede esperar**: una línea con el resto («7 tareas más · 2 esperando»), que lleva a Tareas.
2. **Tareas**: lista agrupada (En curso, Abiertas, Esperando) y **Proyectos** con su siguiente paso. Tocar una tarea abre su ficha para editar estado, prioridad, esfuerzo, fecha, hora, área y proyecto.
3. **Agenda**: los turnos de esta semana (lunes a domingo) y los tests del FP por materia y bloque (fechas de apertura y cierre, casilla «leída»).
4. **Capturar (＋)**: una hoja con un cuadro de texto, botón 🎙️ (graba y la IA lo escucha) y 📷 (foto o captura, p. ej. el horario). La IA devuelve lo que entendió (tareas, turnos, tests, proyectos) y lo muestra en tarjetas editables: corriges o quitas lo que sobre y pulsas **Guardar**. Nada se guarda sin tu confirmación.

## Reglas

- **Turnos**: Opening 10:00–17:30 · Día 11:40–17:30 · Noche 17:00 (o 17:30)–23:00, sábado hasta 24:00 · Libre. Un turno por día; uno nuevo para el mismo día sustituye al anterior.
- **Hueco libre**: el día cuenta de 9:30 a 23:30. Antes de un turno, libre hasta 30 min antes de empezar; después, desde la hora de salida.
- **Foco**: tareas `abierto` o `en_curso`, ordenadas como arriba; las 3 primeras. El resto, y las `esperando`, van a «Puede esperar».
- **FP**: el siguiente bloque = la fecha de apertura futura más cercana; se cuentan sus unidades sin leer.
- **Captura**: la fecha se calcula en hora de Madrid («mañana», «el viernes»). «Urgente» = prioridad alta. Si no se dice, prioridad media y esfuerzo medio.

## Modelo de datos (Supabase, `supabase/setup.sql`)

Todas las tablas llevan `user_id` y RLS «solo el dueño».
- `tasks`: id, title, notes, status (`abierto`/`en_curso`/`esperando`/`hecho`/`descartado`), priority (`alta`/`media`/`baja`), effort (`rapido`/`medio`/`grande`), due_date, due_time, area, project_id, created_at, done_at.
- `projects`: id, name, status (`activo`/`pausado`/`hecho`), next_step, area.
- `shifts`: id, day (único por usuario), kind (`opening`/`dia`/`noche`/`libre`), starts_at, ends_at.
- `fp_tests`: id, subject, block, unit, opens_on, closes_on, read.
- `ai_usage` + función `ai_hit()`: límite de llamadas a la IA por día (copiado de Músculo).

## Fases

- **v1 (ahora)**: Supabase + login, Hoy, Tareas/Proyectos, Agenda, captura por texto/voz/foto con confirmación. Funcionando en local.
- **v2**: publicar en Vercel, instalar en el iPhone y **avisos**: resumen a las **9:30 (Madrid)** con el foco del día y un aviso por tarea a su hora (pg_cron + `api/tick` + Web Push).
- **v3 / ideas**: que el asistente de Obsidian lea Horacio, reenviar correos, el menú «Si te sobra tiempo» editable, repetir tareas.

## Estilo

Familia de Músculo: fondo casi negro, DM Sans, tarjetas redondeadas sin bordes, barra inferior de cristal, sin animaciones (salvo la barra). Color propio de Horacio: **ámbar** (`#ffb547`, la luz de la mañana) para distinguirla de Músculo (azul). Se cambia en una línea si no te gusta.
