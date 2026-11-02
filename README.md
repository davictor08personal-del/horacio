# Horacio

La app de prioridades de Victor: qué hacer **hoy**, qué **puede esperar** y (fase 2) **avisos** al móvil. PWA para el iPhone. Diseño y fases en [DISEÑO.md](DISEÑO.md).

## Arrancarla en local

```bash
npm install
npm run dev
```

Abre http://localhost:5173 (o el puerto que diga). Sin `.env.local` arranca en **modo demo**: guarda en el navegador y la IA da respuestas simuladas. Así se puede probar todo sin cuentas.

`npm test` pasa los tests de las reglas (`src/logic.test.ts`). `npm run build` comprueba tipos y genera `dist/`.

## Conectar Supabase (los datos de verdad)

1. En [supabase.com](https://supabase.com) → **New project** (nombre `horacio`, región Europa). El plan gratis permite 2 proyectos activos; Músculo ya usa uno.
2. **SQL Editor → New query**, pega todo [supabase/setup.sql](supabase/setup.sql) y pulsa **Run**.
3. **Authentication → Sign In / Providers → Email**: desactiva **Confirm email** (así no manda correos).
4. **Project Settings → API Keys**: copia la URL del proyecto y la **publishable key**.
5. Copia `.env.example` como `.env.local` y pon esas dos en `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY`. Reinicia `npm run dev`.
6. En la app pulsa **Crear cuenta** con tu email y una contraseña.

## Conectar la IA (Gemini)

1. Entra en [aistudio.google.com](https://aistudio.google.com) con tu cuenta de Google → **Get API key → Create API key**. Es gratis (con límite de usos al día). Ojo: en el nivel gratis Google puede usar lo que le mandas para mejorar sus productos.
2. En `.env.local`: `GEMINI_API_KEY=<tu clave>` y `AI_PROVIDER=gemini`.
3. Tu id de usuario: Supabase → **Authentication → Users** → copia el **UID** y ponlo en `AI_ALLOWED_USERS`. Solo ese usuario puede gastar la IA.
4. Reinicia `npm run dev` y prueba ＋ → «mañana sacar el alquiler, urgente».

La clave **nunca** va en git ni en el navegador: solo la lee `api/capture.ts`, que corre en el servidor (en local, a través de Vite).

## Cómo está hecha

- `src/screens/`: Hoy, Tareas, Agenda, Capture (＋) y Login.
- `src/logic.ts`: las reglas (orden de prioridad, Foco, hueco libre, turnos, bloque del FP).
- `src/capture.ts`: lo que la IA debe devolver, el prompt y la limpieza de su respuesta (compartido con el servidor).
- `src/store.ts`: lee y escribe en Supabase (o en el navegador en modo demo).
- `src/media.ts`: reduce las fotos y convierte la voz en WAV antes de enviarlas.
- `api/capture.ts`: la llamada a Gemini en el servidor.

## Siguiente fase

Publicar en Vercel (las mismas variables de `.env.local` van en Settings → Environment Variables) y los avisos push: resumen a las 9:30 y aviso por tarea. Ver DISEÑO.md.
