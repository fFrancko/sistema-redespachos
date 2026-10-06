# CR-01 — Infraestructura antes de abrir los carriles

- **Carril:** Compartido (`CR` aprobado por Franco el 5/10/2026).
- **Agente:** Claude Code · **Modelo:** Sonnet 5.5 · **Esfuerzo:** medium
- **Auditor:** Gemini · auditoría estándar
- **Rama:** `cr-01-infraestructura`
- **Depende de:** merge a `main` del cierre de la Ola 0 (`ola-0-cierre`).
- **Origen:** `docs/ola-0/informe-validacion.md`, hallazgos H-04, H-07, H-08, H-11 y H-14.

## Contexto a leer
- `AGENTS.md` completo.
- `docs/ola-0/informe-validacion.md`: H-04, H-07, H-08, H-11, H-14 y la sección "Respuestas a las preguntas abiertas" (P-02, P-12).
- `docs/CI.md`.
- No hace falta leer `docs/arquitectura-v3.md`.

## Alcance
1. **`ci:run` igual a CI (H-07).** En `package.json` raíz, `ci:run` = `pnpm --filter @sistema-redespachos/shared build && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
2. **Prettier (H-11).** Crear `.prettierrc` con el estilo que ya tiene el código (comillas simples, y lo que haga falta para que `prettier --check` no marque cambios en `packages/shared`). Agregar el script `format:check` (`prettier --check .`) y un `.prettierignore` (lockfile, `dist`, `coverage`, `lib`, `docs/**/*.md` y `tickets/**/*.md` si Prettier los reformatea). No reformatear código existente: si con la mejor configuración posible siguen quedando diferencias, listalas en PREGUNTAS y frená.
3. **Paso de formato en CI.** En `.github/workflows/ci.yml`, un paso `Format check` (`pnpm format:check`) después de `Lint`.
4. **Dependabot (H-08, P-12).** En `.github/dependabot.yml`, para `npm` y para `github-actions`: ignorar `version-update:semver-major` en todas las dependencias (`dependency-name: "*"`). Las majors entran a mano como `CR: deps`.
5. **Reglas *deny-all* (H-04, P-02).** `firestore.rules` con `allow read, write: if false;` sobre todo, y un comentario que diga que las reglas reales llegan con MVP-07. Verificar que los tests sigan pasando con los emuladores (hoy ningún test usa Firestore).
6. **`.gitignore` (H-14).** Quitar las reglas heredadas de la herramienta B0 (`/input/`, `output/`, `/tabla_maestra.json`, `test/fixtures/out/`, `test/fixtures/perfilar-out.txt` y las excepciones `!test/fixtures/input/*.xlsx` y `!test/fixtures/bad/*.xlsx`), conservando las de Excel reales (`*.xlsx`, `*.xls`, `*.xlsm`). Agregar `.claude/settings.local.json`.

## Archivos permitidos
`package.json` (solo scripts), `.prettierrc`, `.prettierignore`, `.github/workflows/ci.yml`, `.github/dependabot.yml`, `firestore.rules`, `.gitignore`, `docs/CI.md` (actualizar pasos y Dependabot), este ticket.

## Archivos prohibidos
Todo lo que no figure arriba; en particular `packages/**`, `apps/**`, `pnpm-lock.yaml` (Prettier ya está instalado) y `deploy.yml` (es de MVP-31).

## Criterio de aceptación
1. En un clon limpio, `pnpm ci:run` pasa sin haber construido `shared` antes a mano.
2. `pnpm format:check` pasa sin reformatear archivos existentes, y el paso `Format check` corre en CI.
3. `dependabot.yml` ignora las majors en los dos ecosistemas.
4. `firestore.rules` niega todo; la verificación con emuladores pasa.
5. `git status` limpio tras `pnpm install && pnpm ci:run && pnpm test:coverage` (nada nuevo sin ignorar).
6. Secuencia de `AGENTS.md` §5.5 en verde, con la salida pegada.

## Plan
Aprobado por Franco con 6 ajustes (ver "Decisiones tomadas"). Rama `cr-01-infraestructura` desde `origin/main` (6e426ed).
Archivos: `package.json` (scripts), `.prettierrc`, `.prettierignore`, `.github/workflows/ci.yml`, `.github/dependabot.yml`, `firestore.rules`, `.gitignore`, `docs/CI.md`, este ticket.
Pasos: (1) `ci:run` con Build shared y `format:check`; (2) Prettier con overrides y ignore explícito; (3) paso Format check en CI; (4) Dependabot sin majors; (5) reglas deny-all tras confirmar que ningún test usa el SDK cliente y que `deploy.yml` no publica reglas; (6) `.gitignore`.

## PREGUNTAS
1. **`test/` ahora aparece sin ignorar.** Al quitar `output/` y `test/fixtures/out/` (pedido por el ticket), los dos artefactos locales de la herramienta B0 (`test/fixtures/out/t.jsonl`, `test/fixtures/output/tabla_maestra.json`, hallazgo H-15) aparecen como `?? test/` en `git status`. No están versionados y **no los toqué ni los agregué al commit**. Pueden ser tarifas reales (dato comercial). Hasta que se muevan a `herramientas-tarifas`, el criterio 5 ("`git status` limpio") no se cumple en la carpeta local de Franco; en un clon limpio sí. ¿Los movés vos, o querés que `.gitignore` conserve `test/fixtures/out/` y `test/fixtures/output/` por ahora?
2. **Emuladores no verificados localmente:** esta máquina no tiene Java, y la CLI de Firebase lo necesita. Falta correr `firebase emulators:exec` (ver nota). Lo cubre CI en la PR.

---

## Nota de entrega
- **Qué se hizo:** `ci:run` ahora hace Build shared, lint, format:check, typecheck, test y build. Prettier configurado (`.prettierrc`, `.prettierignore`, `format:check`) y paso `Format check` en CI. Dependabot ignora majors en npm y github-actions. `firestore.rules` pasó a deny-all. `.gitignore` sin reglas de B0 y con `.claude/settings.local.json`. `docs/CI.md` actualizado.
- **Commit:** `git log -1` en la rama `cr-01-infraestructura` (el hash está en el mensaje de cierre; sin push ni PR).
- **Archivos tocados:** los 9 del plan (el `git diff --stat` va en el mensaje de cierre).
- **Cómo probarlo:** `pnpm install --frozen-lockfile && pnpm ci:run && pnpm test:coverage && git status`.
- **Resultado de la verificación (corrido localmente, Windows, tras borrar los `dist/`):**
  - `pnpm install --frozen-lockfile`: Done in 7.4s.
  - `pnpm --filter @sistema-redespachos/shared build`: exit 0.
  - `pnpm lint`: exit 0 (0 warnings).
  - `pnpm format:check`: "All matched files use Prettier code style!".
  - `pnpm typecheck`: 4 workspaces Done.
  - `pnpm test`: 22 files, **490 passed**.
  - `pnpm build`: web, shared, functions y motor Done. `pnpm ci:run` completo: exit 0.
  - `pnpm test:coverage`: 490 passed.
  - **NO verificado:** `firebase emulators:exec --only auth,firestore --project demo-qx-ci "pnpm test"` falla localmente con "Could not spawn `java -version`" (Java no instalado). Pendiente de que lo confirme el CI de la PR.
- **Consumo real:** no aplica (no hay código nuevo consumido por otros paquetes).
- **Evidencia del criterio de aceptación:**
  1. `ci:run` pasa tras borrar `packages/*/dist`, `apps/*/dist` y `coverage` (Build shared incluido). Además, **prueba de clon limpio**: `git clone --branch cr-01-infraestructura` a un directorio temporal (commit `e115ef1`, sin `packages/shared/dist`), `pnpm install --frozen-lockfile` (Done in 27.6s) y `pnpm ci:run`: exit 0. Salida resumida: `shared build` (tsc) OK; `lint` OK; `format:check` "All matched files use Prettier code style!"; `typecheck` 4 workspaces Done; `test` 22 files, 490 passed; `build` web, shared, motor y functions Done. Después `pnpm test:coverage` en el clon: 490 passed y `git status` vacío. El clon se borró.
  2. `pnpm format:check` pasa sin reformatear ningún archivo; el paso `Format check` está en `ci.yml` después de `Lint`.
  3. `dependabot.yml`: `ignore` con `dependency-name: "*"` y `update-types: ["version-update:semver-major"]` en los dos ecosistemas.
  4. `firestore.rules` deny-all: el archivo cumple; la prueba con emuladores queda pendiente (ver arriba).
  5. `git status` tras `install && ci:run && test:coverage`: **vacío en el clon limpio**. En la carpeta local de Franco solo queda `?? test/` (artefactos B0, H-15) hasta que Franco los mueva fuera del repo; después se verifica de nuevo.
  6. Secuencia §5.5: arriba, salvo emuladores.
- **Decisiones tomadas (ajustes de Franco y propias):**
  1. `format:check` también está en `ci:run`, después de `lint`.
  2. Antes de `firestore.rules`: ningún test usa el SDK cliente ni el emulador (`App.test.tsx` no importa `firebase.ts`; `firebase.test.ts` solo prueba esquemas) y `deploy.yml` despliega `--only hosting,functions`, sin reglas. Ambas respuestas fueron "no", así que seguí.
  3. Excepciones de `.gitignore`: `git ls-files '*.xls*'` no devuelve nada; `!test/fixtures/{input,bad}/*.xlsx` no cubrían ningún archivo versionado.
  4. **Dependabot y security updates:** los `ignore` **no** afectan las security updates. La documentación de GitHub dice que `update-types` solo afecta a las version updates. Una corrección de seguridad que requiera una major seguirá llegando como PR de seguridad; revisarla a mano.
  5. Prettier: `singleQuote`, `printWidth: 100`, `endOfLine: auto`, override de comillas dobles en YAML y override de comillas simples para `pnpm-workspace.yaml`. Con eso `packages/shared` queda sin diferencias (con `printWidth` 80 fallaban 40 archivos de `shared`). `endOfLine: auto` porque en Windows el working tree está en CRLF (`core.autocrlf=true`) y en CI en LF.
  6. En `.prettierignore` el patrón `lib` del ticket se acotó a `apps/functions/lib` para no ignorar `apps/functions/src/lib` (código compartido).
- **Archivos que quedaron ignorados por Prettier (TEMPORAL, rutas explícitas, 47):** los 43 `.md` (tablas y líneas en blanco que ninguna opción de Prettier arregla) más `apps/web/index.html` (`<!DOCTYPE>`), `apps/web/src/index.css` (`font-family` en varias líneas), `apps/web/src/main.tsx` (coma final en `render(...)`) y `eslint.config.js` (array en una línea). Lista completa en `.prettierignore`. Un archivo nuevo que no cumpla el estilo rompe CI hasta formatearlo o agregarlo.
- **Supuestos:** que ignorar los `.md` existentes es aceptable aunque el ticket solo nombraba `docs/**` y `tickets/**` (opción A).
- **Fuera de alcance:**
  - **Pendiente: `.gitattributes` con `eol=lf`.** Elimina el CRLF del working tree en Windows y permitiría quitar `endOfLine: auto`. Es un archivo nuevo compartido: va como `CR` aparte (sin ticket).
  - CR de reformateo de los 47 archivos y retiro del bloque `TEMPORAL` (sin ticket).
  - Cerrar las 15 PRs de Dependabot y limpiar ramas remotas (acción de Franco, H-08/H-16).
  - Mover los artefactos de B0 de `test/` (H-15).
- **Formato de archivos nuevos:** `pnpm format` (`prettier --write .`, ya existía en `package.json`) respeta `.prettierignore`: no toca los 47 archivos ignorados, pero **todo `.md` o archivo nuevo debe pasar por `pnpm format`** antes de commitear, o `Format check` falla en CI.
- **Riesgos y deuda:** (a) emuladores sin verificar localmente (sin Java); (b) `test/` visible como no versionado: no hacer `git add -A`; (c) el ignore de Prettier bloquea archivos nuevos que no cumplan el estilo.
