# MVP-15 — Casos dorados del motor (regresión en CI)

- **Carril:** A · Cotización
- **Agente:** Gemini (Antigravity) · **Modelo:** Gemini Pro · **Esfuerzo:** medio
- **Auditor:** Claude Code · **Modelo:** Opus 5.5 · **Esfuerzo:** high · auditoría estándar + recalcular a mano 5 casos elegidos por el auditor
- **Rama:** `mvp-15-casos-dorados`
- **Depende de:** MVP-14 auditado y mergeado.

## Contexto a leer
- `docs/arquitectura-v3.md`: §3.3 (casos de referencia), §4 (Hito 1A, criterio de salida), §7 punto 3.
- `AGENTS.md` regla 8 (datos reales).
- Código previo: `packages/motor/**`, `vitest.config.ts` (MVP-14 ya incluye `packages/*/test/**`).

## Alcance
1. **Formato de caso dorado** en `packages/motor/test/golden/`: un JSON por caso con la entrada completa del motor (pedido, canalizador, proveedores, tarifarios y reglas, `fecha_referencia`, `origen_estricto`) y la salida esperada (cotización, alternativas, descartes, observaciones, estado sugerido), montos en `cents`.
2. **Runner** (`golden.test.ts`) que corre `cotizar` sobre cada caso y compara la salida completa; si difiere, el test falla mostrando el campo y los dos valores.
3. **Actualización explícita:** script `pnpm --filter @sistema-redespachos/motor golden:update -- --caso <id> --motivo "<texto>"` que reescribe solo ese caso y agrega el motivo a un `CHANGELOG.md` de la carpeta. Sin script, un cambio en el motor que altere un caso **no** pasa CI.
4. **Set inicial sintético** (sin datos reales): los 2 casos de referencia de §3.3 y al menos 20 casos en los bordes, que cubran tramos, excedentes, empates, variantes, provincias, origen estricto, cobertura QX y descartes. Cada caso lleva una línea que explica qué prueba.
5. **Casos reales (pendiente):** ver PREGUNTA 1. No se carga ningún dato real en este ticket.

## Archivos permitidos
`packages/motor/test/golden/**`, `packages/motor/package.json` (solo el script), `packages/motor/scripts/**`, este ticket.

## Archivos prohibidos
Todo lo demás; en particular `packages/motor/src` (si un caso dorado revela un error del motor, se registra en PREGUNTAS y se corrige en un ticket aparte).

## Criterio de aceptación
Literal de la arquitectura §4: **"CI falla si un cambio en el motor altera un caso dorado sin actualizarlo explícitamente."** La parte "50 o más pedidos históricos con el costo real del proveedor" queda **pendiente** (PREGUNTA 1) y no bloquea el cierre de este ticket.

Agregados:
1. Prueba de la falla: en una copia local, cambiar el redondeo del IVA del motor hace fallar al menos un caso; se revierte. Con la salida pegada.
2. `golden:update` sin `--motivo` falla.
3. Ningún dato real en el repo: proveedores, CUIT, CPs y precios inventados.
4. Secuencia de `AGENTS.md` §5.5 en verde, con la salida pegada.

## Plan
<lo completa el agente antes de codear; Franco da el OK>

## PREGUNTAS
1. **Casos reales y regla 8 (para Franco).** El criterio pide 50 pedidos históricos con su costo real, pero esos casos contienen tarifas reales (dato comercial) y pedidos del TMS (Ley 25.326), que no pueden estar en el repo, y CI corre en GitHub. Opciones:
   - **(a)** Casos reales **fuera del repo**, con un script que Franco corre en su máquina (mismo patrón que `checkTmsFile`, solo imprime conteos y diferencias por id); CI corre solo los sintéticos.
   - **(b)** Casos reales **anonimizados** en el repo (sin nombres, CUIT ni destinatarios, y con los precios multiplicados por un factor secreto). Mantiene la regresión en CI, pero los precios siguen siendo derivables.

   Recomendación de Claude: **(a)**. Requiere además la planilla de liquidación manual (§7 punto 3), que hoy no existe.

---

## Nota de entrega
Usar la plantilla de `tickets/_TEMPLATE.md`.
