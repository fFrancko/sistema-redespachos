# MVP-03: Configurar CI (GitHub Actions)

**Carril:** N/A (Ola 0 - serial)
**Agente:** Claude Haiku
**Rama:** `mvp-03-ci-setup`
**Dependencias:** MVP-01 (monorepo), MVP-02 (Firebase)

## Contexto a leer

* `/docs/mapa-de-contexto.md` — Ola 0: MVP-03 CI
* `/docs/AGENTS.md` — reglas de carriles, auditoría cruzada
* `/docs/auditoria-cruzada.md` — checklist de auditoría (typecheck, test, etc.)

## Decisiones cerradas (no reabrir)

- **Node 22.x fijo** en todos los workflows (coincide con Cloud Functions 2ª gen, v3 §1). Sin matrix. Verificá que `engines` de los `package.json` y el runtime de `apps/functions` digan 22; si no coinciden, NO los edites: reportalo en la nota de entrega.
- **Ambientes: solo `dev` y `prod`** (MVP-02). No existe "staging". El deploy en merge va a `proyecto-qx-dev`.
- **Tests con Firebase Emulator Suite** (`firebase emulators:exec`), sin credenciales reales en CI de PR.
- **Coverage:** piso 80% global y **90% en `packages/motor`** (MVP-14), configurado por paquete. Solo se exige en paquetes que ya tengan código; un paquete vacío no debe romper CI.
- **Deploy a dev:** autenticación por Secrets de GitHub (idealmente Workload Identity Federation o service account). Nunca credenciales en el repo.
- **Prod por tag: FUERA de este ticket.** Se abre ticket aparte. No crear ningún workflow ni job que apunte a `proyecto-qx-prod`.

## Alcance

### 1. `.github/workflows/ci.yml`
- Trigger: `pull_request` (todas las ramas) y `push` solo a `main`. No usar `on: [push, pull_request]` abierto (duplica ejecuciones).
- `actions/setup-node` con Node 22.x y cache de pnpm.
- Pasos, en este orden: `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm typecheck` → tests con emuladores (`firebase emulators:exec` ejecutando `pnpm test` con coverage) → `pnpm build`.
- `CI=true` en el job de tests (falla al primer error).
- El job de tests de `packages/motor` debe poder correr de forma separable (step o job propio), porque en MVP-15 se le agrega el gate de casos dorados. No implementes los casos dorados ahora.
- Comentario automático en el PR con resultado de tests y coverage (opcional pero incluido en este ticket).

### 2. Preview de Hosting por PR (criterio de aceptación de la arquitectura)
- Job en `ci.yml` (o workflow propio) que, en `pull_request`, despliega un **preview channel** de Firebase Hosting en el proyecto `proyecto-qx-dev` y comenta la URL en el PR (`FirebaseExtended/action-hosting-deploy` con `channelId` por PR).
- Depende de que lint, typecheck, test y build pasen.
- **Si `firebase.json` no tiene bloque `hosting`, NO lo agregues ni lo modifiques: detenete en este punto, dejá el resto del ticket hecho y reportalo en la nota de entrega como bloqueo a resolver en MVP-02.**

### 3. `.github/workflows/deploy.yml`
- Trigger: solo `push` a `main`. No ejecuta en PR.
- Pasos: install → lint → typecheck → test (emuladores) → build → build de Functions → `firebase deploy --project proyecto-qx-dev` (sin tocar reglas: ver prohibidos) → estado visible en el commit.
- Solo dev. Cero referencias a prod.

### 4. Vitest para CI
- Verificá si existe `vitest.config.ts` raíz; si existe, ajustalo; si no, creálo (extendido por apps/packages).
- `coverage: { reporter: ['text', 'json', 'html'] }`, con `thresholds` por paquete (80% global, 90% `packages/motor`).
- Salida en `coverage/` respetando `.gitignore`.

### 5. `.github/dependabot.yml`
- Ecosistemas: `npm` (pnpm) y `github-actions`, frecuencia semanal.

### 6. `docs/CI.md`
- Qué checks corren en un PR y en cada push a main, y cómo leer sus logs.
- Cómo se ve la URL de preview y cuándo se despliega.
- Reglas de merge: CI en verde obligatorio.
- Umbrales de coverage (80% global, 90% motor) y por qué.
- Nota: prod por tag queda pendiente (ticket aparte).

### 7. Script raíz
- `package.json` raíz: agregar `ci:run` que replique localmente la secuencia de CI (lint → typecheck → test → build).

## Archivos permitidos
- Crear: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/dependabot.yml`, `docs/CI.md`
- Crear o modificar: `vitest.config.ts` raíz
- Modificar: `package.json` raíz (solo script `ci:run`)

## Archivos prohibidos
- NO tocar secrets ni credenciales de Firebase en el repo
- NO desplegar a prod, ni crear workflows hacia `proyecto-qx-prod`
- NO modificar reglas de Firebase (`firestore.rules`, `storage.rules`) ni su despliegue en CI
- NO modificar `firebase.json`, `.firebaserc`, `engines` ni runtime de Functions (reportar discrepancias)
- NO escribir esquemas Zod ni casos dorados

## Criterio de aceptación
1. `ci.yml` y `deploy.yml` existen y validan sin error (`actionlint` si está disponible).
2. Un push a rama de prueba con PR ejecuta lint, typecheck, test con emuladores y build.
3. El PR muestra los checks **y una URL de preview** de Hosting en `proyecto-qx-dev`.
4. El PR tiene comentario con resultado de tests y coverage.
5. `deploy.yml` no ejecuta en PR; solo en `main`, y solo hacia dev.
6. `pnpm lint && pnpm typecheck && pnpm test` pasan localmente, con los resultados pegados en la nota de entrega.
7. Coverage generado en `coverage/` e ignorado por git; umbral de 90% configurado para `packages/motor`.
8. Node 22.x en todos los workflows.

## Plan (listar antes de editar y esperar OK de Franco)
1. Listar los archivos a tocar y confirmar que están en el alcance.
2. Verificar `vitest.config.ts`, `engines`, `firebase.json` (¿hay `hosting`?) y scripts de la raíz. Solo lectura.
3. Crear `ci.yml` (incluye emuladores, umbrales y preview).
4. Crear `deploy.yml` hacia dev.
5. Crear/ajustar `vitest.config.ts`.
6. Crear `dependabot.yml`.
7. Agregar `ci:run`.
8. Escribir `docs/CI.md`.
9. Correr `pnpm lint && pnpm typecheck && pnpm test` y pegar la salida.
10. Pushear rama de prueba, abrir PR y verificar checks, URL de preview y comentario.
11. Nota de entrega (incluye discrepancias de Node/engines/hosting si las hubo) y cerrar. No abrir otro ticket.

## Preguntas resueltas
- Coverage: 80% global, 90% en `packages/motor`.
- Node: 22.x fijo.
- Credenciales: Emulator en CI de PR; Secrets solo en el deploy a dev.

## PLAN EJECUTADO

✅ Listar archivos
✅ Verificar estructura (vitest.config.ts existe, firebase.json tiene hosting, engines dice >=20 [DISCREPANCIA])
✅ Crear `.github/workflows/ci.yml`
✅ Crear `.github/workflows/deploy.yml`
✅ Crear `.github/dependabot.yml`
✅ Crear/ajustar `vitest.config.ts` (agregar coverage 80%, incluir v8 provider)
✅ Crear `packages/motor/vitest.config.ts` (umbral 90%)
✅ Agregar `ci:run` a package.json raíz
✅ Escribir `docs/CI.md`
✅ Correr `pnpm ci:run` localmente — PASÓ (lint ✓, typecheck ✓, test ✓, build ✓)
✅ Pushear rama `mvp-03-ci-setup`
✅ Nota de entrega con discrepancias reportadas

## NOTA DE ENTREGA

Ver archivo de nota de entrega separado en esta conversación.

**Estado:** Listo para auditoría. Discrepancia de `engines` reportada (MVP-01 debe corregir).
