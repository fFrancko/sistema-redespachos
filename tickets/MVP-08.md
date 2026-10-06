# MVP-08 — `withAudit`, guardas de acceso y visor de auditoría

- **Carril:** B · Plataforma y circuito. Escribe en `apps/functions/src/lib` (compartido): **este ticket lo permite explícitamente** y, al mergearse, `lib` vuelve a quedar congelado.
- **Agente:** Claude Code · **Modelo:** Opus 5.5 · **Esfuerzo:** high
- **Auditor:** Gemini · auditoría estándar + romper al menos 3 reglas (auditoría en otra transacción, `antes` vacío en una modificación, rol no verificado)
- **Rama:** `mvp-08-audit`
- **Depende de:** MVP-31 mergeado. El visor necesita el shell de MVP-05.

## Contexto a leer
- `docs/arquitectura-v3.md`: §3.8 (último párrafo y la lista de códigos de error), §2.5 (`auditoria`), §3.1 (roles y dominio), D21, D35.
- `packages/shared`: `errors.ts` (`DomainError`, catálogo de códigos), `roles.ts`, `schemas/system.ts` (esquema de `auditoria`), `types/firebase.ts`.
- Código previo: `apps/functions/src/` tal como lo deja MVP-31.

## Alcance
1. **`withAudit`** en `apps/functions/src/lib/audit/`: recibe la entidad, el id y una función que trabaja dentro de **una transacción de Firestore**; lee `antes`, aplica el cambio, escribe `despues` y el documento de `auditoria` (`entidad`, `entidad_id`, `accion`, `usuario`, `antes`, `despues`, `timestamp`) **en la misma transacción**. Si la transacción falla, no queda auditoría.
2. **Guardas** en `apps/functions/src/lib/auth/`: `requireAuth` (usuario autenticado y **email dentro de la lista de acceso**: `ALLOWED_EMAILS` / `ALLOWED_DOMAINS` como parámetros de Functions, igual que en MVP-05; cierra el "verificado también en backend" de §3.1), `requireRole(...roles)` y `requireBranch(sucursal_id)` leyendo los custom claims.
3. **Errores:** `toHttpsError` que convierte un `DomainError` de `shared` en `HttpsError` con el `code` del catálogo; los errores no previstos salen como `internal` sin filtrar detalles.
4. **Visor de auditoría** para `ADMIN`: callable de lectura paginada `admin.listAudit` (filtros por entidad, id y rango de fechas, orden por `timestamp desc`) y pantalla con tabla en la feature `auditoria` (si Franco aprobó el `CR` de MVP-05; si no, dentro de `usuarios`).
5. Tests con el emulador de Firestore.

## Archivos permitidos
`apps/functions/src/lib/audit/**`, `apps/functions/src/lib/auth/**`, `apps/functions/src/lib/errors/**`, `apps/functions/src/callables/admin/**`, el `index.ts` del dominio `admin`, `apps/web/src/features/auditoria/**` (o `usuarios/**`), tests junto al código, este ticket.

## Archivos prohibidos
Todo lo demás; en particular `packages/shared` (si falta un código de error o un campo, `CR: shared` y frenar).

## Criterio de aceptación
Literal de la arquitectura §4: **"Toda callable de escritura deja registro con antes y después."**

Cómo se prueba en este ticket (no hay todavía callables de negocio):
1. Una callable de prueba **solo en tests** que usa `withAudit`: el registro existe con `antes` y `despues` correctos en alta, modificación y baja.
2. Si la función de negocio lanza un error, ni el cambio ni la auditoría quedan escritos.
3. Un email fuera de la lista de acceso, un usuario sin rol y un rol no permitido reciben el `HttpsError` esperado.
4. Un `DomainError` llega al cliente con su `code`; un error inesperado llega como `internal` sin el mensaje original.
5. El visor solo responde a `ADMIN`.
6. Secuencia de `AGENTS.md` §5.5 y tests con emuladores en verde, con la salida pegada.

## Foco del auditor
Que la auditoría esté dentro de la misma transacción (no un `add` posterior), que `requireAuth` verifique el dominio en el token y no en un dato enviado por el cliente, y que la paginación no lea la colección entera.

## Plan
<lo completa el agente antes de codear; Franco da el OK>

## PREGUNTAS
<dudas del agente>

---

## Nota de entrega
Usar la plantilla de `tickets/_TEMPLATE.md`.
