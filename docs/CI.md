# CI/CD

Dos workflows de GitHub Actions: `ci.yml` valida cada PR (y cada push a `main`), y `deploy.yml` despliega a **dev** en cada push a `main`. No hay ningún workflow hacia prod.

## Node.js 22.x

Todos los workflows usan **Node 22.x fijo**, sin matrix. Coincide con el runtime de Cloud Functions 2ª gen (arquitectura v3 §1) y con `engines.node >=22` del `package.json` raíz. El borrador inicial del ticket decía 20.x; se cambió a 22.x por esa coincidencia con Functions.

## CI en Pull Request (`.github/workflows/ci.yml`)

Se dispara en `pull_request` (cualquier rama destino) y en `push` a `main`. Un solo job, `validate`, con estos pasos en orden:

1. **Install:** `pnpm install --frozen-lockfile`. Falla si `pnpm-lock.yaml` no coincide con los `package.json`.
2. **Lint:** `pnpm lint` (ESLint, 0 warnings).
3. **Typecheck:** `pnpm typecheck` en todos los workspaces.
4. **Test packages/motor:** `vitest run packages/motor`. Es un paso separado para que MVP-15 le agregue el gate de casos dorados.
5. **Test con cobertura:** `firebase emulators:exec --only auth,firestore --project demo-qx-ci "pnpm test:coverage"`.
6. **Build:** `pnpm build`.
7. **Comentario de cobertura:** lee `coverage/coverage-summary.json` y publica (o actualiza) un único comentario fijo en la PR con una tabla de statements, branches, functions y lines.
8. **Artefacto:** sube `coverage/` como `coverage-report` (7 días), incluso si los tests fallan.

### Emuladores

- `--only auth,firestore`: solo los emuladores que usan los tests. Si se agregan tests de Functions o Storage, hay que sumarlos a la lista.
- `--project demo-qx-ci`: un proyecto con prefijo `demo-` hace que la CLI no busque credenciales ni toque recursos reales. Por eso CI de PR no necesita secrets.

### Cómo leer los logs

- En la PR, sección **Checks** → `CI / Lint, Typecheck, Test & Build` → **Details**. Cada paso se expande por separado; el que falló queda marcado en rojo.
- La salida del emulador (avisos de "not authenticated", códigos de color) aparece solo en el log del paso de tests, no en el comentario.
- Para ver qué líneas faltan cubrir: descargá el artefacto `coverage-report` del run (pestaña **Summary**) y abrí `index.html`.
- Localmente: `pnpm ci:run` replica lint → typecheck → test → build, y `pnpm test:coverage` genera `coverage/` (ignorado por git).

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

Se dispara solo en `push` a `main`; nunca en PR. Pasos: install → lint → typecheck → test (emuladores) → build → autenticación a Google Cloud (Workload Identity Federation) → `firebase deploy --project proyecto-qx-dev --only hosting,functions`.

No despliega reglas de Firestore ni Storage; esas se despliegan a mano (MVP-02 / MVP-09). El estado del deploy queda visible en el commit de `main` (check del workflow).

### Pendiente para que el deploy funcione

1. **Secrets de GitHub sin cargar.** El deploy requiere:
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`: proveedor de Workload Identity Federation (`projects/<n>/locations/global/workloadIdentityPools/<pool>/providers/<provider>`).
   - `GCP_SERVICE_ACCOUNT_EMAIL`: service account con permisos de deploy de Hosting y Functions en `proyecto-qx-dev`.
   Hasta que se carguen, el paso de autenticación falla. Nunca van en el repo.
2. **Target de Hosting sin mapear.** `firebase.json` declara `"target": "web"`, pero en `.firebaserc` `targets` está vacío. Hay que mapearlo (`firebase target:apply hosting web <site-id> --project proyecto-qx-dev`) en el ticket de Firebase. MVP-03 no puede tocar esos archivos.

## Fuera de alcance (deuda)

- **Preview de Hosting por PR:** se quitó de MVP-03 y queda para un ticket aparte. Requiere los mismos secrets y el target de Hosting de arriba.
- **Deploy a prod por tag:** ticket aparte.
