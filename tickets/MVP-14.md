# MVP-14 — Motor (2/2): tramos, Mayor Valor, adicionales, ranking y resultado

- **Carril:** A · Cotización
- **Agente:** Gemini (Antigravity) · **Modelo:** Gemini Pro · **Esfuerzo:** alto (modo con planificación)
- **Auditor:** Claude Code · **Modelo:** Opus 5.5 · **Esfuerzo:** xhigh · **auditoría adicional del motor**: el auditor recalcula los casos sin leer el código. Franco revisa antes del merge (todo cambio en `packages/motor`).
- **Rama:** `mvp-14-motor-calculo`
- **Depende de:** MVP-13 auditado y mergeado.

## Contexto a leer
- `docs/arquitectura-v3.md`: §3.3 **completo** (pasos 3 a 7, fórmulas y los dos casos de referencia), §2.4 (grupo Cotización elegida y Alternativas, `detalle_tarifa`), D1 a D11, D25.
- `packages/shared`: `primitives.ts` (`decToDecimal`, `decimalToCents`, `centsToDecimal`, `centsSchema`), `schemas/orders.ts` (`quoteSchema`, `quoteAlternativeSchema`, `quoteDiscardSchema`), `errors.ts` (`DISCARD_REASONS`, `OBSERVATION_CODES`), `schemas/suppliers.ts`.
- Código previo: `packages/motor/**` (MVP-13).

## Alcance
1. **Paso 3, tramos:** dentro del grupo elegido por MVP-13, tramo de peso con `peso_kgs` en `(kg_min, kg_max]` y de volumen con `volumen_m3` en `(m3_min, m3_max]`, de forma independiente. Valor sobre el último tramo: se usa el último y el sobrante se cobra a `precio_kg_excedente` / `precio_m3_excedente`; sin ese precio la candidata se descarta (`PESO_EXCEDIDO_SIN_REGLA` / `VOLUMEN_EXCEDIDO_SIN_REGLA`). Sin reglas de un tipo aporta 0; sin reglas de ninguno, `SIN_TARIFA`.
2. **Paso 4, cálculo** con `decimal.js` y las fórmulas de §3.3: `costo_peso` y `costo_volumen` incluyen `costo_base_viaje`; `flete = max`; `seguro = valor_declarado × porcentaje_seguro / 100` si el proveedor aplica seguro (sin valor declarado, 0 y `VALOR_DECLARADO_FALTANTE`); `neto = flete + colecta + seguro`; `iva = neto × iva_porcentaje / 100`; `total = neto + iva`. Redondeo **half-up a centavo** en `costo_peso`, `costo_volumen`, `seguro` e `iva` (§3.3 paso 4). Resultados en `cents`.
3. **Paso 5:** criterio `PESO` si `costo_peso ≥ costo_volumen`, si no `VOLUMEN`; la colecta sale de la regla del tramo del criterio ganador si `aplica_colecta` (D7).
4. **Paso 6, ranking:** candidatas válidas por `total` ascendente; empate por menor `id_proveedor` y luego menor `variante_id` (D11). La primera es la cotización; `alternativas` con todas las válidas (máximo 20, `quoteAlternativeSchema`); `descartes` con su motivo. `CP_AMBIGUO` según PREGUNTA 2.
5. **Paso 7, resultado sugerido:** `cobertura_qx = SI` → `COBERTURA_QX` (con la mejor de expreso como sugerencia si hay); al menos una válida sin cobertura QX → `VALORIZADO`; ninguna → `SIN_COBERTURA` con los motivos. El motor **no** cambia estados ni escribe nada: devuelve el estado sugerido y MVP-18 aplica la transición.
6. **`cotizar(pedido, contexto)`**: función pública, pura, que une MVP-13 y este ticket y devuelve la cotización con la forma de `quoteSchema` **salvo `calculado_en` y `origen`**, que agrega MVP-18 (el motor no lee el reloj). Incluye `fecha_referencia`, `motor_version` (constante `MOTOR_VERSION` exportada) y `detalle_tarifa` legible (ej. `PESO 10–50 kg: tramo $1.600,00`).
7. **Umbral de cobertura (permitido en este ticket, `CR` aprobado):** en `vitest.config.ts`, activar **solo** el umbral de 90 % para `packages/motor/src/**`; el umbral global queda inactivo. Agregar `packages/*/test/**/*.test.ts` al `include` de Vitest para que MVP-15 pueda poner los casos dorados en `packages/motor/test/golden/` (hoy Vitest no los vería).

## Archivos permitidos
`packages/motor/**`, `vitest.config.ts` (solo los dos cambios del punto 7), este ticket.

## Archivos prohibidos
Todo lo demás, incluido `packages/shared`.

## Criterio de aceptación
Literal de la arquitectura §4: **"Cobertura de tests de 90% o más; el caso de referencia 1 de §3.3 da exactamente $4.139,20 y el 2 da un flete de $530.000,00; ningún cálculo usa `number` para dinero; no existe ninguna variable de km ni de paradas."**

Agregados:
1. El caso 1 verifica **cada componente** de la tabla de §3.3 en centavos: `costo_peso` 160000, `costo_volumen` 260000, criterio `VOLUMEN`, `colecta` 32083, `seguro` 50000, `neto` 342083, `iva` 71837, `total` 413920.
2. Bordes de tramo: 10 kg cae en `(0, 10]` y no en `(10, 50]`; 10.0001 kg cae en `(10, 50]`; valor igual al tope del último tramo no cobra excedente; tope + 0.0001 sí.
3. Redondeo half-up en los bordes de cada componente redondeado (…,xx5 sube; …,xx49 baja).
4. Empate de total entre dos proveedores y entre dos variantes del mismo proveedor: orden por `id_proveedor` y luego `variante_id`.
5. Descartes: excedente sin precio (peso y volumen por separado) y `SIN_TARIFA`.
6. Los tres resultados de paso 7, incluido `COBERTURA_QX` con y sin candidatas de expreso.
7. Cada cotización devuelta, completada con `origen: 'MOTOR'` y un `calculado_en`, valida con `quoteSchema`; cada alternativa con `quoteAlternativeSchema`.
8. Búsqueda en `packages/motor/src` sin coincidencias para `km`, `parada`, `Number(`, `parseFloat` ni operaciones aritméticas sobre montos fuera de `Decimal` (un test lo verifica).
9. `pnpm test:coverage` muestra 90 % o más en `motor` y falla si baja.
10. Secuencia de `AGENTS.md` §5.5 en verde y consumo real de `cotizar` desde `dist` con Node, con la salida pegada.

## Plan

Ejecuta Claude Code (Opus 5.5) en lugar de Gemini, por decisión de Franco. Rama `mvp-14-motor-calculo`, creada desde `origin/main` (`8a9a8a2`). **Plan aprobado por Franco el 06/10.**

1. **Tipos (`types.ts`):** la entrada es `MotorQuoteInput`, que suma a `MotorOrderInput` los campos `peso_kgs`, `volumen_m3` y `valor_declarado`. La salida es `QuoteResult`, con `estado_sugerido`, `canalizador`, origen, `observaciones`, `cotizacion` (`MotorQuote` = `Quote` sin `origen`, `calculado_en` ni `justificacion`, o `null`), `alternativas` y `descartes`. Todos son tipos derivados de `shared`, sin esquemas Zod propios.
2. **Paso 3 (`tramos.ts`):** elige el tramo `(min, max]` con `Decimal` y, sobre el tope, toma el último tramo y calcula el excedente. Devuelve el tramo elegido o el motivo de descarte.
3. **Pasos 4 y 5 (`calculo.ts`):** las fórmulas de §3.3 en `Decimal`. Redondea half-up a centavo `costo_peso`, `costo_volumen`, `seguro`, `iva` y la colecta, cada uno una sola vez. Después aplica el criterio y la colecta de la regla ganadora (D7).
4. **Paso 6 (`ranking.ts`):** ordena con `Decimal.comparedTo`, desempata por `id_proveedor` y después por `variante_id`, y marca `CP_AMBIGUO` evaluando por proveedor.
5. **Paso 7 y API (`cotizar.ts`, `formato.ts`):** `cotizar(pedido, contexto)`, `MOTOR_VERSION` y `detalle_tarifa` en formato es-AR. Los montos pasan a `cents` con `decimalToCents` recién al armar la salida.
6. **Tests:** un archivo por módulo, más `index.test.ts`, fixtures sintéticos en `packages/motor/test/fixtures/motor.ts`, la guarda del agregado 8 en `packages/motor/test/guardas.test.ts` y la deuda H-4(a).
7. **Configuración:** `vitest.config.ts`, solo con los dos cambios del punto 7, y `packages/motor/tsconfig*.json` (PREGUNTA 11).
8. **Verificación:** la secuencia §5.5 desde un estado limpio, `pnpm test:coverage` (con prueba de que falla debajo del 90 %) y `cotizar` ejecutado con Node desde `dist`.

## PREGUNTAS
Franco responde antes de dar el OK al plan. Las recomendaciones son de Claude.
1. **Colecta con más de 2 decimales.** `costo_colecta` es `dec` (hasta 4 decimales) y §3.3 no lo lista entre los componentes que se redondean. Recomendación: redondearla también half-up a centavo al convertirla a `cents`.
2. **Cuándo se marca `CP_AMBIGUO`.** §3.2 dice "más de una variante con precios o plazos distintos"; §3.3 paso 6 dice "si el CP tiene varias variantes". Recomendación: cuando entre las candidatas **válidas** hay dos o más `variante_id` distintas con `total` o `plazo_estimado_dias` distintos.
3. **Excedente con decimales.** `(kg − tope) × precio_kg_excedente` puede dar más de 2 decimales antes de sumarse al tramo. Recomendación: calcular `costo_peso` completo en `Decimal` y redondear una sola vez al final (como dice §3.3), no el término por separado.

Preguntas que agregó Claude Code al planificar (06/10):

4. **`CP_AMBIGUO` con varios proveedores (precisa la 2).** `variante_id` sale de la localidad y la zona *del proveedor* (D24). Con la regla de la PREGUNTA 2, dos proveedores que rotulan distinto el mismo destino marcarían `CP_AMBIGUO` en casi todos los pedidos. Recomendación: evaluarlo por proveedor.
5. **No hay un único tramo para el valor y el valor no supera el tope.** Pasa con un hueco, con tramos solapados o con dos "últimos" tramos de igual tope. D3 y MVP-11 lo impiden, pero el motor puede recibirlo. Propuesta: descartar la candidata con `SIN_TARIFA`, sin lanzar error, para no detener el lote, y sin elegir un precio arbitrario.
6. **Cuándo se agrega `VALOR_DECLARADO_FALTANTE`.** D8 lo agrega siempre; el ticket, "si el proveedor aplica seguro". Propuesta, siguiendo al ticket, que es la fuente 1: agregarlo cuando falta `valor_declarado` y algún proveedor candidato tiene `aplica_seguro`. Un `valor_declarado` igual a 0 cuenta como informado.
7. **Criterio con un tipo sin reglas.** Si solo hay reglas `VOLUMEN` y `costo_volumen = 0`, el `≥` literal da `PESO` sin regla de peso (colecta 0 y `regla_peso_id` nulo). Propuesta: aplicar el literal y documentarlo en un test.
8. **Formato de `detalle_tarifa`.** `{CRITERIO} {min}–{max} {kg|m3}: tramo ${precio}`. Si corresponde, se suma `+ excedente {cantidad} {kg|m3} × ${precio}` y `+ base ${costo_base_viaje}`, con números en formato es-AR. Si el criterio no tiene tramo (PREGUNTA 7): `PESO: sin tramo`.
9. **`MOTOR_VERSION` y forma de la salida.** `MOTOR_VERSION = '1.0.0'`; `estado_sugerido` es un nombre interno de la salida que no se persiste, y `cotizacion` vale `null` si no hay candidata válida.
10. **Deuda H-4(a) de MVP-13.** Recomendación: incluirla como un test de `cotizar` con al menos dos proveedores y dos variantes.
11. **Typecheck de `packages/motor/test/`.** Recomendación: que `tsconfig.json` incluya `src` y `test`, y que `tsconfig.build.json` restrinja el build a `src`.

**Respuestas de Franco (06/10):**
- **1 y 3:** OK con la recomendación.
- **2 y 4:** `CP_AMBIGUO` se evalúa por proveedor. Se marca solo cuando entre las candidatas válidas de un mismo proveedor hay dos o más `variante_id` distintas con `total` o `plazo_estimado_dias` distintos.
- **10:** OK, se incluye la deuda H-4(a).
- **11:** OK, se pueden modificar `packages/motor/tsconfig*.json`.
- **5 a 9:** Franco no las había visto (el ticket no estaba commiteado). Indicó que, si son decisiones técnicas o de formato, el agente avance con su criterio, y que detalle en la entrega las que toquen reglas de negocio o se aparten de la arquitectura. Se implementaron como están propuestas; ver "Decisiones tomadas" en la Nota de entrega.

---

## Nota de entrega
Usar la plantilla de `tickets/_TEMPLATE.md`.
