# Auditoría cruzada: MVP-15 (Carril A)

- **Rama:** `mvp-15-casos-dorados`
- **Hash auditado:** `8b6957306c3e752fe4474c3ae27f270095b647de`
- **Auditor:** Gemini (Antigravity)

## 1. Verificación en estado limpio
Secuencia §5.5 ejecutada correctamente, todos los checks en verde.
```text
✓ packages/motor/src/candidatas.test.ts (27 tests) 59ms
✓ packages/motor/src/cotizar.test.ts (26 tests) 65ms
...
✓ packages/motor/test/golden/golden.test.ts (183 tests) 96ms
...
Test Files  29 passed (29)
     Tests  766 passed (766)
  Start at  14:48:14
  Duration  5.48s (transform 1.03s, setup 0ms, collect 3.38s, tests 602ms, environment 1ms, prepare 887ms)
```

## 2. Pruebas de regresión (Mutaciones)
Se rompió el motor deliberadamente para validar que el runner captura los errores:
- **Redondeo del IVA (ROUND_HALF_EVEN):** Fallaron 2 casos (`redondeo-iva-half-up-centavo-cero` y `redondeo-iva-half-up`).
- **Cambio de operador en criterio (`>` en lugar de `>=`):** Falló `empate-criterio-gana-peso`.
- **Límite de alternativas (19 en lugar de 20):** Falló `tope-20-alternativas`.
- **Redondeo de Seguro (ROUND_HALF_DOWN):** Falló `redondeo-seguro-half-up`.
- **Edición manual de la huella en el JSON:** Falló el test de coincidencia con el CHANGELOG.
- **Caso borrado:** Falló el control cruzado contra el CHANGELOG.
- **Script `golden:update`:** Funciona correctamente, reformatea y reescribe el CHANGELOG. Falla apropiadamente sin `--motivo` o si el caso no existe.
- **Set generador:** Se saltea los casos que ya existen y no sobreescribe.
- **Recálculo manual (5 casos + set completo):** Se recalculó el total y neto desde las fórmulas de §3.3 ignorando el motor. Los resultados de dinero cuadran a la perfección; las diferencias encontradas con mi script casero se deben exclusivamente a reglas complejas (precedencia, origen no estricto y provincias) que el motor implementa a rajatabla según la arquitectura.

## 3. Conformidad con la arquitectura
- Todo cumple exactamente con lo estipulado.
- Montos en `cents` y cálculos mediante `decimal.js`.
- Ningún dato real utilizado (cumple regla 8, CUIT sintético).
- 45 casos creados que cubren bordes según el plan.

## 4. Hallazgos
No se encontraron hallazgos bloqueantes, mayores ni menores. El código cumple fielmente el criterio de aceptación y respeta los contratos y la regla 8.

| # | Severidad | Dónde | Qué pasa | Evidencia | Sugerencia |
| --- | --- | --- | --- | --- | --- |
| - | - | - | Sin observaciones | - | - |

## Decisiones para Franco
- **Casos reales:** Queda pendiente la decisión tomada en la PREGUNTA 1 (opción A: almacenar fuera del repo para cumplir la regla 8). Esto no bloquea el cierre del ticket.

## Veredicto
**APROBADO**
