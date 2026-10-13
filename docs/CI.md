# CI/CD

Tres workflows de GitHub Actions: `ci.yml` valida cada PR (y cada push a `main`), `preview.yml` publica un preview de Hosting por PR y `deploy.yml` despliega a **dev** en cada push a `main`. No hay ningún workflow hacia prod.

## Node.js 22.x

Todos los workflows usan **Node 22.x fijo**, sin matrix. Coincide con el runtime de Cloud Functions 2ª gen (arquitectura v3 §1) y con `engines.node >=22` del `package.json` raíz. El borrador inicial del ticket decía 20.x; se cambió a 22.x por esa coincidencia con Functions.

## Runner y versiones de actions

Los tres workflows corren en **`runs-on: ubuntu-24.04` fijo**, no en `ubuntu-latest`. Entre el 19/10 y el 19/11/2026 GitHub mueve la etiqueta `ubuntu-latest` de Ubuntu 24.04 a 26.04 de forma gradual, y un run cualquiera de ese mes podría caer en otra imagen sin que nadie haya tocado el repo. El paso a 26.04 va en un `CR` aparte, con un run de prueba previo (CR-09).

Regla: **toda action se usa en una versión que declare `using: node24`** en su `action.yml`. GitHub quitó Node 20 de los runners el 23/09/2026. Se elige la mayor más reciente con `node24` y al menos un mes publicada, por etiqueta (sin SHA fijos).

| Action                                   | Versión  | Workflows              |
| ---------------------------------------- | -------- | ---------------------- |
| `actions/checkout`                       | `v6`     | `ci.yml`, `deploy.yml`, `preview.yml` |
| `actions/setup-node`                     | `v6`     | `ci.yml`, `deploy.yml`, `preview.yml` |
| `pnpm/action-setup`                      | `v6`     | `ci.yml`, `deploy.yml`, `preview.yml` |
| `marocchino/sticky-pull-request-comment` | `v3.0.5` | `ci.yml`, `preview.yml` |
| `actions/upload-artifact`                | `v6`     | `ci.yml`               |
| `google-github-actions/auth`             | `v3`     | `deploy.yml`, `preview.yml` |

`sticky-pull-request-comment` no publica la etiqueta flotante `v3`: se fija la versión exacta y Dependabot sube parches y menores.

**La versión de pnpm sale de `packageManager` en el `package.json` raíz** (`pnpm@9.15.9`), no del input `version` de `pnpm/action-setup`. Desde `v4`, esa action falla con "Multiple versions of pnpm specified" si los dos valores no coinciden exactamente; por eso los workflows no pasan `version`. Para cambiar de pnpm se cambia solo `packageManager`.

## CI en Pull Request (`.github/workflows/ci.yml`)

Se dispara en `pull_request` (cualquier rama destino) y en `push` a `main`. Un solo job, `validate`, con estos pasos en orden:

1. **Install:** `pnpm install --frozen-lockfile`. Falla si `pnpm-lock.yaml` no coincide con los `package.json`.
2. **Build shared:** `pnpm --filter @sistema-redespachos/shared build`. `packages/shared/dist` no está en git, y sin este paso `motor` y `functions` no compilan en cuanto importan `shared` (`TS2307`). Agregado en el FIX de MVP-04, también en `deploy.yml`.
3. **Lint:** `pnpm lint` (ESLint, 0 warnings).
4. **Format check:** `pnpm format:check` (`prettier --check .`). Estilo en `.prettierrc` (comillas simples, `printWidth` 100, `endOfLine: auto`; comillas dobles en YAML). Los archivos que hoy no cumplen el estilo figuran, uno por uno, en `.prettierignore` bajo `TEMPORAL`, hasta un `CR` de reformateo. Un archivo nuevo que no cumpla el estilo rompe este paso: corré `pnpm format` sobre ese archivo.
5. **Typecheck:** `pnpm typecheck` en todos los workspaces.
6. **Test packages/motor:** `vitest run packages/motor`. Es un paso separado para que MVP-15 le agregue el gate de casos dorados.
7. **Test con cobertura:** `firebase emulators:exec --only auth,firestore --project demo-qx-ci "pnpm test:coverage"`.
8. **Build:** `pnpm build`.
9. **Comentario de cobertura:** lee `coverage/coverage-summary.json` y publica (o actualiza) un único comentario fijo en la PR con una tabla de statements, branches, functions y lines.
10. **Artefacto:** sube `coverage/` como `coverage-report` (7 días), incluso si los tests fallan.

### Emuladores

- `--only auth,firestore`: solo los emuladores que usan los tests. Si se agregan tests de Functions o Storage, hay que sumarlos a la lista.
- `--project demo-qx-ci`: un proyecto con prefijo `demo-` hace que la CLI no busque credenciales ni toque recursos reales. Por eso CI de PR no necesita secrets.

### Cómo leer los logs

- En la PR, sección **Checks** → `CI / Lint, Typecheck, Test & Build` → **Details**. Cada paso se expande por separado; el que falló queda marcado en rojo.
- La salida del emulador (avisos de "not authenticated", códigos de color) aparece solo en el log del paso de tests, no en el comentario.
- Para ver qué líneas faltan cubrir: descargá el artefacto `coverage-report` del run (pestaña **Summary**) y abrí `index.html`.
- Localmente: `pnpm ci:run` equivale a CI (`Build shared`, lint, format check, typecheck, test y build), pero **no** corre `pnpm install --frozen-lockfile` ni los emuladores. La secuencia completa de `AGENTS.md` §5.5 es `pnpm install --frozen-lockfile && pnpm ci:run`. `pnpm test:coverage` genera `coverage/` (ignorado por git).

## Reglas de merge

- CI en verde es obligatorio para mergear a `main`.
- Un paso rojo (lint, typecheck, test o build) bloquea el merge.

## Cobertura

Vitest corre **una sola vez desde la raíz** con `vitest.config.ts` (no por paquete). Toma los tests de `packages/*/src` y `apps/*/src` y mide todo el código de esas carpetas.

Umbrales acordados (Vitest 2.x, forma válida: claves a nivel raíz de `coverage.thresholds` más un glob por paquete):

| Alcance | Umbral | Estado |
| --- | --- | --- |
| Global | 80% (lines, functions, branches, statements) | Definido, **no activo** |
| `packages/motor/src/**` | 90% | Definido, **no activo** |

**Por qué no están activos:** hoy el código es mayormente placeholder (motor ~9% real). Exigir el umbral obligaría a escribir tests que no validan lógica de negocio. Se activan descomentando el bloque `thresholds` de `vitest.config.ts` cuando haya código real que medir. Motor tiene que tener el 90% activo en **MVP-14**.

Nota: `thresholds: { global: {...} }` (estilo Jest) **no se aplica** en Vitest 2.x. Se ignora sin error. Se comprobó en MVP-03: con 0,65% de cobertura, el run salía con código 0.

## Deploy a dev (`.github/workflows/deploy.yml`)

Se dispara solo en `push` a `main`; nunca en PR. Pasos: Check deploy config → install → Build shared → lint → typecheck → test (emuladores) → build → autenticación a Google Cloud (Workload Identity Federation) → `firebase deploy --project qx-redespachos-dev --only functions`.

Solo despliega Functions: el Hosting en vivo no se despliega (el preview por PR vive en `preview.yml`, ver abajo). No despliega reglas de Firestore ni Storage.

### Activación: variable `DEPLOY_ENABLED`

El paso `Check deploy config` corre primero y decide (MVP-31, decisión P-05):

| `DEPLOY_ENABLED` (variable de repositorio) | Secrets      | Resultado                                                                                                                                                                                  |
| ------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ausente o distinto de `true`               | No importan  | Valida lint, typecheck, test y build; **no despliega**. El resumen del run (pestaña Summary) dice "Deploy a dev desactivado" y los pasos de autenticación y deploy figuran como `skipped`. |
| `true`                                     | Falta alguno | El job **falla** en `Check deploy config` con `::error` y el nombre de cada secret faltante, también en el resumen.                                                                        |
| `true`                                     | Los dos      | Autentica y despliega.                                                                                                                                                                     |

Secrets (nunca van en el repo):

- `GCP_WORKLOAD_IDENTITY_PROVIDER`: `projects/<n>/locations/global/workloadIdentityPools/<pool>/providers/<provider>`.
- `GCP_SERVICE_ACCOUNT_EMAIL`: service account con permisos de deploy de Functions en `qx-redespachos-dev`.

La variable se crea en Settings → Secrets and variables → Actions → **Variables**. Los dos secrets van en la misma pantalla, pestaña **Secrets**, sección **Repository secrets**. Cargados como variables o como *Environment secrets*, el workflow no los ve (`secrets.X` vacío) y `Check deploy config` falla con "faltan secrets": pasó el 8/10/2026, en los intentos 2 a 5 del run de abajo.

**Estado (9/10/2026):** `DEPLOY_ENABLED = true` y los dos secrets cargados. Primer deploy real: run [37676044027](https://github.com/fFrancko/sistema-redespachos/actions/runs/37676044027), intento 8 (8/10/2026), en verde con `Authenticate to Google Cloud` y `Deploy Functions` en `success`. Desde entonces **todo merge a `main` despliega Functions a dev**.

### Infraestructura en Google Cloud (dev)

Configurada a mano por Franco el 8/10/2026 en `qx-redespachos-dev` (número de proyecto `775726638194`), con su cuenta owner y Cloud Shell. Nada de esto vive en el repo: esta sección es el registro para auditarlo y para repetirlo en prod (Hito 1B).

**Workload Identity Federation.** GitHub Actions entra a Google Cloud sin claves: presenta un token OIDC firmado por GitHub y Google lo cambia por credenciales de corta duración de una cuenta de servicio. Los valores de abajo son identificadores, no credenciales; la seguridad está en la condición del provider.

| Recurso | Valor |
| --- | --- |
| Cuenta de servicio | `github-deploy@qx-redespachos-dev.iam.gserviceaccount.com` (valor de `GCP_SERVICE_ACCOUNT_EMAIL`) |
| Pool | `github-pool` (global) |
| Provider | `github-provider`, OIDC, emisor `https://token.actions.githubusercontent.com` |
| Mapeo de atributos | `google.subject=assertion.sub`, `attribute.repository=assertion.repository`, `attribute.ref=assertion.ref` |
| Condición del provider | `assertion.repository == 'fFrancko/sistema-redespachos'`: ningún otro repo puede usarlo |
| Valor de `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/775726638194/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| Quién puede usar la cuenta | `roles/iam.workloadIdentityUser` sobre la cuenta, para `principalSet://iam.googleapis.com/projects/775726638194/locations/global/workloadIdentityPools/github-pool/attribute.repository/fFrancko/sistema-redespachos` |

La condición limita por repositorio, no por rama: cualquier workflow de este repo puede autenticarse. Hoy solo `deploy.yml` pide el token (`id-token: write`) y corre solo en `main`. `preview.yml` (MVP-32) también pide el token, y lo pide desde ramas de PR, así que no se puede limitar a `main` sin romperlo. Ver el riesgo en "Preview de Hosting por PR".

**Roles de `github-deploy`** (a nivel proyecto):

| Rol | Para qué |
| --- | --- |
| `roles/cloudfunctions.admin` | Crear y actualizar Functions |
| `roles/run.admin` | Functions 2ª gen corre sobre Cloud Run |
| `roles/cloudbuild.builds.editor` | El deploy compila el código en Cloud Build |
| `roles/artifactregistry.writer` | Cloud Build publica la imagen en Artifact Registry |
| `roles/iam.serviceAccountUser` | Desplegar funciones que corren como la cuenta de servicio por defecto |
| `roles/serviceusage.serviceUsageConsumer` | La CLI de Firebase consulta qué APIs están activas |
| `roles/firebasehosting.admin` | Publicar los preview channels de Hosting (`preview.yml`, MVP-32) |
| `roles/firebaseextensions.viewer` | La CLI lista las extensiones del proyecto en cada deploy de Functions |
| `roles/firebase.viewer` | Lectura del proyecto Firebase; sugerido, **confirmar que se asignó** (ver PREGUNTAS de CR-10) |

La cuenta **no** puede activar APIs, y es intencional: si un deploy pide una API nueva, falla con "Permissions denied enabling `<api>`" y la activa un owner a mano.

**APIs activadas a mano** (además de las que ya traía el proyecto de Firebase): `iam`, `iamcredentials`, `sts`, `serviceusage`, `cloudfunctions`, `cloudbuild`, `artifactregistry`, `run`, `firebaseextensions`, `eventarc`, `pubsub`, `storage`, `cloudbilling` y `orgpolicy` (esta última solo para listar políticas de la organización). Todas `<nombre>.googleapis.com`. La CLI de Firebase pide `firebaseextensions` y `eventarc` en todo deploy de Functions 2ª gen, aunque no se usen extensiones ni triggers.

Pendientes conocidos: Cloud Tasks (`cloudtasks`) y, si hay funciones programadas, Cloud Scheduler (`cloudscheduler`), con sus roles para `github-deploy`, cuando llegue MVP-22. Hay que activarlos antes del merge del ticket que los use, o ese deploy falla.

**Verificar el estado** (Cloud Shell, solo lectura):

```bash
gcloud config set project qx-redespachos-dev
gcloud projects get-iam-policy qx-redespachos-dev \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:github-deploy@qx-redespachos-dev.iam.gserviceaccount.com" \
  --format="table(bindings.role)"
gcloud iam workload-identity-pools providers describe github-provider \
  --location=global --workload-identity-pool=github-pool \
  --format="value(name,state,attributeCondition)"
gcloud services list --enabled --format="value(config.name)"
```

**Prueba de humo del deploy:** la callable `helloWorld` (`southamerica-east1`) responde por HTTP. El 8/10/2026 devolvió `{"result":{"message":"Hello from Firebase Cloud Functions","estados_pedido":[…12 estados…]}}`:

```bash
curl -s -X POST -H "Content-Type: application/json" -d '{"data":{}}' \
  https://helloworld-cz4442kjva-rj.a.run.app
```

**Facturación:** el proyecto está en Blaze sobre la cuenta de facturación asignada por Franco (confirmado el 9/10/2026). La alerta de presupuesto (criterio de MVP-02) sigue pendiente.

### Empaquetado de `apps/functions`

Cloud Build instala las dependencias con npm, que no entiende `workspace:*`. Por eso `firebase.json` usa `source: "apps/functions/dist"` y un `predeploy` que construye `shared` y `functions` y corre `deploy:prepare` (`apps/functions/scripts/prepareDeploy.mjs`). Ese script borra y rearma `apps/functions/dist/` con:

- `lib/`: el JS compilado;
- `vendor/`: `@sistema-redespachos/shared` empaquetado con `pnpm pack`;
- `package.json` generado: `shared` como `file:vendor/<tgz>`, `firebase-admin` y `firebase-functions` fijados a la versión instalada (`pnpm list --prod --json`), y `zod` y `decimal.js` en `overrides`.

Las dependencias transitivas más profundas no quedan fijadas: Cloud Build no recibe un lockfile.

### Functions en local (emulador)

El emulador lee `apps/functions/dist` y no corre el `predeploy`. Flujo:

1. `pnpm --filter @sistema-redespachos/shared build` (una vez, y cada vez que cambie `shared`).
2. `pnpm --filter @sistema-redespachos/functions dev`: compila, arma `dist/` y deja `tsc --watch` escribiendo en `dist/lib`.
3. En otra terminal, `pnpm dev:emulator`: el emulador vigila `dist/` y recarga las funciones con cada cambio en `src`.

En local, `dist/` no tiene `node_modules`: las dependencias se resuelven subiendo a `apps/functions/node_modules`.

## Preview de Hosting por PR (`.github/workflows/preview.yml`)

Se dispara en `pull_request` (`opened`, `synchronize`, `reopened`). Un solo job, con permisos `contents: read`, `id-token: write` y `pull-requests: write`, y `concurrency` por número de PR con `cancel-in-progress` (un push nuevo cancela el preview en curso). Pasos: `Check preview config` → install → `Build shared` → build de `apps/web` → autenticación a Google Cloud (la misma Workload Identity Federation de `deploy.yml`) → `firebase hosting:channel:deploy pr-<número> --project qx-redespachos-dev --expires 7d --json` → comentario en la PR.

Cada PR tiene su canal `pr-<número>` en el sitio de Hosting por defecto de `qx-redespachos-dev`; vence a los 7 días y el vencimiento se renueva con cada push. La URL sale del `--json` (`result.<sitio>.url`, con `jq`) y se publica en un comentario fijo de la PR (header `firebase-preview`, que se actualiza en cada push) y en el resumen del run. El sitio sale de `firebase.json` > `hosting`: `public: apps/web/dist` y rewrite de SPA a `/index.html`. Ese bloque no lleva `target`: es un único sitio, el por defecto del proyecto, y `.firebaserc` no mapea targets.

### Activación

Mismo interruptor que el deploy (`DEPLOY_ENABLED`, MVP-31). `Check preview config` decide en este orden:

| Caso | Resultado |
| --- | --- |
| `DEPLOY_ENABLED` ausente o distinto de `true` | El job termina en verde y **no publica**. El resumen del run dice "Preview de Hosting omitido: … `DEPLOY_ENABLED` vale …"; build, autenticación y deploy figuran como `skipped`. |
| PR de Dependabot (`github.event.pull_request.user.login == dependabot[bot]`) | Se omite, con aviso en el resumen. GitHub no les pasa secrets a sus workflows. |
| PR de un fork (`head.repo.full_name` distinto de `github.repository`) | Se omite, con aviso en el resumen, por el mismo motivo. |
| `true`, PR de este repo y falta algún secret | El job **falla** en `Check preview config`, con `::error` y el nombre de cada secret faltante. |
| `true`, PR de este repo y falta alguna variable `VITE_FIREBASE_*` | El job **falla**, con `::error` y el nombre de cada variable faltante. |
| `true`, todo cargado | Construye, publica y comenta la URL. |

Dependabot y forks se detectan por el autor de la PR y por el repo de origen, nunca por "secrets vacíos": con la variable en `true`, una PR del repo que no tenga los secrets tiene que fallar, no omitirse en silencio. Omitir Dependabot y forks se aparta del texto de MVP-32 ("con la variable y sin secrets, el job falla"); lo decidió Franco.

### Variables del repositorio

Settings → Secrets and variables → Actions → **Variables** (no Secrets, ni Environment variables):

| Variable | Obligatoria | De dónde sale |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | Sí | Config de la app web de Firebase (`apiKey`) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Sí | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | Sí | `projectId` (`qx-redespachos-dev`) |
| `VITE_FIREBASE_STORAGE_BUCKET` | Sí | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sí | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | Sí | `appId` |
| `VITE_ALLOWED_EMAILS` | No | Lista de acceso de la app (MVP-05), emails separados por coma |
| `VITE_ALLOWED_DOMAINS` | No | Lista de acceso de la app (MVP-05), dominios separados por coma |

Los seis `VITE_FIREBASE_*` salen de la Consola de Firebase → Configuración del proyecto (el engranaje) → General → **Tus apps** → app web → "Configuración del SDK" → Config. Si el proyecto no tiene una app web, se crea ahí mismo con "Agregar app" → Web. Son los mismos nombres que lee `apps/web/src/firebase.ts`.

La config web de Firebase no es secreta (queda dentro del JS que baja el navegador), por eso va en variables y no en secrets. Lo mismo vale para `VITE_ALLOWED_EMAILS` y `VITE_ALLOWED_DOMAINS`: **cualquier valor que se cargue ahí queda en el bundle público del preview**, y la URL del preview es pública para quien la tenga. Si no se cargan, la lista queda vacía y no entra nadie (es un filtro de la UI; la verificación real llega en MVP-08).

### Login con Google en la URL del preview

El login con Google **no funciona en la URL del preview** hasta que ese dominio esté autorizado. Cada preview channel tiene un dominio propio (`qx-redespachos-dev--pr-<n>-<hash>.web.app`) que cambia por PR. En Authentication → Configuración → Dominios autorizados hay que sumar los dominios necesarios; Firebase no acepta comodines. Sin eso, el popup de Google falla con `auth/unauthorized-domain`. Mientras no se autorice, el preview sirve para revisar el shell y la pantalla de login, no el ingreso.

### Riesgo: cualquier rama se autentica como `github-deploy`

La condición del provider de Workload Identity limita por repositorio, no por rama, y `preview.yml` corre con el workflow de la propia PR. Quien pueda abrir una rama en este repo puede modificar el workflow, autenticarse como `github-deploy` y, con sus roles (`cloudfunctions.admin`, `run.admin`, etc.), desplegar Functions a `qx-redespachos-dev` sin pasar por `main`. Con un solo equipo de confianza es aceptable en dev; **no lo es para prod**. Las dos mitigaciones están en "Fuera de alcance": una cuenta de servicio solo para el preview, con `roles/firebasehosting.admin` y nada más, y limitar `github-deploy` a `refs/heads/main`. Este ticket no toca GCP.

### Qué no hace

- No despliega Hosting en vivo ni a prod (ver "Fuera de alcance").
- No corre los tests ni el lint: eso es `ci.yml`. El preview solo construye `shared` y `apps/web`.
- No borra el canal al cerrar la PR; vence solo a los 7 días.

### Requisitos en Google Cloud (a verificar por Franco)

- API `firebasehosting.googleapis.com` activa en `qx-redespachos-dev`.
- Sitio de Hosting por defecto creado (Consola → Hosting → "Comenzar").
- `github-deploy` con `roles/firebasehosting.admin` (ya figura en la tabla de roles).

## Dependabot

Abre PRs semanales de npm y GitHub Actions, **solo de parches y versiones menores**: `.github/dependabot.yml` ignora `version-update:semver-major` en los dos ecosistemas (`dependency-name: "*"`). Las majors entran a mano como `CR: deps` (decisión P-12, H-08). Ningún agente mergea ni aprueba PRs de Dependabot: las revisa Franco. Las 15 PRs abiertas al cierre de la Ola 0 son todas majors y se cierran a mano. Las majors de GitHub Actions se suben a mano como `CR` (el primero fue CR-09, ver "Runner y versiones de actions") y las PRs de Dependabot que proponen esas majors se cierran.

Firestore: `firestore.rules` es *deny-all* hasta MVP-07; `deploy.yml` no despliega reglas.

## Fuera de alcance (deuda)

- **Cuenta de servicio solo para Hosting en el preview:** hoy el preview usa `github-deploy`, que también despliega Functions. Una cuenta aparte con solo `roles/firebasehosting.admin` (y su propio provider o binding) cierra el riesgo de "Preview de Hosting por PR". Sin ticket.
- **Limitar `github-deploy` a `refs/heads/main`** (condición del provider o del binding por `attribute.ref`), antes de existir prod y una vez que el preview use su cuenta propia. Sin ticket.
- **Deploy de Hosting en vivo** (dev y prod): sin ticket; el deploy a prod por tag es del Hito 1B.
- **Deploy a prod por tag:** ticket aparte. Requiere repetir en el proyecto de prod la sección "Infraestructura en Google Cloud (dev)".
- **`firebase-functions` 5.1.1:** la CLI avisa en cada deploy que está desactualizada. Subirla es una major: `CR: deps` aparte, con prueba de deploy real.
