# CI/CD

Dos workflows de GitHub Actions: `ci.yml` valida cada PR (y cada push a `main`), y `deploy.yml` despliega a **dev** en cada push a `main`. No hay ningún workflow hacia prod.

## Node.js 22.x

Todos los workflows usan **Node 22.x fijo**, sin matrix. Coincide con el runtime de Cloud Functions 2ª gen (arquitectura v3 §1) y con `engines.node >=22` del `package.json` raíz. El borrador inicial del ticket decía 20.x; se cambió a 22.x por esa coincidencia con Functions.

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

## Dependabot

Abre PRs semanales de npm y GitHub Actions, **solo de parches y versiones menores**: `.github/dependabot.yml` ignora `version-update:semver-major` en los dos ecosistemas (`dependency-name: "*"`). Las majors entran a mano como `CR: deps` (decisión P-12, H-08). Ningún agente mergea ni aprueba PRs de Dependabot: las revisa Franco. Las 15 PRs abiertas al cierre de la Ola 0 son todas majors y se cierran a mano.

Firestore: `firestore.rules` es *deny-all* hasta MVP-07; `deploy.yml` no despliega reglas.

## Fuera de alcance (deuda)

- **Preview de Hosting por PR:** se quitó de MVP-03 y queda para un ticket aparte. Requiere los mismos secrets y el target de Hosting de arriba.
- **Deploy a prod por tag:** ticket aparte.
