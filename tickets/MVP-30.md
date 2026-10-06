# MVP-30 — Catálogo de sucursales y parámetros globales

- **Carril:** B · Plataforma y circuito
- **Agente:** Claude Code · **Modelo:** Sonnet 5.5 · **Esfuerzo:** medium
- **Auditor:** Gemini · auditoría estándar
- **Rama:** `mvp-30-branches`
- **Depende de:** MVP-06 y MVP-07 mergeados. Puede solaparse con MVP-09.

## Contexto a leer
- `docs/arquitectura-v3.md`: §2.5 (`sucursales`, `parametros/global`), §3.8 (filas `admin.importBranches` y `admin.updateParams`), D14, §2 (normalización `norm()`).
- `packages/shared`: `schemas/branches.ts`, `schemas/system.ts`, `normalize.ts`.
- Código previo: `apps/functions/src/callables/admin/**` (MVP-06, MVP-08).

## Alcance
1. **`admin.importBranches`** (`ADMIN`): carga o actualiza el catálogo `sucursales` desde una lista de cabeceras de origen (archivo CSV o lista pegada); id del documento = `norm(cabecera_origen)`; una cabecera repetida se ignora; las que no vienen no se borran (se pueden marcar `activa = false`). Con `withAudit`.
2. `admin.setUserRole` valida que las `sucursales[]` existan y estén activas (cierra lo que MVP-06 dejó anotado).
3. **`admin.updateParams`** (`ADMIN`): edita `parametros/global` validando con el esquema de `shared`. *Está en §3.8 y no tenía ticket: se agrega acá (confirmado por Franco el 5/10).*
4. **Web:** pantalla de sucursales (lista, alta por archivo, activa/inactiva), selector de sucursales en la pantalla de usuarios, pantalla de parámetros.
5. Fixture sintético de cabeceras, con las mismas cabeceras que cita la arquitectura (no hace falta el archivo real).

## Archivos permitidos
`apps/functions/src/callables/admin/**`, el `index.ts` del dominio `admin`, `apps/web/src/features/{sucursales,usuarios,parametros}/**`, `test/fixtures/sucursales/**` (nuevo, sintético), tests junto al código, este ticket.

## Archivos prohibidos
Todo lo demás. La validación `CABECERA_NO_PERMITIDA` en la importación de pedidos es de MVP-17 (Carril A): acá solo se deja el catálogo y la asignación.

## Criterio de aceptación
Literal de la arquitectura §4: **"Las cabeceras de `pedidos_tms.csv` (SANTA FE, CABA, ZONA SUR, ZONA OESTE, ZONA NORTE, MENDOZA, CORDOBA, …) existen como sucursales; un `ANALISTA` solo importa pedidos de sus sucursales; una cabecera desconocida da `CABECERA_NO_PERMITIDA`."**

Reparto: la primera parte se prueba acá; las otras dos dependen de `orders.importBatch` y se prueban en **MVP-17**. Este ticket deja:
1. Test: importar el fixture crea una sucursal por cabecera con id `norm()`, y reimportarlo no crea duplicados.
2. Test: `setUserRole` con una sucursal inexistente o inactiva se rechaza.
3. Test: `updateParams` rechaza un `parametros` que no valida el esquema y audita el cambio.
4. Franco corre la importación con las cabeceras reales (fuera del repo) y confirma el conteo.
5. Secuencia de `AGENTS.md` §5.5 y tests con emuladores en verde, con la salida pegada.

## Plan
<lo completa el agente antes de codear; Franco da el OK>

## PREGUNTAS
- (Resuelto 5/10) `admin.updateParams` entra en este ticket.

---

## Nota de entrega
Usar la plantilla de `tickets/_TEMPLATE.md`.
