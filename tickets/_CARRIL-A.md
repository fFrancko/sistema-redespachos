# Carril A · Cotización — secuencia de la Ola 1

- **Desarrolla:** Gemini (Antigravity). **Audita:** Claude Code, en conversación limpia, con el prompt de `docs/auditoria-cruzada.md`.
- **En paralelo:** el Carril B lo desarrolla Claude y lo audita Gemini (`tickets/_CARRIL-B.md`).
- **Regla de avance:** un ticket no arranca hasta que el anterior tenga auditoría `APROBADO` o `APROBADO CON OBSERVACIONES` y esté mergeado en `main`, salvo que la columna "Puede solaparse con" diga otra cosa.
- **Motor (MVP-13, 14, 18):** auditoría adicional (el auditor recalcula sin leer el código) y revisión de Franco antes del merge.

## Secuencia

| # | Ticket | Qué entrega | Gemini | Auditoría de Claude | Depende de | Estado del ticket |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `MVP-13` | Destino, variantes y reglas candidatas; motor consumible | Pro · alto | Opus 5.5 · xhigh · adicional | — | **Escrito** |
| 2 | `MVP-14` | Tramos, Mayor Valor, colecta, seguro, IVA, ranking, `cotizar` | Pro · alto | Opus 5.5 · xhigh · adicional | 13 | **Escrito** |
| 3 | `MVP-15` | Casos dorados sintéticos y regresión en CI | Pro · medio | Opus 5.5 · high | 14 | **Escrito** |
| 4 | `CR-02` | `origen_tms` completo en pedidos con error (D36) | Pro · medio | Opus 5.5 · high | Cierre Ola 0 | **Escrito** (puede solaparse con 14 o 15) |
| 5 | `MVP-10` | Canalizador de CP y `solicitudes_cp` | — | — | B: MVP-31, 07, 08 | Se escribe cuando B entregue 07 |
| 6 | `MVP-11` | Excel maestro de tarifas, validaciones, publicación | — | — | 10; B: MVP-09 | Pendiente |
| 7 | `MVP-12` | Editor de reglas y diferencias | — | — | 11 | Pendiente |
| 8 | `MVP-16` | Simulador | — | — | 12, 14 | Pendiente |
| 9 | `MVP-17` | Importación de pedidos | — | — | 10, `CR-02`; B: 07, 30 | Pendiente |
| 10 | `MVP-18` | Valorización del lote (trigger) | — | — | 14, 17 | Pendiente |
| 11 | `MVP-19` | Panel de revisión | — | — | 18 | Pendiente |
| 12 | `MVP-20` | Cotización manual y salidas de la disputa | — | — | 18 | Pendiente (paralelo con 19) |
| 13 | `MVP-21` | Informe de modo sombra | — | — | 19 | Pendiente |

Los tickets 5 a 13 se escriben cuando su dependencia del Carril B esté cerca de cerrarse, para que cada uno refleje el código real (lección 7 de la Ola 0: tickets escritos demasiado temprano quedan desactualizados).

## Decisiones que Franco tiene que responder antes de dar el OK a cada plan
| Ticket | Pregunta | Recomendación |
| --- | --- | --- |
| MVP-13 | CP con varios registros en el canalizador y ninguno coincide | Coincidencia solo por provincia si es única; si no, `DESCONOCIDA` |
| MVP-13 | CP de origen fuera del canalizador | Solo reglas `*` con origen estricto; observación `CP_NO_EN_CANALIZADOR` |
| MVP-14 | Redondeo de la colecta | Half-up a centavo |
| MVP-14 | Cuándo se marca `CP_AMBIGUO` | Dos o más variantes válidas con total o plazo distintos |
| MVP-14 | Redondeo del excedente | Una sola vez, sobre `costo_peso` / `costo_volumen` completos |
| MVP-15 | Dónde viven los casos reales | Fuera del repo, con script local |
