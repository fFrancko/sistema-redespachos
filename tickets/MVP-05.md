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
Usar la plantilla de `tickets/_TEMPLATE.md`.
