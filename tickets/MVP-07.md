# MVP-07 — Reglas de seguridad de Firestore y Storage, e índices

- **Carril:** B · Plataforma y circuito
- **Agente:** Claude Code · **Modelo:** Opus 5.5 · **Esfuerzo:** xhigh
- **Auditor:** Gemini · **auditoría reforzada**. Franco revisa las reglas antes del merge (`docs/auditoria-cruzada.md`, regla de cierre 4).
- **Rama:** `mvp-07-security-rules`
- **Depende de:** MVP-06 mergeado.

## Contexto a leer
- `docs/arquitectura-v3.md`: §3.1 (matriz de capacidades completa), §2.1 (colecciones y quién escribe), §2.5 (índices compuestos), §3.4 (evidencias en Storage), §3.5 y §3.6 (reportes en Storage, URLs firmadas).
- `packages/shared`: `roles.ts`, `types/firebase.ts`.
- `firestore.rules` (*deny-all* de `CR-01`), `firebase.json`.
- `docs/ola-0/informe-validacion.md`: H-04 y H-10.

## Alcance
1. **`firestore.rules`:**
   - Ningún cliente escribe ninguna de las 19 colecciones de §2.1 (regla 4 de `AGENTS.md`), sin excepciones: hasta `auth.requestAccess` es una callable.
   - Lectura por rol según la matriz de §3.1: `ANALISTA` solo `pedidos`, `lotes_importacion` y `proformas` de sus sucursales (`sucursal_id in request.auth.token.sucursales`); `BACKOFFICE` todas; `ATENCION_PROVEEDOR` y `ADMINISTRACION` lectura según su fila; `auditoria` solo `ADMIN`; un usuario sin rol solo lee su propio documento de `usuarios` y su solicitud.
   - Usuario `INACTIVO` o sin claim `rol`: sin lectura de negocio.
2. **`storage.rules`** (nuevo): sin escritura directa de clientes salvo las rutas de subida que la arquitectura pone en el cliente (archivo de importación de pedidos y evidencias de respuesta), con tipo y tamaño máximo (evidencias: imagen, PDF o `.eml`, hasta 10 MB); los reportes no se leen directo, salen por URL firmada (`reports.getDownloadUrl`).
3. **`firestore.indexes.json`** (nuevo) con los índices compuestos de §2.5.
4. **Tests en emulador** con `@firebase/rules-unit-testing`: una matriz rol × colección × operación generada desde una tabla, no casos sueltos.
5. Documentar en `docs/FIREBASE.md` (mediante `CR`) cómo se despliegan las reglas: **solo** por workflow, nunca a mano.

## Archivos permitidos
`firestore.rules`, `storage.rules`, `firestore.indexes.json`, `test/rules/**` (nuevo), `firebase.json` (solo para declarar `storage.rules`, por `CR` aprobado en este ticket), este ticket.

## Archivos prohibidos
Todo lo demás.

## Criterio de aceptación
Literal de la arquitectura §4: **"Un `ANALISTA` no lee pedidos de otra sucursal; `ATENCION_PROVEEDOR` y `ADMINISTRACION` solo leen; ningún cliente escribe colecciones de negocio."**

Agregados:
1. La matriz de tests cubre las 19 colecciones y los cinco roles más "sin rol" e "inactivo", para `get`, `list`, `create`, `update` y `delete`.
2. Una consulta de `ANALISTA` sin filtro por sucursal es rechazada (las reglas no son filtros).
3. Los índices de §2.5 están todos en `firestore.indexes.json` y `firebase emulators:start` los carga sin error.
4. Tests con emuladores en verde, con la salida pegada.

## Foco del auditor
Recorrer la matriz de §3.1 fila por fila contra las reglas; probar `list` además de `get`; probar un token con `sucursales` vacío; verificar que no haya ningún `allow write` alcanzable desde el cliente sobre colecciones de negocio.

## Plan
<lo completa el agente antes de codear; Franco da el OK>

## PREGUNTAS
<dudas del agente>

---

## Nota de entrega
Usar la plantilla de `tickets/_TEMPLATE.md`.
