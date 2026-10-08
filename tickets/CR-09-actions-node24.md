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
   - Después del merge, el run de `Deploy to Dev` en `main` queda en verde con el resumen "Deploy a dev desactivado" (`DEPLOY_ENABLED` sigue sin `true`). `google-github-actions/auth@v3` no se ejercita hasta que haya secrets: queda anotado como riesgo.
   - Franco pega en la nota los links de los dos runs.

## Fuera de alcance

- **Migrar a `ubuntu-26.04`:** `CR` aparte, antes de que GitHub retire la imagen 24.04. Paso previo: un run de prueba con `runs-on: ubuntu-26.04` (emuladores de Firebase incluidos: necesitan Java, que en 26.04 sigue siendo 17).
- Secrets de Workload Identity Federation y `DEPLOY_ENABLED`: los gestiona Franco (punto 1 pendiente de MVP-31).
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

---

## Nota de entrega (la completa el agente al terminar)

- **Qué se hizo:**
- **Commit:**
- **Archivos tocados:**
- **Cómo probarlo:**
- **Resultado de la verificación:**
- **Runtime de cada action (punto 4):**
- **Consumo real:** no aplica (la prueba real es el run de la PR; ver criterio 5).
- **Evidencia del criterio de aceptación:**
- **Decisiones tomadas:**
- **Supuestos:**
- **Fuera de alcance:**
- **Riesgos y deuda:**
