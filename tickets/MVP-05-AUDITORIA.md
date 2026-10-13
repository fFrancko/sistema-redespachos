# Auditoría de MVP-05 — Login con Google restringido al dominio, shell web y acceso pendiente

- **Carril:** B · Plataforma y circuito
- **Autor:** Claude Code (Opus 5.5)
- **Auditor:** Gemini (carril A)
- **Rama:** `mvp-05-login-shell`
- **Commits auditados:** `1b5071e` (implementación), `44205c7` (nota de entrega), `fd27052` (ajustes pre-auditoría pedidos por Franco).
- **Veredicto:** **APROBADO**

---

## 1. Verificación técnica (secuencia de AGENTS.md §5.5)

Ejecutada desde un worktree limpio (`sistema-redespachos-mvp05-aud`), sin carpetas `dist/` previas.

### Salida real de los comandos

```bash
$ pnpm install --frozen-lockfile
Lockfile is up to date, resolution step is skipped
Packages: +961
Done in 24.7s using pnpm v9.15.9

$ pnpm format:check
> prettier --check .
Checking formatting...
All matched files use Prettier code style!

$ pnpm ci:run
> pnpm --filter @sistema-redespachos/shared build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build

> @sistema-redespachos/shared@0.0.1 build C:\Users\Franco Aranda\Documents\sistema-redespachos-mvp05-aud\packages\shared
> tsc

> sistema-redespachos@0.0.1 lint C:\Users\Franco Aranda\Documents\sistema-redespachos-mvp05-aud
> eslint apps/web/src apps/functions packages --max-warnings 0

> sistema-redespachos@0.0.1 format:check C:\Users\Franco Aranda\Documents\sistema-redespachos-mvp05-aud
> prettier --check .
Checking formatting...
All matched files use Prettier code style!

> sistema-redespachos@0.0.1 typecheck C:\Users\Franco Aranda\Documents\sistema-redespachos-mvp05-aud
> pnpm -r typecheck
packages/shared typecheck: Done
packages/motor typecheck: Done
apps/web typecheck: Done
apps/functions typecheck: Done

> sistema-redespachos@0.0.1 test C:\Users\Franco Aranda\Documents\sistema-redespachos-mvp05-aud
> vitest run

 RUN  v2.1.9 C:/Users/Franco Aranda/Documents/sistema-redespachos-mvp05-aud

 ✓ packages/motor/src/candidatas.test.ts (27 tests) 33ms
 ✓ packages/motor/src/cotizar.test.ts (26 tests) 35ms
 ✓ packages/shared/src/schemas/orders.test.ts (70 tests) 18ms
 ✓ packages/motor/src/calculo.test.ts (17 tests) 9ms
 ✓ packages/shared/src/tms/orderRow.test.ts (31 tests) 29ms
 ✓ packages/shared/src/tms/headers.test.ts (25 tests) 4ms
 ✓ packages/shared/src/tms/orderRowRules.test.ts (20 tests) 20ms
 ✓ packages/motor/test/golden/golden.test.ts (183 tests) 45ms
 ✓ packages/shared/src/orderTransitions.test.ts (34 tests) 6ms
 ✓ packages/shared/src/primitives.test.ts (60 tests) 8ms
 ✓ packages/shared/src/schemas/tariffs.test.ts (41 tests) 14ms
 ✓ packages/motor/src/destino.test.ts (7 tests) 8ms
 ✓ packages/motor/src/tramos.test.ts (7 tests) 2ms
 ✓ packages/motor/test/guardas.test.ts (8 tests) 54ms
 ✓ packages/shared/src/schemas/suppliers.test.ts (27 tests) 3ms
 ✓ packages/shared/src/schemas/proformas.test.ts (21 tests) 3ms
 ✓ apps/web/src/auth/accessList.test.ts (12 tests) 1ms
 ✓ packages/shared/src/schemas/postalRouter.test.ts (15 tests) 2ms
 ✓ packages/shared/src/tms/amountsAndDates.test.ts (43 tests) 3ms
 ✓ packages/shared/src/schemas/users.test.ts (17 tests) 2ms
 ✓ packages/shared/src/errors.test.ts (9 tests) 1ms
 ✓ packages/shared/src/schemas/emails.test.ts (17 tests) 2ms
 ✓ packages/shared/src/normalize.test.ts (17 tests) 1ms
 ✓ packages/shared/src/schemas/system.test.ts (15 tests) 1ms
 ✓ apps/functions/src/nodeRuntime.test.ts (1 test) 7872ms
   ✓ JS emitido de apps/functions > carga con Node puro y helloWorld es de 2ª gen en southamerica-east1 7872ms
 ✓ packages/shared/src/schemas/reports.test.ts (12 tests) 2ms
 ✓ apps/functions/src/index.test.ts (3 tests) 1ms
 ✓ packages/shared/src/schemas/importBatches.test.ts (8 tests) 1ms
 ✓ apps/web/src/app/featureRegistry.test.ts (3 tests) 1ms
 ✓ packages/shared/src/types/firebase.test.ts (4 tests) 1ms
 ✓ apps/web/src/auth/firebaseGateway.test.ts (6 tests) 1ms
 ✓ packages/motor/src/index.test.ts (2 tests) 1ms
 ✓ packages/shared/src/schemas/branches.test.ts (2 tests) 1ms
 ✓ apps/web/src/auth/AuthGate.test.tsx (12 tests) 482ms
 ✓ apps/web/src/auth/AuthProvider.test.tsx (3 tests) 27ms
 ✓ apps/web/src/app/router.test.tsx (8 tests) 148ms
 ✓ apps/web/src/App.test.tsx (2 tests) 24ms

 Test Files  37 passed (37)
      Tests  815 passed (815)

> sistema-redespachos@0.0.1 build C:\Users\Franco Aranda\Documents\sistema-redespachos-mvp05-aud
> pnpm -r build

packages/shared build: Done
packages/motor build: Done
apps/functions build: Done
apps/web build: vite v5.4.21 building for production...
apps/web build: ✓ 167 modules transformed.
apps/web build: dist/index.html                           0.48 kB │ gzip:   0.32 kB
apps/web build: dist/assets/logo-positivo-BYx1XTu6.png    4.92 kB
apps/web build: dist/assets/logo-negativo-Diju7cr7.png    5.14 kB
apps/web build: dist/assets/index-x-_RwVK4.css           10.12 kB │ gzip:   2.71 kB
apps/web build: dist/assets/index-DHfxjPd3.js           575.53 kB │ gzip: 165.38 kB
apps/web build: ✓ built in 11.16s
apps/web build: Done
```

---

## 2. Criterio de aceptación

| Requisito | Estado | Evidencia |
| --- | --- | --- |
| **Arquitectura §4 (literal):** "Un email externo al dominio no entra; uno interno sin rol ve la pantalla pendiente." | **Cumplido** | Probado en `apps/web/src/auth/AuthGate.test.tsx` (casos `un email externo cierra la sesión y ve el mensaje` y `un email interno sin claim rol ve la pantalla de acceso pendiente`). Probado manualmente por Franco con emulador el 9/10. |
| **Agregado 1:** Tests de componente (Auth simulado): email externo → sesión cerrada y mensaje; email interno sin claim `rol` → pantalla pendiente; con claim `rol` → layout con la navegación de su rol. | **Cumplido** | `AuthGate.test.tsx` cubre cada caso, incluyendo una prueba parametrizada con los 5 roles (`ADMIN`, `ATENCION_PROVEEDOR`, `ANALISTA`, `BACKOFFICE`, `ADMINISTRACION`) y sus menús esperados. |
| **Agregado 2:** El registro de features tiene exactamente las 12 carpetas de `AGENTS.md` §3, y un test falla si alguien agrega o quita una. | **Cumplido** | `apps/web/src/app/featureRegistry.test.ts` verifica los 12 IDs exactos y compara con `readdirSync` sobre `apps/web/src/features`. |
| **Agregado 3:** Prueba manual con el emulador de Auth (`pnpm dev:emulator` + `pnpm dev`), documentada en la nota de entrega. | **Cumplido** | Documentada en detalle en la nota de entrega y validada satisfactoriamente por Franco el 9/10. |
| **Agregado 4:** Secuencia de `AGENTS.md` §5.5 en verde, con la salida pegada. | **Cumplido** | La secuencia completa pasó en limpio (ver sección 1). |

---

## 3. Conformidad con la arquitectura y diseño

- **Arquitectura v3 §1 (Frontend y UI):** React + Vite + TypeScript, React Router, TanStack Query, Tailwind CSS y tema shadcn/ui con primario `#323e48` y secundario `#f5333f`. Implementado en `apps/web/src/index.css` con variables CSS en canales RGB (`50 62 72` y `245 51 63`) y `tailwind.config.js`.
- **Arquitectura v3 §3.1 y D21:** Roles soportados `ADMIN`, `ATENCION_PROVEEDOR`, `ANALISTA`, `BACKOFFICE`, `ADMINISTRACION`. Validación estricta con `roleSchema` de `@sistema-redespachos/shared`. Si el claim no es válido o falta, el usuario permanece en estado pendiente.
- **Matriz de navegación:** `featuresForRole` en `featureRegistry.ts` cumple la matriz de §3.1 con el ajuste aprobado por Franco el 9/10 (`oc` visible para todos los roles por lectura de reportes).
- **Doc funcional §7.1 y §8:** Acceso con login Google, pantalla de acceso pendiente con botón "Solicitar acceso" deshabilitado ("Disponible próximamente"), colores `#323e48` y `#f5333f`, y logos extraídos de §8.2 a `apps/web/src/app/assets/logo-positivo.png` y `logo-negativo.png`.
- **D22 / Login restringido:** `accessList.ts` filtra por lista de emails exactos o dominio exacto (sin aceptar subdominios ni sufijos engañosos como `x@evilqxlogistica.com`), rechazando correos no verificados (`emailVerified === false`). Envío de `hd` a Google solo cuando hay exactamente un dominio y la lista de correos está vacía.

---

## 4. Aislamiento y alcance

- **Alcance de archivos:** `git diff --stat origin/main...mvp-05-login-shell` tocó 42 archivos (1404 inserciones, 29 borrados). Todos dentro de la lista de "Archivos permitidos" (`apps/web/src/app/**`, `apps/web/src/features/*/index.tsx`, `apps/web/src/auth/**`, `apps/web/src/components/ui/**`, `apps/web/src/App.tsx`, `apps/web/src/main.tsx`, `apps/web/vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `apps/web/src/index.css`, `App.test.tsx`, `.env.local.template`, y el ticket `MVP-05.md`).
- **Archivos congelados / compartidos:** `packages/shared`, `packages/motor`, `apps/functions`, `package.json`, `pnpm-lock.yaml` no fueron modificados.
- **Aislamiento de módulos:**
  - `apps/web/src/app/**` y `App.tsx` no importan `firebase.ts` ni `firebase/*`. El gateway real se inyecta en `main.tsx`.
  - Ninguna feature en `apps/web/src/features/*/index.tsx` importa `src/app` ni otra feature (solo exportan `routes: RouteObject[] = []`).
  - `apps/web/src/components/ui/` (`button.tsx`, `utils.ts`) no importa nada de `auth` ni de `app`.

---

## 5. Casos borde y robustez

1. **Carrera asíncrona en `AuthProvider.tsx`:** Resuelta con un contador de generación (`generation`). Si un usuario cierra sesión mientras `getRoleClaim()` está pendiente, o se emite un nuevo evento de auth, la resolución tardía se descarta (`if (current !== generation) return;`). Testeado en `AuthProvider.test.tsx`.
2. **Error al leer el claim o claim inválido:** Si `getRoleClaim()` falla o el claim no pasa la validación de `roleSchema`, el estado queda como `pendiente`, impidiendo cualquier escalamiento de privilegios o rol no autorizado.
3. **Validación de dominios y emails en `accessList.ts`:**
   - Comparación de dominio estricta por extracción posterior al último `@`: subdominios (`x@mail.qxlogistica.com`) y sufijos (`x@qxlogistica.com.ar`, `x@evilqxlogistica.com`) son rechazados.
   - Listas vacías: nadie entra.
   - Normalización de espacios y mayúsculas (`trim().toLowerCase()`).
   - `emailVerified === false`: rechazado siempre, impidiendo suplantación.
4. **Cierre de popup:** Errores `auth/popup-closed-by-user` y `auth/cancelled-popup-request` son mapeados a `SignInError('cancelado')` en `firebaseGateway.ts`; `LoginPage` no muestra banner de alerta si el usuario simplemente cerró la ventana emergente.

---

## 6. Pruebas de mutación (romper reglas localmente)

Se introdujeron 3 mutaciones deliberadas en el código para verificar que los tests fallaran ante regresiones:

1. **Guarda `RequireRole` en `router.tsx`:**
   - *Mutación:* Se cambió `return allowed.includes(rol) ? children : <Navigate to="/" replace />;` por `return children;`.
   - *Resultado:* Fallaron 5 tests en `router.test.tsx` (`una URL directa a /usuarios con rol ANALISTA redirige al inicio`, `/canalizador`, `/tarifas`, `/cotizacion`, `/auditoria`).
   - *Restauración:* Código revertido y tests en verde.
2. **Chequeo de `emailVerified` en `accessList.ts`:**
   - *Mutación:* Se eliminó la verificación `!candidate.emailVerified`.
   - *Resultado:* Fallaron 2 tests (`accessList.test.ts` › "rechaza un email no verificado aunque esté en la lista o el dominio" y `AuthGate.test.tsx` › "un email de la lista sin verificar se rechaza").
   - *Restauración:* Código revertido y tests en verde.
3. **Chequeo de generación en `AuthProvider.tsx`:**
   - *Mutación:* Se comentó `if (current !== generation) return;` en la resolución de `getRoleClaim()`.
   - *Resultado:* Falló el test en `AuthProvider.test.tsx` ("signOut antes de que resuelva el claim termina en el login, nunca en el layout").
   - *Restauración:* Código revertido y tests en verde.

---

## 7. Verificación de `envDir` y consumo real

1. **Lectura de `.env.local` en raíz (`envDir: '../../'`):**
   - Se creó temporalmente `.env.local` en la raíz del worktree con `VITE_ALLOWED_EMAILS=auditor@example.com`.
   - Se compiló la aplicación con `pnpm -C apps/web build`.
   - Se buscó el valor en `apps/web/dist` y se confirmó la presencia de `VITE_ALLOWED_EMAILS:"auditor@example.com"` en el bundle generado (`dist/assets/index-CYGzhHX2.js`).
   - Se eliminaron `.env.local` y `dist`.
2. **Consumo real de `@sistema-redespachos/shared`:**
   - `apps/web` importa `roleSchema`, `ROLES` y `type Role` desde `@sistema-redespachos/shared`.
   - Se verificó que el build de producción resuelve e incluye los símbolos y el esquema en el bundle final.

---

## 8. Hallazgos

| # | Severidad | Dónde | Qué pasa | Evidencia | Sugerencia |
| --- | --- | --- | --- | --- | --- |
| - | - | - | Sin hallazgos bloqueantes, mayores ni menores. | - | - |

*(Las deudas conocidas indicadas en la asignación —ausencia del alias `@/`, `afterEach(cleanup)` repetido, lista de correos expuesta en bundle de cliente, botón de reintento en pantalla pendiente para MVP-06 y `firebase-debug.log` fuera del `.gitignore`— están documentadas y corresponden a tickets o CRs separados).*

---

## 9. Decisiones y temas para Franco

1. **Variables de entorno en CI / Hosting (MVP-32):** Como las listas vacías implican "nadie entra", el pipeline de preview/deploy de Hosting deberá inyectar `VITE_ALLOWED_EMAILS` y/o `VITE_ALLOWED_DOMAINS` para que la app desplegada permita el acceso.
2. **Test faltante, va a MVP-06 (decisión de Franco, 13/10):** la rama de rechazo de `getRoleClaim` en `AuthProvider.tsx` (error al leer el token → pendiente) está bien implementada pero ningún test la cubre; solo se prueba el claim inválido (`SUPERADMIN`). MVP-06, al distinguir "error al leer el rol" de "sin rol", debe incluir un test que haga fallar `getRoleClaim` y verifique que el usuario nunca queda con rol.
3. **Prueba final con popup real de Google:** La prueba manual con el emulador de Auth validó el flujo y los custom parameters; queda probar el popup de producción cuando exista el dominio corporativo en Google Workspace.

---

## Veredicto final

**APROBADO**

El trabajo del autor cumple rigurosamente con los criterios de aceptación, las reglas de arquitectura y las convenciones del proyecto. No se detectaron desvíos ni fallas de aislamiento. La rama está en condiciones de ser revisada y mergeada por Franco.
