# Auditoría cruzada

Cuando un agente termina un ticket, lo audita el agente del otro carril, en una conversación nueva. El auditor **no modifica código del autor**: solo informa.

## Prompt para el auditor
```
Sos el auditor del ticket <MVP-XX> (carril <A|B>), escrito por otro agente. No edites su código.
1. Leé AGENTS.md y tickets/MVP-XX.md (sin la nota de entrega todavía).
2. Leé las secciones de docs/arquitectura-v3.md que el ticket lista.
3. Revisá el diff de la rama mvp-XX-<slug> contra main y corré pnpm typecheck y pnpm test.
4. Recién ahora leé la nota de entrega y contrastala con lo que encontraste.
5. Entregá los hallazgos con el formato de docs/auditoria-cruzada.md.
```

## Checklist
1. **Verificación:** typecheck y tests en verde, corridos por vos.
2. **Criterio de aceptación:** cada punto, literalmente, con su evidencia. Un punto sin test que lo pruebe cuenta como no cumplido.
3. **Conformidad con la arquitectura:** nombres de campos, estados, códigos de error y fórmulas idénticos a la v3.
4. **Dinero:** ningún `number` para montos; redondeo half-up a centavo donde corresponde.
5. **Alcance:** ningún archivo fuera del permitido; ninguna dependencia nueva sin `CR: deps`.
6. **Contratos:** `packages/shared` no modificado fuera de un `CR`.
7. **Seguridad y datos:** toda escritura de negocio por callable con `withAudit`; ningún dato real ni secreto en el repo.
8. **Casos borde:** valores en los límites de tramo (por ejemplo 5 kg en `(0;5]` y `(5;10]`), decimales, campos opcionales ausentes, estados fuera de la tabla de transiciones.
9. **Tests:** que prueben comportamiento y no solo que el código corra; que fallen si se rompe la regla.

## Formato de hallazgos
| # | Severidad | Dónde | Qué pasa | Evidencia | Sugerencia |
| --- | --- | --- | --- | --- | --- |
Severidad: **Bloqueante** (incumple el criterio o la arquitectura, o riesgo de dinero o de datos), **Mayor** (falla en un caso borde probable), **Menor** (estilo o claridad).
Cierre: veredicto `APROBADO`, `APROBADO CON OBSERVACIONES` o `RECHAZADO`.

## Regla de cierre
El autor corrige los Bloqueantes y los Mayores y responde cada hallazgo. Franco desempata y mergea. Todo cambio en `packages/motor` y en las reglas de seguridad lo revisa Franco antes de mergear.

## Auditoría adicional del motor (MVP-13, 14, 18)
El auditor implementa aparte una versión mínima del cálculo desde §3.3 (sin leer el código del autor) y compara resultados contra el motor sobre los 2 casos de referencia y sobre pedidos sintéticos en los bordes de tramo. Cualquier diferencia es Bloqueante hasta que se explique.
