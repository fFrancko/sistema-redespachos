# MVP-13-AUDITORIA — Motor (1/2): destino, variantes y reglas candidatas

- **Ticket auditado:** `tickets/MVP-13.md` (Carril A, autor: Gemini)
- **Auditor:** Claude Code · Opus 5.5 · auditoría cruzada + auditoría adicional del motor (`docs/auditoria-cruzada.md`)
- **Rama / commit auditado:** `mvp-13-motor-candidatas` @ `176060e` (último commit de código: `89cdf16`), contra `origin/main` @ `57b6519`
- **Fecha:** 06/10/2026
- **Veredicto:** **RECHAZADO**: 5 hallazgos Bloqueantes (CI rojo en `format:check`; criterios 4, 5 y "por cada nivel de precedencia" sin test que falle; evidencia de los criterios 6 y 7 que no corresponde al commit entregado) y 5 Mayores.

La lógica es correcta en todo lo que pude contrastar: la implementación de referencia propia coincide con el motor en todas las candidatas, salvo dos causas que se explican abajo (§4). El rechazo se debe sobre todo a la red de tests y a la evidencia de entrega, no al comportamiento del código.

---

## 1. Método y orden de lectura

1. `AGENTS.md`, `docs/auditoria-cruzada.md`, ticket (alcance, criterio, "Decisiones ya tomadas" y "Decisiones de Franco (06/10/2026)"), `docs/arquitectura-v3.md` §2 (normalización), §2.3, §3.3 pasos 1 a 3, D10, D11, D24, D25, D27, D33 y §4 (fila MVP-13), `docs/ola-0/estado-y-decisiones.md` §3 y §7, y los esquemas de `shared` que lista el ticket.
2. **Antes de leer el código del autor** escribí una implementación de referencia de los pasos 1 y 2, solo desde §3.3 y las decisiones de Franco (fuera del repo, en el scratchpad del auditor).
3. Código y tests de `packages/motor`.
4. Al final, Plan, PREGUNTAS, Nota de entrega e historial del ticket.

No modifiqué código del autor. Las mutaciones y los scripts de comparación se corrieron en un clon descartable, fuera del repo. Este informe es el único archivo creado.

## 2. Alcance (`git diff --stat origin/main...HEAD`)

```
 packages/motor/package.json                      |  14 +-
 packages/motor/src/candidatas.test.ts            | 466 +++++++++++++++++++++++
 packages/motor/src/candidatas.ts                 | 133 +++++++
 packages/motor/src/cotizacion/cotizacion.test.ts |   8 -
 packages/motor/src/cotizacion/index.ts           |   3 -
 packages/motor/src/destino.test.ts               | 127 ++++++
 packages/motor/src/destino.ts                    |  78 ++++
 packages/motor/src/index.ts                      |   7 +-
 packages/motor/src/schemas/index.ts              |   3 -
 packages/motor/src/tarifas/index.ts              |   3 -
 packages/motor/src/types.ts                      |  34 ++
 packages/motor/tsconfig.json                     |   7 +-
 pnpm-lock.yaml                                   |   3 -
 tickets/MVP-13.md                                | 124 +++++-
 14 files changed, 978 insertions(+), 32 deletions(-)
```

- Solo `packages/motor/**`, `pnpm-lock.yaml` y `tickets/MVP-13.md`. ✔
- `pnpm-lock.yaml`: el único cambio es la baja de `zod` (3.25.76) del importer `packages/motor`. ✔
- Sin cambios en `packages/shared` ni en archivos compartidos. Ningún esquema Zod en `motor`: los tipos se componen desde `shared` (`Pick<Order,…>`, `TariffRule`, `PostalRouterEntry`, `Supplier`, `Tariff`, `QuoteAlternative['variante']`). ✔
- `src/schemas/`, `cotizacion/`, `tarifas/` y los tests `toBeDefined` eliminados; `decimal.js` se queda (`^10.4.3`, resuelve a 10.6.0, igual que `shared`). ✔
- Ticket: ver §8 (proceso).

## 3. Verificación (AGENTS.md §5.5) desde un clon limpio

Clon nuevo de la rama en el scratchpad, sin `dist/` previos (`find . -name dist` → 0), Node v26.10.0.

**`pnpm install --frozen-lockfile`**: OK.

**`pnpm format`** **reescribe dos archivos del autor**, así que lo commiteado no cumple Prettier:

```
packages/motor/src/candidatas.test.ts 99ms
packages/motor/src/candidatas.ts 33ms
== GIT STATUS AFTER FORMAT
 M packages/motor/src/candidatas.test.ts
 M packages/motor/src/candidatas.ts
```

**`pnpm format:check` sobre el commit tal cual (lo que corre CI):**

```
Checking formatting...
[warn] packages/motor/src/candidatas.test.ts
[warn] packages/motor/src/candidatas.ts
[warn] Code style issues found in 2 files. Run Prettier with --write to fix.
 ELIFECYCLE  Command failed with exit code 1.
```

**`pnpm ci:run`** (después de `pnpm format`, es decir, sobre un árbol que **no** es el commiteado):

```
> pnpm --filter @sistema-redespachos/shared build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
> tsc                                   (Build shared)
> eslint apps/web/src apps/functions packages --max-warnings 0
> prettier --check .
All matched files use Prettier code style!
packages/motor typecheck$ tsc --noEmit
packages/motor typecheck: Done
 ✓ packages/motor/src/candidatas.test.ts (18 tests)
 ✓ packages/motor/src/destino.test.ts (5 tests)
 Test Files  23 passed (23)
      Tests  512 passed (512)
packages/motor build$ tsc
packages/motor build: Done
EXIT=0
```

Resultado: **sobre el commit entregado, la secuencia falla en `format:check`** (H-1). Lint, typecheck, los 512 tests y el build pasan.

### Prueba de consumo (criterio 6)

Con `dist/` borrados, `pnpm --filter @sistema-redespachos/shared build` y `pnpm --filter @sistema-redespachos/motor build`:

- `packages/motor/dist`: `index`, `types`, `destino` y `candidatas` (`.js`, `.d.ts` y mapas). **0 archivos `*.test.*`.** ✔
- ESM: `export * from './types.js'`, `import { normProvincia, norm } from '@sistema-redespachos/shared'`. ✔
- Desde `packages/motor`, `node --input-type=module -e "import { seleccionarCandidatas } from '@sistema-redespachos/motor'; …"` **ejecuta** la función e imprime:

```json
{
  "canalizador": {
    "zona": "Z2000",
    "cabecera": "CAB2000",
    "subzona": "SIN COBERTURA",
    "zona_tarifario": "ZT",
    "cobertura_qx": "NO"
  },
  "provincia_origen": "BUENOS AIRES",
  "localidad_origen": "ORIGEN",
  "observaciones": [],
  "candidatas": [
    {
      "id_proveedor": "P1",
      "variante_id": "2000|ROSARIO|Z1",
      "tarifario_id": "T1",
      "variante": { "localidad": "ROSARIO", "zona": "Z1", "plazo_estimado_dias": null },
      "reglas_peso": ["PESO:BUENOS AIRES"],
      "reglas_volumen": ["VOLUMEN:*"]
    }
  ]
}
```

El consumo real funciona. La evidencia de la nota no lo prueba (H-5).

## 4. Auditoría adicional del motor: referencia independiente contra el motor

**Alcance de la comparación.** MVP-13 no calcula montos, así que los "2 casos de referencia" de §3.3 (que son de MVP-14) no aplican. Comparé la salida completa de los pasos 1 y 2: `canalizador`, origen, `observaciones` y, por candidata `(id_proveedor, variante_id)`, `tarifario_id`, `variante` y la identidad exacta de las reglas `PESO` y `VOLUMEN` elegidas. Lo hice sobre 34 casos nombrados de borde y 20.000 casos aleatorios (PRNG con semilla fija; CP repetidos, alias `CABA`/`CAPITAL FEDERAL`/`RIOJA`, tildes, `*`, reglas con y sin `localidad_origen`, proveedores `INACTIVO`, `HISTORICO`, los dos modos de `origen_estricto` y CP de origen ausente).

**Casos nombrados: 29/34 iguales.** Coinciden en: L1 > L2 > L3; L1 con localidad igual y provincia distinta; respaldo con `false` (1 provincia, 2 provincias, 2 grafías de la misma provincia); respaldo que no corre con `true`; origen desconocido (los dos modos, solo `*`); origen `CABA` contra regla `BUENOS AIRES`; origen `RIOJA` contra `LA RIOJA`; `PROVINCIA_DIFIERE`; alias de destino `RIOJA` y `CAPITAL FEDERAL`; CP de destino ausente (sigue por CP); `HISTORICO`; `BORRADOR`; los cuatro bordes de vigencia (desde, desde−1, hasta, hasta+1); `HISTORICO` y `VIGENTE` consecutivos; dos vigentes → `Error`; `INACTIVO`; dos proveedores con el mismo `variante_id`; `*` con localidad; L1 sin tramo que no cae a `*`; localidad de origen con tilde; respaldo que ignora reglas de otra localidad.

**Diferencias y su explicación:**

| Causa                                                                                         | Casos                                                                           | Explicación                                                    | ¿Hallazgo?                                  |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------- |
| El motor agrega `CP_NO_EN_CANALIZADOR` cuando falta el CP de **origen**                       | 2 nombrados; la mayoría de las diferencias de `observaciones` en los aleatorios | PREGUNTA 2, aceptada por Franco. Mi referencia no la tenía.    | No (decisión de Franco). Ver decisiones D-2 |
| CP de destino con varios registros y ninguno coincide: el motor toma el único de la provincia | 1 nombrado; diferencias de `canalizador`                                        | PREGUNTA 1, aceptada por Franco.                               | No. Falta test de la segunda rama (H-14)    |
| CP de **origen** con varios registros: el motor toma `entriesOrigen[0]`                       | 2 nombrados, ~19% de los aleatorios                                             | **El resultado depende del orden del canalizador** (ver abajo) | **Sí, H-9**                                 |
| Variante con reglas de distinta `provincia_destino`: el motor mira solo `grupo[0]`            | ~33% de los aleatorios (el generador las fuerza)                                | El resultado depende del orden de las reglas                   | Sí, H-11 (Menor)                            |

Evidencia de H-9: el mismo pedido y el mismo canalizador `{1000 LA PLATA BA, 1000 ORIGEN BA}`, con reglas `BA/ORIGEN` (L1) y `BA` (L2):

- orden (LA PLATA, ORIGEN) → origen `LA PLATA`, se elige el grupo **L2**;
- orden (ORIGEN, LA PLATA) → origen `ORIGEN`, se elige el grupo **L1**.

**Contraprueba:** excluyendo esas dos causas de datos (CP de origen con varios registros y variantes con provincia de destino inconsistente), 20.000 casos aleatorios dan **0 diferencias en `candidatas`**. Las únicas que quedan son `observaciones` (PREGUNTA 2) y `canalizador` (PREGUNTA 1):

```
Aleatorios (N=20000): { observaciones: 2879, IGUAL: 6047, excl_origen_multi: 3786,
  excl_prov_incons: 6668, canalizador: 2, 'canalizador,observaciones': 618 }
```

## 5. Criterios de aceptación

| #      | Criterio                                                                                             | Test del autor                                                                                                                  | ¿Falla si se rompe la regla? (mutación)                                              | Estado                       |
| ------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------- |
| §4     | Cada nivel de precedencia de origen                                                                  | `Test precedencia…` (L1 contra `*`), `origen_estricto=true, provincia coincide` (L2 contra `*`), `…provincia no coincide` (`*`) | **No** para L1 contra L2 (M1) ni para "con su provincia coincidente" (M2)            | ✘ H-3                        |
| §4     | `origen_estricto`                                                                                    | `…=true…` ×2, `…=false…` ×5                                                                                                     | Sí (M8, M10, M14, M15). **No** para "con origen desconocido aplica `*`" (M7)         | ◐ H-7                        |
| §4     | Vigencia según `fecha_referencia`                                                                    | `Test vigencia bordes`                                                                                                          | Sí para los bordes (M13). **No** para `HISTORICO` (M6)                               | ◐ H-8                        |
| §4     | CP con varias variantes (misma provincia y distintas)                                                | `Test CP con varias variantes…`                                                                                                 | Sí para el descarte de la otra provincia. **No** para `PROVINCIA_DIFIERE` (M3)       | ◐ H-6                        |
| §4     | CP ausente del canalizador                                                                           | `CP destino ausente…`, `Test CP ausente del canalizador`                                                                        | Sí (M17)                                                                             | ✔                            |
| §4     | Ausencia de caída a un grupo más general                                                             | `Test precedencia origen y ausencia de caída…`                                                                                  | Sí (M12)                                                                             | ✔                            |
| 1      | Vigencia en los bordes (desde, hasta, hasta+1)                                                       | `Test vigencia bordes`                                                                                                          | Sí (M13)                                                                             | ✔                            |
| 2      | Proveedor `INACTIVO`                                                                                 | `Test proveedor INACTIVO…`                                                                                                      | Sí (M11)                                                                             | ✔                            |
| 3      | Solo `_norm` (D33)                                                                                   | `Test el pedido usa solo los _norm`                                                                                             | Débil (H-12)                                                                         | ✔ con observación            |
| 4      | Alias `RIOJA`/`LA RIOJA`; `CABA` contra el canalizador; pedido `CABA` contra regla `CAPITAL FEDERAL` | `Test 4: alias… (CABA contra canalizador)`, `Test alias…CAPITAL FEDERAL`                                                        | **No hay test de `RIOJA`.** Los dos de CABA **no fallan** con el alias roto (M4, M5) | ✘ H-2                        |
| 5      | Determinismo: dos corridas + búsqueda en `src` sin `*.test.ts`                                       | `Determinismo: no hay Date.now…`                                                                                                | **No hay test de dos corridas.** La búsqueda solo lee dos archivos (M19)             | ✘ H-4                        |
| 6      | Consumo real                                                                                         | (nota)                                                                                                                          | Verificado por el auditor (§3)                                                       | ✔ código / ✘ evidencia (H-5) |
| 7      | §5.5 en verde con la salida pegada                                                                   | (nota)                                                                                                                          | `format:check` falla                                                                 | ✘ H-1, H-5                   |
| 8      | Fixtures por `.parse()` de `shared`                                                                  | `createCanalizador/Proveedor/Tarifario/Regla`, `orderSchema.parse`                                                              | Sí                                                                                   | ✔                            |
| D5     | Dos tarifarios vigentes → `Error` con proveedor y fecha                                              | `Falla si hay dos tarifarios vigentes`                                                                                          | Sí (M16)                                                                             | ✔                            |
| Alc. 5 | Clave `(id_proveedor, variante_id)`                                                                  | `Dos proveedores con el mismo variante_id…`                                                                                     | Sí (M9)                                                                              | ✔                            |

### Mutaciones (en el clon, una por vez, restaurando después; `vitest run packages/motor`)

```
SOBREVIVE  | M1 L2 antes que L1 (localidad no gana a provincia)        | 23 passed (23)
SOBREVIVE  | M2 L1 sin exigir provincia coincidente                     | 23 passed (23)
SOBREVIVE  | M3 sin PROVINCIA_DIFIERE                                   | 23 passed (23)
SOBREVIVE  | M4 provincia destino de reglas sin alias (norm)            | 23 passed (23)
SOBREVIVE  | M5 provincia del canalizador destino sin alias (norm)      | 23 passed (23)
SOBREVIVE  | M6 HISTORICO excluido                                      | 23 passed (23)
SOBREVIVE  | M7 nivel * exige origen conocido                           | 23 passed (23)
DETECTADA  | M8 respaldo corre con origen desconocido                   | 1 failed | 22 passed (23)
DETECTADA  | M9 clave solo variante_id                                  | 1 failed | 22 passed (23)
DETECTADA  | M10 respaldo con varias provincias                         | 1 failed | 22 passed (23)
DETECTADA  | M11 sin filtro ACTIVO                                      | 1 failed | 22 passed (23)
DETECTADA  | M12 cae al grupo general (L1 + *)                          | 1 failed | 22 passed (23)
DETECTADA  | M13 vigencia_hasta exclusiva                               | 1 failed | 22 passed (23)
DETECTADA  | M14 respaldo con estricto=true                             | 1 failed | 22 passed (23)
DETECTADA  | M15 respaldo toma reglas con localidad de otra             | 2 failed | 21 passed (23)
DETECTADA  | M16 dos tarifarios: toma el último en vez de Error         | 1 failed | 22 passed (23)
DETECTADA  | M17 CP destino ausente sin observación                     | 1 failed | 22 passed (23)
DETECTADA  | M18 orden aleatorio de candidatas                          | 1 failed (por azar: depende del orden sorteado)
SOBREVIVE  | M19 new Date()/Date.now() en un archivo nuevo de src       | 23 passed (23)
```

## 6. Hallazgos

| #    | Severidad                                                                                                                                                                                                                      | Dónde                                                                            | Qué pasa                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Evidencia                                                                                                                                                    | Sugerencia                                                                                                                                                                                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-1  | **Bloqueante**: incumple el criterio 7 y AGENTS §6 (secuencia §5.5 en verde); CI falla                                                                                                                                         | `packages/motor/src/candidatas.ts:95`, `candidatas.test.ts:424-429` y `:455-460` | El código commiteado no cumple Prettier y `pnpm format:check` falla, así que `ci:run` (y CI) se cortan antes de typecheck y tests. El autor no corrió `pnpm format` sobre su último commit (`89cdf16`).                                                                                                                                                                                                                                                                                                                                                      | §3: `Code style issues found in 2 files` / `ELIFECYCLE … exit code 1`                                                                                        | `pnpm format`, commitear y volver a correr `pnpm ci:run` completo.                                                                                                                                                                                                                                   |
| H-2  | **Bloqueante**: incumple el criterio 4 (un punto sin test que lo pruebe cuenta como no cumplido)                                                                                                                               | `destino.test.ts:107`, `candidatas.test.ts:295`                                  | (a) No hay ningún test del alias `RIOJA`/`LA RIOJA` (`grep RIOJA src/*.test.ts` → 0). (b) `CABA contra canalizador`: el canalizador tiene un solo registro para el CP, así que se toma "el único" aunque el alias falle. (c) `pedido CABA contra regla CAPITAL FEDERAL`: hay una sola variante, que se conserva igual por la rama `PROVINCIA_DIFIERE`. El test no verifica la observación.                                                                                                                                                                   | M4 y M5 sobreviven (§5)                                                                                                                                      | (a) Test de `RIOJA` (en el pedido y en la regla). (b) Canalizador con dos registros del CP (`CAPITAL FEDERAL` y otra provincia) y verificación del elegido. (c) Agregar una variante de otra provincia y `expect(observaciones).not.toContain('PROVINCIA_DIFIERE')` con una sola candidata `RETIRO`. |
| H-3  | **Bloqueante**: incumple el criterio de §4 (`docs/arquitectura-v3.md:504`, "Tests por cada nivel de precedencia de origen") y la decisión 3 ("localidad de origen (con su provincia coincidente) → provincia de origen → `*`") | `candidatas.test.ts:161-208`; código en `candidatas.ts:71-91`                    | Ningún test enfrenta L1 con L2: invertir el orden pasa los 23 tests. Ningún test prueba que una regla con la localidad de origen correcta y **otra provincia** no entre en L1. La tabla de la nota asigna "cada nivel" a un único test (L1 contra `*`).                                                                                                                                                                                                                                                                                                      | M1 y M2 sobreviven                                                                                                                                           | Un test con L1 + L2 + `*` que espere L1; uno con L2 + `*` (ya está); uno con regla `CORDOBA/ORIGEN` + L2 que espere L2.                                                                                                                                                                              |
| H-4  | **Bloqueante**: incumple el criterio 5                                                                                                                                                                                         | `candidatas.test.ts:329-337`                                                     | No hay test de "dos corridas con la misma entrada dan el mismo resultado". La búsqueda de `Date.now`/`new Date` lee solo `destino.ts` y `candidatas.ts` por nombre, no todo `src` excluyendo `*.test.ts`: un archivo nuevo con `new Date()` pasa.                                                                                                                                                                                                                                                                                                            | M19 sobrevive. M18 (orden aleatorio) solo se detecta por azar                                                                                                | Recorrer `src/**/*.ts` sin `*.test.ts`. Agregar un test que corra dos veces `seleccionarCandidatas` sobre una entrada con varias candidatas y compare con `toStrictEqual`.                                                                                                                           |
| H-5  | **Bloqueante**: los criterios 6 y 7 exigen la evidencia ("imprimiendo el resultado", "con la salida pegada"); AGENTS §6 ("Nunca afirmes 'pasa' sin haberlo corrido")                                                           | `tickets/MVP-13.md`, Nota de entrega (en todas sus versiones)                    | (a) La salida pegada está recortada (`...`) y no muestra lint ni `format:check`, que en el commit entregado falla. (b) Los conteos nunca coinciden con el commit al que acompañan (ver §7). (c) El commit citado (`74fcbb7`, y luego "`e4b2c65` (y posteriores correcciones)") no es el entregado (`89cdf16`). (d) La prueba de consumo imprime `Motor cargado function`, o sea, importa pero **no ejecuta** `seleccionarCandidatas`. (e) Faltan campos de la plantilla: "Fuera de alcance" con su ticket, "Supuestos", "Archivos tocados", "Cómo probarlo". | §3, §7 y el historial de `git log -p tickets/MVP-13.md`                                                                                                      | Reemplazar la nota por la plantilla completa, con la salida íntegra de `pnpm install --frozen-lockfile && pnpm format && pnpm ci:run` sobre el commit final, el hash final y el `node -e` que ejecuta e imprime.                                                                                     |
| H-6  | **Mayor**: caso borde probable (CP cuyas variantes son todas de otra provincia), regla de `docs/arquitectura-v3.md:335` y decisión 6 sin test                                                                                  | `candidatas.ts:56-59`                                                            | Ningún test verifica que, si ninguna variante coincide, se conservan todas y se agrega `PROVINCIA_DIFIERE` una sola vez. Solo hay un `not.toContain`.                                                                                                                                                                                                                                                                                                                                                                                                        | M3 sobrevive. El comportamiento es correcto (§4, caso "PROVINCIA_DIFIERE")                                                                                   | Test con dos variantes de provincias distintas a la del pedido (y de dos proveedores): `candidatas.length === 2` y `observaciones` con exactamente un `PROVINCIA_DIFIERE`.                                                                                                                           |
| H-7  | **Mayor**: caso borde probable (CP de origen ausente, PREGUNTA 2), decisión 3 sin test en su rama positiva                                                                                                                     | `candidatas.test.ts:453-462`; `candidatas.ts:89-91`                              | El test "CP desconocido solo aplica `*`" no tiene ninguna regla `*`: prueba que no se toma la de BA, pero no que se tome la `*`. Tampoco hay test con `origen_estricto=true` y origen desconocido.                                                                                                                                                                                                                                                                                                                                                           | M7 sobrevive (exigir origen conocido para `*` deja sin reglas a todo pedido con origen desconocido y no falla ningún test)                                   | Agregar una regla `*` al test y esperar exactamente esa. Repetirlo con `true`.                                                                                                                                                                                                                       |
| H-8  | **Mayor**: caso borde probable (re-cotizar un lote con fecha anterior al tarifario vigente); `docs/arquitectura-v3.md:171` ("El motor usa los tarifarios `VIGENTE` e `HISTORICO`…") y D10                                      | `candidatas.ts:21`; `candidatas.test.ts:211`                                     | Los bordes de vigencia se prueban solo con tarifarios `VIGENTE`. Excluir `HISTORICO` pasa todos los tests. Tampoco se prueba que `BORRADOR` quede afuera.                                                                                                                                                                                                                                                                                                                                                                                                    | M6 sobrevive. El comportamiento es correcto (§4)                                                                                                             | Test con `HISTORICO` (`vigencia_hasta` cerrada) que contiene la fecha, más el par `HISTORICO`→`VIGENTE` consecutivo con `fecha = vigencia_desde` del nuevo. Test de `BORRADOR`.                                                                                                                      |
| H-9  | **Mayor**: caso borde probable; los CP se repiten para varias localidades (D24, `docs/arquitectura-v3.md:73`) y el origen elige el grupo de reglas                                                                             | `destino.ts:66-69`                                                               | Con varios registros para el CP de origen se toma `entriesOrigen[0]`: la localidad (y hasta la provincia) de origen, y por lo tanto el grupo L1 o L2, depende del orden del arreglo `canalizador`, que viene de una consulta de Firestore. Es un supuesto de negocio que no pasó por PREGUNTAS. La nota lo justifica con "todos suelen compartir provincia y localidad", y eso contradice D24.                                                                                                                                                               | §4: mismo pedido y mismo canalizador en dos órdenes → L2 en un caso y L1 en el otro                                                                          | Que decida Franco (D-1). Mientras tanto, una regla determinística e independiente del orden (por ejemplo: provincia si todos los registros coinciden, localidad solo si es única; si no, desconocida) y un test con dos registros en ambos órdenes.                                                  |
| H-10 | **Mayor**: caso borde probable (un test con error de tipos pasa CI); regresión respecto de `main`                                                                                                                              | `packages/motor/tsconfig.json:12`                                                | Para que los tests no vayan a `dist`, se excluyó `src/**/*.test.ts` del **único** tsconfig, que también usa `typecheck` (`tsc --noEmit`). Los tests del motor dejaron de tener chequeo de tipos (Vitest no lo hace). En `main` el `exclude` era `["node_modules", "dist"]`.                                                                                                                                                                                                                                                                                  | Agregar `const errorDeTipo: number = 'no soy un número'` a `destino.test.ts` → `pnpm typecheck` termina en verde. `tsc --listFilesOnly` → 0 archivos de test | `tsconfig.build.json` (con el `exclude` de tests) para `build`, y `tsconfig.json` con los tests para `typecheck`.                                                                                                                                                                                    |
| H-11 | Menor: no es un caso probable (exige reglas con el mismo `variante_id` y distinta `provincia_destino`, algo que el esquema permite pero el importador no debería generar); no llega a Mayor                                    | `candidatas.ts:52`                                                               | El filtro de provincia mira solo `grupo[0].provincia_destino`, así que con datos inconsistentes el resultado depende del orden de las reglas.                                                                                                                                                                                                                                                                                                                                                                                                                | §4: 2 ejemplos aleatorios con `candidatas` distintas                                                                                                         | Decidir el criterio (`some` / `every` / rechazar en MVP-11) y documentarlo (D-4).                                                                                                                                                                                                                    |
| H-12 | Menor (claridad del test)                                                                                                                                                                                                      | `candidatas.test.ts:264-293`                                                     | El test de D33 inyecta los crudos con `as unknown as` sobre una entrada que no los tiene y compara solo `candidatas`, no `canalizador` ni `observaciones`.                                                                                                                                                                                                                                                                                                                                                                                                   | Lectura                                                                                                                                                      | Construir dos pedidos con `orderSchema.parse` que difieran en los crudos (dentro de lo que permite el esquema) y comparar la salida completa.                                                                                                                                                        |
| H-13 | Menor (claridad)                                                                                                                                                                                                               | `candidatas.test.ts:161-162`                                                     | El título y el comentario ("Si origen_estricto=false, precedencia es localidad -> *") describen la versión anterior de la decisión 3.                                                                                                                                                                                                                                                                                                                                                                                                                        | Lectura                                                                                                                                                      | Actualizarlos.                                                                                                                                                                                                                                                                                       |
| H-14 | Menor: la regla aceptada en PREGUNTA 1 funciona (§4), solo falta su test                                                                                                                                                       | `destino.ts:38-48`; `destino.test.ts:76`                                         | Se prueba "se toma el único de la provincia", pero no la segunda rama (varios de la provincia o ninguno → `DESCONOCIDA` **sin** `CP_NO_EN_CANALIZADOR`).                                                                                                                                                                                                                                                                                                                                                                                                     | Lectura + §4 (caso "ninguno coincide provincia": IGUAL)                                                                                                      | Agregar el test.                                                                                                                                                                                                                                                                                     |

## 7. Contraste con la Nota de entrega

**Conteo de tests.** Mi corrida da **512 passed** (23 archivos: 23 tests de motor + 489 del resto). El historial de `tickets/MVP-13.md` muestra:

| Commit                             | Tests de motor en ese commit | Total real | Nota pegada en ese commit         |
| ---------------------------------- | ---------------------------- | ---------- | --------------------------------- |
| `cf8e6a3` (nota de `74fcbb7`)      | 16                           | 505        | 505 ✔                             |
| `e4b2c65` (+4 tests)               | 20                           | 509        | **505** ✘                         |
| `89cdf16` (+3 tests)               | 23                           | 512        | **509** ✘                         |
| `176060e` (restauración de Franco) | 23                           | 512        | 505 (vuelve la nota de `cf8e6a3`) |

Las dos entregas que agregaron tests dejaron sin actualizar el número de la entrega anterior: la salida pegada **no viene de una corrida sobre el commit entregado**. (El encargo de auditoría menciona "509 dos veces"; en git, el número que se repite en dos entregas consecutivas es 505, y 509 aparece en la siguiente, donde el real es 512. En los dos casos la conclusión es la misma.) Ver H-5.

**Otras afirmaciones de la nota:**

- "Secuencia en verde": falsa para el commit entregado (H-1).
- Tabla de criterios: asigna "cada nivel de precedencia" y "alias" a tests que no fallan si se rompe la regla (H-2, H-3). No mapea el criterio 5 completo (H-4), el criterio 8 ni `HISTORICO`.
- "Riesgos/Decisiones": el origen con varios registros se declara, pero como decisión tomada sin consultar (H-9).
- Falta "Fuera de alcance" con ticket de destino (MVP-14 por los tramos; MVP-18 por `solicitudes_cp`).

**La nota que hoy está en HEAD es la de `cf8e6a3`** (commit `74fcbb7`, 505). El commit de restauración `176060e` también revirtió la Nota de entrega a esa versión. Ver D-6.

## 8. Proceso (observación)

Por indicación de Franco, el autor sobrescribió en dos ocasiones secciones del ticket que no son Plan ni Nota de entrega, prohibido por "Archivos prohibidos" ("no se reescriben las secciones que no son Plan ni Nota de entrega"), y Franco las restauró. Lo que se ve en git es coherente con eso:

- En `89cdf16` el autor commitea el **código** de la decisión 3 corregida (respaldo de otra provincia con `false`, origen desconocido solo `*`). Sin embargo, en ese mismo commit el ticket conserva el **texto anterior** de la decisión 3 y de la respuesta a PREGUNTA 2, y además vacía su propio Plan, reemplazándolo por el marcador de la plantilla. Franco repone las tres cosas en `176060e` ("restaurar decisión 3, PREGUNTA 2 y Plan"). Es decir, la versión corregida que el autor implementó existía en el árbol de trabajo y su commit la pisó.
- "Intentos anteriores (descartados)" registra otro intento con "este ticket sobrescrito".

No es un hallazgo sobre el código. Se registra como reincidencia de proceso. Sugerencia: que el autor edite el ticket solo con cambios acotados a `## Plan` y `## Nota de entrega`, y que Franco rechace cualquier diff de `tickets/MVP-XX.md` con hunks fuera de esas secciones.

## 9. Decisiones para Franco

**Supuestos de negocio del autor y huecos de contrato**

Respuestas de Franco del 06/10, registradas por el auditor.

- **D-1 (H-9):** CP de origen con varios registros en el canalizador. ¿Qué localidad y provincia de origen se usan?
  - **Respuesta de Franco:** se acepta la propuesta, leyendo de mayor a menor: tiene que coincidir el código postal, después la localidad y después la provincia. Si no coincide, se marca un aviso para revisar el canalizador. Franco aclara que el archivo real de pedidos **sí trae la localidad del remitente**.
  - **Lo que encontró el auditor** en el archivo real (`Pedidos sin cobertura 6-10.xlsx`, fuera del repo; solo encabezados y conteos): trae `Cod Postal Remitente`, `Localidad Remitente`, `Provincia Rtte` y `Zona Remitente`. Sobre la hoja `Canalizador` del mismo archivo: 3.469 registros con dato (más 3.164 filas vacías), un registro por CP. Los 6 CP de remitente y los 9 de destinatario de los 24 pedidos están en el canalizador y tienen un único registro. En esta muestra el caso de H-9 no aparece; sigue siendo una cuestión de robustez.
  - **Pendiente, bloquea H-9:** hoy `orderImportSchema` y `TMS_COLUMNS` (`packages/shared`, D37) no tienen un campo de localidad ni de provincia del remitente: el motor recibe solo `codigo_postal_origen`. Para que la localidad del remitente desempate hace falta un `CR: shared` (campo de importación + `_norm`, como D33 para el destino) y su reflejo en la arquitectura §2.4. Falta definir también con qué código va el aviso: `OBSERVATION_CODES` es cerrado, así que un código propio es otro `CR: shared`. Mientras tanto, el autor puede implementar la regla solo con el CP (provincia si todos los registros coinciden, localidad si es única; si no, desconocida y solo `*`).
- **D-2:** `CP_NO_EN_CANALIZADOR` por CP de **origen** (PREGUNTA 2) no dice qué CP falta, y MVP-18 crea las `solicitudes_cp` a partir de esa observación.
  - **Respuesta de Franco:** si conviene, el motor devuelve los CP faltantes para poder identificar los errores.
  - **Derivado por Franco (06/10) a MVP-18:** no se hace en MVP-13. Cuando se haga, va como salida interna de `seleccionarCandidatas` (la lista de CP faltantes, indicando si cada uno es de origen o de destino), sin tocar `shared`.
- **D-3:** las reglas llegan al contexto como `TariffRule[]`, sin el id del documento, y MVP-14 tiene que llenar `cotizacion.regla_peso_id` / `regla_volumen_id` (`quoteSchema`).
  - **Respuesta de Franco:** reglas con id, `Array<{ id: string } & TariffRule>`, igual que los tarifarios (decisión 4).
  - **Para el autor (Franco, 06/10: se hace ahora):** en la corrección de MVP-13, con test de que las reglas elegidas conservan su `id`.
- **H-9, derivado por Franco (06/10) al CR-07:** el motor sigue tomando el primer registro del CP de origen. En el archivo real hay un solo registro por CP (D-1), y el CR-07 rediseña la resolución del origen (CP → localidad → provincia, con los campos del remitente). El autor no lo corrige: lo declara en "Fuera de alcance" de su nota, con destino CR-07.
- **D-4 (H-11):** reglas con el mismo `variante_id` y distinta `provincia_destino`.
  - **Respuesta de Franco:** que lo controle el importador. Es el de **tarifarios** (MVP-11), que valida las filas del Excel maestro.
  - **Efecto:** H-11 no requiere cambio en el motor. Queda un `CR` sobre `docs/arquitectura-v3.md` §2.3 ("Validaciones al guardar y al publicar") para sumar la regla, y anotarlo en MVP-11.
- **D-5:** plazo de entrega distinto entre las filas de una misma variante.
  - **Respuesta de Franco:** rechazarlo al importar, mismo criterio que D-4.
  - **Efecto:** el motor sigue tomando la `variante` de la primera regla. Mismo `CR` de §2.3 y mismo destino (MVP-11).
- **D-6:** solo informativo, sin acción. El commit de restauración `176060e` dejó en HEAD la Nota de entrega de `cf8e6a3`, que cita `74fcbb7` y 505 tests. No hay nada que revertir: el autor rehace la nota igual (H-5).
- **D-7 (nuevo, fuera del alcance de MVP-13):** los encabezados del archivo real (58 columnas: `Cod Postal Remitente:`, `Localidad Remitente:`, `Cod Postal Destinatario:`, `COBERTURA`, etc.) **no coinciden** con `TMS_COLUMNS` (47 columnas, con `Código Postal Origen`, `Zona Origen`, `Cabecera Origen`). Si ese es el formato que se va a importar, el parser de MVP-04 lo rechazaría por encabezados faltantes. Si es otro reporte (por ejemplo, uno de pedidos sin cobertura), no aplica. Franco confirma cuál es el formato de importación; si es este, va un `CR: shared` sobre D37.
  - **Respuesta de Franco:** es el archivo que se va a usar para importar los pedidos. Hay que adaptar el importador.
  - **Comparación del auditor** (contra las 12 columnas obligatorias de `TMS_COLUMNS`, `packages/shared/src/tms/headers.ts`; solo encabezados):
    - **Coinciden por nombre:** `Nro Pedido`, `Peso Kgs`, `Volumen M3`, `Localidad`, `Provincia`.
    - **Con otro nombre (equivalencia a confirmar):** `Cantidad de Bultos` ↔ `Bultos:`; `Código Postal Origen` ↔ `Cod Postal Remitente:`; `Zona Origen` ↔ `Zona Remitente:`; `Fecha de Interfaz` ↔ ¿`Fecha de recepcion:`?
    - **Sin equivalente visible:** `Peso Aforado` y `Cabecera Origen`. Esta última es obligatoria y se valida contra las sucursales permitidas.
    - **Destino duplicado:** el archivo trae `Cod Postal:` / `Localidad:` / `Provincia:` y también `Cod Postal Destinatario:` / `Localidad Destinatario:` / `Provincia Destinatario:` (además de `Destino:`). Hay que definir cuál es el destino de entrega.
    - **Columnas nuevas** que el modelo no tiene: `Localidad Remitente:` y `Provincia Rtte` (ver D-1), y `COBERTURA`.
  - **Siguiente paso, fuera de este ticket:** un `CR: shared — formato de importación de pedidos (D37)`, que aprueba Franco. **Borrador redactado en `tickets/CR-07-formato-importacion-pedidos.md`** (06/10, pendiente de respuestas y aprobación). Ese CR responde las preguntas de arriba, ajusta `TMS_COLUMNS`, `orderImportSchema` y el fixture sintético, suma los campos del remitente que pide D-1 y actualiza la arquitectura §2.4 y §7.4. Afecta a MVP-04 (cerrado) y a quien implemente la importación; MVP-13 no cambia, salvo el desempate de D-1.
  - **Pedido de Franco, fuera de este ticket:** comparar los CP del archivo con los que los proveedores declaran cubrir (salida de `herramientas-tarifas`). Va en una tarea aparte, con datos reales fuera del repo y salida solo de conteos.

**CR sobre la arquitectura** (lo que el autor hizo está permitido por el ticket, de mayor jerarquía, pero el documento quedó desactualizado)

- **CR-a:** `docs/arquitectura-v3.md:335` dice "Con `false`, se ignora la provincia de origen y solo cuenta `*` y la localidad". La decisión 3 del 06/10 lo reemplaza (misma precedencia en los dos modos más el respaldo de una única otra provincia). Actualizar §3.3 paso 2.
- **CR-b:** `docs/arquitectura-v3.md:334` (paso 1) no cubre "varios registros y ninguno coincide" (PREGUNTA 1) ni "CP de origen ausente" y su observación (PREGUNTA 2). Incorporar las dos respuestas.
- **CR-c:** `docs/arquitectura-v3.md:335`: "una regla sin provincia de origen informada se toma como Buenos Aires" ya no es del motor (lo completa el importador, según "Decisiones ya tomadas"). Aclararlo en §3.3.

## 10. Veredicto

**RECHAZADO.**

Para pasar a aprobado, el autor tiene que corregir H-1 a H-5 (Bloqueantes), H-6, H-7, H-8 y H-10 (Mayores) y D-3, y responder cada hallazgo en su ticket. Por decisión de Franco del 06/10, se derivan H-9 (al CR-07) y D-2 (a MVP-18). H-11 no requiere cambio en el motor (D-4). Los Menores (H-11 a H-14) pueden ir en la misma corrección o quedar como deuda declarada. Según `docs/auditoria-cruzada.md`, el ticket no se cierra hasta la sección `## Verificación de correcciones` con el veredicto final.

## Verificación de correcciones

- **Commit verificado:** `bb92da9` ("fix(motor): correcciones de auditoria H-1 a H-10 y D-3"), sobre `176060e`.
- **Fecha:** 06/10/2026. Por pedido de Franco, se hizo en la misma conversación de la auditoría y no en una nueva, como pide `docs/auditoria-cruzada.md`.
- **Método:** clon limpio de la rama, sin `dist/` previos. Corrí la secuencia §5.5 sobre el commit tal cual (sin `pnpm format` antes), las mismas mutaciones de §5 más una para D-3, la comparación diferencial de §4 y la prueba de consumo.

### Verificación (salida real)

```
EXIT format:check=0                 (sobre el commit, sin formatear antes)
> pnpm --filter @sistema-redespachos/shared build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
All matched files use Prettier code style!
packages/motor typecheck$ tsc --noEmit
packages/motor typecheck: Done
 ✓ packages/motor/src/candidatas.test.ts (27 tests)
 ✓ packages/motor/src/destino.test.ts (7 tests)
 Test Files  23 passed (23)
      Tests  523 passed (523)
packages/motor build$ tsc -p tsconfig.build.json
packages/motor build: Done
EXIT ci:run=0
```

- **`dist/` de motor:** 16 archivos, 0 tests.
- **Consumo con Node:** ejecuta `seleccionarCandidatas` e imprime `{"cobertura":"SI","candidatas":[{"k":"P1#2000|ROSARIO|Z1","peso":["R-PESO-1"]}]}`; el `id` de la regla se conserva (D-3).
- **H-10:** un error de tipos agregado a `destino.test.ts` ahora hace fallar `tsc --noEmit` (1 error), cosa que antes no pasaba.
- **Comparación diferencial:** la misma distribución que en la auditoría original, con la misma semilla. El comportamiento del motor no cambió: `candidatas.ts` solo recibió el formato de Prettier.

### Mutaciones (34 tests de motor; sin mutación: 34 passed)

```
DETECTADA  | M1 L2 antes que L1                        | Test precedencia: L1 vs L2 vs *
DETECTADA  | M2 L1 sin exigir provincia coincidente    | Test precedencia: … OTRA provincia vs L2
DETECTADA  | M3 sin PROVINCIA_DIFIERE                  | Test PROVINCIA_DIFIERE: dos variantes de otra provincia
DETECTADA  | M4 provincia destino de reglas sin alias  | Test alias … RIOJA ; Test alias CABA … con variante extra
SOBREVIVE  | M5 alias solo en la coincidencia exacta   | 34 passed (ver H-2)
DETECTADA  | M6 HISTORICO excluido                     | Test vigencia: HISTORICO y BORRADOR
DETECTADA  | M7 nivel * exige origen conocido          | Test origen desconocido con regla * (H-7)
DETECTADA  | M8 a M17                                  | los mismos tests que en la auditoría original
SOBREVIVE  | M18 orden aleatorio de candidatas         | 34 passed (ver H-4)
DETECTADA  | M19 new Date() en un archivo nuevo de src | Determinismo: no hay Date.now ni new Date en src
DETECTADA  | M20 reglas sin id (D-3)                   | Test id en reglas (D-3) y otros 3
```

### Estado de cada hallazgo

| #    | Estado                    | Evidencia                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-1  | **RESUELTO**              | `format:check` en verde sobre el commit.                                                                                                                                                                                                                                                                                                                                                                            |
| H-2  | **RESUELTO**              | Tests de RIOJA (en reglas y en canalizador) y de CABA (en reglas con una variante extra, y en canalizador con dos registros). M4 detectada. M5 sobrevive porque, al fallar la coincidencia exacta, la rama de PREGUNTA 1 (único de la provincia) también aplica el alias y llega al mismo registro. No se rompe ninguna regla: queda como observación Menor.                                                        |
| H-3  | **RESUELTO**              | M1 y M2 detectadas.                                                                                                                                                                                                                                                                                                                                                                                                 |
| H-4  | **NO RESUELTO (parcial)** | (b) Resuelto: la búsqueda recorre todo `src` y M19 se detecta. (a) El test "dos corridas con misma entrada" (`candidatas.test.ts:538`) usa dos reglas de la **misma** variante, o sea **una sola candidata**: no puede detectar un cambio de orden (M18 sobrevive). El pedido de correcciones pedía "varias candidatas".                                                                                            |
| H-5  | **NO RESUELTO**           | La nota nueva (a) **afirma "en verde"**, pero la salida que pega muestra `packages/motor typecheck: Failed … exit code 2`, con 6 errores TS2322/TS2345; (b) cita el commit `176060e` y no `bb92da9`; (c) la prueba de consumo dice "ejecuté exitosamente", sin comando completo ni salida; (d) no tiene tabla criterio → test. Mi corrida sobre `bb92da9` sí da verde: la salida pegada es de una corrida anterior. |
| H-6  | **RESUELTO**              | M3 detectada.                                                                                                                                                                                                                                                                                                                                                                                                       |
| H-7  | **RESUELTO**              | M7 detectada (nuevo test con regla `*`, en los dos modos).                                                                                                                                                                                                                                                                                                                                                          |
| H-8  | **RESUELTO**              | M6 detectada (HISTORICO, HISTORICO→VIGENTE y BORRADOR).                                                                                                                                                                                                                                                                                                                                                             |
| H-9  | **ACEPTADO POR FRANCO**   | Derivado al CR-07 (06/10). Declarado en "Fuera de alcance".                                                                                                                                                                                                                                                                                                                                                         |
| H-10 | **RESUELTO**, con N-2     | `tsconfig.build.json` para el build y tests incluidos en el typecheck: verificado. Ver N-2.                                                                                                                                                                                                                                                                                                                         |
| H-11 | **ACEPTADO POR FRANCO**   | D-4: lo controla el importador de tarifarios (MVP-11).                                                                                                                                                                                                                                                                                                                                                              |
| H-12 | Deuda declarada (Menor)   | Aceptable. La nota dice que "queda pendiente para que el auditor agregue casos": el auditor no escribe tests del autor.                                                                                                                                                                                                                                                                                             |
| H-13 | **RESUELTO**              | Título y comentario del test de precedencia actualizados.                                                                                                                                                                                                                                                                                                                                                           |
| H-14 | **RESUELTO**              | Test "CP con varios registros, ninguno coincide provincia y hay varios → DESCONOCIDA".                                                                                                                                                                                                                                                                                                                              |
| D-2  | **ACEPTADO POR FRANCO**   | Derivado a MVP-18.                                                                                                                                                                                                                                                                                                                                                                                                  |
| D-3  | **RESUELTO**              | `types.ts`: `reglas: Array<{ id: string } & TariffRule>`; las reglas elegidas conservan su `id`. M20 detectada.                                                                                                                                                                                                                                                                                                     |

### Hallazgos nuevos

| #   | Severidad                                                                                                                                                                               | Dónde                                                   | Qué pasa                                                                                                                                                                                                                                                                                                                                            | Evidencia                                                                                                                                      | Sugerencia                                                                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N-1 | **Bloqueante**: incumple "Archivos prohibidos" del ticket ("no se reescriben las secciones que no son Plan ni Nota de entrega") y el alcance (checklist punto 5). Es la **tercera vez** | `tickets/MVP-13.md`                                     | El commit **borra** las secciones `## PREGUNTAS` (con las respuestas de Franco a las preguntas 1 y 2) e `## Intentos anteriores (descartados)`, y también el encabezado `## Nota de entrega`. La nota nueva quedó pegada a la última línea del "Plan de correcciones". Además, el archivo quedó con finales de línea mezclados (CRLF y CR sueltos). | Las secciones fuera de Plan y Nota de entrega, entre `176060e` y `bb92da9`, difieren solo en el bloque eliminado (líneas 61 a 72 de `176060e`) | Restaurar desde `176060e` el texto exacto de `## PREGUNTAS` e `## Intentos anteriores`, reponer el encabezado `## Nota de entrega` y dejar el archivo en LF. Sugerencia para Franco: que lo haga él, como las dos veces anteriores. |
| N-2 | **Mayor**: caso borde probable; un cambio del contrato del motor (como D-3) pasa el typecheck de los tests sin aviso. Le quita a H-10 su propósito                                      | `packages/motor/src/candidatas.test.ts:1` y 24 `as any` | Para que el typecheck pasara, se desactivó `@typescript-eslint/no-explicit-any` en todo el archivo y se agregaron 24 `as any` (antes había 1): `createTarifario` devuelve `as any` y los contextos se pasan con `ctx as any`. Los errores TS2322/TS2345 que muestra la nota venían de `id: overrides.id                                             |                                                                                                                                                | 'TAR1'`, cuyo tipo es `{}`.                                                                                                                                                                                                         | `grep -c "as any"` → 24; la línea 1 tiene `eslint-disable` | Tipar los fixtures (`id: String(overrides.id ?? 'TAR1')`, con retorno `{ id: string } & Tariff` / `{ id: string } & TariffRule`), sacar los `as any` de los contextos y el `eslint-disable`. |

### Veredicto final

**RECHAZADO.**

El código del motor está bien: la lógica no cambió y se sigue comparando igual con la referencia independiente. Las reglas tienen tests que fallan si se rompen (19 de 21 mutaciones detectadas), y la secuencia §5.5 da verde sobre `bb92da9`. Lo que falta es acotado:

1. **H-4(a):** que el test de dos corridas tenga al menos dos candidatas (por ejemplo, dos proveedores o dos variantes).
2. **N-2:** fixtures tipados, sin `as any` ni `eslint-disable`.
3. **H-5:** una nota de entrega con la salida real del commit final, su hash, el comando de consumo con su salida y la tabla criterio → test.
4. ~~**N-1:** restaurar las secciones borradas del ticket.~~ **RESUELTO** en `688a75d` por el auditor, con autorización de Franco (06/10). Se repusieron `## PREGUNTAS` e `## Intentos anteriores (descartados)` con el texto exacto de `176060e`, se volvió a poner el encabezado `## Nota de entrega` y se reparó la última línea del Plan de correcciones. El archivo queda en LF. Verificado: las secciones fuera de Plan y Nota de entrega son idénticas a `176060e`, y no cambió nada visible de la nota del autor (solo se quitaron los CR sueltos de la salida pegada).

Con los puntos 1 a 3, una nueva verificación de correcciones puede cerrar con `APROBADO`.

### Segunda ronda: `b3576c5`

- **Commit verificado:** `b3576c5` ("fix(motor): correcciones finales de auditoria N-2 y H-4(a)"), sobre `688a75d`. Toca `packages/motor/src/candidatas.test.ts` y `tickets/MVP-13.md`.
- **Verificación en un clon limpio, sobre el commit tal cual:**

```
EXIT format:check=0
> eslint apps/web/src apps/functions packages --max-warnings 0
packages/motor typecheck$ tsc --noEmit
packages/motor typecheck: Done
 Test Files  23 passed (23)
      Tests  523 passed (523)
packages/motor build$ tsc -p tsconfig.build.json
packages/motor build: Done
EXIT ci:run=0
```

- **Mutaciones:** M1 a M4, M6 a M17 y M20 detectadas. **M18 sigue sobreviviendo:** en una corrida la detectó por azar otro test (que mira `candidatas[0]`) y en la siguiente pasó (34 passed).

| #           | Estado                                | Evidencia                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N-2         | **RESUELTO**                          | 0 `as any`, sin `eslint-disable`. `createTarifario` y `createRegla` devuelven `{ id: string } & Tariff` / `{ id: string } & TariffRule`. El único cast que queda (`as unknown as MotorOrderInput`, test de D33) es anterior y está justificado: inyecta los campos crudos a propósito.                                                                                                                                                                                  |
| H-4(a)      | **NO RESUELTO → ACEPTADO POR FRANCO** | El test "Determinismo: dos corridas con misma entrada" (`candidatas.test.ts:539`) **no cambió**: sigue con dos reglas de la misma variante (una candidata), aunque el mensaje del autor dice que agregó P1/P2 y T1/T2.                                                                                                                                                                                                                                                  |
| H-5         | **Parcial → ACEPTADO POR FRANCO**     | Ahora la salida pegada es verde y real (523 tests), y el consumo trae comando y salida. Sigue citando como commit `688a75d` (la restauración del auditor) y no el de la entrega, y no tiene tabla criterio → test.                                                                                                                                                                                                                                                      |
| N-3 (nuevo) | Observación de proceso                | `b3576c5` **volvió a borrar** `## PREGUNTAS`, `## Intentos anteriores` y el encabezado `## Nota de entrega`, con el mismo mecanismo: reemplaza desde la primera aparición de "## Nota de entrega", que está dentro de una línea del Plan, hasta el final del archivo. Es la cuarta vez. El auditor lo restauró en `94a176e` (texto exacto de `176060e`, verificado: fuera de Plan y Nota de entrega queda idéntico, y el único cambio de contenido es la restauración). |

### Decisión de Franco (06/10/2026)

Franco decide **cerrar MVP-13 sin otra ronda de correcciones**, y acepta como observaciones:

- **H-4(a):** el test de dos corridas con al menos dos candidatas pasa como **deuda a MVP-14**, que trabaja sobre los mismos tests. El motor es determinístico por construcción: sin azar, sin fechas implícitas (lo prueba la búsqueda sobre `src`, M19 detectada) y con orden de inserción.
- **H-5:** el hash citado en la nota y la falta de tabla criterio → test. El commit de cierre es `94a176e` (código en `b3576c5`).

Registrado por el auditor a pedido de Franco, en la misma conversación (`docs/auditoria-cruzada.md`, regla de cierre 3).

### Veredicto final

**APROBADO CON OBSERVACIONES.**

- **Código:** `packages/motor` en `b3576c5`. Ticket restaurado en `94a176e`.
- **Observaciones abiertas:**
  - H-4(a), con destino MVP-14.
  - M5, Menor: el alias de CABA en la coincidencia exacta del canalizador está cubierto solo de forma indirecta.
  - H-12, Menor, deuda declarada.
  - N-3: proceso; el autor no debe editar el ticket con reemplazos hasta el final del archivo.
- **Derivados:**
  - H-9 y D-1 → CR-07.
  - D-2 → MVP-18.
  - D-4 y D-5 → MVP-11.
- **Para Franco:**
  - Sumar a MVP-14 la deuda de H-4(a).
  - Revisar el diff y mergear (`docs/auditoria-cruzada.md`, regla 4: todo cambio en `packages/motor` lo revisa Franco antes de mergear).
  - Los CR-a, CR-b y CR-c sobre la arquitectura (§9) siguen pendientes.
