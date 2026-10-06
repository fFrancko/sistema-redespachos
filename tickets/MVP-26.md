# MVP-26 — Reporte de liquidación (§7.8)

- **Carril:** B · Plataforma y circuito
- **Agente:** Claude Code · **Modelo:** Opus 5.5 · **Esfuerzo:** xhigh
- **Auditor:** Gemini · **auditoría reforzada**: orden de las 55 columnas, importes y unicidad
- **Rama:** `mvp-26-settlement-report`
- **Depende de:** MVP-25 mergeado. `CR-02` (D36) mergeado.

## Contexto a leer
- `docs/arquitectura-v3.md`: §3.5 completo (incluida la tabla de columnas), §2.5 (`reportes_liquidacion`), §2.4 (`origen_tms`, cotización), §3.7, D19, D31, D36, D37.
- `docs/documentacion-funcional.md`: §7.8.
- `packages/shared`: `tms/headers.ts` (`TMS_COLUMNS`), `schemas/reports.ts`, `schemas/orders.ts`, `orderTransitions.ts`.

## Alcance
1. **`settlement.preview`** (`ADMIN`, `ANALISTA` de sus sucursales, `BACKOFFICE`): pedidos `ACEPTADO_PROVEEDOR` filtrables por `fecha_aceptacion`, sucursal y proveedor, paginados, con subtotales por proveedor.
2. **`settlement.confirmBlock`**: recibe la lista de pedidos (sin los excluidos); rechaza con `PEDIDO_NO_EXPORTABLE` cualquiera que no esté `ACEPTADO_PROVEEDOR`; crea el reporte en `PROCESANDO` con `numero` correlativo **sin colisiones** (contador en transacción), genera el xlsx o csv con exceljs, lo guarda en Storage, marca los pedidos `LISTO_PARA_OC` con `reporte_liquidacion_id` (BulkWriter en tandas si son más de 500) y pasa el reporte a `LISTO`.
3. **Columnas** en `apps/functions/src/exporters/settlement.ts`: las 47 de `TMS_COLUMNS` en su orden (D37), con los valores de la tabla de §3.5 (Id Tarifa, Valor Calculado Tarifa = `flete + colecta`, Seguro, Total a Facturar, Status, Codigo de Expreso y Transporte, Nro de Liquidación, etc.) y los demás desde los campos del pedido y `origen_tms`; al final las 8 técnicas. Importes con 2 decimales desde `cents` (punto decimal en CSV, numérico en xlsx); fechas nuevas `yyyy-MM-dd`.
4. **`reports.getDownloadUrl`**: URL firmada de corta duración, solo para roles con acceso al reporte.
5. **Web:** previsualización con exclusión de pedidos, confirmación del bloque, historial con re-descarga.

## Archivos permitidos
`apps/functions/src/callables/{settlement,reports}/**`, sus `index.ts` de dominio, `apps/functions/src/exporters/settlement.ts` (nuevo), `apps/web/src/features/liquidacion/**`, `test/seed/carril-b/**`, tests junto al código, este ticket.

## Archivos prohibidos
Todo lo demás, incluido `headers.ts` (D37: si el orden no cierra, `CR`).

## Criterio de aceptación
Literal de la arquitectura §4: **"Solo se exportan `ACEPTADO_PROVEEDOR`; los pedidos pasan a `LISTO_PARA_OC`; ninguno aparece en dos reportes; el orden de columnas es el de §3.5."**

Agregados:
1. Test: los encabezados del archivo generado son exactamente `TMS_COLUMNS` + las 8 técnicas, en orden.
2. Test: un bloque con un pedido `PENDIENTE_CONFIRMACION` o `EN_DISPUTA` → `PEDIDO_NO_EXPORTABLE` y nada cambia.
3. Test: dos `confirmBlock` concurrentes sobre el mismo pedido → uno solo lo incluye.
4. Test con 1.200 pedidos sembrados: todos pasan a `LISTO_PARA_OC` y el reporte queda `LISTO`.
5. Test: `Valor Calculado Tarifa`, `Valor Calculado Seguro` y `Total a Facturar` coinciden centavo a centavo con la cotización guardada.
6. Secuencia de `AGENTS.md` §5.5 y tests con emuladores en verde, con la salida pegada.

La validación con el TMS real es MVP-28 (la conduce Franco).

## Foco del auditor
Comparar el archivo generado contra la tabla de §3.5 columna por columna; buscar `number` en la conversión de importes; estado intermedio si la generación falla a mitad (el reporte no puede quedar `LISTO` con pedidos sin marcar, ni pedidos marcados sin reporte).

## Plan
<lo completa el agente antes de codear; Franco da el OK>

## PREGUNTAS
<dudas del agente>

---

## Nota de entrega
Usar la plantilla de `tickets/_TEMPLATE.md`.
