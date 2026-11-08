# Cuadre

(Antes «Horacio»; la carpeta y el repo conservan ese nombre.) La app de organización y productividad de Victor: qué hacer **hoy**, qué **puede esperar** y (fase 2) **avisos** al móvil. PWA para el iPhone. Diseño y fases en [DISEÑO.md](DISEÑO.md).

## Arrancarla en local

```bash
npm install
npm run dev
```

Abre http://localhost:5173 (o el puerto que diga). Sin `.env.local` arranca en **modo demo**: guarda en el navegador y la IA da respuestas simuladas. Así se puede probar todo sin cuentas.

Para probar sin cuenta aunque tengas Supabase conectado: crea `.env.demo.local` con `VITE_SUPABASE_URL=`, `VITE_SUPABASE_KEY=` y `AI_PROVIDER=mock`, y arranca `npm run dev -- --mode demo --port 5174`.

`npm test` pasa los tests de las reglas (`src/logic.test.ts`). `npm run build` comprueba tipos y genera `dist/`.

## Conectar Supabase (los datos de verdad)

1. En [supabase.com](https://supabase.com) → **New project** (nombre `horacio`, región Europa). El plan gratis permite 2 proyectos activos; Músculo ya usa uno.
2. **SQL Editor → New query**, pega todo [supabase/setup.sql](supabase/setup.sql) y pulsa **Run**.
3. **Authentication → Sign In / Providers → Email**: desactiva **Confirm email** (así no manda correos).
4. **Project Settings → API Keys**: copia la URL del proyecto y la **publishable key**.
5. Copia `.env.example` como `.env.local` y pon esas dos en `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY`. Reinicia `npm run dev`.
6. En la app pulsa **Crear cuenta** con tu email y una contraseña.

¿Ya tenías Supabase montado antes de las notas? Vuelve a ejecutar [supabase/setup.sql](supabase/setup.sql) entero: crea las tablas nuevas (`notes`, `daily_tasks`) y añade las columnas nuevas sin tocar lo que ya hay.

## Conectar la IA (Gemini)

1. Entra en [aistudio.google.com](https://aistudio.google.com) con tu cuenta de Google → **Get API key → Create API key**. Es gratis (con límite de usos al día). Ojo: en el nivel gratis Google puede usar lo que le mandas para mejorar sus productos.
2. En `.env.local`: `GEMINI_API_KEY=<tu clave>` y `AI_PROVIDER=gemini`.
3. Cualquiera con cuenta puede usar la IA, con un límite diario por persona (`AI_DAILY_LIMIT`, 20 por defecto). Para una beta cerrada, pon ids de usuario en `AI_ALLOWED_USERS`.
4. Reinicia `npm run dev` y prueba ＋ → «mañana sacar el alquiler, urgente».

**Alternativa: DeepSeek** (si Gemini está saturado). En [platform.deepseek.com](https://platform.deepseek.com) → **Top up** (unos euros duran mucho) → **API keys → Create new API key**. En `.env.local`: `DEEPSEEK_API_KEY=<tu clave>` y `AI_PROVIDER=deepseek`. DeepSeek solo lee texto: fotos y voz siguen yendo a Gemini si hay `GEMINI_API_KEY`.

La clave **nunca** va en git ni en el navegador: solo la lee `api/capture.ts`, que corre en el servidor (en local, a través de Vite).

## Cómo está hecha

- `src/screens/`: Hoy, Tareas, Notas, Proyectos, Agenda (se abre desde Hoy), Capture (＋) y Login. `src/DailyTasks.tsx`: las tareas diarias de Hoy.
- `src/NoteEditor.tsx`: el editor de notas a pantalla completa (lista de casillas, color, fijar, archivar, compartir y crear un recordatorio desde la nota).
- `src/logic.ts`: las reglas (orden de prioridad, Foco, hueco libre, turnos, bloque del FP).
- `src/capture.ts`: lo que la IA debe devolver, el prompt y la limpieza de su respuesta (compartido con el servidor).
- `src/store.ts`: lee y escribe en Supabase (o en el navegador en modo demo).
- `src/media.ts`: reduce las fotos y convierte la voz en WAV antes de enviarlas.
- `api/capture.ts`: la llamada a la IA (Gemini o DeepSeek) en el servidor.
- `api/tick.ts`, `api/ping.ts`, `api/_push.ts`, `src/push.ts` y `public/push-sw.js`: los avisos push.
- `public/icon.png`: el icono provisional (cuadrado violeta con un cuadro blanco); `npm run icons` genera todos los tamaños. El dibujo del antiguo mayordomo sigue en `docs/horacio-mascota.webp`.

## Publicar (Vercel + avisos al iPhone)

Antes: Supabase y Gemini conectados en local (arriba) y tu cuenta creada en la app.

1. **Claves de los avisos.** En esta carpeta: `npx web-push generate-vapid-keys`. Pon la *Public Key* en `VITE_VAPID_PUBLIC_KEY` y la *Private Key* en `VAPID_PRIVATE_KEY` de `.env.local`.
2. **Secretos del servidor.** Supabase → **Project Settings → API Keys → Secret keys** → copia una (`sb_secret_…`) para `SUPABASE_SECRET_KEY`. Para `CRON_SECRET` genera una contraseña larga: `node -e "console.log(crypto.randomBytes(32).toString('hex'))"`. Estas dos solo van en Vercel: no las pongas en la app.
3. **Tablas nuevas.** Vuelve a ejecutar [supabase/setup.sql](supabase/setup.sql) entero (añade las de los avisos sin tocar lo que hay).
4. **GitHub.** Crea un repo privado y sube el código: `gh repo create horacio --private --source . --push`.
5. **Vercel.** [vercel.com/new](https://vercel.com/new) → importa el repo `horacio` (detecta Vite solo). En **Environment Variables** pon: `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`, `AI_PROVIDER`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY` (si usas DeepSeek), `AI_ALLOWED_USERS` (opcional), `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SUPABASE_SECRET_KEY` y `CRON_SECRET`. Pulsa **Deploy**. Desde entonces cada `git push` publica.
6. **El reloj.** Abre [supabase/cron.sql](supabase/cron.sql), cambia la dirección por la de Vercel y `YOUR_CRON_SECRET` por tu `CRON_SECRET`, y ejecútalo en el SQL Editor. Desde ese momento Supabase llama a `/api/tick` cada minuto.
7. **En el iPhone.** Abre la dirección en Safari → **Compartir → Añadir a pantalla de inicio**. Abre Cuadre desde el icono, entra, toca el engranaje ⚙ de arriba a la derecha (Ajustes) → **Activar avisos** → **Probar aviso**.

Si un aviso no llega: Vercel → proyecto → **Logs** (busca `tick` o `ping`) y, en Supabase, `select * from cron.job_run_details order by start_time desc limit 5;`.

## Cómo funcionan los avisos

- El iPhone, al activar los avisos, da una «dirección» (suscripción) que se guarda en `push_subscriptions`.
- Cada minuto `pg_cron` llama a `api/tick.ts`. Este busca los recordatorios (tareas con día y hora) que ya tocan y no se han avisado, los marca (`notified_at`) y los envía. Entre las 9:30 y las 12:00 manda una vez al día el resumen («Buenos días, Victor»); `push_daily` evita repetirlo.
- Si cambias el día o la hora de un recordatorio, vuelve a avisar a la nueva hora (lo hace un trigger en la base).
- Las reglas (qué toca y el texto del resumen) están en `src/logic.ts`, con tests.

## Cuentas para otras personas

- **Recuperar la contraseña**: en Supabase → **Authentication → URL Configuration** pon *Site URL* = la dirección de Vercel y añade en *Redirect URLs* esa dirección y `http://localhost:5173`. Sin esto, el enlace del email no vuelve a la app.
- **Que lleguen los emails**: el envío gratis de Supabase solo manda a los miembros del equipo del proyecto (y unos pocos por hora). Para el resto, en **Authentication → Emails → SMTP Settings** conecta un remitente: lo más fácil sin dominio es Gmail con una «contraseña de aplicación» (host `smtp.gmail.com`, puerto 465); con dominio propio, Resend (gratis hasta 3.000 al mes). Con eso ya se puede volver a encender «Confirm email».
- **Borrar la cuenta** (Ajustes → Cuenta) llama a `api/account.ts`, que usa `SUPABASE_SECRET_KEY`. Todas las tablas borran en cascada.
- **Perfil** (`profiles`): nombre, zona horaria y módulos. La bienvenida lo crea la primera vez; todo «hoy», «mañana» y la hora de los avisos usan esa zona.
- **Privacidad**: `public/privacidad.html` (enlazada en la entrada, en ＋ y en Ajustes).

## Protección y comprobaciones

- **Anti-bots (Cloudflare Turnstile)**, apagado hasta configurarlo. En este orden, o nadie podrá entrar:
  1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Turnstile → Add widget**: nombre `Cuadre`, dominio `horacio-nu.vercel.app` (y `localhost`), modo *Managed*. Te da una *Site Key* y una *Secret Key*.
  2. Vercel → Environment Variables: `VITE_TURNSTILE_SITE_KEY` = la Site Key. **Redeploy** y comprueba que en la entrada aparece la casilla de Cloudflare.
  3. Supabase → **Authentication → Attack Protection → Captcha protection**: proveedor Turnstile y la *Secret Key*.
- **Cabeceras de seguridad** en `vercel.json` (CSP, no incrustar en iframes, HTTPS obligatorio…). `npm run preview` sirve las mismas, para probar antes de publicar que no rompen nada.
- **Límites de tamaño** en la base (final de `supabase/setup.sql`): nadie puede guardar megabytes en una fila.
- **CI**: GitHub Actions (`.github/workflows/ci.yml`) pasa los tests y el build en cada push. Si sale una ✗ roja en el commit, algo se rompió.
- **Menos tráfico**: tras cada cambio la app solo vuelve a leer lo que tocó (`refresh` en `src/store.ts`); todo entero solo al abrirla o volver a ella.

## Google Calendar

Un recordatorio con día ofrece «Añadir a Google Calendar» (en su ficha y justo después de guardarlo con ＋). Usa el enlace oficial de Google para crear un evento (`googleCalendarUrl` en `src/logic.ts`): abre tu calendario con título, día y hora rellenos y solo pulsas Guardar. Sin login con Google ni permisos. Leer tus eventos o crearlos sin ese toque necesitaría login con Google (OAuth); ver DISEÑO.md.

## Siguiente fase

Agenda con Google Calendar y «Hablar con Horacio». Ver DISEÑO.md.
