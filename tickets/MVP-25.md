# MVP-25 — Respuesta del proveedor, control por oposición y disputa

- **Carril:** B · Plataforma y circuito
- **Agente:** Claude Code · **Modelo:** Opus 5.5 · **Esfuerzo:** high
- **Auditor:** Gemini · **auditoría reforzada**: control por oposición (incluido `ADMIN`) y transiciones
- **Rama:** `mvp-25-supplier-response`
- **Depende de:** MVP-24 mergeado. Las salidas de la disputa son del Carril A (MVP-18 y MVP-20).

## Contexto a leer
- `docs/arquitectura-v3.md`: §3.1 (Control por oposición), §3.4 (puntos Respuesta del proveedor y Disputa), §2.5 (`respuestas_proveedor`, `proformas`), §3.7, §3.8 (filas `proformas.registerResponse` y `orders.reopen`), D17, D18, D31.
- `packages/shared`: `schemas/proformas.ts`, `schemas/orders.ts`, `orderTransitions.ts`, `errors.ts` (`MISMO_USUARIO`).

## Alcance
1. **`proformas.registerResponse`** (`ADMIN`, `ATENCION_PROVEEDOR`): registra por pedido `ACEPTA` o `RECHAZA` (por defecto, todos los de la proforma); exige al menos una evidencia ya subida a Storage (imagen, PDF o `.eml`, hasta 10 MB), `fecha_respuesta` no futura (día calendario de Buenos Aires) y justificación si hay rechazos. **Rechaza con `MISMO_USUARIO` si quien registra es quien envió la proforma, aunque sea `ADMIN`.**
2. Efectos en una transacción con `withAudit`: aceptados → `ACEPTADO_PROVEEDOR` con `fecha_aceptacion` en la **raíz** del pedido (D31) y `confirmacion = {respuesta, respuesta_id}`; rechazados → `EN_DISPUTA`; proforma `RESPONDIDA` o `RESPONDIDA_PARCIAL`. Solo pedidos `PENDIENTE_CONFIRMACION` de esa proforma.
3. **`orders.reopen`** (`ADMIN`): `ACEPTADO_PROVEEDOR` → `EN_DISPUTA` con justificación. *Está en el dominio `orders` (Carril A); este ticket lo permite por ser parte del circuito de confirmación (confirmado por Franco el 5/10).*
4. Contador en la UI de pedidos `EN_DISPUTA` (por consulta).
5. **Web:** pantalla de respuesta por proforma con subida de evidencias, selección de rechazos, justificación y fecha.

## Archivos permitidos
`apps/functions/src/callables/proformas/**`, `apps/functions/src/callables/orders/reopen*` (solo ese archivo y su test) y una línea en el `index.ts` del dominio `orders` (ver PREGUNTAS), `apps/web/src/features/proformas/**`, `test/seed/carril-b/**`, tests junto al código, este ticket.

## Archivos prohibidos
Todo lo demás. `orders.requote`, `chooseAlternative` y `setManualQuote` (las tres salidas de la disputa) son del Carril A.

## Criterio de aceptación
Literal de la arquitectura §4: **"Quien envió la proforma no puede registrar la respuesta (`MISMO_USUARIO`); sin evidencia se rechaza; un rechazo deja `EN_DISPUTA` con sus tres salidas; se guarda `fecha_aceptacion`."**

Reparto: "con sus tres salidas" se prueba cuando A entregue MVP-20; acá se prueba que el pedido queda en `EN_DISPUTA` y que la tabla de transiciones habilita las tres. Agregados:
1. Test: `ADMIN` que envió la proforma → `MISMO_USUARIO`.
2. Test: sin evidencia, con fecha futura o con rechazos sin justificación → rechazo.
3. Test: respuesta parcial → aceptados con `fecha_aceptacion` en la raíz, rechazados `EN_DISPUTA`, proforma `RESPONDIDA_PARCIAL`.
4. Test: registrar sobre un pedido que ya no está `PENDIENTE_CONFIRMACION` → `TRANSICION_INVALIDA`.
5. Secuencia de `AGENTS.md` §5.5 y tests con emuladores en verde, con la salida pegada.

## Plan
<lo completa el agente antes de codear; Franco da el OK>

## PREGUNTAS
- (Resuelto 5/10) `orders.reopen` lo hace este ticket.

---

## Nota de entrega
Usar la plantilla de `tickets/_TEMPLATE.md`.
