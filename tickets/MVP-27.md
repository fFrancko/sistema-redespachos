# MVP-27 — Reporte de orden de compra (§7.9)

- **Carril:** B · Plataforma y circuito
- **Agente:** Claude Code · **Modelo:** Opus 5.5 · **Esfuerzo:** high
- **Auditor:** Gemini · **auditoría reforzada**: `precio` con IVA, una OC por proveedor, unicidad
- **Rama:** `mvp-27-purchase-order-report`
- **Depende de:** MVP-26 mergeado.

## Contexto a leer
- `docs/arquitectura-v3.md`: §3.6 completo (incluida la tabla de columnas), §2.5 (`reportes_oc`, `parametros.oc_constantes`, `formato_fecha_oc`), §2.2 (`condicion_pago`), §3.7, D20, §6.1 (fila IVA doble en la OC).
- `docs/documentacion-funcional.md`: §7.9.
- `packages/shared`: `schemas/reports.ts`, `schemas/system.ts`, `schemas/suppliers.ts`.
- Código previo: `apps/functions/src/callables/{settlement,reports}/**` (MVP-26).

## Alcance
1. **`purchaseOrders.generateReport`** (`ADMIN`, `ADMINISTRACION`): toma pedidos `LISTO_PARA_OC`; rechaza con `PEDIDO_NO_EXPORTABLE` cualquier otro estado; genera una OC por proveedor (`numero` 1, 2, 3 … dentro del reporte) con una línea por pedido; guarda el archivo, registra `reportes_oc`, guarda `reporte_oc_id` y pasa los pedidos a `LIQUIDADO`, con el mismo cuidado de concurrencia y tandas que MVP-26.
2. **Mapeo único** en `apps/functions/src/exporters/purchaseOrder.ts`: columnas y constantes de la tabla de §3.6, leídas de `parametros.oc_constantes` y `formato_fecha_oc`; `precio` = `total` con IVA, 2 decimales desde `cents`. Cambiar a neto debe ser una sola línea (§6.1).
3. **Web:** generación, historial y re-descarga (por `reports.getDownloadUrl`).

## Archivos permitidos
`apps/functions/src/callables/purchaseOrders/**`, su `index.ts` de dominio, `apps/functions/src/exporters/purchaseOrder.ts` (nuevo), `apps/web/src/features/oc/**`, `test/seed/carril-b/**`, tests junto al código, este ticket.

## Archivos prohibidos
Todo lo demás.

## Criterio de aceptación
Literal de la arquitectura §4: **"Solo se exportan `LISTO_PARA_OC`; `precio` es el total con IVA; los pedidos pasan a `LIQUIDADO`; ninguno aparece en dos reportes de OC."**

Agregados:
1. Test: 3 proveedores → `numero` 1, 2 y 3, igual en todas las líneas de cada proveedor.
2. Test: columnas y constantes idénticas a §3.6, incluidas las vacías; fechas en `formato_fecha_oc`.
3. Test: `precio` igual a `total` del pedido centavo a centavo.
4. Test: dos generaciones concurrentes no repiten pedidos; `LIQUIDADO` es final.
5. Secuencia de `AGENTS.md` §5.5 y tests con emuladores en verde, con la salida pegada.

La importación en Finnegans es MVP-28 (la conduce Franco).

## Plan
<lo completa el agente antes de codear; Franco da el OK>

## PREGUNTAS
<dudas del agente>

---

## Nota de entrega
Usar la plantilla de `tickets/_TEMPLATE.md`.
