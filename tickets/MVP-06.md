# MVP-06 — Custom claims, solicitudes de acceso y administración de usuarios

- **Carril:** B · Plataforma y circuito
- **Agente:** Claude Code · **Modelo:** Sonnet 5.5 · **Esfuerzo:** high
- **Auditor:** Gemini · auditoría estándar
- **Rama:** `mvp-06-roles`
- **Depende de:** MVP-05 y MVP-08 mergeados.

## Contexto a leer
- `docs/arquitectura-v3.md`: §3.1, §2.5 (`usuarios`, `solicitudes_acceso`), §3.8 (filas `auth.requestAccess` y `admin.setUserRole`), D21, D35.
- `packages/shared`: `roles.ts`, `schemas/users.ts`, `errors.ts`.
- Código previo: `apps/functions/src/lib/**` (MVP-08), `apps/web/src/app/**` y `src/auth/**` (MVP-05).

## Alcance
1. **`auth.requestAccess`** (usuario autenticado del dominio, sin rol): crea o reutiliza su solicitud `PENDIENTE` en `solicitudes_acceso` (una sola pendiente por `uid`), con `withAudit`, y deja un email a los `ADMIN` **en el outbox** cuando exista (MVP-22). Hasta entonces, el aviso es solo el contador de la UI y queda anotado como pendiente de MVP-22.
2. **`admin.setUserRole`** (`ADMIN`): asigna `rol` y `sucursales[]` en los custom claims y en `usuarios`, resuelve la solicitud (`APROBADA` o `RECHAZADA`, con `resuelto_por` y `resuelto_en`) y permite desactivar un usuario (`estado = INACTIVO`, claims vacíos). Todo con `withAudit`. Las sucursales se validan contra el catálogo cuando exista (MVP-30); hasta entonces, se acepta la lista y queda anotado.
3. **Web:** el botón *Solicitar acceso* de MVP-05 se habilita; pantallas de usuarios (lista, rol, sucursales, estado) y de solicitudes pendientes, con contador en la navegación del `ADMIN`. Tras un cambio de rol, la UI fuerza `getIdToken(true)`.
4. Los cinco roles de D21: `ADMIN`, `ATENCION_PROVEEDOR`, `ANALISTA`, `BACKOFFICE`, `ADMINISTRACION`.
5. Script de arranque para el primer `ADMIN` (los claims no se pueden asignar sin un `ADMIN` previo), que corre con credenciales locales y **no** se despliega.

## Archivos permitidos
`apps/functions/src/callables/{auth,admin}/**`, los `index.ts` de los dominios `auth` y `admin`, `apps/web/src/features/usuarios/**`, `apps/web/src/auth/**` (solo para habilitar el botón y refrescar el token), `scripts/bootstrap-admin.ts` (nuevo, fuera de los paquetes), tests junto al código, este ticket.

## Archivos prohibidos
Todo lo demás, incluidos `packages/shared` y `apps/functions/src/lib`.

## Criterio de aceptación
Literal de la arquitectura §4: **"Cambiar un rol se refleja al refrescar el token y queda en auditoría; existen los cinco roles."**

Agregados:
1. Test con emuladores: `setUserRole` cambia los claims, el token refrescado los trae y `auditoria` tiene `antes` y `despues`.
2. Un no-`ADMIN` que llama a `setUserRole` recibe `permission-denied`.
3. Un usuario que pide acceso dos veces tiene una sola solicitud `PENDIENTE`.
4. Desactivar un usuario le quita los claims y la UI vuelve a la pantalla pendiente.
5. Secuencia de `AGENTS.md` §5.5 y tests con emuladores en verde, con la salida pegada.

## Plan
<lo completa el agente antes de codear; Franco da el OK>

## PREGUNTAS
<dudas del agente>

---

## Nota de entrega
Usar la plantilla de `tickets/_TEMPLATE.md`.
