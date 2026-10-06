# MVP-24 — Proforma: agrupación, adjunto y envío

- **Carril:** B · Plataforma y circuito
- **Agente:** Claude Code · **Modelo:** Opus 5.5 · **Esfuerzo:** high
- **Auditor:** Gemini · **auditoría reforzada**: recalcular por su cuenta los totales del adjunto en centavos
- **Rama:** `mvp-24-proformas`
- **Depende de:** MVP-23 mergeado. Necesita pedidos `VALORIZADO` del Carril A (MVP-18): mientras tanto, datos sembrados.

## Contexto a leer
- `docs/arquitectura-v3.md`: §3.4 (puntos Envío, Contenido), §2.5 (`proformas`), §2.4 (grupo Cotización elegida, `detalle_tarifa`), §3.7, §3.1 (permisos de envío), D16, §6.1 (fila de adjunto mayor a 20 MB).
- `packages/shared`: `schemas/proformas.ts`, `schemas/orders.ts` (`orderSchema`), `primitives.ts` (helpers de `cents`), `orderTransitions.ts`.

## Alcance
1. **`proformas.send`** (`ADMIN`, `ANALISTA` de la sucursal, `BACKOFFICE`) sobre un lote: toma solo los pedidos `VALORIZADO`, los agrupa por `cotizacion.id_proveedor` y crea por proveedor una proforma con **totales congelados** (`cantidad`, `neto`, `iva`, `total` en `cents`, sumados desde las cotizaciones guardadas, sin recalcular), el adjunto con exceljs (`XLSX` o `CSV` según la plantilla resuelta) en Storage y el email en el outbox de MVP-22. Pedidos en `CON_ERROR`, `VALIDADO`, `SIN_COBERTURA` o `COBERTURA_QX` no se envían.
2. Cada pedido incluido guarda `proforma_id`; un pedido ya incluido en una proforma no entra en otra salvo que vuelva a `VALORIZADO` por el circuito de disputa.
3. Adjunto mayor a 20 MB: se divide en varias proformas del mismo proveedor y lote, cada una con su email (§6.1).
4. Importes del adjunto con 2 decimales a partir de `cents`, sin `number` flotante en la conversión.
5. **Siembra** en los emuladores: script en `test/seed/carril-b/` con pedidos `VALORIZADO` que validan contra `orderSchema`.
6. **Web:** acción *Enviar proformas* por lote con resumen por proveedor antes de confirmar, y lista de proformas con estado.

## Archivos permitidos
`apps/functions/src/callables/proformas/**`, el `index.ts` del dominio `proformas`, `apps/functions/src/exporters/proformaAttachment.ts` (nuevo), `apps/web/src/features/proformas/**`, `test/seed/carril-b/**` (nuevo), tests junto al código, este ticket.

## Archivos prohibidos
Todo lo demás; en particular los dominios `orders` y el motor (Carril A).

## Criterio de aceptación
Literal de la arquitectura §4: **"Se envía un email por proveedor y lote; el adjunto trae criterio, tarifa utilizada, neto, IVA y total de cada pedido, y su suma coincide con los totales de la proforma."**

Agregados:
1. Test con un lote sembrado de 3 proveedores y pedidos en estados mezclados: 3 proformas, 3 emails, solo los `VALORIZADO`.
2. Test: se lee el adjunto generado y la suma de sus columnas `neto`, `iva` y `total` es igual, centavo a centavo, a `proformas.totales`.
3. Test: llamar dos veces a `send` sobre el mismo lote no duplica proformas.
4. Un `ANALISTA` de otra sucursal recibe `permission-denied`.
5. Secuencia de `AGENTS.md` §5.5 y tests con emuladores en verde, con la salida pegada.

## Foco del auditor
Sumas en `cents` sin pasar por flotante; congelamiento real (cambiar la cotización de un pedido después del envío no cambia la proforma); idempotencia de `send`.

## Plan
<lo completa el agente antes de codear; Franco da el OK>

## PREGUNTAS
<dudas del agente>

---

## Nota de entrega
Usar la plantilla de `tickets/_TEMPLATE.md`.
