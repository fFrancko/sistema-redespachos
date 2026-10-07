# MVP-31 — Deploy de `apps/functions`

- **Carril:** Compartido (`CR`). Toca `.github`, `firebase.json`, `apps/functions/tsconfig.json` y `apps/functions/package.json`.
- **Agente:** Claude Code · **Modelo:** Opus 5.5 · **Esfuerzo:** high
- **Auditor:** Gemini · auditoría estándar + leer los pasos del run (un paso `skipped` que debía correr es hallazgo)
- **Rama:** `mvp-31-deploy-functions`
- **Depende de:** MVP-03 mergeado.
- **Origen:** evidencia levantada durante el `fix(shared)` de MVP-04. **No es un hallazgo de la auditoría de MVP-04**: el deploy está roto desde antes de ese ticket.

## Contexto

El criterio de aceptación de MVP-03 dice "deploy a dev en merge". No se cumple: el deploy de `functions` falla, y hoy está enmascarado porque el paso `Check deploy secrets` de `deploy.yml` omite el deploy con un `::warning` y el job sale verde mientras falten `GCP_WORKLOAD_IDENTITY_PROVIDER` y `GCP_SERVICE_ACCOUNT_EMAIL`.

Evidencia:

- **Sin punto de entrada:** `apps/functions/package.json` no declara `main` ni `engines`, y no existe `apps/functions/index.js`.
- **Build sin emisión:** `apps/functions/tsconfig.json` declara `outDir: "./lib"` pero no sobrescribe el `noEmit: true` que hereda del `tsconfig.json` raíz, así que `pnpm build` no genera nada. `lib/` además está en `.gitignore` (l.46).
- **Sin predeploy:** `firebase.json` declara `"source": "apps/functions"` y no define `predeploy`.
- **`workspace:*` en deploy:** desde el `fix(shared)`, `apps/functions` declara `@sistema-redespachos/shared` con el protocolo `workspace:`, que npm no resuelve en el deploy de Firebase.

## Alcance

1. `apps/functions/tsconfig.json`: `"noEmit": false`.
2. `apps/functions/package.json`: `main` apuntando al entry compilado en `lib/`, `engines.node` acorde al runtime de Functions 2ª gen, y el script de build.
3. Resolver el empaquetado de `packages/shared` para el deploy. Evaluá las opciones y justificá la elegida en la nota de entrega:
   - `predeploy` en `firebase.json` que construya `shared` y lo copie o empaquete dentro de `apps/functions`;
   - `pnpm deploy --filter` a un directorio de deploy con las dependencias resueltas;
   - bundle de `apps/functions` con las dependencias de workspace embebidas.
4. `deploy.yml`: que la ausencia de secrets **falle** el job en lugar de avisar y seguir en verde. Hoy ese comportamiento esconde el problema y va a esconder los próximos.
5. Verificá que `ci.yml` y `deploy.yml` conserven el paso `Build shared` antes de `Lint`.

### Agregado en el cierre de la Ola 0 (`docs/ola-0/informe-validacion.md`, H-05 y H-09)

6. **Functions de 2ª gen y región.** El `helloWorld` actual se registra como 1ª gen (`firebase-functions` 5.1.1, `platform: 'gcfv1'`), contra la v3 §1. Reemplazalo por una callable de ejemplo con `firebase-functions/v2/https` y `region: 'southamerica-east1'` que importe algo de `@sistema-redespachos/shared`.
7. **`NodeNext` en `apps/functions`.** Hoy hereda `moduleResolution: bundler` de la raíz: un import relativo sin `.js` pasa el typecheck y falla al cargar en Node. Mismo esquema que `packages/shared`.
8. **Registro de Functions sin índice compartido** (decidido el 5/10, P-07): `apps/functions/src/index.ts` queda con una línea por cada dominio de §3.8 (`auth`, `admin`, `postalRouter`, `suppliers`, `tariffs`, `emailTemplates`, `orders`, `proformas`, `emails`, `settlement`, `purchaseOrders`, `reports`) que reexporta un `index.ts` de dominio vacío. Después de este ticket, el índice raíz no se edita más; cada carril edita los índices de sus dominios.
9. **Punto 4, decidido el 5/10 (P-05):** el deploy se activa con la variable de repositorio `DEPLOY_ENABLED`. Con `DEPLOY_ENABLED = 'true'` y algún secret ausente, el job falla con `exit 1`; con la variable ausente o en otro valor, el deploy se omite con un aviso explícito en el resumen del job (`$GITHUB_STEP_SUMMARY`), no con un warning que pase inadvertido.
10. **Proyecto real:** el proyecto de dev es `qx-redespachos-dev` (ya configurado en `.firebaserc` y `deploy.yml`).

## Fuera de alcance

- Cualquier cambio en `packages/shared`, `packages/motor` o el código de negocio de `apps/functions`.
- Los secrets de GCP: los configura Franco.

## Criterio de aceptación

1. `pnpm build` genera `apps/functions/lib` con un entry válido, y la salida pegada.
2. `firebase deploy --only functions --project qx-redespachos-dev` publica, y una callable responde. Si no tenés credenciales, dejá el comando y la verificación local con los emuladores, y marcá el punto como pendiente de Franco explícitamente.
3. Con `DEPLOY_ENABLED = 'true'` y sin los secrets, el job de deploy falla con un mensaje claro; sin la variable, el resumen del run dice que el deploy está desactivado. Con la salida pegada.
4. `lint`, `typecheck`, `test` y `build` en verde sobre la rama, con la secuencia de `AGENTS.md` §5.5.
5. Nota de entrega con la opción de empaquetado elegida y por qué.
6. El JS emitido de `apps/functions/lib` carga con Node puro (`node --input-type=module -e "import('./apps/functions/lib/index.js')"`) y la callable de ejemplo es de 2ª gen en `southamerica-east1`.

## Plan

Aprobado por Franco el 7/10 con la opción 1 y estos ajustes, ya incorporados. Worktree propio en `../sistema-redespachos-mvp31`, rama `mvp-31-deploy-functions` desde `origin/main` (`599480b`).

1. `apps/functions/tsconfig.json`: `noEmit: false` y `module`/`moduleResolution` `NodeNext` (como `shared`); sigue incluyendo los tests, así que `typecheck` los cubre. `tsconfig.build.json` (nuevo) lo extiende, excluye `src/**/*.test.ts`, emite a `lib/` y no emite `.d.ts` (`apps/functions` no se consume como librería).
2. `apps/functions/package.json`: `main: "lib/index.js"`, `engines.node: "22"`, `build: "tsc -p tsconfig.build.json"`, `deploy:prepare` y `dev`.
3. Empaquetado (opción 1, `predeploy`): `apps/functions/scripts/prepareDeploy.mjs` borra y rearma `apps/functions/dist/` (ignorado por git y Prettier por la regla `dist`) con `lib/` copiado, `shared` empaquetado con `pnpm pack` en `vendor/*.tgz` y un `package.json` generado. `firebase.json`: `source: "apps/functions/dist"`, el mismo `ignore` (incluye `node_modules`) y `predeploy` = build de `shared` + build de `functions` + `deploy:prepare`.
4. Versiones: el script lee `pnpm list --prod --json --depth 1` en `apps/functions` (sin parsear el YAML del lockfile ni sumar dependencias). Fija `firebase-admin` y `firebase-functions` a la versión instalada y pone en `overrides` las dependencias de `shared` (`zod`, `decimal.js`). Las transitivas más profundas quedan sin lock en Cloud Build.
5. Desarrollo local: `pnpm --filter @sistema-redespachos/functions dev` (build, `deploy:prepare` y `tsc --watch` con salida a `dist/lib`) más `pnpm dev:emulator` en otra terminal.
6. Índice raíz con 12 líneas `export * as <dominio>` (despliegan como `<dominio>-<función>`) más la línea de `helloWorld` (P-2); 12 `src/<dominio>/index.ts` con `export {}` (P-1). Imports con `.js`.
7. Región con `setGlobalOptions`: en `src/globalOptions.ts`, importado en la primera línea de `index.ts` (ver el desvío en PREGUNTAS). `helloWorld` con `firebase-functions/v2/https`, devuelve `ORDER_STATUSES` de `shared`.
8. `deploy.yml`: `Check deploy config` justo después de Checkout, con la lógica de `DEPLOY_ENABLED` del punto 9 del alcance, y deploy `--only functions` (P-3).

## PREGUNTAS

- **P-1. Decidido por Franco (7/10):** índices de dominio en `apps/functions/src/<dominio>/index.ts`, que reexportan de `callables/<dominio>`, `triggers/<dominio>` y `workers/<dominio>`. **Línea exacta para `AGENTS.md` §3** (la aplica Franco), como viñeta nueva debajo de la tabla:

  > - **Índices de Functions (desde MVP-31):** `apps/functions/src/index.ts` tiene una línea fija por dominio de §3.8 y no se edita más. Cada dominio tiene su `apps/functions/src/<dominio>/index.ts`, que es del carril dueño del dominio (A: `postalRouter`, `tariffs`, `orders`; B: el resto) y reexporta lo de `callables/<dominio>`, `triggers/<dominio>` y `workers/<dominio>`. Las funciones se despliegan como `<dominio>-<función>` (p. ej. `orders-importBatch`).

- **P-2. Decidido por Franco (7/10):** `helloWorld` va en una línea del índice raíz. Sacarla después es un `CR`.
- **P-3. Decidido por Franco (7/10):** `deploy.yml` despliega `--only functions` hasta que el ticket de Hosting mapee el target `web` en `.firebaserc`.
- **P-4. Decidido por Franco (7/10):** actualizar `docs/CI.md`. `docs/` es compartido (`AGENTS.md` §3), así que no lo edito. **Texto propuesto** para reemplazar la sección `## Deploy a dev` completa, hasta antes de `## Dependabot`:

  ```markdown
  ## Deploy a dev (`.github/workflows/deploy.yml`)

  Se dispara solo en `push` a `main`; nunca en PR. Pasos: Check deploy config → install → Build shared → lint → typecheck → test (emuladores) → build → autenticación a Google Cloud (Workload Identity Federation) → `firebase deploy --project qx-redespachos-dev --only functions`.

  Solo despliega Functions: Hosting vuelve cuando se mapee el target `web` en `.firebaserc`. No despliega reglas de Firestore ni Storage.

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

  La variable se crea en Settings → Secrets and variables → Actions → Variables.

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
  ```

  Además, `docs/FIREBASE.md` (línea 49) dice que el deploy "hoy se omite por falta de secrets" y que `apps/functions` "todavía no es desplegable (MVP-31)"; con este ticket queda desactualizado.

- **CR propuesto: `CR: eslint — ignorar salidas de build anidadas`.** Lo registra Franco aparte; no creo el archivo para no chocar con la numeración de otros agentes. Texto:

  > `eslint.config.js` ignora `lib/**` y `dist/**` solo en la raíz, pero `pnpm lint` recorre `apps/functions` y `packages`. Después de un build local, lintea `apps/functions/lib`, `apps/functions/dist` y `packages/*/dist`. En CI no se nota porque lint corre antes de build, pero un `pnpm ci:run` repetido en local puede dar rojo por código generado. Evidencia en MVP-31: mientras `functions` emitía `.d.ts`, `pnpm lint` falló por `no-explicit-any` en `apps/functions/lib/callables/helloWorld.d.ts`. MVP-31 lo esquiva sin emitir `.d.ts` en `functions`, pero la regla sigue frágil. Cambio: agregar `'**/lib/**'` y `'**/dist/**'` a `ignores`. Ojo: `apps/functions/src/lib/` es código fuente compartido y quedaría ignorado con `'**/lib/**'`, así que conviene `'apps/functions/lib/**'` más `'**/dist/**'`, o excluir `src/lib` explícitamente.

- **Desvío respecto del ajuste 5 de Franco (para confirmar):** pidió `setGlobalOptions` "en `src/index.ts`". En ESM los imports de un módulo se evalúan antes que su cuerpo, y `onCall` de `firebase-functions` 5.1.1 copia las opciones globales al definirse la función. Con la llamada en el cuerpo de `index.ts`, el JS emitido cargado con Node deja `helloWorld` **sin región** (`region: undefined`, verificado). Por eso la llamada vive en `src/globalOptions.ts` y `index.ts` la importa en su primera línea. Si preferís otra forma, avisame.

---

## Nota de entrega

- **Qué se hizo:** `apps/functions` emite JS ESM con `NodeNext` a `lib/`. El deploy se arma con `predeploy` en `apps/functions/dist/`, con `shared` empaquetado. `helloWorld` es una callable de 2ª gen en `southamerica-east1` que usa `shared`. El índice raíz tiene una línea por dominio de §3.8 hacia 12 índices vacíos. `deploy.yml` decide con `DEPLOY_ENABLED`: si está activado y faltan secrets, falla; si está desactivado, lo dice en el resumen. Despliega solo Functions.
- **Commit:** `29a2757` en `mvp-31-deploy-functions` (código y plan); esta nota va en el commit siguiente. Sin push ni PR.
- **Archivos tocados** (`git diff --stat origin/main...HEAD` al commit `29a2757`):

  ```
   .github/workflows/deploy.yml               | 59 +++++++++++++-----
   apps/functions/package.json                | 10 ++-
   apps/functions/scripts/prepareDeploy.mjs   | 99 ++++++++++++++++++++++++++++++
   apps/functions/src/{admin,auth,emailTemplates,emails,orders,postalRouter,
     proformas,purchaseOrders,reports,settlement,suppliers,tariffs}/index.ts  | 3 + c/u
   apps/functions/src/callables/helloWorld.ts |  9 +++
   apps/functions/src/globalOptions.ts        |  7 +++
   apps/functions/src/index.test.ts           | 49 +++++++++++++++
   apps/functions/src/index.ts                | 20 ++++--
   apps/functions/src/nodeRuntime.test.ts     | 56 +++++++++++++++++
   apps/functions/tsconfig.build.json         |  8 +++
   apps/functions/tsconfig.json               | 10 +--
   firebase.json                              |  9 ++-
   tickets/MVP-31.md                          | 72 +++++++++++++++++++++-
   24 files changed, 413 insertions(+), 31 deletions(-)
  ```

  Sin cambios en `packages/*`, `pnpm-lock.yaml`, `docs/`, `AGENTS.md`, `.gitignore` ni `eslint.config.js`.

- **Cómo probarlo:**

  ```bash
  pnpm install --frozen-lockfile && pnpm format && pnpm ci:run
  node --input-type=module -e "import('./apps/functions/lib/index.js').then(m => console.log(m.helloWorld.__endpoint.platform, m.helloWorld.__endpoint.region))"
  pnpm --filter @sistema-redespachos/functions build && pnpm --filter @sistema-redespachos/functions deploy:prepare
  # emulador: terminal 1
  pnpm --filter @sistema-redespachos/functions dev
  # terminal 2
  pnpm exec firebase emulators:start --only functions --project demo-qx-ci
  curl -X POST -H "Content-Type: application/json" -d '{"data":{}}' http://127.0.0.1:5001/demo-qx-ci/southamerica-east1/helloWorld
  # deploy real (pendiente de Franco, con credenciales)
  pnpm exec firebase deploy --only functions --project qx-redespachos-dev
  ```

- **Resultado de la verificación** (`AGENTS.md` §5.5, desde estado limpio: se borraron `packages/*/dist`, `apps/*/dist`, `apps/functions/lib` y `coverage` antes de correr; exit 0; extracto de la salida real):

  ```
  Lockfile is up to date, resolution step is skipped
  Already up to date
  > prettier --write .            (todos "unchanged" salvo lo propio ya formateado)
  > pnpm --filter @sistema-redespachos/shared build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
  > tsc                                          (shared)
  > eslint apps/web/src apps/functions packages --max-warnings 0
  > prettier --check .
  All matched files use Prettier code style!
  > pnpm -r typecheck
  packages/shared typecheck: Done
  apps/web typecheck: Done
  packages/motor typecheck: Done
  apps/functions typecheck: Done
  > vitest run
   ✓ apps/functions/src/nodeRuntime.test.ts (1 test) 4414ms
   ✓ apps/functions/src/index.test.ts (3 tests) 2ms
   Test Files  30 passed (30)
        Tests  587 passed (587)
  > pnpm -r build
  packages/shared build: Done
  packages/motor build: Done
  apps/functions build: Done
  apps/web build: Done
  ```

  No corrí los tests con los emuladores de Auth y Firestore (`emulators:exec --only auth,firestore`): en esta máquina no hay un Java utilizable (solo un JRE 6), y el emulador de Firestore lo necesita. Los tests de este ticket no usan Firestore; ese paso lo corre CI. Node local: 26.10.0 (CI usa 22.x). Por eso pnpm avisa `Unsupported engine` con `engines.node: "22"`; es solo un aviso.

- **Consumo real:**
  - **Node puro sobre el build (criterio 6):** `{"platform":"gcfv2","region":["southamerica-east1"],"callable":{},"exports":["admin","auth","emailTemplates","emails","helloWorld","orders","postalRouter","proformas","purchaseOrders","reports","settlement","suppliers","tariffs"]}`.
  - **Simulación de Cloud Build:** copié `apps/functions/dist` fuera del repo (sin `node_modules` arriba). Ahí corrí `npm install` (npm 11.19.1) contra el registro y lo cargué con Node. Se instaló `firebase-functions 5.1.1`, `firebase-admin 12.7.0`, `@sistema-redespachos/shared 0.0.1` (desde el `.tgz`), `zod 3.25.76` y `decimal.js 10.6.0`. Resultado: `{"platform":"gcfv2","region":["southamerica-east1"],"callable":true,"exports":13}`, y `helloWorld.run` devolvió los 12 `estados_pedido` de `shared`.
  - **Emulador de Functions (`--project demo-qx-ci`):** `Watching "...\apps\functions\dist"`, `Loaded functions definitions from source: helloWorld`, `http function initialized (http://127.0.0.1:5001/demo-qx-ci/southamerica-east1/helloWorld)`. El `curl` respondió `{"result":{"message":"Hello from Firebase Cloud Functions","estados_pedido":["CON_ERROR",…,"CANCELADO"]}}`.
  - **Recarga:** con `dev` corriendo, cambié el mensaje en `src/callables/helloWorld.ts`. `tsc --watch` recompiló a `dist/lib` y unos 8 s después el emulador respondió el mensaje nuevo, sin reiniciarlo. El cambio se revirtió.
  - **`predeploy`:** los tres comandos de `firebase.json`, corridos desde la raíz sin `lib/`, `dist/` ni `packages/shared/dist`, arman `dist/{lib,package.json,vendor/sistema-redespachos-shared-0.0.1.tgz}`. `prepareDeploy` borra `dist/` al empezar (probado con un archivo viejo, que no sobrevive).

- **Evidencia del criterio de aceptación:**
  1. **`pnpm build` genera `apps/functions/lib`:** `index.js`, `globalOptions.js`, `callables/helloWorld.js` y los 12 dominios (ver "Consumo real"). ✔
  2. **Deploy real:** **pendiente de Franco.** No tengo credenciales del proyecto y no corrí `firebase deploy` contra ningún proyecto. En esta máquina hay Application Default Credentials y no quise llamar APIs reales con ellas. Queda verificado localmente con el emulador y la simulación de Cloud Build. Comando: `pnpm exec firebase deploy --only functions --project qx-redespachos-dev`; después, llamar `southamerica-east1-helloWorld`.
  3. **`DEPLOY_ENABLED`:** extraje el bloque `run` de `Check deploy config` de `deploy.yml` y lo corrí con `bash -e`, con `GITHUB_OUTPUT` y `GITHUB_STEP_SUMMARY` apuntando a archivos (simulación local, no un run de GitHub):
     - Sin la variable: exit 0, `enabled=false`, `::notice` y resumen "## Deploy a dev desactivado … vale `(sin definir)`, no `true` … **no despliega**".
     - `DEPLOY_ENABLED=false`: igual, con "vale `false`".
     - `true` sin secrets: **exit 1**, `::error title=Faltan secrets de deploy::DEPLOY_ENABLED es 'true' pero faltan: GCP_WORKLOAD_IDENTITY_PROVIDER GCP_SERVICE_ACCOUNT_EMAIL. …` y el resumen "## Deploy a dev fallido: faltan secrets".
     - `true` con un solo secret: exit 1, nombra solo el que falta.
     - `true` con los dos: exit 0, `enabled=true`.

     Con `js-yaml` (ya instalado como dependencia de `firebase-tools`) confirmé que los dos workflows parsean. Auth y deploy tienen `if: steps.deploy_config.outputs.enabled == 'true'`. **Verificado en GitHub** con el run de `Deploy to Dev` del merge de la PR #28 (`d943ef1`), [run 37673234187](https://github.com/fFrancko/sistema-redespachos/actions/runs/37673234187), consultado por la API de GitHub:
     - **Intento 1, `DEPLOY_ENABLED = true` sin secrets:** job `failure`. Falla en `Check deploy config` (paso 3) y todos los pasos siguientes figuran `skipped`. Anotación: `Faltan secrets de deploy | DEPLOY_ENABLED es 'true' pero faltan: GCP_WORKLOAD_IDENTITY_PROVIDER GCP_SERVICE_ACCOUNT_EMAIL. Cargalos o desactivá DEPLOY_ENABLED.` ✔
     - **Intento 2 (re-run), `DEPLOY_ENABLED = false`:** job `success`. Install, Build shared, lint, typecheck, test y build en `success`; `Authenticate to Google Cloud` y `Deploy Functions` en `skipped`. Anotación: `Deploy desactivado | DEPLOY_ENABLED no es 'true'; no se despliega a qx-redespachos-dev.` El re-run toma el valor nuevo de la variable. El texto del resumen (`$GITHUB_STEP_SUMMARY`) no se lee por la API pública: lo escribe la misma rama del script que emite esa anotación, y se ve en la pestaña Summary del run. ✔

  4. **Secuencia de §5.5 en verde:** ver arriba. ✔
  5. **Opción de empaquetado:** ver Decisiones. ✔
  6. **Carga con Node puro, 2ª gen y región:** ver "Consumo real" y `nodeRuntime.test.ts`. ✔
  7. **`Build shared` antes de `Lint`:** en `ci.yml` es el paso 4 y `Lint` el 5. En `deploy.yml` es el 5 y `Lint` el 6, porque `Check deploy config` es el paso 1. ✔

- **Decisiones tomadas:**
  - **Empaquetado, opción 1 (`predeploy` + carpeta de deploy):** es la única de las tres que no suma dependencias. `pnpm deploy` deja `shared` como dependencia de registro que npm no encuentra en Cloud Build. El bundle necesita `esbuild` (`CR: deps`) y además obliga a reescribir el `package.json` igual. `dist/` va anidado en `apps/functions` para que el CLI y el emulador resuelvan `node_modules` hacia arriba sin instalar nada en local.
  - **Versiones fijas desde `pnpm list --prod --json --depth 1`:** `firebase-admin` y `firebase-functions` como dependencias exactas; `zod` y `decimal.js` (las de `shared`) en `overrides`. **Las transitivas más profundas quedan sin lock en Cloud Build**: no se sube lockfile y npm las resuelve por rango.
  - **`setGlobalOptions` en `src/globalOptions.ts`, importado primero desde `index.ts`,** y no en el cuerpo de `index.ts` (desvío del ajuste 5; ver PREGUNTAS). Con la llamada en el cuerpo, Node deja `region: undefined`; lo verifiqué con una mutación.
  - **Dos tests:**
    - `index.test.ts` controla los exports, que la callable sea de 2ª gen con región y la respuesta del handler.
    - `nodeRuntime.test.ts` compila con `tsc` y carga con Node puro. Hace falta porque Vitest (vite-node) **no** reproduce el orden de evaluación de ESM: con la mutación, `index.test.ts` siguió en verde y `nodeRuntime.test.ts` falló. Tarda unos 4 a 5 s y escribe en `apps/functions/node_modules/.cache/`.
  - **Sin `.d.ts` en el build de `functions`:** no se consume como librería, y el `.d.ts` de `helloWorld` rompía `pnpm lint` corrido después de un build local (ver el CR de ESLint).
  - **`deploy.yml` corre `Check deploy config` antes del install,** para fallar rápido si está activado sin secrets.

- **Supuestos:**
  - `engines.node: "22"` (rango `22.x`) es lo que Cloud Functions toma como runtime `nodejs22`. Verificado: `getRuntimeChoice` de `firebase-tools` 13.35.1 sobre `apps/functions/dist` devuelve `nodejs22`.
  - Los nombres desplegados por dominio salen de la forma de agrupar de `firebase-functions` (`<dominio>-<función>`); hoy los 12 namespaces están vacíos y el emulador los carga sin error.

- **Fuera de alcance:**
  - Texto de `docs/CI.md` y la desactualización de `docs/FIREBASE.md`: en PREGUNTAS, los aplica Franco.
  - Línea de `AGENTS.md` §3: en PREGUNTAS, la aplica Franco.
  - `CR: eslint — ignorar salidas de build anidadas`: texto en PREGUNTAS, lo registra Franco.
  - Hosting en el deploy: va con el ticket que mapee el target `web` (H-06, sin número todavía).
  - Upgrade de `firebase-functions` (el emulador avisa "outdated version"): es una major, va como `CR: deps` (H-08).
  - `src/firebase-init.ts` sigue sin importarse y viaja en `lib/`: sin ticket, lo toman MVP-06 o MVP-10 cuando usen Admin.

- **Riesgos y deuda** (qué conviene que el auditor mire primero):
  1. **El deploy real no se probó** (criterio 2): faltan los secrets de Workload Identity Federation. El criterio 3 quedó verificado en GitHub (run 37673234187).
  2. **Orden de evaluación ESM:** cualquier carril que cree una función tiene que importarla a través del índice raíz, que ya importa `globalOptions.js` primero. Una función importada por otra vía antes de `globalOptions` quedaría sin región. `nodeRuntime.test.ts` lo cubre para `helloWorld`; conviene extenderlo a cada dominio cuando tenga funciones.
  3. **Transitivas sin lock en Cloud Build:** un deploy puede traer versiones distintas de las que se testearon en CI.
  4. **Flujo local:** el emulador lee `dist/`, no `src/`. Sin `pnpm --filter @sistema-redespachos/functions dev` corriendo, el emulador sirve código viejo o no arranca. En Windows, detener el proceso padre puede dejar vivos el `tsc --watch` y el emulador (me pasó con mis propios procesos y los cerré a mano).
