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
