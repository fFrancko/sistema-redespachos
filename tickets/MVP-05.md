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
`apps/web/src/app/**` (se crea en este ticket), `apps/web/src/features/*/index.tsx` (vacíos), `apps/web/src/auth/**`, `apps/web/src/components/ui/**`, `apps/web/src/App.tsx`, `apps/web/src/main.tsx`, `apps/web/index.html`, `apps/web/vite.config.ts`, la configuración de Tailwind y PostCSS de `apps/web`, `apps/web/tsconfig.json` (solo alias `@/`), `.env.local.template` (solo las dos variables), este ticket.

## Archivos prohibidos
Todo lo que no figure arriba. `.env.local.template` y `AGENTS.md` van por `CR` (ver PREGUNTAS).

## Criterio de aceptación
Literal de la arquitectura §4: **"Un email externo al dominio no entra; uno interno sin rol ve la pantalla pendiente."** Mientras no haya dominio, "externo" = fuera de la lista de acceso.

Agregados de este ticket:
1. Tests de componente (Auth simulado): email externo → sesión cerrada y mensaje; email interno sin claim `rol` → pantalla pendiente; con claim `rol` → layout con la navegación de su rol.
2. El registro de features tiene exactamente las 12 carpetas de `AGENTS.md` §3, y un test falla si alguien agrega o quita una.
3. Prueba manual con el emulador de Auth (`pnpm dev:emulator` + `pnpm dev`), documentada en la nota de entrega.
4. Secuencia de `AGENTS.md` §5.5 en verde, con la salida pegada.

Fuera de este ticket: "verificado también en backend" (§3.1) va en MVP-08 (guarda de dominio en las callables).

## Plan
<lo completa el agente antes de codear, con la lista de archivos a tocar; Franco da el OK>

## PREGUNTAS
- (Resuelto 5/10) QX todavía no tiene Google Workspace: acceso por lista de emails hasta que exista el dominio.
- (Resuelto 5/10) `auditoria` y `parametros` se suman a las features del Carril B en `AGENTS.md` §3: el registro sale con **12 carpetas**.

---

## Nota de entrega
Usar la plantilla de `tickets/_TEMPLATE.md`.
