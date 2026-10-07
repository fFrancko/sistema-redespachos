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
