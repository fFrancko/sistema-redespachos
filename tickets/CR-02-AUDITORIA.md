# Auditoría CR-02 — `packages/shared`: `origen_tms` completo en los pedidos con error (D36)

- **Ticket:** `tickets/CR-02-shared-d36.md`
- **Carril:** Compartido (`CR: shared`)
- **Autor:** Claude Code (Opus 5.5)
- **Auditor:** Gemini (Antigravity · Gemini Pro)
- **Rama auditada:** `cr-02-shared-d36` (commits `dcacf59` y `d95f05f`)
- **Base:** `origin/main` (`ba7f3dd`)
- **Worktree de auditoría:** `sistema-redespachos-cr02-aud` (HEAD `d95f05f`)
- **Fecha:** 9 de octubre de 2026

---

## 1. Verificación del checklist general (11 puntos)

### 1. Verificación limpia
Secuencia completa de `AGENTS.md` §5.5 ejecutada desde el worktree limpio sin artefactos previos (`dist/` vacíos).
- **Entorno:** Windows 11, Node v26.10.0, pnpm 9.15.9 (CI usa Node 22.x; probado también en emulación de consumo Node).
- `pnpm install --frozen-lockfile`: exit 0 en 16.3s.
- `pnpm format`: exit 0 (todos los archivos con formato Prettier al día, sin cambios pendientes).
- `pnpm ci:run`: exit 0. Salida real completa:

```text
> sistema-redespachos@0.0.1 ci:run C:\Users\Franco Aranda\Documents\sistema-redespachos-cr02-aud
> pnpm --filter @sistema-redespachos/shared build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build

apps/functions                           |  WARN  Unsupported engine: wanted: {"node":"22"} (current: {"node":"v26.10.0","pnpm":"9.15.9"})

> @sistema-redespachos/shared@0.0.1 build C:\Users\Franco Aranda\Documents\sistema-redespachos-cr02-aud\packages\shared
> tsc

> sistema-redespachos@0.0.1 lint C:\Users\Franco Aranda\Documents\sistema-redespachos-cr02-aud
> eslint apps/web/src apps/functions packages --max-warnings 0

> sistema-redespachos@0.0.1 format:check C:\Users\Franco Aranda\Documents\sistema-redespachos-cr02-aud
> prettier --check .

Checking formatting...
All matched files use Prettier code style!

> sistema-redespachos@0.0.1 typecheck C:\Users\Franco Aranda\Documents\sistema-redespachos-cr02-aud
> pnpm -r typecheck

apps/functions                           |  WARN  Unsupported engine: wanted: {"node":"22"} (current: {"node":"v26.10.0","pnpm":"9.15.9"})
Scope: 4 of 5 workspace projects
packages/shared typecheck$ tsc --noEmit && tsc -p scripts --noEmit
packages/shared typecheck: Done
apps/functions typecheck$ tsc --noEmit
apps/web typecheck$ tsc --noEmit
packages/motor typecheck$ tsc --noEmit
apps/web typecheck: Done
packages/motor typecheck: Done
apps/functions typecheck: Done

> sistema-redespachos@0.0.1 test C:\Users\Franco Aranda\Documents\sistema-redespachos-cr02-aud
> vitest run

 RUN  v2.1.9 C:/Users/Franco Aranda/Documents/sistema-redespachos-cr02-aud

 ✓ packages/motor/src/candidatas.test.ts (27 tests) 43ms
 ✓ packages/motor/src/cotizar.test.ts (26 tests) 36ms
 ✓ packages/shared/src/schemas/orders.test.ts (71 tests) 18ms
 ✓ packages/shared/src/tms/orderRow.test.ts (37 tests) 54ms
 ✓ packages/shared/src/tms/orderRowRules.test.ts (26 tests) 23ms
 ✓ packages/motor/src/calculo.test.ts (17 tests) 8ms
 ✓ packages/shared/src/tms/headers.test.ts (25 tests) 4ms
 ✓ packages/motor/test/golden/golden.test.ts (183 tests) 44ms
 ✓ packages/shared/src/orderTransitions.test.ts (34 tests) 6ms
 ✓ packages/shared/src/primitives.test.ts (60 tests) 7ms
 ✓ packages/shared/src/schemas/tariffs.test.ts (41 tests) 8ms
 ✓ packages/motor/src/destino.test.ts (7 tests) 2ms
 ✓ packages/motor/src/tramos.test.ts (7 tests) 2ms
 ✓ packages/motor/test/guardas.test.ts (8 tests) 54ms
 ✓ packages/shared/src/schemas/suppliers.test.ts (27 tests) 3ms
 ✓ packages/shared/src/schemas/proformas.test.ts (21 tests) 3ms
 ✓ packages/shared/src/schemas/postalRouter.test.ts (15 tests) 2ms
 ✓ packages/shared/src/tms/amountsAndDates.test.ts (43 tests) 3ms
 ✓ packages/shared/src/schemas/users.test.ts (17 tests) 2ms
 ✓ packages/shared/src/errors.test.ts (9 tests) 2ms
 ✓ packages/shared/src/schemas/emails.test.ts (17 tests) 3ms
 ✓ packages/shared/src/normalize.test.ts (17 tests) 2ms
 ✓ packages/shared/src/schemas/system.test.ts (15 tests) 2ms
 ✓ apps/functions/src/nodeRuntime.test.ts (1 test) 3071ms
   ✓ JS emitido de apps/functions > carga con Node puro y helloWorld es de 2ª gen en southamerica-east1 3071ms
 ✓ packages/shared/src/schemas/reports.test.ts (12 tests) 1ms
 ✓ apps/functions/src/index.test.ts (3 tests) 1ms
 ✓ packages/shared/src/schemas/importBatches.test.ts (8 tests) 2ms
 ✓ packages/shared/src/types/firebase.test.ts (4 tests) 1ms
 ✓ packages/motor/src/index.test.ts (2 tests) 2ms
 ✓ packages/shared/src/schemas/branches.test.ts (2 tests) 0ms
 ✓ apps/web/src/App.test.tsx (1 test) 0ms

 Test Files  31 passed (31)
      Tests  783 passed (783)
   Start at  15:17:53
   Duration  6.71s (transform 795ms, setup 0ms, collect 2.77s, tests 3.41s, environment 0ms, prepare 178ms)

> sistema-redespachos@0.0.1 build C:\Users\Franco Aranda\Documents\sistema-redespachos-cr02-aud
> pnpm -r build

apps/functions                           |  WARN  Unsupported engine: wanted: {"node":"22"} (current: {"node":"v26.10.0","pnpm":"9.15.9"})
Scope: 4 of 5 workspace projects
packages/shared build$ tsc
packages/shared build: Done
apps/web build$ tsc && vite build
apps/functions build$ tsc -p tsconfig.build.json
packages/motor build$ tsc -p tsconfig.build.json
packages/motor build: Done
apps/web build: vite v5.4.21 building for production...
apps/web build: transforming...
apps/functions build: Done
apps/web build: ✓ 31 modules transformed.
apps/web build: rendering chunks...
apps/web build: computing gzip size...
apps/web build: dist/index.html                   0.48 kB │ gzip:  0.31 kB
apps/web build: dist/assets/index-C-YIHlKk.css    0.27 kB │ gzip:  0.22 kB
apps/web build: dist/assets/index-Cmy3f65K.js   142.78 kB │ gzip: 45.86 kB
apps/web build: ✓ built in 761ms
apps/web build: Done
```

### 2. Criterio de aceptación
- **Criterio 1:** Cumplido. Los tests del punto 3 existen en `orderRow.test.ts`, `orderRowRules.test.ts` y `orders.test.ts`. Se verificó mediante mutaciones (ver Control D) que fallan si se vuelve al comportamiento previo.
- **Criterio 2:** Cumplido. Ningún cambio en la salida de `parseTmsRow` para filas válidas. Se verificó con script independiente comparando fila por fila contra `origin/main` (ver Control B).
- **Criterio 3:** Cumplido. Secuencia §5.5 en verde y prueba de consumo Node sobre `packages/shared/dist` ejecutada con éxito (ver Control A y Consumo Real).

### 3. Conformidad con la arquitectura
- Cumple `docs/arquitectura-v3.md`:
  - **§2.4 (línea 234):** En los pedidos con error, `origen_tms` conserva además las columnas mapeadas con su valor crudo.
  - **D36 (línea 85):** `origen_tms` conserva las columnas del TMS tal como vinieron para la exportación de filas con error en el panel de revisión (MVP-19), mientras que en filas válidas guarda solo las columnas no mapeadas evitando duplicación.
  - **D26 (línea 75):** `Codigo de Expreso` se guarda en `expreso_manual` y, en pedidos con error, también crudo en `origen_tms`.
  - **D37 (línea 86):** El orden canónico proviene de `headers.ts` (`TMS_COLUMNS`).

### 4. Dinero
- Regla 1 de `AGENTS.md` cumplida. Los valores que alimentan `origen_tms` son strings crudos recortados (`(value ?? '').trim()`), sin conversiones intermedias a `number` ni alteración de centavos.

### 5. Alcance
- `git diff --stat origin/main...HEAD` muestra únicamente los 5 archivos permitidos en `packages/shared` y el ticket:
  ```text
  packages/shared/src/schemas/orders.test.ts    |  11 +++
  packages/shared/src/schemas/orders.ts         |   4 +-
  packages/shared/src/tms/orderRow.test.ts      |  98 +++++++++++++++++++-
  packages/shared/src/tms/orderRow.ts           |  35 ++++++-
  packages/shared/src/tms/orderRowRules.test.ts |  62 ++++++++++++-
  tickets/CR-02-shared-d36.md                   | 126 +++++++++++++++++++++++++-
  6 files changed, 322 insertions(+), 14 deletions(-)
  ```
- `headers.ts` y el fixture no fueron modificados.
- Ninguna dependencia añadida.

### 6. Contratos
- Cambio habilitado bajo `CR: shared` expresamente aprobado por Franco el 5/10/2026.
- `invalidOrderSchema` documenta y mantiene compatibilidad con `origen_tms` completo.
- `orderSchema` no sufrió modificaciones. No hay tipos duplicados.

### 7. Seguridad y datos
- Sin datos reales ni secretos. El fixture sintético se mantiene intacto.
- No se imprimen valores de filas en errores ni logs (cumple Ley 25.326).

### 8. Casos borde
- `Peso Kgs: 0` queda `'0'` en `origen_tms` con error `PESO_INVALIDO`.
- `Cabecera Origen: '   '` queda `''` en `origen_tms` con error `CAMPO_OBLIGATORIO`.
- `Codigo de Expreso: ' EXPRESO X '` queda `'EXPRESO X'` en `origen_tms` y `expreso_manual`.
- Columna mapeada ausente de la fila cruda: no se agrega indebidamente a `origen_tms`.
- Columnas opcionales presentes (3 columnas de dimensiones al final): se preservan en `origen_tms` (total 50 columnas).

### 9. Tests
- Tests con aserciones rigurosas de comportamiento.
- Se verificó que fallan al mutar la implementación (ver Control D).
- Tests existentes no sufrieron modificaciones ni eliminaciones (ver Control C).

### 10. Consumo real
- Verificado ejecutando scripts ESM (`.mjs`) externos con Node puro importando directamente `./dist/index.js` emitido.
- Se confirmó exportación y ejecución correcta de `parseTmsRow`, `buildFullOrigenTms`, `TMS_COLUMNS`, `TMS_ALL_COLUMNS` y `normalizeHeader`.

### 11. CI
- El ticket no toca workflows ni configuración de CI. `ci:run` pasó localmente de forma limpia.

---

## 2. Controles específicos de CR-02

### Control A: Reconstrucción independiente desde `origen_tms`
Se ejecutó un script `.mjs` independiente ubicado fuera del repositorio (`scratch/control_a.mjs`) que importó `packages/shared/dist/index.js` mediante Node. Se tomaron del fixture sintético 3 filas representativas con errores de diferente naturaleza:
1. `SINT-0008`: error de peso (`peso_kgs:PESO_INVALIDO`).
2. `SINT-0004`: error de cabecera (`cabecera_origen:CAMPO_OBLIGATORIO`).
3. `SINT-0019`: error de fecha en columna no mapeada (`fecha_de_alta:FORMATO_INVALIDO`).

Para cada una se reconstruyó la fila celda por celda iterando `TMS_COLUMNS` (y las columnas opcionales de `TMS_OPTIONAL_COLUMNS`) contra el valor original del CSV recortado.
Salida real obtenida:

```text
=== CONTROL A: RECONSTRUCCION INDEPENDIENTE DESDE ORIGEN_TMS ===
Fila SINT-0008 (peso):
  - Errores detectados: [peso_kgs:PESO_INVALIDO]
  - Columnas canónicas (TMS_COLUMNS): 47/47 coincidentes (0 discrepancias)
  - Columnas opcionales (TMS_OPTIONAL_COLUMNS): 3/3 coincidentes
  - Total claves en origen_tms: 50
  - Reconstrucción 100% exacta: SI
Fila SINT-0004 (cabecera):
  - Errores detectados: [cabecera_origen:CAMPO_OBLIGATORIO]
  - Columnas canónicas (TMS_COLUMNS): 47/47 coincidentes (0 discrepancias)
  - Columnas opcionales (TMS_OPTIONAL_COLUMNS): 3/3 coincidentes
  - Total claves en origen_tms: 50
  - Reconstrucción 100% exacta: SI
Fila SINT-0019 (fecha en columna no mapeada):
  - Errores detectados: [fecha_de_alta:FORMATO_INVALIDO]
  - Columnas canónicas (TMS_COLUMNS): 47/47 coincidentes (0 discrepancias)
  - Columnas opcionales (TMS_OPTIONAL_COLUMNS): 3/3 coincidentes
  - Total claves en origen_tms: 50
  - Reconstrucción 100% exacta: SI
```

### Control B: Filas válidas sin cambios respecto a `origin/main`
Se ejecutó una comparación completa (`scratch/control_b.mjs`) sobre las 20 filas del fixture sintético contrastando la salida de `parseTmsRow` del branch contra la implementación canónica de `origin/main`:
- En las **8 filas válidas**, el resultado completo (`datos`, `origen_tms`, `errores`, `observaciones`) es **100% idéntico** (deep equal).
- En las **12 filas con error**, `errores`, `observaciones` y los campos de `datos` (salvo `origen_tms`) son idénticos; lo único que cambia es `origen_tms`, que incorpora las columnas mapeadas tal como exige D36.
Salida real obtenida:

```text
=== CONTROL B: COMPARACION DE TODAS LAS FILAS CON ORIGIN/MAIN ===
Filas totales analizadas: 20
Filas válidas: 8 | 100% idénticas a origin/main: SI
Filas con error: 12 | Solo cambia origen_tms según D36: SI
```

### Control C: Tests existentes intactos
Revisión del diff en `orderRow.test.ts` y `orderRowRules.test.ts`:
- En `orderRow.test.ts`: la línea de imports fue actualizada para incluir los nuevos símbolos exportados, y se agregaron 2 nuevos bloques `describe` al final (líneas 252+). Los 35 tests preexistentes no sufrieron ninguna alteración.
- En `orderRowRules.test.ts`: se agregaron imports al inicio y un bloque `describe` al final (líneas 211+). Los 20 tests preexistentes se mantuvieron intactos.

### Control D: Sensibilidad de tests ante rotura de reglas (Mutaciones)
Se introdujeron 3 mutaciones deliberadas en `packages/shared/src/tms/orderRow.ts` y se verificó que los tests fallen:

1. **Mutación 1: `parseTmsRow` no completa `origen_tms` en filas con error** (se comentó la llamada a `buildFullOrigenTms`).
   - Resultado: **8 tests fallaron** (2 en `orderRow.test.ts` y 6 en `orderRowRules.test.ts`).
2. **Mutación 2: `parseTmsRow` completa `origen_tms` también en filas válidas** (asignación incondicional de `buildFullOrigenTms(fila)`).
   - Resultado: **4 tests fallaron** en `orderRow.test.ts` (aserciones de longitud 28 vs 50 y no duplicación de claves mapeadas).
3. **Mutación 3: `buildFullOrigenTms` no recorta los valores** (se eliminó `.trim()` en `readTmsCells`).
   - Resultado: **4 tests fallaron** (1 en `orderRow.test.ts` y 3 en `orderRowRules.test.ts`).

Tras las pruebas, se restauró el archivo con `git checkout` y se verificó la suite limpia (63/63 tests pasando).

### Control E: Alcance estricto
- Ningún archivo fuera de los autorizados fue tocado.
- `headers.ts` y `pedidos_tms_sintetico.csv` se mantuvieron 100% inalterados.

---

## 3. Tabla de hallazgos

| # | Severidad | Dónde | Qué pasa | Evidencia | Sugerencia |
| - | --------- | ----- | -------- | --------- | ---------- |
| - | Ninguna   | -     | Sin hallazgos bloqueantes, mayores ni menores | Verificación y controles 100% en verde | Proceder con el merge |

---

## 4. Veredicto

**APROBADO**

La solución implementada por Claude Code en `cr-02-shared-d36` es limpia, determinística, cumple rigurosamente con D36 y D26, no rompe ninguna fila válida, aísla el comportamiento en la función pura exportada `buildFullOrigenTms`, y cuenta con una cobertura de tests ejemplar.

---

## 5. Decisiones para Franco

1. **Traspaso a MVP-17:** La nota de entrega y el docstring de `orderRow.ts` dejan documentado con total claridad que el importador de MVP-17 debe invocar `buildFullOrigenTms(fila)` al detectar y marcar pedidos con error `DUPLICADO`.
2. **Ajuste en arquitectura (CR-07):** Tal como quedó resuelto en las preguntas previas, el texto de D26 y la mención de "las 47 columnas" en D36 en `docs/arquitectura-v3.md` se ajustarán en el ticket CR-07.
3. **Validación real:** Franco correrá `checkTmsFile` sobre el CSV real de 538 filas fuera del repositorio.
