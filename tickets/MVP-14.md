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

**Definiciones finales de Franco sobre 5 a 7 (06/10, después de la primera entrega):**
- **5:** OK. Se descarta con `SIN_TARIFA`. `OBSERVATION_CODES` no tiene un código para hueco o solapamiento y `shared` está congelado, así que el motivo en `descartes` alcanza. Sin cambios.
- **6:** OK tal como está. La observación solo interesa si el proveedor pide seguro. Sin cambios.
- **7 (R7):** ante el empate gana `PESO`, pero si uno de los dos tipos no tiene reglas (`tramo` nulo), el criterio sigue al que sí las tiene. Si ambos cuestan 0, `PESO` no tiene reglas y `VOLUMEN` sí, gana `VOLUMEN` y conserva su colecta. Se implementó en `4f96b41`; ver "Actualización por R7" en la Nota de entrega.

---

## Nota de entrega
Usar la plantilla de `tickets/_TEMPLATE.md`.

- **Qué se hizo:** son los pasos 3 a 7 de §3.3 en `packages/motor`.
  - `tramos.ts`: tramo `(min, max]`, excedente y descartes.
  - `calculo.ts`: fórmulas en `Decimal`, half-up a centavo, criterio y colecta (D7).
  - `ranking.ts`: orden D11 y `CP_AMBIGUO` evaluado por proveedor.
  - `cotizar.ts` y `formato.ts`: `cotizar(pedido, contexto)`, `MOTOR_VERSION = '1.0.0'` y `detalle_tarifa` en formato es-AR.
  - Los montos se calculan en `Decimal` y pasan a `cents` con `decimalToCents` recién al armar la salida.
  - `vitest.config.ts` activa solo el umbral de 90 % de `motor` y agrega `packages/*/test/**/*.test.ts` al `include`.
  - Los `tsconfig` de `motor` revisan `test/` en el typecheck y construyen solo `src`.
- **Commit:** `83c6e4b` en `mvp-14-motor-calculo`, que contiene el código y el Plan y las PREGUNTAS del ticket. Esta nota va en el commit siguiente. Sin push ni PR.
- **Archivos tocados:** `git diff --stat origin/main...HEAD`, sobre `83c6e4b`:
  ```
   packages/motor/src/calculo.test.ts    | 194 ++++++++++++++++
   packages/motor/src/calculo.ts         | 112 ++++++++++
   packages/motor/src/cotizar.test.ts    | 408 ++++++++++++++++++++++++++++++++++
   packages/motor/src/cotizar.ts         | 120 ++++++++++
   packages/motor/src/formato.ts         |  45 ++++
   packages/motor/src/index.test.ts      |  17 ++
   packages/motor/src/index.ts           |   5 +
   packages/motor/src/ranking.ts         |  33 +++
   packages/motor/src/tramos.test.ts     | 101 +++++++++
   packages/motor/src/tramos.ts          |  66 ++++++
   packages/motor/src/types.ts           |  20 ++
   packages/motor/test/fixtures/motor.ts | 198 +++++++++++++++++
   packages/motor/test/guardas.test.ts   | 103 +++++++++
   packages/motor/tsconfig.build.json    |   4 +
   packages/motor/tsconfig.json          |   3 +-
   tickets/MVP-14.md                     |  30 ++-
   vitest.config.ts                      |  14 +-
   17 files changed, 1466 insertions(+), 7 deletions(-)
  ```
- **Cómo probarlo:**
  ```bash
  pnpm install --frozen-lockfile && pnpm format && pnpm ci:run
  pnpm test:coverage
  pnpm exec vitest run packages/motor
  ```
- **Resultado de la verificación:** la secuencia de `AGENTS.md` §5.5 en un worktree limpio de `83c6e4b`, sin `dist/` y con `node_modules` recién instalados. Salió con exit 0, y `pnpm format` no cambió ningún archivo (`git status` vacío). En la salida, la ruta del worktree aparece abreviada.
  ```
  > pnpm install --frozen-lockfile
  Scope: all 5 workspace projects
  Lockfile is up to date, resolution step is skipped
  Packages: +860
  Done in 27.5s

  > pnpm --filter @sistema-redespachos/shared build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
  > @sistema-redespachos/shared@0.0.1 build …\packages\shared
  > tsc
  > sistema-redespachos@0.0.1 lint …
  > eslint apps/web/src apps/functions packages --max-warnings 0
  > sistema-redespachos@0.0.1 format:check …
  > prettier --check .
  Checking formatting...
  All matched files use Prettier code style!
  > sistema-redespachos@0.0.1 typecheck …
  > pnpm -r typecheck
  Scope: 4 of 5 workspace projects
  apps/web typecheck: Done
  packages/shared typecheck: Done
  packages/motor typecheck: Done
  apps/functions typecheck: Done
  > vitest run
   ✓ packages/motor/src/candidatas.test.ts (27 tests) 46ms
   ✓ packages/motor/src/cotizar.test.ts (25 tests) 29ms
   ✓ packages/motor/src/calculo.test.ts (15 tests) 11ms
   ✓ packages/motor/src/destino.test.ts (7 tests) 3ms
   ✓ packages/motor/src/tramos.test.ts (7 tests) 3ms
   ✓ packages/motor/test/guardas.test.ts (8 tests) 72ms
   ✓ packages/motor/src/index.test.ts (2 tests) 2ms
   (… 21 archivos de shared y web, todos ✓)
   Test Files  28 passed (28)
        Tests  580 passed (580)
  > pnpm -r build
  packages/shared build: Done
  apps/web build: ✓ built in 1.28s
  apps/web build: Done
  packages/motor build: Done
  apps/functions build: Done
  ```
  `pnpm test:coverage` (exit 0):
  ```
        Tests  580 passed (580)
   ...ages/motor/src |   99.77 |    96.23 |     100 |   99.77 |
    calculo.ts       |     100 |    96.66 |     100 |     100 | 59
    candidatas.ts    |     100 |    98.27 |     100 |     100 | 23
    cotizar.ts       |   98.83 |    95.65 |     100 |   98.83 | 65
    destino.ts       |     100 |      100 |     100 |     100 |
    formato.ts       |     100 |      100 |     100 |     100 |
    ranking.ts       |     100 |      100 |     100 |     100 |
    tramos.ts        |     100 |     86.2 |     100 |     100 | 23-24
    types.ts         |       0 |        0 |       0 |       0 |
  ```
  Para probar que el umbral corta, agregué en local un archivo temporal `src/zz-temporal-sin-tests.ts` con 60 funciones sin tests y lo borré después, sin commitearlo. Con ese archivo, `pnpm test:coverage` sale con exit 1:
  ```
   ...ages/motor/src |    87.5 |    95.72 |   95.83 |    87.5 |
  ERROR: Coverage for lines (87.5%) does not meet "packages/motor/src/**" threshold (90%)
  ERROR: Coverage for statements (87.5%) does not meet "packages/motor/src/**" threshold (90%)
  ```
  Mutaciones manuales, aplicadas una por una y revertidas: todas hacen fallar algún test.
  - Half-even en lugar de half-up.
  - `>` en lugar de `≥` en el criterio.
  - Colecta tomada siempre de la regla de peso.
  - `costo_base_viaje` ignorado.
  - Borde `[min, max)` en lugar de `(min, max]`.
  - Sin desempate por `id_proveedor`, y sin desempate por `variante_id`.
  - `CP_AMBIGUO` evaluado de forma global.
  - Sin `COBERTURA_QX`.
  - Sin el tope de 20 alternativas.
  - `VALOR_DECLARADO_FALTANTE` sin la condición de seguro.
  - Sin redondeo en colecta, seguro, IVA o costo de componente.

  Sobrevivió una sola: `valor > tope` → `valor ≥ tope` en `tramos.ts`. Es equivalente, porque un valor igual al tope ya cae en el último tramo antes de llegar a esa línea.
- **Consumo real:** un script ESM importa `packages/motor/dist/index.js` y el `dist` de `shared`, arma los dos casos de referencia validados con los esquemas de `shared`, ejecuta `cotizar` y valida la salida con `quoteSchema`:
  ```
  MOTOR_VERSION 1.0.0
  Caso 1 VALORIZADO {"id_proveedor":"PROV1","tarifario_id":"TAR1","variante_id":"2000|ROSARIO|Z1","variante":{"localidad":"ROSARIO","zona":"Z1","plazo_estimado_dias":null},"regla_peso_id":"P2","regla_volumen_id":"V2","criterio":"VOLUMEN","detalle_tarifa":"VOLUMEN 0,05–0,5 m3: tramo $2.600,00","costo_peso":160000,"costo_volumen":260000,"flete":260000,"colecta":32083,"seguro":50000,"neto":342083,"iva_porcentaje":"21","iva":71837,"total":413920,"fecha_referencia":"2026-10-06","motor_version":"1.0.0"}
  Caso 1 total $ 4139.20 | quoteSchema: true
  Caso 2 VALORIZADO PESO flete $ 530000.00 | PESO 900–1.000 kg: tramo $500.000,00 + excedente 50 kg × $600,00 | quoteSchema: true
  ```
- **Evidencia del criterio de aceptación:**

  | Criterio | Evidencia |
  | --- | --- |
  | §4: cobertura de 90 % o más | `pnpm test:coverage`: `motor/src` da 99,77 % de líneas, 96,23 % de ramas y 100 % de funciones; debajo de 90 % sale con exit 1 (ver arriba) |
  | §4 y agregado 1: caso 1 = $4.139,20, componente por componente | `cotizar.test.ts` › "caso 1: cada componente en centavos…", más el consumo real |
  | §4: caso 2, flete $530.000,00 | `cotizar.test.ts` › "caso 2: excedente…", más el consumo real |
  | §4 y agregado 8: sin `number` para dinero, sin km ni paradas | `test/guardas.test.ts` busca los 4 tokens del ticket en todo `src`, conversiones a `number` y aritmética binaria sobre montos, y verifica su propio detector con ejemplos buenos y malos. `grep -rniE "km\|parada\|Number\(\|parseFloat" packages/motor/src` no devuelve coincidencias (exit 1) |
  | 2. Bordes de tramo | `tramos.test.ts`: 10 / 10.0001 kg, borde de volumen, tope y tope + 0.0001 |
  | 3. Half-up en los bordes | `calculo.test.ts`: `costo_peso`, `costo_volumen`, `seguro`, `iva` y colecta (…5 sube, …49 baja). El helper exige que el monto llegue con 2 decimales o menos |
  | 4. Empates | `cotizar.test.ts` › "empate de total entre dos proveedores…" y "…entre dos variantes del mismo proveedor…" |
  | 5. Descartes | `tramos.test.ts` (peso y volumen por separado), `calculo.test.ts` (`SIN_TARIFA`) y `cotizar.test.ts` (orden y motivos) |
  | 6. Los tres resultados del paso 7 | `cotizar.test.ts` › "resultado sugerido": `VALORIZADO` (también con `DESCONOCIDA`), `SIN_COBERTURA`, y `COBERTURA_QX` con y sin candidatas |
  | 7. `quoteSchema` y `quoteAlternativeSchema` | `expectSchemas` en `cotizar.test.ts`, en los casos 1, ranking, 20 alternativas y `COBERTURA_QX` |
  | 9. Umbral | `vitest.config.ts`; ver arriba |
  | 10. §5.5 y consumo real | ver arriba |
  | Deuda H-4(a) | `cotizar.test.ts` › "determinismo": 2 proveedores × 2 variantes; dos corridas, más una con proveedores y reglas en orden inverso, dan resultados iguales con `toEqual` |

- **Decisiones tomadas** (PREGUNTAS 5 a 9; Franco pidió detallar las que tocan reglas de negocio):
  - **PREGUNTA 5, regla de negocio sobre datos inválidos:** si no hay un único tramo que contenga el valor y el valor no supera el tope (hueco, solapamiento o dos "últimos" tramos con el mismo tope), la candidata se descarta con `SIN_TARIFA`. No se lanza error, para que el lote no se detenga (§3.3 paso 7), y no se elige un precio arbitrario. D3 y MVP-11 impiden esos datos. Si preferís un error o un código propio, se cambia en `tramos.ts`, aunque un código nuevo requiere un `CR: shared`.
  - **PREGUNTA 6, regla de negocio:** `VALOR_DECLARADO_FALTANTE` se agrega cuando falta `valor_declarado` y algún proveedor candidato (válido o descartado) tiene `aplica_seguro`. Esto sigue el texto del ticket, que es la fuente 1, y no la lectura amplia de D8. Un valor declarado igual a 0 cuenta como informado. Si se quiere la lectura de D8 (siempre que falte), es un cambio de una línea en `cotizar.ts`.
  - **PREGUNTA 7, literal de la arquitectura (reemplazada por R7 en `4f96b41`; ver "Actualización por R7"):** con `costo_peso = costo_volumen` gana `PESO`, aunque el pedido no tenga reglas de peso. Así, con un único tipo de reglas a precio 0, se pierde la colecta de la otra regla. Está documentado en `calculo.test.ts`.
  - **PREGUNTAS 8 y 9, formato y nombres:**
    - `detalle_tarifa` sigue el formato propuesto en la PREGUNTA 8.
    - `MOTOR_VERSION` es `'1.0.0'` y `MAX_ALTERNATIVAS` es 20.
    - La salida es `QuoteResult`, con `estado_sugerido` y `cotizacion: null` si no hay candidata válida. Los tipos y las funciones están en inglés, siguiendo la regla 2 y el estilo de MVP-13 (`Candidate`, `CandidateSelection`); `cotizar` y `seleccionarCandidatas` conservan sus nombres.
  - **Orden de los descartes:** si una candidata excede peso y volumen sin precio, el motivo es el de peso, que se evalúa primero.
  - **Fixture de determinismo:** dentro de una misma variante, todas las reglas tienen el mismo plazo. Si no, MVP-13 toma el plazo de la primera regla, y el resultado depende del orden de entrada (D-5, que rechaza MVP-11).
- **Supuestos:**
  - `seleccionarCandidatas` solo devuelve proveedores del `contexto` (los filtra por `ACTIVO`). Por eso `cotizar` no revisa si falta el proveedor.
  - `porcentaje_seguro` y `costo_colecta` vienen cuando su bandera es `true`, como exigen los esquemas de `shared`. Si faltan, `decToDecimal` falla, y hay un test que lo prueba.
- **Fuera de alcance:**
  - Aplicar la transición de estado, completar `origen` y `calculado_en`, persistir y crear `solicitudes_cp` → MVP-18.
  - Casos dorados → MVP-15, que ya puede ponerlos en `packages/motor/test/golden/`, ahora incluido en Vitest y en el typecheck.
  - H-9 (origen con varios registros) → CR-07.
  - D-4 y D-5 (consistencia de variante y plazo) → MVP-11.
- **Riesgos y deuda:**
  - **Incidente de proceso, a revisar primero.** Durante el trabajo, alguien cambió este mismo directorio de trabajo de rama varias veces (reflog: 18:37, 18:40, 18:43 y 19:00:37). Eso revirtió el Plan del ticket y, a las 19:00:37, dejó `HEAD` en `cr-03-deps-carril-b`, con lo que mi primer commit (`3635237`) quedó sobre esa rama. Lo rearmé en `mvp-14-motor-calculo` con cherry-pick en un worktree aparte (`83c6e4b`) y repetí ahí toda la verificación. **`cr-03-deps-carril-b` todavía tiene el commit `3635237` (local, sin push)**. No lo saqué, porque esa rama no es de este ticket: lo decide Franco. *Resuelto:* según Franco, Antigravity lo limpió, y `cr-03-deps-carril-b` volvió a `cf36172` (verificado con `git branch -v`).
  - La guarda de aritmética es heurística (expresiones regulares sobre nombres de montos). Un monto con un nombre fuera de la lista no se detectaría. El auditor puede revisar la lista `MONTO` de `guardas.test.ts`.
  - `CP_AMBIGUO` compara el total redondeado a centavos y el plazo (`null` cuenta como un valor).

### Actualización por R7 (06/10)

- **Qué cambió:** en `calculo.ts`, el criterio es `PESO` si `costo_peso ≥ costo_volumen`, salvo en el empate en que `PESO` no tiene reglas y `VOLUMEN` sí; ahí gana `VOLUMEN`, que conserva su colecta. Si `VOLUMEN` es el que no tiene reglas, el `≥` ya da `PESO`. Los dos tipos sin reglas es `SIN_TARIFA` antes de llegar a ese punto.
- **Expresión propuesta por Franco:** su texto literal (`costo_peso.gt(costo_volumen) ? 'PESO' : (… ? 'VOLUMEN' : 'PESO')`) devuelve `PESO` también cuando `costo_peso < costo_volumen`, porque cae en la rama `'PESO'` final. Se implementó la regla que describe el texto de R7. Lo probé como mutación: la expresión literal hace fallar el caso de referencia 1 (criterio `VOLUMEN`) y otros 4 tests. La regla anterior (`≥` literal) hace fallar los 2 tests nuevos de R7.
- **Tests:** el test de la decisión 7 inicial se reemplazó por dos de R7 en `calculo.test.ts`: empate sin reglas de peso → `VOLUMEN` con colecta, y empate sin reglas de volumen → `PESO` con colecta. En `cotizar.test.ts` se agregó el empate a 0 → `VOLUMEN 0–1 m3: tramo $0,00`. Con R7, `evaluateCandidate` ya no produce un criterio sin tramo, así que la rama `PESO: sin tramo` de `tariffDetail` se prueba de forma directa.
- **Commits** en `mvp-14-motor-calculo`, sin push ni PR: `83c6e4b` (código), `7ab06c0` (nota), `4f96b41` (R7) y el de esta actualización de la nota. Son commits nuevos en lugar de modificar `83c6e4b`, para que los hashes que cita la nota sigan siendo válidos.
- **Archivos tocados por `4f96b41`:**
  ```
   packages/motor/src/calculo.test.ts | 19 +++++++++++++++----
   packages/motor/src/calculo.ts      |  7 ++++++-
   packages/motor/src/cotizar.test.ts | 28 ++++++++++++++++++++++++++--
   3 files changed, 47 insertions(+), 7 deletions(-)
  ```
  `git diff --stat origin/main...HEAD` sobre `4f96b41`: los mismos 17 archivos de antes, `17 files changed, 1665 insertions(+), 7 deletions(-)`.
- **Verificación sobre `4f96b41`**, desde un estado limpio (sin `dist/` ni `coverage/`). `pnpm install --frozen-lockfile && pnpm format && pnpm ci:run` salió con exit 0, y `pnpm format` no cambió ningún archivo:
  ```
  Lockfile is up to date, resolution step is skipped
  Done in 8.7s
  Checking formatting...
  All matched files use Prettier code style!
  apps/web typecheck: Done
  packages/shared typecheck: Done
  packages/motor typecheck: Done
  apps/functions typecheck: Done
   ✓ packages/motor/src/candidatas.test.ts (27 tests) 48ms
   ✓ packages/motor/src/cotizar.test.ts (26 tests) 39ms
   ✓ packages/motor/src/calculo.test.ts (17 tests) 17ms
   ✓ packages/motor/src/destino.test.ts (7 tests) 6ms
   ✓ packages/motor/src/tramos.test.ts (7 tests) 5ms
   ✓ packages/motor/test/guardas.test.ts (8 tests) 26ms
   ✓ packages/motor/src/index.test.ts (2 tests) 2ms
   Test Files  28 passed (28)
        Tests  583 passed (583)
  packages/shared build: Done
  apps/web build: ✓ built in 1.57s
  apps/web build: Done
  packages/motor build: Done
  apps/functions build: Done
  ```
  Cobertura (`pnpm test:coverage`, exit 0):
  ```
        Tests  583 passed (583)
   ...ages/motor/src |   99.77 |    96.27 |     100 |   99.77 |
    calculo.ts       |     100 |    96.87 |     100 |     100 | 59
    candidatas.ts    |     100 |    98.27 |     100 |     100 | 23
    cotizar.ts       |   98.83 |    95.65 |     100 |   98.83 | 65
    destino.ts       |     100 |      100 |     100 |     100 |
    formato.ts       |     100 |      100 |     100 |     100 |
    ranking.ts       |     100 |      100 |     100 |     100 |
    tramos.ts        |     100 |     86.2 |     100 |     100 | 23-24
    types.ts         |       0 |        0 |       0 |       0 |
  ```
  Umbral, con el mismo archivo temporal sin tests (borrado después, sin commitear). `test:coverage` salió con exit 1:
  ```
   ...ages/motor/src |   87.57 |    95.76 |   95.83 |   87.57 |
  ERROR: Coverage for lines (87.57%) does not meet "packages/motor/src/**" threshold (90%)
  ERROR: Coverage for statements (87.57%) does not meet "packages/motor/src/**" threshold (90%)
  ```
  Consumo real desde `dist`, con el mismo script, y la misma salida que antes en los dos casos de referencia:
  ```
  MOTOR_VERSION 1.0.0
  Caso 1 total $ 4139.20 | quoteSchema: true
  Caso 2 VALORIZADO PESO flete $ 530000.00 | PESO 900–1.000 kg: tramo $500.000,00 + excedente 50 kg × $600,00 | quoteSchema: true
  ```
  `grep -rniE "km|parada|Number\(|parseFloat" packages/motor/src` no encontró coincidencias (exit 1).
- **Pendiente para Franco, fuera de alcance:** R7 precisa §3.3 paso 5 de `docs/arquitectura-v3.md`, que dice solo "`PESO` si `costo_peso` ≥ `costo_volumen`". `docs/` es compartido y está congelado, así que hace falta un `CR` de documentación que sume la excepción del empate. Sin ticket por ahora.
