# MVP-04-AUD — Auditoría cruzada de `packages/shared` (cierre de Ola 0)

- **Carril:** Auditoría de Ola 0. La hace el agente que **no** escribió MVP-04.
- **Agente:** Gemini (MVP-04 lo hizo Claude Code)
- **Rama:** `mvp-04-auditoria`
- **Depende de:** MVP-04 mergeado en `main` (PR #17, merge `5be13d6`)

## Contexto especial
MVP-04 ya está mergeado. En este caso la auditoría es **posterior al merge**, así que se audita `main` y no una rama abierta.

- **Diff a auditar:** `git diff d91abf2..5be13d6`. El primero es el merge de MVP-03 y el segundo el de MVP-04.
- **Si hay hallazgos Bloqueantes o Mayores:** los corrige el autor en una PR `fix(shared): …` antes de empezar la Ola 1.
- **Hasta tu veredicto:** `packages/shared` **no** se considera congelado.

## Reglas (AGENTS.md §7 y `docs/auditoria-cruzada.md`)
- **No modifiques código del autor.** El único archivo que creás es `tickets/MVP-04-AUDITORIA.md`, con los hallazgos.
- **Orden de lectura obligatorio:**
  1. `AGENTS.md`.
  2. `tickets/MVP-04.md`, **sin** la nota de entrega ni la sección PREGUNTAS.
  3. Las secciones de `docs/arquitectura-v3.md`: §2 completo **excepto §2.6**, §3.1, §3.2 (normalización, observaciones y códigos de error), §3.3 (solo los códigos de descarte), §3.7 y §3.8.
  4. El diff.
  5. Correr la verificación.
  6. **Recién entonces** la nota de entrega y PREGUNTAS de `tickets/MVP-04.md`.
- Podés escribir código de prueba propio **fuera del repo** o en archivos que no commitees, para verificar comportamiento. No lo subas.

## Alcance de la auditoría
Seguí el checklist completo de `docs/auditoria-cruzada.md`. Además, estos puntos son obligatorios.

### 1. Conformidad campo por campo con la arquitectura (el punto principal)
Armá una matriz por cada una de las 19 colecciones de §2.1 con estas columnas: campo en la arquitectura · campo en el esquema · tipo (`dec`, `cents`, `date`, `timestamp`, `ref`, enum, etc.) · obligatoriedad · coincide (sí/no).

- Un campo que está en la arquitectura y falta en el esquema: hallazgo.
- Un campo que está en el esquema y no en la arquitectura: hallazgo (regla 9).
- Un tipo distinto, por ejemplo `cents` donde la arquitectura dice `dec`: hallazgo.
- La matriz va completa en el informe, no solo las diferencias.

### 2. Los 21 supuestos del autor (sección PREGUNTAS)
Clasificá cada uno en una de tres categorías:
- **(a)** se deduce de la arquitectura;
- **(b)** es razonable pero es una decisión de negocio que Franco tiene que confirmar;
- **(c)** contradice la arquitectura o inventa algo.

Prestá especial atención a:
- la 18: `orderSchema`, `invalidOrderSchema` y su impacto en el export de errores de MVP-19;
- la 16: cotización manual con referencias nulas;
- la 19: `fecha_aceptacion` como campo del pedido;
- las 6 y 7: los campos de `usuarios` y `solicitudes_acceso`, que son casi todos supuestos.

### 3. Dinero (regla 1)
- `dec` acepta solo strings con hasta 4 decimales. `cents` acepta solo enteros seguros. Ningún monto es `number` salvo `cents`.
- El redondeo half-up de los helpers se prueba en los bordes. Algunos casos:
  - `718.3743` → `71837` cents (caso de referencia 1 de §3.3);
  - `0.005` → `1` cent;
  - `0.0049` → `0`;
  - `1250.50005` → `1250.5001` en `dec`.
  
  Verificá que existan tests de esos bordes. Si no existen, es hallazgo.
- **Ampliación de D28:** el autor normaliza `.dd` a `0.dd` en **todas** las columnas de importe, no solo en peso. Evaluá el riesgo y si debería limitarse.

### 4. Estados y transiciones (regla 6)
- Verificalo **sin leer el test del autor**. Armá vos, desde §3.7, la tabla de los 12 estados y compará los 144 pares (desde, hacia) contra `canTransition`.
- Incluí la restricción de `ADMIN` en `ACEPTADO_PROVEEDOR → EN_DISPUTA` y la ausencia de salidas desde `CANCELADO` y `LIQUIDADO`.
- Cualquier diferencia es Bloqueante.
- Verificá también que `assertTransition` lance un `DomainError` con `code = TRANSICION_INVALIDA`.

### 5. Parser del TMS (D28, §3.2)
- **Encabezados:** `Cabecera` contra `Cabecera Origen`, `Código Postal` contra `Código Postal Origen`, `:` final, tildes, mayúsculas, repetidos y desconocidos.
- **Montos:** `349,731.72` es válido. Estos tienen que dar `FORMATO_INVALIDO`, sin conversión silenciosa: `1.234,56` (formato europeo), `1,5`, `1e3`, `-5`, `.5.5`.
- **Fechas:** `31/02/2026` y `29/02/2027` son inválidas; `29/02/2028` es válida; las dos variantes con hora.
- **CP:** `0123` es válido; `123`, `12345` y `1406.0` son inválidos.
- **Códigos:** cada código de error y de observación intrínseca sale con el disparador exacto de §3.2, y no sale ningún código que no esté en la arquitectura.

### 6. Datos y privacidad (regla 8, Ley 25.326)
- Leé `scripts/checkTmsFile.ts` y confirmá que **nunca** imprime valores de filas, ni siquiera en los mensajes de error.
- El fixture `pedidos_tms_sintetico.csv` tiene que ser sintético: nombres, direcciones y CUIT inventados. Si podés, confirmá que los CUIT del fixture **no** sean CUIT reales válidos de empresas conocidas.
- Buscá en todo el diff datos reales o secretos.

### 7. Consumo del contrato (hallazgo previo de Franco, confirmalo)
`packages/shared` va a ser importado por `packages/motor` (MVP-13), `apps/functions` y `apps/web`. Verificá:
- Que `packages/shared/package.json` declare `main`, `types` y/o `exports`. Hoy no tiene ninguno.
- Que `pnpm build` de shared emita algo. El `tsconfig` de shared extiende el raíz, que tiene `noEmit: true`.
- Que el alias `@shared/*` del `tsconfig` raíz alcance para typecheck y vitest, pero no para el runtime de Functions desplegadas.
- Que exista `packages/motor/src/schemas/` con un placeholder. Eso podría derivar en tipos duplicados (regla 3).

Probalo con un archivo de prueba **no commiteado** que importe `@sistema-redespachos/shared` desde `packages/motor` y desde `apps/functions`, y corré typecheck y vitest. Clasificá la severidad e indicá qué ticket o qué `CR` debería resolverlo.

### 8. Calidad de los tests (checklist 9)
- Elegí al menos 5 reglas internas de esquemas: CUIT, `aplica_seguro`, `PESO`/`VOLUMEN`, `min < max`, `justificacion` obligatoria con rechazos.
- Para cada una, rompé la regla en una copia local del código y confirmá que algún test falla. Revertí después.
- Si un test no falla con la regla rota, es hallazgo.

## Archivos permitidos
- Crear: `tickets/MVP-04-AUDITORIA.md`.
- Nada más. Cualquier otro archivo en la PR es hallazgo contra vos.

## Criterio de aceptación de la auditoría
1. `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` corridos por vos sobre `main`, con la salida pegada.
2. La matriz completa del punto 1, para las 19 colecciones.
3. Los 21 supuestos clasificados como (a), (b) o (c), con una línea de justificación cada uno.
4. Los puntos 3 a 8 respondidos, cada uno con la evidencia que corresponda: comando, salida o test.
5. Hallazgos con el formato de `docs/auditoria-cruzada.md` (tabla con #, severidad, dónde, qué pasa, evidencia y sugerencia).
6. Veredicto final: `APROBADO`, `APROBADO CON OBSERVACIONES` o `RECHAZADO`.
7. Una lista separada de **decisiones que tiene que tomar Franco**: los supuestos (b) y las ampliaciones de la arquitectura.

## Plan
<lo completa el auditor antes de empezar; Franco da el OK>

## PREGUNTAS
<dudas del auditor>