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
Ejecuta Claude Code (Opus 5.5) en lugar de Gemini, por decisión de Franco. Rama `mvp-15-casos-dorados`, creada desde `origin/main` (`599480b`, MVP-14 mergeado y auditado `APROBADO`), en un worktree propio (`../sistema-redespachos-mvp15`) para no pisar a los otros agentes.

1. **Formato (`test/golden/casos/<id>.json`):** `{ id, descripcion, entrada: { pedido, contexto }, salida }`. `contexto` es el `MotorContext` completo (canalizador, proveedores, tarifarios, reglas, `fecha_referencia`, `origen_estricto`); `salida` es el `QuoteResult` entero (cotización, alternativas, descartes, observaciones, `estado_sugerido`, canalizador y origen), montos en `cents`. `descripcion` es la línea que dice qué prueba.
2. **Runner (`test/golden/golden.test.ts`):** un `it` por caso. Valida la entrada con los esquemas de `shared` (`supplierSchema`, `tariffSchema`, `tariffRuleSchema`, `postalRouterEntrySchema`, y `orderImportSchema.pick(...)`/`cpSchema` para el pedido), corre `cotizar` y compara la salida completa con un diff propio que lista `ruta.del.campo: esperado X, obtenido Y`. Chequeos extra: ids únicos e iguales al nombre del archivo, `descripcion` no vacía, y que haya al menos 22 casos (para que borrar casos no pase en silencio).
3. **Huella en el `CHANGELOG.md`:** cada alta o actualización agrega una línea `fecha · caso · sha256 · motivo`, con el hash del JSON canónico del caso. El runner exige que el hash actual de cada caso sea el de su última línea: editar un JSON a mano (sin el script) también rompe CI.
4. **`golden:update`:** `scripts/golden-update.mjs` (JS con Node, porque no hay `tsx` y sumarlo es un `CR: deps`). El script de `package.json` es `tsc -p tsconfig.build.json && node scripts/golden-update.mjs`, así corre contra el motor recién compilado. Falla sin `--motivo` (o vacío), sin `--caso` o con un caso inexistente; reescribe solo la `salida` de ese caso, la formatea con Prettier (para que `format:check` siga verde) y agrega la línea al `CHANGELOG`.
5. **Set inicial sintético (`scripts/golden-generar.mjs`):** genera los casos con los esquemas de `shared` y **verifica contra valores calculados a mano** (total, criterio, proveedor elegido, motivos, estado) antes de escribirlos; no sobrescribe casos existentes. ~35 casos: los 2 de referencia y bordes de tramos (límite exacto, apenas sobre el límite), excedente de peso y de volumen, excedido sin regla (peso y volumen), solo peso / solo volumen, empate de criterio y R7, redondeos half-up (componente, seguro e IVA en x,xx5), seguro sin valor declarado y proveedor sin seguro, colecta solo del criterio ganador, ranking con IVA distinto (D11), empates de total (proveedor y variante), `CP_AMBIGUO` sí/no, filtro de provincia y `PROVINCIA_DIFIERE`, `origen_estricto` true/false, precedencia de origen y no caída al grupo general, cobertura QX con y sin candidatas, CP de destino y de origen fuera del canalizador, vigencia e histórico, proveedor inactivo, CP sin reglas, tramos solapados y tope de 20 alternativas. CPs (`99xx`), localidades, proveedores y precios inventados; CUIT sintético `20001555554`.
6. **Verificación:** prueba de la falla (cambiar el redondeo del IVA a `ROUND_HALF_EVEN` en una copia local → falla al menos un caso; se revierte), `golden:update` sin `--motivo` falla, un update real sobre un caso en una copia descartable, y la secuencia §5.5 desde estado limpio.

**Archivos:** `packages/motor/test/golden/**` (casos, `golden.test.ts`, `CHANGELOG.md`; se borra el `.gitkeep`), `packages/motor/scripts/golden-update.js`, `packages/motor/scripts/golden-generar.js`, `packages/motor/scripts/golden-lib.js` (código común), `packages/motor/package.json` (solo el script `golden:update`) y este ticket. Todos en el carril A y en la lista de permitidos.

**Ajustes de la revisión del plan (07/10), incorporados:**
- Los scripts son `.js` (no `.mjs`): `eslint.config.js` solo aplica reglas a `**/*.{js,jsx}` y `motor` es `"type": "module"`.
- `golden:update` descarta un `--` suelto antes de leer las opciones (pnpm 9 puede pasarlo tal cual) y se prueba con el comando literal del ticket.
- El conjunto de casos esperado sale del `CHANGELOG.md`: todo caso con línea debe tener su JSON y todo JSON su línea; el mínimo de 22 queda como control extra.
- Casos armados a propósito para que half-up y half-even difieran: IVA en x,xx5 con centavo anterior par (p. ej. 0,125) y lo mismo para el seguro. La prueba de la falla cambia el IVA a `ROUND_HALF_EVEN`.
- Hash sobre el JSON canónico (claves ordenadas, sin formato ni fin de línea); id y hash entre backticks en el `CHANGELOG`; se verifica que sigan coincidiendo después de `pnpm format`.
- Pedido: además de `orderImportSchema.pick` y `cpSchema`, `localidad_destino_norm` y `provincia_destino_norm` deben ser iguales a su propio `norm()` / `normProvincia()` (D33).
- La nota de entrega aclara que la `salida` completa la escribe el motor y a mano se controlan solo algunos campos por caso. Caso de referencia 2: total a mano $530.000,00.
- Prettier se corre con `pnpm exec prettier --write <archivo>`, sin depender de la resolución desde `scripts/`.

## PREGUNTAS
1. **Casos reales y regla 8 (para Franco).** El criterio pide 50 pedidos históricos con su costo real, pero esos casos contienen tarifas reales (dato comercial) y pedidos del TMS (Ley 25.326), que no pueden estar en el repo, y CI corre en GitHub. Opciones:
   - **(a)** Casos reales **fuera del repo**, con un script que Franco corre en su máquina (mismo patrón que `checkTmsFile`, solo imprime conteos y diferencias por id); CI corre solo los sintéticos.
   - **(b)** Casos reales **anonimizados** en el repo (sin nombres, CUIT ni destinatarios, y con los precios multiplicados por un factor secreto). Mantiene la regresión en CI, pero los precios siguen siendo derivables.

   Recomendación de Claude: **(a)**. Requiere además la planilla de liquidación manual (§7 punto 3), que hoy no existe.
2. **`MOTOR_VERSION` en la salida.** `cotizacion.motor_version` es parte de la salida comparada: subir la versión rompe todos los casos con cotización y obliga a correr `golden:update` caso por caso. Recomendación: dejarlo así en este ticket (es lo que pide "reescribe solo ese caso"); si molesta, un ticket aparte agrega `--caso` repetible. **Revisión del plan (07/10): de acuerdo.**
3. **Generador del set inicial.** Queda en el repo (regla 8: fixtures generados con scripts propios), pero solo da de alta casos nuevos; nunca reescribe uno existente. Las actualizaciones pasan solo por `golden:update`. **Revisión del plan (07/10): de acuerdo.**

---

## Nota de entrega

- **Qué se hizo:** formato de caso dorado (un JSON por caso con `id`, `descripcion`, `entrada` completa y `salida` completa de `cotizar`, montos en `cents`), runner `golden.test.ts`, script `golden:update` con `CHANGELOG.md` y huella sha256 por caso, y un set inicial de **45 casos sintéticos**: los 2 de referencia de §3.3 y 43 de bordes. El runner hace cuatro cosas: valida la entrada con los esquemas de `shared`, compara la salida campo por campo (`salida.cotizacion.iva: esperado 2153, obtenido 2152`), exige que los casos sean exactamente los del `CHANGELOG` y que la huella de cada uno sea la de su última línea. Por eso también falla un JSON editado a mano o un caso borrado.
- **Commit:** `bf2f1ce` (implementación) en la rama `mvp-15-casos-dorados`, más el commit de esta nota. Sin push ni PR. Desarrollado en un worktree propio (`../sistema-redespachos-mvp15`).
- **Archivos tocados:** `packages/motor/package.json` (solo el script `golden:update`), `packages/motor/scripts/golden-{lib,update,generar}.js`, `packages/motor/test/golden/{golden.test.ts,CHANGELOG.md}`, `packages/motor/test/golden/casos/*.json` (45), se borró `packages/motor/test/golden/.gitkeep`, y este ticket. `git diff --stat origin/main...HEAD` (antes del commit de la nota): `53 files changed, 10607 insertions(+), 2 deletions(-)`, todos dentro de los permitidos.
- **Cómo probarlo:**

  ```bash
  pnpm --filter @sistema-redespachos/shared build
  pnpm exec vitest run packages/motor/test/golden
  pnpm --filter @sistema-redespachos/motor golden:update -- --caso redondeo-iva-half-up --motivo "<texto>"
  pnpm --filter @sistema-redespachos/motor build && node packages/motor/scripts/golden-generar.js
  ```

  El último comando vuelve a controlar los 45 casos contra los valores a mano y no escribe nada si ya existen.

- **Resultado de la verificación** (`rm -rf packages/*/dist apps/functions/lib apps/web/dist`, después `pnpm install --frozen-lockfile && pnpm format && pnpm ci:run`, exit 0; extracto real):

  ```text
  > pnpm --filter @sistema-redespachos/shared build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
  > @sistema-redespachos/shared@0.0.1 build > tsc
  > eslint apps/web/src apps/functions packages --max-warnings 0
  > prettier --check .
  All matched files use Prettier code style!
   ✓ packages/motor/test/golden/golden.test.ts (183 tests) 42ms
   ✓ packages/motor/test/guardas.test.ts (8 tests) 54ms
   Test Files  29 passed (29)
        Tests  766 passed (766)
  packages/shared build: Done
  packages/motor build: Done
  apps/functions build: Done
  apps/web build: ✓ built in 820ms
  ```

  ESLint sí revisa los scripts: `eslint packages/motor/scripts --format json` lista los 3 `.js` con `errores=0`.

- **Consumo real:** los scripts corren con Node sobre `packages/motor/dist`. `golden:update` compila con `tsc -p tsconfig.build.json` antes de correr. Se probó con el comando literal del ticket. **pnpm 9 sí pasa el `--` tal cual** (`node scripts/golden-update.js "--" "--caso" ...`) y el script lo descarta antes de `parseArgs`.
- **Evidencia del criterio de aceptación:**
  - **§4 / agregado 1 (prueba de la falla).** Se cambió el IVA de `calculo.ts` a `ROUND_HALF_EVEN` en el worktree, sin commitear, y después se revirtió con `git checkout`:

    ```text
    × caso dorado 'redondeo-iva-half-up-centavo-cero.json' > cotizar devuelve exactamente la salida esperada
    × caso dorado 'redondeo-iva-half-up.json' > cotizar devuelve exactamente la salida esperada
    AssertionError: redondeo-iva-half-up: la salida del motor cambió. Si es intencional: pnpm --filter @sistema-redespachos/motor golden:update -- --caso redondeo-iva-half-up --motivo "<texto>": expected [ …(3) ] to deeply equal []
    +   "salida.cotizacion.iva: esperado 2153, obtenido 2152",
    +   "salida.cotizacion.total: esperado 12403, obtenido 12402",
    +   "salida.alternativas[0].total: esperado 12403, obtenido 12402",
    (redondeo-iva-half-up-centavo-cero: iva esperado 11, obtenido 10)
          Tests  2 failed | 181 passed (183)
    ```

    Lo mismo con el seguro en half-even: falla `redondeo-seguro-half-up` (`seguro: esperado 13, obtenido 12`), `Tests 1 failed | 182 passed`.

  - **Actualización explícita de punta a punta.** Con el IVA en half-even se corrió `golden:update -- --caso redondeo-iva-half-up --motivo "prueba..."`. El script mostró los 3 campos que cambiaban, reescribió solo ese JSON y agregó una línea al `CHANGELOG`. Después de eso, ese caso pasa, el otro sigue fallando (`Tests 1 failed | 182 passed`) y `prettier --check` sigue verde. Se revirtió todo con `git checkout`.
  - **Agregado 2.** Sin `--motivo` → `golden: falta --motivo "<texto>": toda actualización lleva motivo`, exit 1. Con `--motivo "  "` da el mismo error. Con un caso inexistente → `golden: no existe el caso no-existe`, exit 1.
  - **Edición a mano.** Cambiar `iva` 2153→2152 en el JSON falla dos tests: la huella (`redondeo-iva-half-up: editado sin golden:update`) y la salida.
  - **Caso borrado.** Borrar `tramos-solapados.json` falla `los casos son exactamente los registrados en el CHANGELOG`.
  - **Fin de línea.** Después del commit se borraron y se volvieron a sacar de git los casos y el `CHANGELOG`. Los JSON quedaron con CRLF (`autocrlf=true`) y pasan `183 passed`, igual que después de `pnpm format`.
  - **Agregado 3.** CPs `9900`–`9909` (fuera del rango real), localidades y proveedores inventados (`EXPA`, `PUEBLO DESTINO`, …), precios inventados, CUIT sintético `20001555554` y emails `@example.com`.
  - **Agregado 4:** ver la verificación de arriba.
- **Decisiones tomadas:**
  - **Huella en el `CHANGELOG`.** Se guarda el sha256 del JSON canónico del caso, con las claves ordenadas y sin formato. Así, el único camino para cambiar un caso sin romper CI es el script.
  - **Valores calculados a mano.** **La `salida` completa la escribe el motor.** A mano se controlan solo algunos campos por caso (estado, observaciones, descartes y los montos o reglas clave de la cotización). Están en `aMano` en `golden-generar.js`, con el cálculo comentado en los casos de referencia. El generador no escribe nada si alguno no coincide; se probó cambiando un valor a mano: `referencia-1 → cotizacion.iva: a mano 71838, motor 71837`, exit 1. Caso de referencia 2: total a mano $530.000,00.
  - **Valores de la salida que se comparan.** La salida se compara como JSON, así que los campos `undefined` (por ejemplo, `provincia_origen` cuando el CP de origen no está en el canalizador) no figuran.
  - **Prettier desde los scripts.** Se corre con `pnpm exec prettier --write`, en un solo string con `shell` (en Windows `pnpm` es un `.cmd`). Las rutas salen de ids validados con `^[a-z0-9]+(-[a-z0-9]+)*$`.
  - **Huella en dos lugares.** `canonical` está escrito dos veces: en `golden-lib.js` (JS, para Node) y en `golden.test.ts` (TS). Si divergen, el runner falla con todos los casos.
- **Supuestos:**
  - La fecha del `CHANGELOG` es la fecha local de la máquina que corre el script.
  - Los casos de `vigencia-*` usan dos tarifarios del mismo proveedor con rangos que no se pisan. El caso con dos vigentes a la vez (el motor lanza un error) no es un caso dorado, porque `cotizar` no devuelve salida; queda cubierto por los tests de MVP-13.
- **Fuera de alcance:**
  - Casos reales (PREGUNTA 1, pendiente de Franco y de la planilla de liquidación manual de §7.3): sin ticket todavía.
  - `--caso` repetible para subir `MOTOR_VERSION` (PREGUNTA 2): sin ticket.
- **Riesgos y deuda:**
  - **Sugerencia para el auditor:** recalcular a mano `referencia-1`, `excedente-volumen` (5.617,2839 → $5.617,28), `redondeo-componente-half-up`, `redondeo-seguro-half-up` y `empate-r7-gana-volumen-con-reglas`.
  - El runner no impide que alguien recalcule la huella a mano y la escriba en el `CHANGELOG`. Eso igual queda visible en el diff como una línea nueva con motivo.
  - `golden:update` reescribe la `salida` aunque no cambie nada (por ejemplo, para registrar una edición de `descripcion` o de `entrada`) y lo informa con "0 campos de la salida cambiaron".
