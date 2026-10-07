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
2. **`MOTOR_VERSION` en la salida.** `cotizacion.motor_version` es parte de la salida comparada: subir la versión rompe todos los casos con cotización y obliga a correr `golden:update` caso por caso. Recomendación: dejarlo así en este ticket (es lo que pide "reescribe solo ese caso"); si molesta, un ticket aparte agrega `--caso` repetible.
3. **Generador del set inicial.** Queda en el repo (regla 8: fixtures generados con scripts propios), pero solo da de alta casos nuevos; nunca reescribe uno existente. Las actualizaciones pasan solo por `golden:update`.

---

## Nota de entrega
Usar la plantilla de `tickets/_TEMPLATE.md`.
