# Carril B · Plataforma y circuito — secuencia de la Ola 1

- **Desarrolla:** Claude Code. **Audita:** Gemini (Antigravity), en conversación limpia, con el prompt de `docs/auditoria-cruzada.md`.
- **En paralelo:** el Carril A (cotización) lo desarrolla Gemini y lo audita Claude.
- **Regla de avance:** un ticket no arranca hasta que el anterior de la secuencia tenga auditoría con veredicto `APROBADO` o `APROBADO CON OBSERVACIONES` y esté mergeado en `main`, salvo que la columna "Puede solaparse con" diga otra cosa.
- **Fuente de cada ticket:** `docs/arquitectura-v3.md` §4 (criterio de aceptación copiado literal) y `docs/mapa-de-contexto.md`.

## Secuencia

| # | Ticket | Qué entrega | Modelo | Esfuerzo | Auditoría de Gemini | Depende de | Puede solaparse con |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `CR-01` | Infraestructura: `ci:run`, Prettier, Dependabot, reglas *deny-all*, `.gitignore` | Sonnet 5.5 | medium | Estándar | Cierre Ola 0 | `CR-03` |
| 2 | `CR-03` | `CR: deps` base del carril (router, React Query, UI, formularios, tests de reglas y de React) | Sonnet 5.5 | low | Liviana (solo dependencias y lockfile) | `CR-01` | — |
| 3 | `MVP-31` | Deploy de Functions: 2ª gen, región, NodeNext, empaquetado de `shared`, índice raíz por dominio, `DEPLOY_ENABLED` | **Opus 5.5** | **high** | Estándar + leer los pasos del run | `CR-01` | `MVP-05` |
| 4 | `MVP-05` | Login con Google restringido al dominio, shell web con la lista fija de features, pantalla de acceso pendiente | **Opus 5.5** | medium | Estándar | `CR-03` | `MVP-31` |
| 5 | `MVP-32` | Preview de Hosting por PR | Sonnet 5.5 | medium | Liviana + leer los pasos del run | `MVP-31`, `MVP-05` | `MVP-08` |
| 6 | `MVP-08` | `withAudit`, guardas de autenticación y rol, mapeo de errores, visor de auditoría | **Opus 5.5** | **high** | Estándar + romper 3 reglas | `MVP-31` | `MVP-32` |
| 7 | `MVP-06` | Custom claims, `auth.requestAccess`, `admin.setUserRole`, pantallas de usuarios y solicitudes | Sonnet 5.5 | high | Estándar | `MVP-05`, `MVP-08` | — |
| 8 | `MVP-07` | Reglas de Firestore y Storage por rol y sucursal, índices, tests en emulador | **Opus 5.5** | **xhigh** | **Reforzada**: matriz de §3.1 completa | `MVP-06` | — |
| 9 | `MVP-30` | Catálogo de sucursales, asignación a usuarios, `admin.updateParams` | Sonnet 5.5 | medium | Estándar | `MVP-06`, `MVP-07` | `MVP-09` |
| 10 | `MVP-09` | ABM de proveedores con CUIT único, IVA, seguro, alias y `email_config` | Sonnet 5.5 | high | Estándar + casos borde de CUIT y porcentajes | `MVP-07`, `MVP-08` | `MVP-30` |
| 11 | `CR-04` | `CR: deps` del circuito (Gmail API, Handlebars, exceljs) | Sonnet 5.5 | low | Liviana | `MVP-09` | — |
| 12 | `MVP-22` | Outbox de emails, worker con Cloud Tasks, Gmail API, 3 reintentos, idempotencia | **Opus 5.5** | **high** | Estándar + forzar fallos | `CR-04` | — |
| 13 | `MVP-23` | Plantillas de email parametrizables con catálogo cerrado y vista previa | Sonnet 5.5 | high | Estándar + intento de inyección | `MVP-22`, `MVP-09` | — |
| 14 | `MVP-24` | Proforma: agrupación por proveedor, adjunto, totales congelados, `proformas.send` | **Opus 5.5** | **high** | **Reforzada**: suma de importes en centavos | `MVP-23` (+ datos sembrados de A) | — |
| 15 | `MVP-25` | Respuesta del proveedor con evidencia, control por oposición, `EN_DISPUTA` | **Opus 5.5** | **high** | **Reforzada**: oposición y transiciones | `MVP-24` | — |
| 16 | `MVP-26` | Reporte de liquidación §7.8 (47 + 8 columnas), historial | **Opus 5.5** | **xhigh** | **Reforzada**: orden de columnas y dinero | `MVP-25` | — |
| 17 | `MVP-27` | Reporte de OC §7.9, historial | **Opus 5.5** | high | **Reforzada**: dinero y unicidad | `MVP-26` | — |

`CR-02` (D36 en `shared`) **no está en esta secuencia**: es dependencia del Carril A (bloquea MVP-17) y toca el parser. Recomendación: que lo haga Gemini antes de MVP-17 y lo audite Claude.

## Criterio para elegir modelo y esfuerzo

- **Opus 5.5** cuando un error es caro o difícil de ver en la revisión: dinero (`cents`, totales congelados, reportes), seguridad (reglas, control por oposición), código que todos los tickets reutilizan (`withAudit`, shell, deploy) o idempotencia (outbox).
- **Sonnet 5.5** para ABM y pantallas con un contrato ya fijado en `shared`, y para los `CR: deps`.
- **Esfuerzo:** `low` para cambios mecánicos; `medium` para tickets acotados; `high` para lógica con transacciones o casos borde; `xhigh` solo en MVP-07 (una regla mal escrita expone datos de todas las sucursales) y MVP-26 (47 columnas en orden, importes y cambio de estado masivo). `max` no se justifica en ningún ticket del carril.
- **Auditoría de Gemini:** *estándar* es el checklist de `docs/auditoria-cruzada.md`; *reforzada* agrega lo que dice cada ticket en su sección "Foco del auditor"; *liviana* se limita a alcance, lockfile y verificación.

## Dependencias con el Carril A

| Ticket B | Necesita de A | Mientras tanto |
| --- | --- | --- |
| MVP-24 | Pedidos `VALORIZADO` (MVP-18) | Script de siembra en los emuladores (`test/seed/carril-b/`) |
| MVP-25 | Salidas de la disputa: `orders.requote`, `chooseAlternative`, `setManualQuote` (MVP-18, MVP-20) | MVP-25 solo deja el pedido en `EN_DISPUTA`; las salidas son de A |
| MVP-26, MVP-27 | Pedidos con `cotizacion` completa | Datos sembrados |

| Ticket A | Necesita de B |
| --- | --- |
| MVP-10 (primer callable de A) | `MVP-31`, `MVP-07`, `MVP-08` |
| MVP-11 | `MVP-09` |
| MVP-17 | `MVP-07`, `MVP-30` (y `CR-02`) |

## Pendientes para Franco antes de arrancar

1. **Secrets de GCP** y variable `DEPLOY_ENABLED` (MVP-31).

Resuelto el 5/10: sin Google Workspace por ahora → login por lista de emails (MVP-05, MVP-08) y emails simulados con bandeja visible (MVP-22); envío real por Gmail cuando exista Workspace (ticket a crear). `admin.updateParams` en MVP-30; `orders.reopen` en MVP-25; `auditoria` y `parametros` agregadas a `AGENTS.md` §3.
