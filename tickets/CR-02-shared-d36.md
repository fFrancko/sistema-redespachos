# CR-02 — `packages/shared`: `origen_tms` completo en los pedidos con error (D36)

- **Carril:** Compartido (`CR: shared`, aprobado por Franco el 5/10/2026). Es el único cambio permitido a `packages/shared` en este ticket.
- **Agente:** Claude Code · **Modelo:** Opus 5.5 · **Esfuerzo:** medio (reasignado por Franco el 9/10/2026; antes: Gemini)
- **Auditor:** Gemini (Antigravity) · **Modelo:** Gemini Pro · **Esfuerzo:** alto · auditoría estándar + reconstruir desde `origen_tms` una fila con error y compararla con el CSV (confirmado por Franco el 9/10/2026)
- **Rama:** `cr-02-shared-d36`
- **Depende de:** merge a `main` del cierre de la Ola 0. Tiene que estar mergeado **antes de MVP-17**. No bloquea MVP-13 ni MVP-14.
- **Origen:** `docs/ola-0/informe-validacion.md`, H-01; decisión P-03.

## Contexto a leer
- `AGENTS.md` completo.
- `docs/arquitectura-v3.md`: §2.4 (incluido el párrafo de `origen_tms`), D26, D32, D36 y D37.
- `docs/ola-0/informe-validacion.md`: H-01 y P-03.
- Código: `packages/shared/src/tms/orderRow.ts`, `src/tms/headers.ts`, `src/schemas/orders.ts` y sus tests.

## Problema
D36 dice que la exportación de filas con error (MVP-19) sale de `origen_tms`. Hoy `parseTmsRow` guarda en `origen_tms` solo las 28 columnas que no se mapean a un campo; las 19 mapeadas van a `datos` y, si fallan la validación, se descartan. Un pedido con `Peso Kgs: 0` pierde el `0`, y el xlsx de errores no se puede reconstruir.

## Decisión (P-03)
- **Pedido con error** (la fila tiene al menos un error): `origen_tms` guarda **todas las columnas del TMS que trae la fila**, las 47 y las 3 opcionales si vienen, con su valor crudo (recortado con `trim`, sin convertir) y con la clave `origenKey` de `headers.ts`.
- **Pedido válido:** sin cambios. `origen_tms` guarda solo las columnas que no se mapean a un campo. No se duplican datos.

## Alcance
1. `parseTmsRow`: si `errores` no está vacío, completar `datos.origen_tms` con las columnas mapeadas presentes en la fila (valor crudo). El resto del comportamiento no cambia.
2. Esquema: `invalidOrderSchema` documenta y prueba que `origen_tms` puede traer las claves de las columnas mapeadas. `orderSchema` sigue igual.
3. Tests:
   - Fila con `Peso Kgs: 0`: `origen_tms.peso_kgs === '0'` y error `PESO_INVALIDO`.
   - Fila con `Cabecera Origen` vacía: la clave está en `origen_tms` con `''`.
   - `Codigo de Expreso` presente en `origen_tms` de una fila con error.
   - Fila válida: `origen_tms` no contiene ninguna clave de columna mapeada (no hay duplicación).
   - Con el fixture sintético: cada fila con error reconstruye, desde `origen_tms`, todas sus columnas en el orden de `TMS_COLUMNS` (D37), con los mismos valores del CSV.
4. `checkTmsFile` sobre el archivo real sigue dando 538 filas y 0 errores de formato (lo corre Franco; el archivo no entra al repo).

## Archivos permitidos
`packages/shared/src/tms/orderRow.ts`, `packages/shared/src/schemas/orders.ts`, sus `*.test.ts`, `packages/shared/src/tms/orderRowRules.test.ts`, este ticket.

## Archivos prohibidos
Todo lo demás, incluidos `headers.ts` (D37: las columnas no cambian), el fixture sintético y cualquier archivo fuera de `packages/shared`.

## Criterio de aceptación
1. Los tests del punto 3 existen y pasan; fallan si se vuelve al comportamiento anterior.
2. Ningún cambio en la salida de `parseTmsRow` para filas válidas (los tests existentes pasan sin tocarlos).
3. Secuencia de `AGENTS.md` §5.5 en verde, con la salida pegada, y prueba de consumo: el `dist` de `shared` se importa con Node y `parseTmsRow` devuelve el `origen_tms` completo para una fila con error.

## Plan
Worktree `../sistema-redespachos-cr02`, rama `cr-02-shared-d36` desde `origin/main` (`ba7f3dd`).

1. `packages/shared/src/tms/orderRow.ts`: en la pasada de columnas, guardar también las celdas mapeadas (ya recortadas). Al final, si `errores` no está vacío, `datos.origen_tms` pasa a tener todas las columnas presentes en la fila, en el orden de `TMS_ALL_COLUMNS`, con su `origenKey` y el valor crudo. Las columnas ausentes de la fila no se agregan. Filas válidas: sin cambios (mismo objeto, mismas 28 claves).
2. `packages/shared/src/schemas/orders.ts`: solo el comentario de `invalidOrderSchema` (D36: `origen_tms` trae también las columnas mapeadas). El esquema ya acepta cualquier clave string; `orderSchema` no cambia.
3. `packages/shared/src/tms/orderRow.test.ts`: test de reconstrucción con el fixture (cada fila con error rearma sus 47 + 3 columnas en el orden de `TMS_COLUMNS`/`TMS_OPTIONAL_COLUMNS` con los valores del CSV) y test de no duplicación en todas las filas válidas.
4. `packages/shared/src/tms/orderRowRules.test.ts`: `Peso Kgs: 0` → `origen_tms.peso_kgs === '0'` + `PESO_INVALIDO`; `Cabecera Origen` vacía → clave con `''`; `Codigo de Expreso` presente en una fila con error; columna mapeada ausente de la fila → no aparece.
5. `packages/shared/src/schemas/orders.test.ts`: `invalidOrderSchema` acepta un `origen_tms` con claves de columnas mapeadas (salida real de `parseTmsRow` de una fila con error, más el contexto del pedido).
6. Este ticket (plan, PREGUNTAS y nota de entrega).
7. Verificación: `pnpm install --frozen-lockfile`, `pnpm format`, `pnpm ci:run`, prueba de consumo con Node sobre `packages/shared/dist`, prueba de que los tests nuevos fallan con el `orderRow.ts` de `main` y `git diff --stat origin/main...HEAD`. Un solo commit, sin push.

**OK de Franco (9/10/2026), con cambios** que se aplicaron sobre el plan anterior:

1. Autoriza tocar `packages/shared` solo en los archivos permitidos de este `CR: shared`.
2. `DUPLICADO` lo agrega el importador (MVP-17), no `parseTmsRow`. `orderRow.ts` exporta una función pura que arma el `origen_tms` completo de una fila (`buildFullOrigenTms`); `parseTmsRow` la usa cuando hay errores. Test: fila válida + esa función = las 47 columnas con su valor recortado.
3. El `origen_tms` completo se arma al final de `parseTmsRow`, después de todas las validaciones.
4. Los tests buscan el `origenKey` por `field` en `TMS_ALL_COLUMNS`, sin claves escritas a mano (CR-07 va a renombrar columnas). La reconstrucción recorre `TMS_COLUMNS` y compara contra el valor recortado.
5. La nota aclara qué tests son de protección y pasan también con `main`.
6. Auditor: Gemini Pro, esfuerzo alto.
7. D26 y "las 47 columnas" de D36 quedan fuera de alcance: van a CR-07.

## PREGUNTAS
1. ~~El ticket estaba asignado a Gemini con Claude Code de auditor. Al pasar la autoría a Claude Code, puse a Gemini como auditor (`AGENTS.md` §7: audita el otro agente). Confirmar modelo y esfuerzo del auditor.~~ **Respondida:** Gemini Pro, esfuerzo alto.
2. `docs/arquitectura-v3.md` D26 todavía dice que `Codigo de Expreso` va "también crudo en `origen_tms`" en los pedidos con error; P-03 pedía ajustarlo a "se guarda en `expreso_manual`". Con este CR las dos lecturas coinciden (con error: en ambos; válido: solo `expreso_manual`), así que no hay contradicción con el código. `docs/` está fuera de este ticket; no lo toco. **Respondida:** D26 y "las 47 columnas" de D36 van a CR-07.

---

## Nota de entrega (la completa el agente al terminar)

- **Qué se hizo:** `orderRow.ts` exporta `buildFullOrigenTms(fila)`, una función pura que devuelve todas las columnas del TMS que trae la fila (las 47 y las opcionales presentes), con su `origenKey` y el valor recortado sin convertir, en el orden de `TMS_ALL_COLUMNS`. Las columnas ausentes de la fila no se agregan. `parseTmsRow` la usa al final, después de todas las validaciones, si `errores` no está vacío; en las filas válidas `origen_tms` sigue con las 28 columnas no mapeadas. La lectura de celdas de la fila pasó a un helper interno (`readTmsCells`) que comparten las dos funciones, así que reconocen los encabezados y recortan igual. En `orders.ts` solo cambió el comentario de `invalidOrderSchema`; ningún esquema cambió.
- **Autorización:** Franco autorizó tocar `packages/shared` en este `CR: shared`, solo en los archivos permitidos del ticket (OK del 9/10/2026). No se tocó `headers.ts` ni el fixture.
- **Commit:** `dcacf59` en `cr-02-shared-d36` (código, tests, plan y la primera versión de esta nota). Los ajustes de la nota pedidos en la revisión de Franco van en el commit siguiente, que solo toca este ticket. Sin push ni PR. Worktree propio: `../sistema-redespachos-cr02`, rama creada desde `origin/main` (`ba7f3dd`) después de `git fetch`. Se le quitó el upstream `origin/main` que puso `git worktree add`, como en CR-09, para que un `git push` sin argumentos no apunte a `main`.
- **Archivos tocados** (`git diff --stat origin/main...HEAD`):
  ```
   packages/shared/src/schemas/orders.test.ts    | 11 +++
   packages/shared/src/schemas/orders.ts         |  4 +-
   packages/shared/src/tms/orderRow.test.ts      | 98 ++++++++++++++++++++++++++-
   packages/shared/src/tms/orderRow.ts           | 35 ++++++++--
   packages/shared/src/tms/orderRowRules.test.ts | 62 ++++++++++++++++-
   tickets/CR-02-shared-d36.md                   | ...
  ```
  (la línea del ticket depende de esta misma nota; el auditor ve el número real con el comando).
- **Cómo probarlo:**
  ```bash
  pnpm install --frozen-lockfile
  pnpm ci:run
  pnpm exec vitest run packages/shared/src/tms packages/shared/src/schemas/orders.test.ts
  ```
- **Resultado de la verificación** (Windows, Node v26.10.0, pnpm 9.15.9; worktree recién creado, `find . -name dist -not -path "*/node_modules/*"` vacío antes de correr):
  - `pnpm install --frozen-lockfile`: `Done in 31.9s using pnpm v9.15.9`, sin cambios en `pnpm-lock.yaml`.
  - `pnpm format`: sin cambios fuera de los archivos del ticket.
  - `pnpm ci:run` (exit 0), salida recortada a los resultados de cada paso:
    ```
    > pnpm --filter @sistema-redespachos/shared build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
    apps/functions | WARN  Unsupported engine: wanted: {"node":"22"} (current: {"node":"v26.10.0","pnpm":"9.15.9"})
    > @sistema-redespachos/shared@0.0.1 build
    > tsc
    > eslint apps/web/src apps/functions packages --max-warnings 0
    > prettier --check .
    All matched files use Prettier code style!
    > pnpm -r typecheck
    packages/shared typecheck: Done
    apps/web typecheck: Done
    packages/motor typecheck: Done
    apps/functions typecheck: Done
    > vitest run
     ✓ packages/shared/src/schemas/orders.test.ts (71 tests)
     ✓ packages/shared/src/tms/orderRow.test.ts (37 tests)
     ✓ packages/shared/src/tms/orderRowRules.test.ts (26 tests)
     ...
     Test Files  31 passed (31)
          Tests  783 passed (783)
    > pnpm -r build
    packages/shared build: Done
    packages/motor build: Done
    apps/functions build: Done
    apps/web build: ✓ built in 883ms
    apps/web build: Done
    ```
  - Sin emuladores: el ticket no toca reglas ni Functions.
- **Consumo real:** script `.mjs` fuera del repo, copiado un momento a `packages/shared/` para resolver `@sistema-redespachos/shared` por su campo `exports` (`./dist/index.js`) y `csv-parse` del paquete, corrido con `node` y borrado (no se commitea). Toma la fila SINT-0001 del fixture con `PESO KGS:` en `0`:
  ```
  errores: peso_kgs:PESO_INVALIDO
  claves origen_tms (con error): 50
  origen_tms.peso_kgs: "0"
  47 columnas presentes: true
  claves origen_tms (válida): 28
  buildFullOrigenTms (válida): 50
  ```
- **Evidencia del criterio de aceptación:**
  1. Tests del punto 3 del alcance:
     - `Peso Kgs: 0` → `orderRowRules.test.ts` › "Peso Kgs 0 queda crudo en origen_tms, con el error PESO_INVALIDO".
     - `Cabecera Origen` vacía → "Cabecera Origen vacía queda en origen_tms con su clave y \"\"".
     - `Codigo de Expreso` → "Codigo de Expreso está en origen_tms de una fila con error (D26)".
     - Fila válida sin duplicación → `orderRow.test.ts` › "una fila válida no guarda en origen_tms ninguna columna mapeada (sin duplicación)", sobre las 8 filas válidas del fixture y contra todas las columnas con `field` de `TMS_ALL_COLUMNS`.
     - Reconstrucción → "cada fila con error reconstruye sus 47 columnas, en el orden de TMS_COLUMNS, con los valores del CSV": recorre `TMS_COLUMNS` (no el orden del objeto) en las 12 filas con error y compara con la celda del CSV recortada.
     - Además: `buildFullOrigenTms` sobre una fila válida (con un valor rellenado con espacios) devuelve las 47 columnas recortadas; valores sin convertir (monto, fecha, CP inválido); error en una columna no mapeada; columna mapeada ausente de la fila; columnas opcionales; `invalidOrderSchema` acepta un `origen_tms` con las columnas mapeadas.

     **Fallan con `main`:** se puso el `orderRow.ts` de `origin/main` (más un `buildFullOrigenTms` que devuelve `{}`, porque sin esa exportación los archivos de test no cargan) y se corrieron los tres archivos de test sin tocarlos: `Tests  10 failed | 124 passed (134)`. Fallan los 6 tests nuevos de `orderRowRules.test.ts`, los 2 de reconstrucción y opcionales y los 2 de `buildFullOrigenTms` (estos dos, por el stub). Después se restauró el archivo (idéntico al de `dcacf59`) y se volvieron a correr los mismos tres archivos:

     ```
     pnpm exec vitest run packages/shared/src/tms/orderRow.test.ts packages/shared/src/tms/orderRowRules.test.ts packages/shared/src/schemas/orders.test.ts
      ✓ packages/shared/src/schemas/orders.test.ts (71 tests)
      ✓ packages/shared/src/tms/orderRow.test.ts (37 tests)
      ✓ packages/shared/src/tms/orderRowRules.test.ts (26 tests)
      Test Files  3 passed (3)
           Tests  134 passed (134)
     ```

     **Tests de protección, que pasan también con `main`:** "una fila válida no guarda en origen_tms ninguna columna mapeada (sin duplicación)", "el fixture tiene 12 filas con error y 8 válidas" y, en `orders.test.ts`, "origen_tms puede traer las columnas mapeadas con su valor crudo (D36)". Protegen que el cambio no se extienda a las filas válidas y que el esquema no se cierre, pero no prueban el cambio.
  2. Filas válidas sin cambios: los tests existentes de `orderRow.test.ts` y `orderRowRules.test.ts` no se modificaron (el diff de esos archivos solo agrega imports y bloques al final) y pasan, incluido "el resto de las columnas va a origen_tms… `toHaveLength(28)`".
  3. Secuencia §5.5 y consumo: arriba.
  4. `checkTmsFile` sobre el archivo real (538 filas, 0 errores de formato): **lo corre Franco**; el archivo no está en el repo. El cambio no toca la lectura de encabezados ni los errores de formato.
- **Decisiones tomadas:**
  - Las claves de `origen_tms` en una fila con error salen en el orden de `TMS_ALL_COLUMNS`, no en el del archivo. El orden de claves no se garantiza en Firestore, así que el export (MVP-19) igual tiene que recorrer `TMS_COLUMNS`.
  - Si una fila trae dos encabezados que normalizan a la misma columna, gana la última celda, igual que en `parseTmsRow` (comparten `readTmsCells`). En un archivo, `resolveTmsHeaders` ya lo marca como error de archivo.
  - Plan, punto 5: el test de `orders.test.ts` arma el `origen_tms` completo desde `TMS_ALL_COLUMNS`, en lugar de usar la salida de `parseTmsRow` con el fixture, para que el test del esquema no dependa del parser.
- **Supuestos:** ninguno nuevo.
- **Fuera de alcance:**
  - **MVP-17** tiene que usar `buildFullOrigenTms(fila)` para armar el `origen_tms` del pedido cuando le agrega el error `DUPLICADO` (que `parseTmsRow` no detecta). Si la fila ya traía errores del parser, el `origen_tms` ya viene completo.
  - **CR-07:** ajustar el texto de D26 y "las 47 columnas" de D36 en `docs/arquitectura-v3.md` (P-03).
  - `checkTmsFile` sobre el archivo real: Franco.
- **Riesgos y deuda:**
  - Verificado en Node 26 en local; CI corre en 22.x. El cambio no usa nada que dependa de la versión.
  - Un pedido con error pesa unos 19 valores más en Firestore (5 de 538 filas en el archivo real, según P-03).
  - Para el auditor: mirar que `buildFullOrigenTms` y la rama de filas válidas de `parseTmsRow` usan el mismo `readTmsCells`, y que la reconstrucción del test compara contra el CSV y no contra el parser.
