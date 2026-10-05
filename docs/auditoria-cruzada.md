# Auditoría cruzada

Cuando un agente termina un ticket, lo audita el agente del otro carril, en una conversación nueva. El auditor **no modifica código del autor**: solo informa. El informe va en `tickets/MVP-XX-AUDITORIA.md` y es el único archivo que el auditor crea.

## Prompt para el auditor
```
Sos el auditor del ticket <MVP-XX> (carril <A|B>), escrito por otro agente. No edites su código.
1. Leé AGENTS.md y tickets/MVP-XX.md (sin la nota de entrega ni PREGUNTAS todavía).
2. Leé las secciones de docs/arquitectura-v3.md que el ticket lista y la sección 3 de docs/ola-0/estado-y-decisiones.md.
3. Revisá el diff del commit del autor contra main: git diff origin/main...<rama o hash> (el autor no pushea; Franco te pasa la rama o el hash).
4. Corré la verificación completa desde un clon o worktree limpio (secuencia de AGENTS.md §5.5, empezando por Build shared).
5. Recién ahora leé la nota de entrega y PREGUNTAS, y contrastalas con lo que encontraste.
6. Entregá los hallazgos con el formato de docs/auditoria-cruzada.md, en tickets/MVP-XX-AUDITORIA.md.
```

## Checklist
1. **Verificación:** lint, typecheck, tests y build en verde, corridos por vos desde un estado limpio (sin `dist/` previos). Pegá la salida.
2. **Criterio de aceptación:** cada punto, literalmente, con su evidencia. Un punto sin test que lo pruebe cuenta como no cumplido. Si el ticket copió el criterio de la arquitectura §4, verificá también contra la arquitectura: un criterio que el ticket recortó sin dejar ticket de destino es hallazgo.
3. **Conformidad con la arquitectura:** nombres de campos, estados, códigos de error y fórmulas idénticos a la v3, incluidas D30 a D37. **Antes de registrar un hallazgo de conformidad, citá la línea de la arquitectura que se incumple, con su número, y la columna de obligatoriedad si aplica.** Si la arquitectura permite lo que el autor hizo, no es un hallazgo contra él: es un `CR` sobre el documento, y va en una lista aparte dirigida a Franco. Un hallazgo de conformidad sin cita de línea no cuenta. D35 (ausencia deliberada de campos de control) no es hallazgo.
4. **Dinero:** ningún `number` para montos; redondeo half-up a centavo donde corresponde, con tests en los bordes.
5. **Alcance:** ningún archivo fuera del permitido (`git diff --stat`); ninguna dependencia nueva sin `CR: deps`.
6. **Contratos:** `packages/shared` y los archivos compartidos de `AGENTS.md` §3 no modificados fuera de un `CR`. Ningún esquema o tipo duplicado fuera de `shared`.
7. **Seguridad y datos:** toda escritura de negocio por callable con `withAudit`; ningún dato real ni secreto en el repo; ningún script imprime valores de filas reales; CUIT de prueba inventados.
8. **Casos borde:** valores en los límites de tramo (por ejemplo 5 kg en `(0;5]` y `(5;10]`), decimales, campos opcionales ausentes, estados fuera de la tabla de transiciones.
9. **Tests:** que prueben comportamiento y no solo que el código corra; que fallen si se rompe la regla. Rompé al menos 3 reglas en una copia local y confirmá que algún test falla; revertí después.
10. **Consumo real (lección de la Ola 0):** si el ticket produce algo que otro paquete importa o que corre en Node (Functions, scripts), probá el consumo con un archivo no commiteado desde el consumidor y ejecutá el JS emitido con Node. Typecheck verde no alcanza.
11. **CI:** si el ticket toca workflows o deploy, leé los pasos del run, no solo su color: un paso omitido (`skipped`) que debía correr es hallazgo.

## Formato de hallazgos
| # | Severidad | Dónde | Qué pasa | Evidencia | Sugerencia |
| --- | --- | --- | --- | --- | --- |
Severidad: **Bloqueante** (incumple el criterio o la arquitectura, o riesgo de dinero o de datos), **Mayor** (falla en un caso borde probable), **Menor** (estilo o claridad). Cada hallazgo justifica su severidad citando cuál de las tres definiciones aplica; no se usan severidades por intuición.
Cierre: veredicto `APROBADO`, `APROBADO CON OBSERVACIONES` o `RECHAZADO`, más una lista separada de **decisiones para Franco** (supuestos del autor que son de negocio y `CR` sobre la arquitectura).

## Regla de cierre
1. El autor corrige los Bloqueantes y los Mayores y responde cada hallazgo en su ticket (corregido, con commit; o rechazado, con motivo).
2. **Verificación de correcciones:** el mismo auditor, en una conversación nueva, revisa solo el diff de las correcciones y la respuesta del autor, vuelve a correr la verificación y agrega al final de su informe una sección `## Verificación de correcciones` con el estado de cada hallazgo (`RESUELTO`, `NO RESUELTO`, `ACEPTADO POR FRANCO`) y el **veredicto final**.
3. Un ticket con veredicto `RECHAZADO` no se considera cerrado, ni su código congelado, hasta ese veredicto final. Si Franco decide cerrar sin re-auditoría, lo deja escrito y firmado en esa misma sección.
4. Franco desempata y mergea. Todo cambio en `packages/motor` y en las reglas de seguridad lo revisa Franco antes de mergear.

## Auditoría adicional del motor (MVP-13, 14, 18)
El auditor implementa aparte una versión mínima del cálculo desde §3.3 (sin leer el código del autor) y compara resultados contra el motor sobre los 2 casos de referencia y sobre pedidos sintéticos en los bordes de tramo. Cualquier diferencia es Bloqueante hasta que se explique.
