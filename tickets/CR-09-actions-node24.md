# CR-09 — GitHub Actions en Node 24 y runner fijo en Ubuntu 24.04

- **Carril:** Compartido (`CR`). Toca `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `package.json` (solo `packageManager`) y `docs/CI.md`.
- **Agente:** Claude Code · **Modelo:** Sonnet 5.5 · **Esfuerzo:** medium
- **Auditor:** Gemini · auditoría liviana + leer los pasos y las anotaciones del run de la PR (un aviso de Node 20 o un paso `skipped` que debía correr es hallazgo)
- **Rama:** `cr-09-actions-node24`
- **Depende de:** MVP-31 mergeado (ya está en `main`, `338e91a`).
- **Origen:** nota de entrega de MVP-31, "Fuera de alcance".

## Contexto a leer

- `AGENTS.md` completo.
- `docs/CI.md` completo (es corto).
- `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/dependabot.yml`.
- No hace falta leer `docs/arquitectura-v3.md`: no hay cambios de negocio.

## Problema

1. **Actions sobre Node 20.** GitHub pasó los runners a Node 24 por defecto el 16/06/2026 y **quitó Node 20 el 23/09/2026** ([changelog](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/)). Cuatro de las seis actions que usamos todavía declaran `using: node20` en la versión que tenemos fijada. Hoy corren forzadas en Node 24, sin garantía del autor.
2. **`ubuntu-latest` cambia solo.** Entre el **19/10 y el 19/11/2026**, GitHub mueve la etiqueta `ubuntu-latest` de Ubuntu 24.04 a 26.04, de forma gradual ([changelog](https://github.blog/changelog/2026-09-17-ubuntu-26-generally-available-and-latest-migration/)). Un run cualquiera de ese mes puede caer en otra imagen sin que nadie haya tocado el repo.
3. **Dependabot no lo iba a resolver:** `.github/dependabot.yml` ignora las majors y todas estas subas son majors.

## Versiones verificadas (8/10/2026)

Las verificó Franco con Claude leyendo el `action.yml` de cada tag. **Volvé a verificarlas** antes de editar (ver Alcance, punto 4).

| Action                                   | Hoy  | Runtime hoy | Pasa a   | Runtime nuevo | Por qué esa versión                                                                                 |
| ---------------------------------------- | ---- | ----------- | -------- | ------------- | --------------------------------------------------------------------------------------------------- |
| `actions/checkout`                       | `v4` | node20      | `v6`     | node24        | `v7` existe, pero se elige la mayor anterior a la última, ya asentada                               |
| `actions/setup-node`                     | `v4` | node20      | `v6`     | node24        | `v7` salió el 7/10/2026: demasiado nueva                                                            |
| `actions/upload-artifact`                | `v4` | node20      | `v6`     | node24        | `v5` sigue en node20; `v7` salió el 7/10/2026                                                       |
| `pnpm/action-setup`                      | `v3` | node20      | `v6`     | node24        | `v4` sigue en node20 (ver punto 2 del Alcance: cambia cómo se elige la versión de pnpm)             |
| `marocchino/sticky-pull-request-comment` | `v2` | node20      | `v3.0.5` | node24        | No publica la etiqueta flotante `v3`: se fija la versión exacta y Dependabot sube parches y menores |
| `google-github-actions/auth`             | `v2` | node20      | `v3`     | node24        | Mismos inputs (`workload_identity_provider`, `service_account`)                                     |

Criterio: la mayor más reciente que declare `node24` y tenga al menos un mes publicada. Sin SHA fijos: el repo hoy usa etiquetas y eso no cambia en este CR.

## Alcance

1. **Subir las seis actions** de la tabla en `ci.yml` y `deploy.yml`, todas las apariciones. Solo el `@ref`: no se cambian inputs salvo lo del punto 2.
2. **Versión de pnpm, un solo origen.** `pnpm/action-setup` desde `v4` **falla** si el input `version` y el campo `packageManager` de `package.json` no coinciden exactamente (`src/install-pnpm/run.ts`: "Multiple versions of pnpm specified"). Hoy hay `version: 9` en los workflows y `"packageManager": "pnpm@9.0.0"` en `package.json`, y `"9" !== "9.0.0"`.
   - Quitar `with: version: 9` de `pnpm/action-setup` en los dos workflows. La versión sale de `packageManager`.
   - Cambiar `packageManager` a `pnpm@9.15.9`. Hoy CI resuelve `version: 9` a la última 9.x (9.15.9 al 8/10), así que es la versión con la que CI viene corriendo. Dejar `9.0.0` cambiaría de pnpm en silencio.
   - No es un `CR: deps`: no cambia ninguna dependencia ni `pnpm-lock.yaml`. Si `pnpm install --frozen-lockfile` con 9.15.9 modifica el lockfile, **frená y avisá**.
3. **Runner fijo:** `runs-on: ubuntu-latest` → `runs-on: ubuntu-24.04` en los dos workflows. La migración a 26.04 va en un `CR` aparte, con una prueba previa (ver "Fuera de alcance").
4. **Verificar el runtime de cada action** en el ref elegido, sin confiar en la tabla:
   ```bash
   git clone -q --depth 1 --branch <tag> https://github.com/<owner>/<repo>.git /tmp/act && grep -E "^\s*using:" /tmp/act/action.yml
   ```
   Fuera del repo, sin commitear. Pegá las seis líneas en la nota. Si alguna no da `node24`, frená.
5. **`docs/CI.md`:**
   - Debajo de `## Node.js 22.x`, una sección `## Runner y versiones de actions` con: runner fijo `ubuntu-24.04` y por qué (la migración de `ubuntu-latest` del 19/10 al 19/11/2026), la tabla de actions con su versión, la regla "toda action en una versión que declare `node24`" y que pnpm sale de `packageManager` en `package.json` (no del input `version`).
   - En `## Dependabot`, una oración: las majors de actions se suben a mano como `CR` (este es el primero) y las PRs de Dependabot de esas majors se cierran.
6. **Formato:** `pnpm format` sobre lo que tocaste, este ticket incluido.

## Archivos permitidos

`.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `package.json` (solo la línea `packageManager`), `docs/CI.md` (las dos secciones del punto 5) y este ticket.

## Archivos prohibidos

Todo lo demás. En particular `pnpm-lock.yaml`, `.github/dependabot.yml`, la lógica de `DEPLOY_ENABLED` y el orden de pasos de los workflows (`Build shared` sigue antes de `Lint`).

## Criterio de aceptación

1. `grep -rn "uses:" .github/workflows` muestra solo las versiones de la tabla, y la salida del punto 4 da `node24` para las seis.
2. `grep -rn "runs-on" .github/workflows` muestra solo `ubuntu-24.04`, y ningún `pnpm/action-setup` tiene input `version`.
3. Con pnpm 9.15.9 (`corepack enable && corepack prepare pnpm@9.15.9 --activate`, o el que use tu entorno), `pnpm install --frozen-lockfile` no modifica `pnpm-lock.yaml` (`git status` limpio) y la secuencia de `AGENTS.md` §5.5 da verde. Pegá la salida y `pnpm --version`.
4. `git diff --stat origin/main...HEAD`: solo archivos permitidos.
5. **Pendiente de Franco, después del push (el agente no pushea):**
   - El run de `CI` de la PR termina en verde, en `ubuntu-24.04`, sin anotaciones de Node 20 deprecado ni "Multiple versions of pnpm", y el comentario de cobertura aparece en la PR (prueba `sticky-pull-request-comment@v3.0.5`) y se sube el artefacto `coverage-report` (prueba `upload-artifact@v6`).
   - Después del merge, el run de `Deploy to Dev` en `main` queda en verde **desplegando de verdad**: `Authenticate to Google Cloud` (`google-github-actions/auth@v3`) y `Deploy Functions` en `success`, no `skipped`. Después, `helloWorld` sigue respondiendo a la prueba de humo de `docs/CI.md`. Es la primera prueba real de `auth@v3`.
   - _Actualizado el 9/10/2026 (CR-10): el criterio original pedía el resumen "Deploy a dev desactivado" porque `DEPLOY_ENABLED` no estaba en `true`. Desde el 8/10 lo está, y todo merge a `main` despliega._
   - Franco pega en la nota los links de los dos runs.

## Fuera de alcance

- **Migrar a `ubuntu-26.04`:** `CR` aparte, antes de que GitHub retire la imagen 24.04. Paso previo: un run de prueba con `runs-on: ubuntu-26.04` (emuladores de Firebase incluidos: necesitan Java, que en 26.04 sigue siendo 17).
- Secrets de Workload Identity Federation y `DEPLOY_ENABLED`: los gestiona Franco. _Hechos el 8/10/2026 (ver CR-10)._
- Fijar actions por SHA, subir Node 22 del proyecto, subir pnpm a 10: sin ticket.
- Cerrar las PRs de Dependabot que proponen estas mismas majors: Franco, después del merge.

## Plan

Worktree `../sistema-redespachos-cr09`, rama `cr-09-actions-node24` desde `origin/main` (`338e91a`). Runtimes ya verificados (punto 4): los seis refs dan `using: node24`.

1. `.github/workflows/ci.yml`: `runs-on: ubuntu-24.04`; `checkout@v6`, `pnpm/action-setup@v6` sin `with: version`, `setup-node@v6`, `sticky-pull-request-comment@v3.0.5`, `upload-artifact@v6`. Sin cambios de orden ni de otros inputs.
2. `.github/workflows/deploy.yml`: `runs-on: ubuntu-24.04`; `checkout@v6`, `pnpm/action-setup@v6` sin `with: version`, `setup-node@v6`, `google-github-actions/auth@v3`. `Check deploy config` y los `if:` intactos.
3. `package.json`: solo `"packageManager": "pnpm@9.15.9"`.
4. `docs/CI.md`: sección nueva `## Runner y versiones de actions` debajo de `## Node.js 22.x`, y una oración en `## Dependabot`.
5. Este ticket (plan y nota de entrega).
6. Verificación con pnpm 9.15.9: `pnpm install --frozen-lockfile` (si cambia `pnpm-lock.yaml`, freno), `pnpm format`, `pnpm ci:run`, emuladores, greps de los criterios 1 y 2 y `git diff --stat origin/main...HEAD`. Un solo commit en la rama.

## PREGUNTAS

1. **`docs/CI.md` tiene un cierre de bloque de código suelto en la línea 98** (un ` ``` ` solo, después de "Functions en local", venido de MVP-31). Ese bloque nunca se cierra, así que en GitHub todo lo que sigue, `## Dependabot` incluida, se ve como código. Además, el párrafo que le sigue (línea 100, sobre `docs/FIREBASE.md`) parece una nota de ticket pegada por error. Ninguna de las dos líneas está en las secciones que me permite el punto 5. Propuesta: no las toco y van a un `CR` de docs aparte. Si preferís que borre solo la línea 98 en este CR (son 4 caracteres y arregla cómo se ve la oración nueva de Dependabot), decímelo.
   - **Respuesta de Franco:** se arregla en este CR. Borrar las líneas 98 (el cierre suelto) y 100 (la nota sobre `docs/FIREBASE.md`). Va en "Decisiones tomadas" como ampliación del alcance aprobada por Franco.

---

## Nota de entrega (la completa el agente al terminar)

- **Qué se hizo:**
  - Seis actions subidas a refs con `node24`, en las dos apariciones de cada una: `checkout`, `setup-node`, `upload-artifact` y `pnpm/action-setup` a `v6`, `sticky-pull-request-comment` a `v3.0.5` y `google-github-actions/auth` a `v3`. No cambió ningún otro input.
  - `runs-on: ubuntu-24.04` en `ci.yml` y `deploy.yml`.
  - `pnpm/action-setup` ya no recibe `with: version: 9`. `packageManager` pasa de `pnpm@9.0.0` a `pnpm@9.15.9`.
  - `docs/CI.md`: sección `## Runner y versiones de actions` (runner fijo y por qué, tabla, regla `node24`, pnpm desde `packageManager`) y la oración en `## Dependabot`. Además se borraron el cierre de bloque suelto y la nota sobre `docs/FIREBASE.md` (ver Decisiones).
- **Commit:** `4aeb616` en `cr-09-actions-node24` (código, docs y plan). Esta nota va en el commit siguiente, como en MVP-31. Sin push ni PR. Worktree propio: `../sistema-redespachos-cr09`. La rama no tiene upstream configurado: se le quitó el `origin/main` que `git worktree add` le asignó, para que un `git push` sin argumentos no apunte a `main`.
- **Archivos tocados:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `package.json` (solo `packageManager`), `docs/CI.md` y este ticket.
- **Cómo probarlo:** con pnpm 9.15.9, en un clon limpio:
  ```bash
  pnpm install --frozen-lockfile && git status --short   # pnpm-lock.yaml no aparece
  pnpm format && pnpm ci:run
  grep -rn "uses:\|runs-on" .github/workflows
  ```
  La prueba real son los runs de criterio 5.
- **Resultado de la verificación** (Windows, Node v26.10.0, pnpm 9.15.9; sin `dist/` previos: worktree recién creado, `find . -name dist -not -path "*/node_modules/*"` vacío):
  - Entorno: no hay `corepack`, y el pnpm global es 9.0.0. Se instaló pnpm 9.15.9 con `npm install --prefix` en el scratchpad de la sesión, fuera del repo, y se puso primero en el `PATH`. El pnpm global no se tocó.
  - `pnpm --version` → `9.15.9`.
  - `pnpm install --frozen-lockfile` → `Done in 46.7s using pnpm v9.15.9`, exit 0. `git status --short` después: solo los cuatro archivos editados y el ticket; `pnpm-lock.yaml` sin cambios.
  - `pnpm format` → solo reformateó `tickets/CR-09-actions-node24.md` (la tabla de versiones y el código en línea de PREGUNTAS). Los dos workflows y `package.json` quedaron igual.
  - `pnpm ci:run`, exit 0:
    ```
    > pnpm --filter @sistema-redespachos/shared build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
    > eslint apps/web/src apps/functions packages --max-warnings 0
    > prettier --check .
    Checking formatting...
    All matched files use Prettier code style!
    packages/shared typecheck: Done
    apps/web typecheck: Done
    packages/motor typecheck: Done
    apps/functions typecheck: Done
     Test Files  31 passed (31)
          Tests  770 passed (770)
    packages/shared build: Done
    packages/motor build: Done
    apps/functions build: Done
    apps/web build: ✓ built in 1.35s
    apps/web build: Done
    ```
  - Emuladores: `firebase emulators:exec --only auth,firestore --project demo-qx-ci "pnpm test:coverage"` **no corrió en local**: `Error: Could not spawn 'java -version'` (no hay Java en este equipo). Sin emuladores, `CI=true pnpm test:coverage` da exit 0, `31 passed`, `770 passed` y `All files | 95.17 | 95.53 | 88.88 | 95.17`, y genera `coverage/coverage-summary.json`, que es lo que leen el comentario y el artefacto. Con emuladores se prueba en el run de la PR.
  - Los dos YAML parsean (con `js-yaml`) y el orden de pasos es el mismo que en `origin/main`. `ci.yml`: Checkout → Setup pnpm → Setup Node → Install → Build shared → Lint → Format check → Typecheck → Test motor → Test con cobertura → Build → comentario → artefacto. `deploy.yml`: Checkout → Check deploy config → Setup pnpm → … → Build → Authenticate (`if: enabled == 'true'`) → Deploy Functions (mismo `if`).
- **Runtime de cada action (punto 4)** (`git clone --depth 1 --branch <tag>` en el scratchpad, fuera del repo; entre corchetes, la fecha del commit del tag):
  ```
  actions/checkout@v6: using: node24  [2026-07-16]
  actions/setup-node@v6: using: node24  [2026-07-13]
  actions/upload-artifact@v6: using: node24  [2025-12-12]
  pnpm/action-setup@v6: using: node24  [2026-08-03]
  marocchino/sticky-pull-request-comment@v3.0.5: using: node24 [2026-07-05]
  google-github-actions/auth@v3: using: node24  [2025-08-28]
  ```
  Las seis cumplen el mes de publicadas. `git ls-remote --tags` de `sticky-pull-request-comment` no muestra la etiqueta `v3`, así que se fija la versión exacta. En `pnpm/action-setup@v6`, `src/install-pnpm/run.ts:141` tira `Multiple versions of pnpm specified` cuando `version` y `packageManager` no coinciden exactamente (sin el hash de integridad). `npm view pnpm@9 version` da `9.15.9` como última 9.x.
- **Consumo real:** no aplica (la prueba real es el run de la PR; ver criterio 5).
- **Evidencia del criterio de aceptación:**
  1. `grep -rn "uses:" .github/workflows`:
     ```
     .github/workflows/ci.yml:22:        uses: actions/checkout@v6
     .github/workflows/ci.yml:25:        uses: pnpm/action-setup@v6
     .github/workflows/ci.yml:28:        uses: actions/setup-node@v6
     .github/workflows/ci.yml:84:        uses: marocchino/sticky-pull-request-comment@v3.0.5
     .github/workflows/ci.yml:91:        uses: actions/upload-artifact@v6
     .github/workflows/deploy.yml:21:        uses: actions/checkout@v6
     .github/workflows/deploy.yml:60:        uses: pnpm/action-setup@v6
     .github/workflows/deploy.yml:63:        uses: actions/setup-node@v6
     .github/workflows/deploy.yml:90:        uses: google-github-actions/auth@v3
     ```
     El punto 4 da `node24` para las seis (arriba).
  2. `grep -rn "runs-on" .github/workflows` → `ci.yml:15: runs-on: ubuntu-24.04` y `deploy.yml:14: runs-on: ubuntu-24.04`. `grep -rn "version:" .github/workflows` → solo `node-version: 22.x` (líneas 30 y 65, de `setup-node`). Ningún `pnpm/action-setup` tiene input `version`: el parseo YAML muestra los dos sin `with`.
  3. `pnpm --version` → `9.15.9`. `pnpm install --frozen-lockfile` no modifica `pnpm-lock.yaml`, y `pnpm ci:run` da verde (salida arriba). Los emuladores no corrieron en local por falta de Java.
  4. `git diff --stat origin/main...HEAD` (sobre `4aeb616`; el commit de esta nota suma solo este ticket):
     ```
      .github/workflows/ci.yml        |  14 +++--
      .github/workflows/deploy.yml    |  12 ++---
      docs/CI.md                      |  24 +++++++--
      package.json                    |   2 +-
      tickets/CR-09-actions-node24.md | 112 ++++++++++++++++++++++++++++++++++++++++
      5 files changed, 144 insertions(+), 20 deletions(-)
     ```
  5. Pendiente de Franco, después del push: los runs de `CI` (PR) y `Deploy to Dev` (`main`), con sus links.
- **Decisiones tomadas:**
  - **Ampliación del alcance aprobada por Franco:** en `docs/CI.md` se borraron el cierre de bloque suelto de la línea 98 y la nota de la línea 100 sobre `docs/FIREBASE.md`, ambos venidos de MVP-31 (ver PREGUNTAS 1). Con el cierre suelto, GitHub mostraba como código todo lo que seguía, incluidas `## Dependabot` y la oración nueva. También se quitó la línea en blanco 99, para que no quedaran dos seguidas.
  - **`pnpm format` y `docs/CI.md`:** `docs/CI.md` figura en `.prettierignore` (bloque `TEMPORAL`), así que `pnpm format` no le cambia nada, tampoco ahora que el texto quedó fuera del bloque de código. Lo confirman `prettier --file-info docs/CI.md` → `"ignored": true` y un `diff` antes y después de `pnpm format` sin diferencias. No hubo cambios de formato ni de contenido fuera de lo editado a mano. La tabla nueva se alineó a mano con el mismo resultado que da `prettier --parser markdown` sobre una copia en el scratchpad (`diff` vacío), para que quede igual a la tabla `DEPLOY_ENABLED`.
  - La oración de Dependabot dice "como `CR`", no "como `CR: deps`", porque el ticket aclara que este cambio no es un `CR: deps`.
  - Dos commits (implementación y nota), como en MVP-31 y MVP-15, en lugar del "un solo commit" del plan: la nota necesita el hash del commit de implementación.
- **Supuestos:**
  - Node v26.10.0 en local, contra 22.x en CI. El ticket no cambia código ni Node, así que la diferencia no afecta la verificación. El run de la PR corre en 22.x.
  - `setup-node@v6` con `cache: pnpm` explícito sigue igual: desde v5, el caché automático por `packageManager` es solo para npm, y acá el input `cache` se pasa explícito.
- **Fuera de alcance:**
  - `docs/FIREBASE.md` l.49 quedó desactualizada después de MVP-31: dice que el deploy "hoy se omite por falta de secrets" y que `apps/functions` "todavía no es desplegable". _Se actualiza en CR-10._
  - Migrar a `ubuntu-26.04`: `CR` aparte, con un run de prueba previo (ver "Fuera de alcance" del ticket).
  - Cerrar las PRs de Dependabot de estas majors: Franco, después del merge.
  - Fijar actions por SHA, subir Node 22 del proyecto, subir pnpm a 10: sin ticket.
- **Riesgos y deuda:**
  - `google-github-actions/auth@v3` no se ejercita hasta que haya secrets y `DEPLOY_ENABLED=true`. Los inputs son los mismos, pero el primer deploy real es la primera prueba.
    - _Actualización del 9/10/2026 (CR-10): los secrets y `DEPLOY_ENABLED=true` ya están, y `auth@v2` desplegó en `main` (run 37676044027). El merge de esta PR es la primera prueba real de `auth@v3` (criterio 5)._
  - Los emuladores no se probaron en local (falta Java). `upload-artifact@v6` y `sticky-pull-request-comment@v3.0.5` solo se prueban en el run de la PR (criterio 5).
  - `ubuntu-24.04` fijo pasa a ser deuda cuando GitHub anuncie el retiro de esa imagen: el `CR` de 26.04 tiene que entrar antes.
  - El aviso `failed to delete '.git/worktrees/sistema-redespachos-mvp15|mvp31|mvp31-apoyo': Permission denied` aparece en cada `git worktree add` y `commit`: hay metadatos de worktrees viejos que git no puede limpiar, probablemente por un archivo abierto o por permisos. No afecta este ticket; se limpia con `git worktree prune` cuando esas carpetas no estén en uso.
