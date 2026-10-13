# MVP-32 — Preview de Hosting por PR

- **Carril:** Compartido (`CR`: toca `.github` y `firebase.json`).
- **Agente:** Claude Code · **Modelo:** Sonnet 5.5 · **Esfuerzo:** medium
- **Auditor:** Gemini · auditoría liviana + leer los pasos del run
- **Rama:** `mvp-32-preview-hosting`
- **Depende de:** MVP-31 y MVP-05 mergeados.
- **Origen:** criterio de MVP-03 en la arquitectura §4 ("un PR muestra los checks y una URL de preview"), quitado de MVP-03 y decidido el 5/10 como ticket nuevo después de MVP-31 (H-06, P-06). El deploy a prod por tag queda para el Hito 1B, sin ticket todavía.

## Contexto a leer
- `docs/arquitectura-v3.md`: §1 (fila CI/CD), §4 (fila MVP-03).
- `docs/CI.md`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `firebase.json`, `.firebaserc`.
- `tickets/MVP-31.md` (mecanismo `DEPLOY_ENABLED`).

## Alcance
1. Target de Hosting en `firebase.json` apuntando al build de `apps/web` (`apps/web/dist`), con rewrite de SPA a `index.html`.
2. Workflow (o job en `ci.yml`) que en cada PR construye `apps/web` y publica un **preview channel** de Hosting en `qx-redespachos-dev` con expiración de 7 días, y comenta la URL en la PR.
3. Mismo interruptor que MVP-31: sin `DEPLOY_ENABLED = 'true'` el preview se omite y el resumen del run lo dice; con la variable y sin secrets, el job falla.
4. Las variables `VITE_*` de Firebase del proyecto dev se inyectan desde variables del repositorio, no desde el código.
5. Actualizar `docs/CI.md`.

## Archivos permitidos
`firebase.json` (solo `hosting`), `.github/workflows/**`, `docs/CI.md`, este ticket.

## Archivos prohibidos
Todo lo demás.

## Criterio de aceptación
1. Literal de la arquitectura §4 (MVP-03): **"Un PR muestra los checks y una URL de preview."**
2. Sin `DEPLOY_ENABLED`, el resumen del run dice que el preview está desactivado; con la variable y sin secrets, el job falla. Con la salida pegada.
3. Si el agente no tiene credenciales, deja el workflow verificado con `act` o con una PR de prueba que Franco dispara, y marca el punto 1 como pendiente de Franco.

## Plan
Plan aprobado por Franco (13/10/2026) con ajustes. Archivos a tocar: `firebase.json` (solo `hosting`), `.github/workflows/preview.yml` (nuevo), `.github/workflows/deploy.yml` (solo un comentario), `docs/CI.md`, este ticket.

1. `firebase.json`: quitar `target: "web"` del bloque `hosting`. Es un único sitio (el por defecto del proyecto) y `.firebaserc` no se toca.
2. `preview.yml` en `pull_request` (`opened`, `synchronize`, `reopened`). Permisos `contents: read`, `id-token: write`, `pull-requests: write`. `concurrency` por número de PR con `cancel-in-progress`.
3. `Check preview config`, en este orden: `DEPLOY_ENABLED` distinto de `true` → omite con resumen; autor de la PR `dependabot[bot]` (`github.event.pull_request.user.login`) o `head.repo.full_name` distinto de `github.repository` → omite con resumen; activado, de este repo y sin secrets o sin `VITE_FIREBASE_*` → falla. Nunca se omite por "secrets vacíos".
4. Build de `apps/web` con las seis `VITE_FIREBASE_*` desde `vars.*` (más `VITE_ALLOWED_EMAILS` y `VITE_ALLOWED_DOMAINS`, opcionales).
5. Deploy: `firebase hosting:channel:deploy pr-<número> --project qx-redespachos-dev --expires 7d --json --non-interactive > preview.json`. La URL se extrae con `jq -r '[.result[]? | .url][0] // empty'` (el JSON es `{"status":"success","result":{"<sitio>":{"url":…,"expireTime":…}}}`); sin URL, el paso falla.
6. Comentario con `marocchino/sticky-pull-request-comment@v3.0.5`, `header: firebase-preview`, y la URL también en el resumen del run.
7. `docs/CI.md`: sección nueva, variables y de dónde se sacan, riesgo de WIF por repositorio, login con Google en el preview, "Fuera de alcance" actualizado. `deploy.yml`: solo el comentario (sigue solo Functions).
8. Verificación: `pnpm install --frozen-lockfile`, `pnpm format`, `pnpm ci:run`; simulación con `bash -e` del bloque `Check preview config`; la PR real de MVP-32 es la prueba del criterio 1.

## PREGUNTAS
- **Decisión de Franco que se aparta del texto del ticket:** el alcance 3 dice "con la variable y sin secrets, el job falla". Se omite (con aviso en el resumen) si la PR es de Dependabot (`pull_request.user.login == 'dependabot[bot]'`, no `github.actor`) o de un fork, porque GitHub no les pasa secrets. En PRs de este repo, el comportamiento del texto se mantiene.
- **Para chequear a mano (Franco):**
  1. API `firebasehosting.googleapis.com` activa en `qx-redespachos-dev`.
  2. Sitio de Hosting por defecto creado.
  3. Las seis `VITE_FIREBASE_*` cargadas como variables de repositorio antes de abrir la PR (de dónde se sacan: `docs/CI.md`).
  4. Dominio del preview autorizado en Authentication si se quiere probar el login (ver `docs/CI.md`).
- **`VITE_ALLOWED_EMAILS` y `VITE_ALLOWED_DOMAINS` (MVP-05):** el build de `apps/web` las lee y con las dos vacías no entra nadie. El ticket pedía solo las `VITE_*` de Firebase. Las agregué al build como opcionales (si no existen, llegan vacías). Si se cargan, los emails quedan dentro del bundle público del preview (la URL es pública para quien la tenga). ¿Se cargan en el preview, o se prefiere ver solo el login?
- **`docs/FIREBASE.md`** queda desactualizado respecto de Hosting; está prohibido para este ticket.
- **Sin comprobar:** `roles/firebase.viewer` de `github-deploy` figura como "confirmar que se asignó" (CR-10). Si `hosting:channel:deploy` falla por permisos, mirar ahí primero.

---

## Nota de entrega
Usar la plantilla de `tickets/_TEMPLATE.md`.

- **Qué se hizo:** `preview.yml` publica en cada PR un preview channel `pr-<n>` de Hosting en `qx-redespachos-dev` (vence a los 7 días) y comenta la URL en un comentario fijo (`firebase-preview`). Usa el interruptor `DEPLOY_ENABLED` de MVP-31. `firebase.json` > `hosting` pierde el `target` y queda como sitio por defecto. `docs/CI.md` documenta el flujo, las variables, el riesgo de WIF y lo que queda fuera. `deploy.yml` solo cambió un comentario.
- **Commit:** `064e0e4` en la rama `mvp-32-preview-hosting` (sin push ni PR). La nota de entrega va en un commit aparte.
- **Archivos tocados:** `.github/workflows/preview.yml` (nuevo), `.github/workflows/deploy.yml` (comentario), `firebase.json`, `docs/CI.md`, `tickets/MVP-32.md`.
  `git diff --stat origin/main...HEAD` (al commit `064e0e4`): 5 archivos, 275 inserciones, 15 borrados.
- **Cómo probarlo:** cargar las seis `VITE_FIREBASE_*` como variables de repositorio (`docs/CI.md`) y abrir la PR de MVP-32: debe aparecer el comentario con la URL. Para el caso desactivado, poner `DEPLOY_ENABLED` en `false` y re-ejecutar el run.
- **Resultado de la verificación (13/10/2026, Node local 26.10.0; CI usa 22.x):**
  - `pnpm install --frozen-lockfile`: "Lockfile is up to date".
  - `Build shared` y `lint`: sin errores.
  - **`format:check`: falla, por archivos ajenos.** `prettier --check .` marca `tickets/CR-02-AUDITORIA.md` y `tickets/MVP-05-AUDITORIA.md`, que vienen así desde `origin/main` (entraron con MVP-05 y CR-02). `pnpm format` los reformatea, los revertí por estar fuera de mi alcance. Mis archivos pasan: `prettier --check .github docs/CI.md firebase.json tickets/MVP-32.md` → "All matched files use Prettier code style!". **El CI de la PR va a fallar en este paso hasta que alguien formatee esos dos archivos** (fuera de alcance, ver abajo).
  - Por eso `pnpm ci:run` corta en `format:check` y no llega solo a los pasos siguientes. Los corrí por separado: `pnpm typecheck` en verde (shared, motor, web, functions); `pnpm test` 37 archivos, 828 tests pasados (sin emuladores, ver abajo); `pnpm build` en verde (`apps/web/dist` generado, aviso de chunk > 500 kB que ya existía).
  - **No corrí** `firebase emulators:exec --only auth,firestore … "pnpm test"`: no toqué reglas ni Functions, y en esta máquina no hay un Java utilizable (ver nota de MVP-31).
- **Consumo real:** no aplica a código. El workflow solo se prueba en GitHub.
- **Evidencia del criterio de aceptación:**
  1. **"Un PR muestra los checks y una URL de preview": pendiente de Franco.** No tengo credenciales ni corrí ningún deploy. Lo prueba la PR de MVP-32 una vez cargadas las variables. Tampoco corrí `act`.
  2. **Interruptor, simulado en local** (extraje el bloque `run` de `Check preview config` con `js-yaml` y lo corrí con `bash -e`, con `GITHUB_OUTPUT` y `GITHUB_STEP_SUMMARY` a archivos; no es un run de GitHub):
     - Sin `DEPLOY_ENABLED`: exit 0, `enabled=false`, resumen "Preview de Hosting omitido … vale `(sin definir)`, no `true`".
     - `DEPLOY_ENABLED=false`: exit 0, igual, con "vale `false`".
     - `true` sin secrets: **exit 1**, `::error title=Faltan secrets del preview::DEPLOY_ENABLED es 'true' pero faltan: GCP_WORKLOAD_IDENTITY_PROVIDER GCP_SERVICE_ACCOUNT_EMAIL. …` y resumen "Preview de Hosting fallido: faltan secrets".
     - `true` con un solo secret: exit 1, nombra solo el que falta.
     - `true`, con secrets y sin `VITE_*`: exit 1, `::error title=Faltan variables VITE_ del preview … faltan: VITE_FIREBASE_AUTH_DOMAIN …` (las cinco que no cargué).
     - `true`, autor `dependabot[bot]`: exit 0, `enabled=false`, resumen "La PR es de Dependabot …".
     - `true`, `head.repo.full_name` distinto del repo: exit 0, `enabled=false`, resumen "La PR viene de un fork …".
     - `true` con todo cargado: exit 0, `enabled=true`.
     - Los tres workflows parsean con `js-yaml`; los pasos posteriores llevan `if: steps.preview_config.outputs.enabled == 'true'`.
     - **No verificado en GitHub** (a diferencia de MVP-31): falta un run real con cada valor de `DEPLOY_ENABLED`.
  3. **No corrido:** `jq` no está en esta máquina. La extracción `jq -r '[.result[]? | .url][0] // empty'` y la forma del JSON de `hosting:channel:deploy --json` salen de lo que conozco de `firebase-tools`, no de una salida real. Si el run falla en "Sin URL de preview", el log del paso imprime `preview.json` completo. Tampoco corrí `firebase hosting:channel:deploy` ni `--dry-run`.
- **Decisiones tomadas:**
  - Workflow aparte (`preview.yml`) y no un job en `ci.yml`: el token `id-token: write` no se mezcla con el job de validación.
  - Omitir Dependabot (por `pull_request.user.login`) y forks (por `head.repo.full_name`): decisión de Franco, se aparta del texto del alcance 3. Nunca se omite por secrets vacíos.
  - `firebase.json` > `hosting` sin `target`: un único sitio (el por defecto); `.firebaserc` no se toca.
  - Un push nuevo cancela el preview en curso (`cancel-in-progress`); un deploy cancelado a mitad puede dejar el canal con el contenido anterior.
  - Comentario fijo con `marocchino/sticky-pull-request-comment@v3.0.5`, la misma versión que usa `ci.yml`.
  - `VITE_ALLOWED_EMAILS` y `VITE_ALLOWED_DOMAINS` pasan al build como opcionales (ver PREGUNTAS).
- **Supuestos:**
  - `roles/firebasehosting.admin` alcanza para `hosting:channel:deploy`; `github-deploy` ya lo tiene según `docs/CI.md`. No lo verifiqué contra GCP.
  - La API `firebasehosting.googleapis.com` y el sitio por defecto existen (lo chequea Franco).
  - El `--json` incluye `result.<sitio>.url` y `expireTime`.
- **Fuera de alcance:**
  - `docs/FIREBASE.md` queda desactualizado respecto de Hosting: prohibido para este ticket, sin ticket.
  - Formatear `tickets/CR-02-AUDITORIA.md` y `tickets/MVP-05-AUDITORIA.md` (rompen `format:check` en `main`): sin ticket; hace falta un cambio que no sea de este carril, o Franco los formatea.
  - Cuenta de servicio solo para Hosting en el preview y limitar `github-deploy` a `refs/heads/main` (antes de prod): en "Fuera de alcance" de `docs/CI.md`, sin ticket.
  - Deploy de Hosting en vivo, y deploy a prod por tag: sin ticket (Hito 1B).
  - Borrar el canal al cerrar la PR: vence solo a los 7 días.
- **Riesgos y deuda** (qué conviene que el auditor mire primero):
  1. **Cualquier rama del repo se autentica como `github-deploy`** y podría desplegar Functions modificando el workflow. Detalle en `docs/CI.md`.
  2. **El preview no se probó con un run real** (criterio 1 y extracción de la URL); depende de las variables y de las verificaciones de Franco en PREGUNTAS.
  3. **El login con Google no funciona en la URL del preview** hasta autorizar el dominio en Authentication; los dominios cambian por PR.
  4. **`VITE_ALLOWED_*` quedan en el bundle público** si se cargan.
  5. **`format:check` rojo en CI** por los dos informes de auditoría ajenos: no es de este ticket, pero la PR lo va a mostrar.
