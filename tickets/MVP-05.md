# MVP-05 — Login con Google restringido al dominio, shell web y acceso pendiente

- **Carril:** B · Plataforma y circuito
- **Agente:** Claude Code · **Modelo:** Opus 5.5 · **Esfuerzo:** medium
- **Auditor:** Gemini · auditoría estándar
- **Rama:** `mvp-05-login-shell`
- **Depende de:** `CR-03` mergeado. Puede correr en paralelo con MVP-31.

## Contexto a leer
- `docs/arquitectura-v3.md`: §1 (fila Frontend y UI), §3.1 (primeros tres puntos), D21, D22.
- `docs/documentacion-funcional.md`: §7.1 y §8 (colores y logo).
- Código previo: `apps/web/src/firebase.ts`, `apps/web/src/App.tsx`, `packages/shared/src/roles.ts`.
- `AGENTS.md` §3 (lista de features por carril).

## Alcance
1. **Shell web** en `apps/web/src/app/`: router, `QueryClientProvider`, layout con navegación por rol, tema shadcn/Tailwind con #323e48 (primario) y #f5333f (secundario), y **registro fijo de features**: una entrada por carpeta de `AGENTS.md` §3 (A: `cotizacion`, `pedidos`, `tarifas`, `canalizador`; B: `usuarios`, `proveedores`, `sucursales`, `proformas`, `liquidacion`, `oc`), cada una con un `index.tsx` vacío que exporta sus rutas. Desde este ticket, `src/app` queda congelado y cada carril edita solo los `index.tsx` de sus features (decisión P-07).
2. **Login con Google** (Firebase Auth) con **lista de acceso configurable**: `VITE_ALLOWED_EMAILS` (emails exactos) y `VITE_ALLOWED_DOMAINS` (dominios). Mientras QX no tenga Google Workspace se usa solo la lista de emails (cuentas de Gmail de las personas de la prueba); cuando exista el dominio, se carga el dominio y no cambia el código. Un email fuera de la lista cierra la sesión y ve un mensaje. El parámetro `hd` de Google se usa solo si hay un dominio configurado.
3. **Pantalla de acceso pendiente** para un usuario interno sin rol (sin custom claim `rol`), con el botón *Solicitar acceso*. La callable `auth.requestAccess` llega en MVP-06: hasta entonces el botón se muestra deshabilitado con el texto "Disponible próximamente".
4. Las dos variables se documentan en `.env.local.template` (`CR` aprobado por Franco el 5/10).

## Archivos permitidos
`apps/web/src/app/**` (se crea en este ticket), `apps/web/src/features/*/index.tsx` (vacíos), `apps/web/src/auth/**`, `apps/web/src/components/ui/**`, `apps/web/src/App.tsx`, `apps/web/src/main.tsx`, `apps/web/index.html`, `apps/web/vite.config.ts`, la configuración de Tailwind y PostCSS de `apps/web`, `apps/web/tsconfig.json` (solo alias `@/`), `.env.local.template` (solo las dos variables), `apps/web/src/index.css` y `apps/web/src/App.test.tsx` (autorizados por Franco el 9/10), este ticket.

## Archivos prohibidos
Todo lo que no figure arriba. `AGENTS.md` va por `CR` (ver PREGUNTAS).

## Criterio de aceptación
Literal de la arquitectura §4: **"Un email externo al dominio no entra; uno interno sin rol ve la pantalla pendiente."** Mientras no haya dominio, "externo" = fuera de la lista de acceso.

Agregados de este ticket:
1. Tests de componente (Auth simulado): email externo → sesión cerrada y mensaje; email interno sin claim `rol` → pantalla pendiente; con claim `rol` → layout con la navegación de su rol.
2. El registro de features tiene exactamente las 12 carpetas de `AGENTS.md` §3, y un test falla si alguien agrega o quita una.
3. Prueba manual con el emulador de Auth (`pnpm dev:emulator` + `pnpm dev`), documentada en la nota de entrega.
4. Secuencia de `AGENTS.md` §5.5 en verde, con la salida pegada.

Fuera de este ticket: "verificado también en backend" (§3.1) va en MVP-08 (guarda de dominio en las callables).

## Plan
1. **Auth** (`src/auth/`): `accessList.ts`, una función pura que lee `VITE_ALLOWED_EMAILS` y `VITE_ALLOWED_DOMAINS` (listas separadas por coma, sin distinguir mayúsculas ni espacios) y decide si un email entra. Con las dos listas vacías no entra nadie. `AuthGateway` es una interfaz chica (`onAuthStateChanged`, `getRole`, `signInWithGoogle`, `signOut`) con una implementación real sobre `firebase.ts` (que no se modifica). El parámetro `hd` se pasa solo si hay **exactamente un** dominio configurado. `AuthProvider` y `useAuth` exponen el estado: `cargando | anonimo | rechazado | pendiente | con_rol(rol)`. Un email fuera de la lista dispara `signOut` y el mensaje. El claim `rol` se valida con `roleSchema` de `shared`; si falta o es inválido, el usuario queda como pendiente.
2. **Pantallas** (`src/auth/`): `LoginPage` (botón Google y mensaje de rechazo) y `PendingAccessPage` (botón *Solicitar acceso* deshabilitado, con "Disponible próximamente").
3. **Shell** (`src/app/`): `featureRegistry.ts` es la lista fija de las 12 features, cada una con `id`, `label`, `roles` y `routes`, y las importa de `features/<id>/index.tsx`. `router.tsx` monta `/<id>/*` con guardas por rol. Además, `AppShell.tsx` (layout con navegación filtrada por el rol), `providers.tsx` (`QueryClientProvider` + `AuthProvider`), `src/index.css` reescrito como entrada de Tailwind con las variables del tema (ajuste de Franco) y el logo, extraído del base64 de la doc funcional §8.2 a `src/app/assets/`.
4. **Roles por feature** (sale de la matriz de §3.1): ADMIN ve todo. ATENCION_PROVEEDOR ve `pedidos`, `tarifas`, `proveedores`, `proformas` y `liquidacion`. ANALISTA y BACKOFFICE ven `cotizacion`, `pedidos`, `proformas` y `liquidacion`. ADMINISTRACION ve `pedidos`, `proformas`, `liquidacion` y `oc`. **Ajuste de Franco (9/10):** `oc` también para ATENCION_PROVEEDOR, ANALISTA y BACKOFFICE. Las features restantes (`canalizador`, `usuarios`, `sucursales`, `auditoria`, `parametros`) son solo de ADMIN. Es navegación; la seguridad real va en reglas y callables (MVP-07 y MVP-08).
5. **Features**: 12 `features/<id>/index.tsx` que exportan `routes` con una pantalla "En construcción".
6. **UI**: Tailwind 3 (`tailwind.config.js`, `postcss.config.js` con `content.relative`) con `primary` #323e48 y `secondary` #f5333f como variables CSS al estilo shadcn, y `components/ui/button.tsx` + `components/ui/utils.ts` (`cn`).
7. **Entrada**: `main.tsx` crea el gateway real y se lo pasa a `<App>`. `App.tsx` no importa Firebase, así el `App.test.tsx` existente no inicializa Auth.
8. **Tests** (jsdom por docblock `// @vitest-environment jsdom`, porque `vitest.config.ts` está congelado en `node`):
   - `accessList.test.ts`: casos de emails y dominios.
   - `AuthGate.test.tsx` con un gateway falso: email externo → `signOut` llamado y mensaje; email interno sin `rol` → pantalla pendiente; con `rol` → layout que muestra solo la navegación de ese rol (un caso por rol).
   - `featureRegistry.test.ts`: los ids son exactamente los 12 esperados.
9. **Archivos a tocar:**
   - `apps/web/src/auth/{accessList.ts,accessList.test.ts,gateway.ts,firebaseGateway.ts,AuthProvider.tsx,LoginPage.tsx,PendingAccessPage.tsx,AuthGate.test.tsx}`
   - `apps/web/src/app/{featureRegistry.ts,featureRegistry.test.ts,router.tsx,router.test.tsx,AppShell.tsx,providers.tsx,assets/logo-*.png}`, `apps/web/src/index.css`, `apps/web/src/App.test.tsx`
   - `apps/web/src/features/{cotizacion,pedidos,tarifas,canalizador,usuarios,proveedores,sucursales,proformas,liquidacion,oc,auditoria,parametros}/index.tsx`
   - `apps/web/src/components/ui/{button.tsx,utils.ts}`
   - `apps/web/src/App.tsx`, `apps/web/src/main.tsx`, `apps/web/tailwind.config.js`, `apps/web/postcss.config.js`
   - `.env.local.template` (solo las dos variables; ver pregunta 1) y este ticket
   - **No toco** `apps/web/tsconfig.json`, `vite.config.ts` ni `index.html`. Sin alias `@/`: el `vitest.config.ts` raíz (congelado) no lo resolvería en los tests, así que uso imports relativos.

## PREGUNTAS
- (Resuelto 5/10) QX todavía no tiene Google Workspace: acceso por lista de emails hasta que exista el dominio.
- (Resuelto 5/10) `auditoria` y `parametros` se suman a las features del Carril B en `AGENTS.md` §3: el registro sale con **12 carpetas**.
- (Resuelto 9/10, Franco) **1. `.env.local.template`.** Se edita en esta rama: solo las dos variables, con un comentario cada una. Se corrigió la línea contradictoria de "Archivos prohibidos".
- (Resuelto 9/10, Franco) **2. `hd` con varios dominios.** `hd` se pasa solo si hay exactamente un dominio; con varios, el filtro queda solo del lado de la app.
- (Resuelto 9/10, Franco) **3. `src/index.css` y `App.test.tsx`.** Se autorizan los dos: `index.css` se reescribe como entrada de Tailwind (`main.tsx` lo sigue importando; no hay `app/styles.css`) y `App.test.tsx` se reemplaza por un test real.
- (Resuelto 9/10, Franco) **4. Matriz rol → features.** Confirmada, con `oc` también para ATENCION_PROVEEDOR, ANALISTA y BACKOFFICE (lectura de reportes, §3.1). Solo ADMIN: `canalizador`, `usuarios`, `sucursales`, `auditoria`, `parametros`.
- (Resuelto 9/10, Franco) `cn()` vive en `components/ui/`, sin `src/lib/`. Si jsdom 30 falla con Vitest 2, se frena y se pide `CR` (sin happy-dom ni cambios en `vitest.config.ts`). La función de acceso rechaza emails no verificados.

---

## Nota de entrega
- **Qué se hizo:**
  - Shell web en `apps/web/src/app/`: router con guardas por rol, `QueryClientProvider`, layout con navegación filtrada por rol y logo de §8.2. Registro fijo de las 12 features; cada `features/<id>/index.tsx` exporta `routes` vacío y el shell muestra "En construcción".
  - Login con Google con lista de acceso (`VITE_ALLOWED_EMAILS` / `VITE_ALLOWED_DOMAINS`): email exacto o dominio exacto, solo si el email está verificado; con las dos listas vacías no entra nadie. Un email fuera de la lista dispara `signOut` y ve el mensaje. `hd` se envía solo con exactamente un dominio.
  - El claim `rol` se valida con `roleSchema` de `shared`. Sin claim válido, el usuario ve la pantalla pendiente con *Solicitar acceso* deshabilitado y "Disponible próximamente".
  - Tema Tailwind 3 / shadcn con #323e48 y #f5333f (variables RGB en `index.css`), `Button` y `cn()` en `components/ui/`.
- **Commit:** `1b5071e` en la rama `mvp-05-login-shell` (esta nota va en un commit aparte); sin push ni PR.
- **Archivos tocados** (`git diff --stat origin/main...HEAD` en `1b5071e`): 39 archivos, 1126 inserciones y 28 borrados.
  - Raíz: `.env.local.template`.
  - `apps/web`: `postcss.config.js` y `tailwind.config.js`.
  - `apps/web/src`: `App.tsx`, `App.test.tsx`, `main.tsx` e `index.css`.
  - `apps/web/src/app/`: `AppShell.tsx`, `featureRegistry.ts`, `featureRegistry.test.ts`, `providers.tsx`, `router.tsx`, `router.test.tsx`, `assets/logo-positivo.png` y `assets/logo-negativo.png`.
  - `apps/web/src/auth/`: `AuthGate.test.tsx`, `AuthProvider.tsx`, `LoginPage.tsx`, `PendingAccessPage.tsx`, `accessList.ts`, `accessList.test.ts`, `fakeGateway.ts`, `firebaseGateway.ts` y `gateway.ts`.
  - `apps/web/src/components/ui/`: `button.tsx` y `utils.ts`.
  - `apps/web/src/features/*/index.tsx` (12) y este ticket.
  - Ningún archivo fuera de los permitidos.
- **Cómo probarlo:**
  - Secuencia de CI: `pnpm install --frozen-lockfile && pnpm format && pnpm ci:run`.
  - Solo los tests de web: `pnpm exec vitest run apps/web`.
  - Prueba manual:
    1. Crear `apps/web/.env.local` con `VITE_FIREBASE_EMULATOR=true`, `VITE_FIREBASE_PROJECT_ID=demo-qx-ci` y las dos listas. Ver el hallazgo sobre la ubicación en Riesgos.
    2. Levantar `pnpm exec firebase emulators:start --only auth --project demo-qx-ci` y `pnpm dev`.
- **Resultado de la verificación:** desde estado limpio (sin `dist/`), salida real:

  ```
  pnpm install --frozen-lockfile   → Already up to date / Done in 1.3s using pnpm v9.15.9
  pnpm format                      → sin cambios fuera de lo tocado
  pnpm ci:run:
  > pnpm --filter @sistema-redespachos/shared build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
  > @sistema-redespachos/shared@0.0.1 build → tsc
  > eslint apps/web/src apps/functions packages --max-warnings 0
  > prettier --check .
  All matched files use Prettier code style!
  packages/shared typecheck: Done
  packages/motor typecheck: Done
  apps/web typecheck: Done
  apps/functions typecheck: Done
   Test Files  35 passed (35)
        Tests  804 passed (804)
  packages/shared build: Done
  packages/motor build: Done
  apps/functions build: Done
  apps/web build: ✓ 166 modules transformed.
  apps/web build: dist/assets/logo-positivo-BYx1XTu6.png    4.92 kB
  apps/web build: dist/assets/logo-negativo-Diju7cr7.png    5.14 kB
  apps/web build: dist/assets/index-x-_RwVK4.css           10.12 kB │ gzip:   2.71 kB
  apps/web build: dist/assets/index-qehNuMqc.js           575.04 kB │ gzip: 165.22 kB
  apps/web build: ✓ built in 10.95s
  apps/web build: Done
  ```

  - Advertencias: `WARN Unsupported engine` de `apps/functions` (local con Node 26.10.0; el repo pide 22) y la de Vite por un chunk de más de 500 kB, que es Firebase. En el primer intento falló el typecheck (`main.tsx`: `ImportMetaEnv` contra `AccessEnv`); se corrigió y se re-corrió todo desde limpio.
  - Mutaciones de control: si se quita la guarda por rol del router fallan los 5 casos de redirección, y si se quita el chequeo de `emailVerified` fallan los 2 tests de email no verificado.
- **Prueba manual con el emulador de Auth (9/10):** levanté el emulador solo de Auth y no `pnpm dev:emulator`: en esta máquina no hay Java y Firestore lo necesita. El navegador integrado abre el popup del emulador en la misma pestaña, así que el popup no puede completar. Igual se vio que la URL del widget lleva `customParameters={"hd":"qxlogistica.com"}`. El login lo hice con `signInWithCredential` (credencial Google del emulador) sobre la misma instancia de `auth` de la app, así que pasa por el mismo `onAuthStateChanged` → lista de acceso → claim.
  1. `intruso.prueba@gmail.com` → `auth.currentUser` en `null` y el mensaje "La cuenta … no tiene acceso al sistema".
  2. `alguien@qxlogistica.com` sin claim → "Acceso pendiente", con *Solicitar acceso* deshabilitado y "Disponible próximamente".
  3. Con `rol: ANALISTA` cargado por la API del emulador y la página recargada → layout con Cotización, Pedidos, Proformas, Liquidación y Órdenes de compra. `/usuarios` redirige a `/`, `/pedidos` muestra "En construcción" y *Cerrar sesión* vuelve al login sin mensaje.
  - **Pendiente para Franco:** probar el popup real de Google en un navegador común.
- **Consumo real:** el bundle de producción se construye con `vite build`, y en dev la app importa `@sistema-redespachos/shared` (`roleSchema`, `ROLES`) y corre en el navegador (prueba manual de arriba).
- **Evidencia del criterio de aceptación:**
  - Email externo: `auth/AuthGate.test.tsx` › "un email externo cierra la sesión y ve el mensaje", más el caso desde el login y el de email no verificado.
  - Interno sin rol: "un email interno sin claim `rol` ve la pantalla de acceso pendiente".
  - Con rol: "con rol %s ve el layout con la navegación de su rol", un caso por cada uno de los 5 roles.
  - Registro: `app/featureRegistry.test.ts` (ids exactos y comparación con las carpetas de `src/features`).
  - URL directa a una feature de otro rol: `app/router.test.tsx`.
  - Función de acceso: `auth/accessList.test.ts` (mayúsculas y espacios, dominio exacto incluido `x@evilqxlogistica.com`, no verificado, listas vacías, `hd`).
- **Decisiones tomadas:**
  - Las features exportan `routes: RouteObject[]` vacío y el shell pone "En construcción", así cada `index.tsx` queda realmente vacío y sin dependencias de `src/app`.
  - Una feature fuera del rol, o una URL desconocida, redirige a `/`, que muestra un inicio neutro.
  - `rol` inválido (no está en D21) o un error al leer el token dejan al usuario como pendiente.
  - El token se lee con `getIdTokenResult(user, true)` para tomar un rol recién asignado.
  - `App` recibe el gateway por props (`main.tsx` crea el real), así los tests no inicializan Firebase.
  - `afterEach(cleanup)` explícito en cada test de componente: con `singleFork`, Testing Library registra el cleanup automático solo en el primer archivo que lo carga.
  - Logos extraídos del base64 de la doc funcional §8.2 a `src/app/assets/`.
- **Supuestos:** las listas se separan por coma y no distinguen mayúsculas; un `@` inicial en el dominio se ignora.
- **Fuera de alcance:**
  - Verificación de dominio y lista en backend: MVP-08.
  - Callable `auth.requestAccess` y botón habilitado: MVP-06.
  - Reglas de Firestore por rol: MVP-07.
  - Code splitting del bundle: sin ticket.
- **Riesgos y deuda:**
  1. **La lista de emails queda visible en el bundle público:** las variables `VITE_*` se incrustan en el JS. Además es solo un filtro de UI: cualquiera puede autenticarse contra Firebase Auth y llamar a la API directamente. La protección real es MVP-07/08.
  2. **El build de CI y de preview necesita las dos variables cargadas.** Sin ellas el build pasa igual, pero la app desplegada rechaza a todos (listas vacías = nadie entra). Hay que cargarlas como variables de entorno del job de build de Hosting (MVP-32 / preview).
  3. **Hallazgo:** `docs/FIREBASE.md` dice copiar el template a `.env.local` en la raíz, pero Vite (sin `envDir`) lee `apps/web/.env.local`, así que un `.env.local` en la raíz no se usa. Va por `CR` (`envDir` en `vite.config.ts` o corregir la doc).
  4. **Deuda:** `firebase-debug.log` no está en `.gitignore` (lo genera el emulador).
  5. **Deuda:** el chunk JS pesa 575 kB.
  6. **Deuda:** `firebase.ts` (no tocado) usa el host de Firestore aunque no haya emulador de Firestore levantado.
  7. **Para el auditor:** revisar primero `AuthProvider.tsx` (la carrera entre `onAuthStateChanged` y `getRoleClaim`, resuelta con un contador de generación) y la matriz de `featureRegistry.ts` contra §3.1 con el ajuste del 9/10.
