# Auditoría: de app personal a app para cientos de personas

Fecha: 2026-11-06. Punto de partida: Cuadre funciona bien para **un** usuario (Victor). Esta lista dice qué impide abrirla a otros y en qué orden arreglarlo. Cientos de usuarios es poco tráfico para la técnica que usamos (Supabase + Vercel aguantan eso de sobra); lo que falta es sobre todo **producto, cuentas y legal**.

Leyenda: 🔴 bloquea abrirla a otros · 🟠 importante antes de crecer · 🟢 cuando haya gente usándola.

## 1. Hecha para una sola persona 🔴

| Qué | Dónde | Arreglo |
| --- | --- | --- |
| El saludo y el resumen de las 9:30 dicen «Victor» a todo el mundo | `OWNER` en `src/logic.ts` | Tabla `profiles` (nombre, zona horaria) que se rellena al crear la cuenta |
| Todo va en hora de **Madrid**: «hoy», «mañana», los avisos y el resumen | `madridDay`, `madridMinutes`, `TZ` (10 archivos), `api/tick.ts` | Zona horaria por usuario (la del móvil al registrarse). Un venezolano (UTC-4) vería «mañana» a las 20:00 |
| La IA cree que habla con Victor en Madrid, con turnos de restaurante y tests del FP | prompt en `src/capture.ts` | Prompt genérico con el nombre y la zona del perfil |
| **Turnos** (opening/día/noche) y **tests del FP** son de la vida de Victor | `Agenda`, `dayPlan`, `shifts`, `fp_tests` | Convertirlos en «módulos» opcionales en Ajustes, apagados por defecto. Para el resto, Hoy no habla de turnos |

## 2. Cuentas 🔴

| Qué | Por qué importa | Arreglo |
| --- | --- | --- |
| **No se puede recuperar la contraseña** | Quien la olvide pierde todo | «¿Olvidaste tu contraseña?» con email. Supabase gratis solo manda ~2 correos/hora: conectar **Resend** (gratis hasta 3.000/mes) como SMTP |
| «Confirm email» está apagado | Cualquiera se registra con un email que no es suyo | Volver a encenderlo cuando haya SMTP propio |
| No se puede **borrar la cuenta** | Lo exige la ley (RGPD) y Apple/Google si algún día va a tiendas | Botón en Ajustes → Cuenta que borra todo (las tablas ya borran en cascada) |
| Sin protección contra registros masivos | Bots creando cuentas | Cloudflare **Turnstile** (gratis, Supabase lo soporta) en el registro |

## 3. La IA 🔴

| Qué | Arreglo |
| --- | --- |
| Solo los ids de `AI_ALLOWED_USERS` pueden usarla: para el resto ＋ no funciona | Quitar la lista y dejar el **límite diario por usuario** que ya existe (`ai_hit`, `AI_DAILY_LIMIT`, hoy 40). Bajarlo a ~20 |
| Coste | DeepSeek es muy barato: 100 personas × 10 capturas/día ≈ **5–15 €/mes**. Poner un tope de gasto en platform.deepseek.com |
| **Privacidad**: lo que escribes en ＋ va a DeepSeek (empresa china) | Decirlo claro en la política de privacidad y en el primer uso de ＋. Para usuarios europeos es delicado (RGPD): valorar un proveedor europeo/estadounidense (Mistral, Gemini de pago) cuando crezca |
| Si DeepSeek cae, ＋ no hace nada | Un plan B sin IA: entender «mañana a las 5 #Proyecto» con reglas (idea de Todoist) |

## 4. Legal y confianza 🔴

- **Política de privacidad** y **condiciones de uso**: qué datos guardas, dónde (Supabase en Europa, Vercel, DeepSeek), cuánto tiempo, cómo borrarlos. Victor vive en España: aplica el RGPD.
- **Vercel Hobby** solo permite uso **no comercial**. Gratis y sin anuncios vale; si algún día cobras o pones anuncios, pasar a Pro (20 $/mes).
- Un email de contacto y una página sencilla que explique qué es Cuadre.

## 5. Coste y rendimiento 🟠

| Qué | Por qué | Arreglo |
| --- | --- | --- |
| **Cada cambio recarga todo** (7 consultas: tareas, notas, proyectos…) | Con 100 personas activas se come el tráfico gratis de Supabase (5 GB/mes) | Actualizar solo lo que cambió, en memoria, y recargar todo solo al abrir la app |
| Imágenes de proyectos y diarias como texto en la fila | Viajan en cada recarga | Tope de tamaño en la base (`check (length(icon) < 60000)`) y, si crece, Supabase Storage |
| `api/tick` lee **todas** las tareas abiertas de todos cada minuto | Con cientos de usuarios es lento y caro | Filtrar en la consulta: solo tareas con hora, sin avisar, de ayer u hoy |
| El resumen de las 9:30 es a las 9:30 **de Madrid** para todos | Depende de la zona horaria (punto 1) | Calcular las 9:30 de cada usuario |

## 6. Seguridad 🟠

Bien: RLS en todas las tablas, claves de la IA y de Supabase solo en el servidor, `CRON_SECRET`, avisos validados contra los servicios de push reales.
Falta:
- Cabeceras de seguridad (`vercel.json`: CSP, `X-Frame-Options`, `Referrer-Policy`).
- Límites de tamaño en la base para textos e imágenes (que nadie guarde 10 MB en una nota).
- Rotar la clave de Gemini (se pegó en un chat) y quitarla si ya no se usa.

## 7. Saber qué pasa 🟢

- **Copias de seguridad**: el plan gratis de Supabase **no hace backups**. Al principio, una exportación semanal (script); con usuarios reales, Supabase Pro (25 $/mes, copias diarias).
- **Errores**: Sentry (gratis hasta 5.000 errores/mes) para enterarte de los fallos que ven otros.
- **Uso**: métricas mínimas y respetuosas (cuántos usuarios activos, cuántas capturas), sin rastrear a nadie.
- **CI**: GitHub Actions que pase `npm test` y `npm run build` en cada push, para no publicar algo roto.

## 8. Producto 🟢

- **Bienvenida**: 3 pantallas al registrarse (nombre, qué es cada cosa, crear el primer proyecto).
- Nombre y dirección: dominio propio (`cuadre.app` o similar, ~10–15 €/año) en vez de `horacio-nu.vercel.app`; renombrar repo y proyecto de Vercel.
- Icono definitivo.

## Hecho (Fase 1, 2026-11-06)

- ✅ Perfil (`profiles`): nombre, zona horaria y módulos; pantalla de bienvenida. Fuera «Victor» y Madrid fijos: todo usa la zona del usuario (también los avisos y el resumen de las 9:30, por usuario).
- ✅ Turnos y Estudios (FP) son módulos opcionales, apagados por defecto; la IA no los propone si están apagados.
- ✅ IA para cualquiera con cuenta, límite de 20 al día por persona; `AI_ALLOWED_USERS` queda como beta cerrada opcional.
- ✅ «¿Olvidaste tu contraseña?» y pantalla de contraseña nueva (falta configurar el SMTP en Supabase, ver README).
- ✅ Borrar la cuenta desde Ajustes (`api/account.ts`).
- ✅ Política de privacidad (`public/privacidad.html`), con el aviso de DeepSeek también en ＋.
- ✅ `api/tick` ya solo lee las tareas candidatas a aviso, no todas.
- Pendiente de Fase 1: volver a encender «Confirm email» cuando haya SMTP.

## Hecho (Fase 2, 2026-11-06)

- ✅ Tras cada cambio solo se relee lo que cambió (1–2 consultas en vez de 9); al volver a la app no se consultan módulos apagados (`shifts`, `fp_tests`) ni se repite la carga si han pasado menos de 30 s.
- ✅ Cerrar sesión (`signOut`) y borrar cuenta limpian la memoria local, cierran notas abiertas y desvinculan la suscripción push del dispositivo.
- ✅ La cuota diaria de IA (`ai_hit`) solo se descuenta si el proveedor responde bien; las tablas `ai_usage` y `push_daily` purgan los días antiguos automáticamente y `CRON_SECRET` se comprueba con `timingSafeEqual`.
- ✅ Límites de tamaño en la base para todas las tablas (`tasks`, `notes`, `projects`, `daily_tasks`, `fp_tests`, `push_subscriptions` y `profiles`).
- ✅ Cabeceras de seguridad (CSP sin scripts en línea, `X-Frame-Options`, HSTS, `Referrer-Policy`, `Permissions-Policy`); `npm run preview` las imita.
- ✅ Turnstile listo en el código (entrar, crear cuenta, recuperar contraseña); falta crear el widget en Cloudflare y activarlo (README).
- ✅ CI con GitHub Actions: tests y build en cada push; bundle separado (`supabase` + `index`) sin avisos de tamaño.
- Pendiente: rotar/quitar la clave de Gemini (ya no se usa: `AI_PROVIDER=deepseek`) y añadir el email de contacto en `public/privacidad.html`.

## Orden recomendado

1. **Fase 1, abrirla a amigos (10–20 personas)**: perfil con nombre y zona horaria, quitar Madrid y «Victor», módulos opcionales (turnos/FP), IA con límite por usuario, recuperar contraseña + Resend, borrar cuenta, política de privacidad.
2. **Fase 2, antes de compartirla en redes**: recargar menos, `api/tick` filtrado, límites de tamaño, cabeceras de seguridad, Turnstile, CI.
3. **Fase 3, con gente usándola**: backups, Sentry, métricas, bienvenida, dominio.

Coste esperado hasta unos cientos de usuarios: **5–15 €/mes** (DeepSeek) + dominio. Supabase y Vercel siguen gratis mientras no se cobre y no se pase de sus límites.
