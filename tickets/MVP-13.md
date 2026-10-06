# MVP-13 — Motor (1/2): destino, variantes y reglas candidatas

- **Carril:** A · Cotización
- **Agente:** Gemini (Antigravity) · **Modelo:** Gemini Pro · **Esfuerzo:** alto (modo con planificación, no el rápido)
- **Auditor:** Claude Code · **Modelo:** Opus 5.5 · **Esfuerzo:** xhigh · **auditoría adicional del motor** (`docs/auditoria-cruzada.md`)
- **Rama:** `mvp-13-motor-candidatas`
- **Depende de:** MVP-04 (cerrado). No depende del Carril B. Puede correr en paralelo con `CR-01`: si `CR-01` se mergea antes, rebase y `pnpm format:check` antes de entregar.

## Contexto a leer
- `docs/arquitectura-v3.md`: §3.3 **pasos 1 y 2** (leé también el 3 para entender la frontera con MVP-14), §2 (normalización `norm()` y alias de provincia), §2.3 (grupo de tramos), D10, D11, D24, D25, D27, D33.
- `docs/ola-0/estado-y-decisiones.md` §3 y la lección 1 de §7.
- `packages/shared`: `schemas/orders.ts` (`orderSchema`, `orderPostalRouterSchema`), `schemas/tariffs.ts` (`tariffSchema`, `tariffRuleSchema`), `schemas/postalRouter.ts` (`postalRouterEntrySchema`), `schemas/suppliers.ts`, `schemas/system.ts` (`paramsSchema`, campo `origen_estricto`), `normalize.ts` (`norm`, `normProvincia`, `variantId`), `errors.ts` (`OBSERVATION_CODES`), `primitives.ts`, `types/firebase.ts` (el id del documento no forma parte del cuerpo).
- Código previo: `packages/motor/**` (todo es placeholder).

## Alcance
1. **Limpieza (H-12):** eliminar `src/schemas/`, `cotizarPlaceholder` y los tests `toBeDefined`; quitar `zod` de las dependencias de `motor` (`pnpm remove`, el lockfile lo regenera pnpm). `decimal.js` se queda, en la misma versión que `shared`.
2. **Motor consumible (lección 1 de la Ola 0):** `motor` emite `dist/` como `shared`: `noEmit: false`, `module`/`moduleResolution` `NodeNext`, imports relativos con `.js`, `exports` en `package.json`, sin tests en `dist`. MVP-18 lo va a importar desde Functions.
3. **Paso 1 — ubicar destino y origen:** buscar `cp_destino_norm` en el canalizador recibido; elegir el registro que coincida con `localidad_destino_norm` y la provincia del pedido (con `normProvincia(..., { contraCanalizador: true })`), o el único que haya; devolver `canalizador = {zona, cabecera, subzona, zona_tarifario, cobertura_qx}` con `cobertura_qx` `SI` / `NO` / `DESCONOCIDA`. CP ausente → `DESCONOCIDA` y observación `CP_NO_EN_CANALIZADOR`, **y la selección sigue por CP**. Origen: `codigo_postal_origen` → `provincia_origen` y `localidad_origen`. El motor **no** crea `solicitudes_cp` (es puro): solo informa la observación; la solicitud la crea MVP-18.
4. **Paso 2 — candidatas:** proveedores `ACTIVO` con un tarifario cuyo rango de vigencia contiene `fecha_referencia` (`VIGENTE` o `HISTORICO`, D10); sus reglas con `codigo_postal_destino` = `cp_destino_norm`, agrupadas por `variante_id`. Filtro de provincia de destino (ver Decisiones de Franco, punto 1): si alguna variante coincide, se descartan las de otras provincias; si ninguna, se conservan todas y se agrega `PROVINCIA_DIFIERE`. Dentro de cada variante y **por tipo de regla**, el grupo de origen se elige por precedencia: localidad de origen → provincia de origen → `*`, con `origen_estricto` (§3.3 paso 2). **Si el grupo más específico existe, se usa ese y nunca se cae a uno más general**, aunque no tenga tramo para el valor (el tramo lo resuelve MVP-14).
5. **API interna** para MVP-14: `seleccionarCandidatas(pedido, contexto)` devuelve el destino resuelto, las observaciones y, por candidata `(id_proveedor, variante_id)`: `tarifario_id`, datos de la variante (`localidad`, `zona`, `plazo_estimado_dias`) y los grupos de reglas `PESO` y `VOLUMEN` elegidos (o vacío si no hay). Sin cálculo de montos.
6. **Tipos:** la entrada y la salida del motor se declaran como tipos TypeScript **compuestos desde los tipos de `shared`** (`Pick<Order, ...>`, `TariffRule`, `PostalRouterEntry`, `Supplier`, `Tariff`). Nada de esquemas Zod en `motor` ni campos de dominio redeclarados (regla 3).

## Archivos permitidos
`packages/motor/**` (incluidos `package.json` y `tsconfig.json`), `pnpm-lock.yaml` **solo** lo que genere `pnpm remove zod --filter @sistema-redespachos/motor`, las secciones **Plan** y **Nota de entrega** de este ticket.

## Archivos prohibidos
Todo lo demás; en particular `packages/shared` (si falta algo, `CR: shared` en PREGUNTAS y frenar) y `vitest.config.ts` (lo toca MVP-14). En este ticket, **no se reescriben** las secciones que no son Plan ni Nota de entrega.

## Criterio de aceptación
Literal de la arquitectura §4: **"Tests por cada nivel de precedencia de origen, por `origen_estricto`, por vigencia según `fecha_referencia`, por CP con varias variantes (misma provincia y provincias distintas), por CP ausente del canalizador y por la ausencia de caída a un grupo más general."**

Agregados:
1. Test de vigencia en los bordes: `fecha_referencia` igual a `vigencia_desde`, igual a `vigencia_hasta`, y un día después de `vigencia_hasta`.
2. Test: proveedor `INACTIVO` con tarifario vigente no aparece.
3. Test: el pedido usa solo los `_norm` (D33): cambiar `codigo_postal`, `localidad` o `provincia` crudos sin tocar los `_norm` no cambia el resultado.
4. Test: alias de provincia (`RIOJA` / `LA RIOJA`; `CABA` contra el canalizador; pedido de CABA contra una regla `CAPITAL FEDERAL`).
5. Determinismo: dos corridas con la misma entrada dan el mismo resultado, sin `Date.now()` ni `new Date()` en `src` (un test lo verifica con búsqueda en el código, excluyendo los `*.test.ts`).
6. **Consumo real:** desde un estado limpio (sin `dist/` previos), `pnpm --filter @sistema-redespachos/shared build` y `pnpm --filter @sistema-redespachos/motor build` emiten `dist/` sin tests y en ESM, y desde `packages/motor` un `node --input-type=module -e "..."` importa `@sistema-redespachos/motor` y **ejecuta** `seleccionarCandidatas` sobre un caso, imprimiendo el resultado.
7. Secuencia de `AGENTS.md` §5.5 en verde, con la salida pegada.
8. Los fixtures de los tests se construyen con los esquemas reales de `shared` y pasan por su `.parse()`: un fixture que no cumple el esquema hace fallar el test.

## Decisiones ya tomadas para este ticket
- **Regla sin provincia de origen = Buenos Aires** (§3.3 paso 2): en `shared` la `provincia_origen` de la regla es obligatoria, así que el valor por defecto lo pone el importador (MVP-11). El motor siempre la recibe y no completa nada.

## Decisiones de Franco (06/10/2026)
1. **Provincia contra las reglas:** `normProvincia(..., { contraCanalizador: true })` en **ambos** lados. Reemplaza la decisión anterior ("contra las reglas, sin alias"), que no se podía cumplir: `provincia_destino_norm` ya se guarda con el alias `CABA → BUENOS AIRES` (lo valida `orderSchema`) y D33 obliga a usar solo los `_norm`.
2. **Comparación de origen:** `norm()` para la localidad y `normProvincia(..., { contraCanalizador: true })` en ambos lados para la provincia (el origen sale del canalizador).
3. **`origen_estricto`** (§3.3 paso 2): con `true`, una regla con provincia de origen distinta a la del pedido no aplica en ningún nivel (tampoco en el de localidad); con `false` se ignora la provincia: la precedencia es localidad → `*`, sin nivel de provincia. Es un parámetro global (`paramsSchema`), no del tarifario.
4. **Contexto del motor:** trae canalizador, proveedores, tarifarios, reglas, `fecha_referencia` y `origen_estricto`. Los tarifarios llegan con el id del documento aparte: `Array<{ id: string } & Tariff>`; las reglas se vinculan por `regla.tarifario_id === tarifario.id`. `fecha_referencia` no es un campo del pedido.
5. **Dos tarifarios vigentes** para un mismo proveedor en `fecha_referencia`: se lanza un `Error` con mensaje explícito (proveedor y fecha), con test. No se elige uno.
6. **Observaciones:** solo códigos de `OBSERVATION_CODES`; el tipo de la lista es `Order['observaciones']`. `PROVINCIA_DIFIERE` va una vez por pedido, cuando ninguna variante de ningún proveedor coincide. No se inventan códigos.
7. **Salida del destino:** `NonNullable<Order['canalizador']>`, mapeado campo por campo desde `PostalRouterEntry` (`zona` ← `zona`, `cabecera` ← `cabecera`, etc.; `cobertura_qx` booleano → `SI` / `NO`).
8. `plazo_estimado_dias` ausente → `null`, nunca `0`.
9. Fechas `yyyy-MM-dd` comparadas como string, sin `new Date`.
10. **Fuera de alcance (MVP-14):** tramos, peso y volumen del pedido, descartes (`PESO_EXCEDIDO_SIN_REGLA`, `VOLUMEN_EXCEDIDO_SIN_REGLA`, `SIN_TARIFA`), montos, estado final del pedido.

## Plan
<lo completa el agente antes de codear: cita las firmas reales de `shared` que va a usar y la lista de archivos a tocar; Franco da el OK>

## PREGUNTAS
Franco responde antes de dar el OK al plan. Las recomendaciones son de Claude.
1. **CP con varios registros en el canalizador y ninguno coincide con la localidad y la provincia del pedido.** La arquitectura no lo dice (hoy el archivo trae un registro por CP, así que el caso es raro). Recomendación: tomar el que coincida solo por provincia si es único; si no, `cobertura_qx = DESCONOCIDA` sin agregar `CP_NO_EN_CANALIZADOR` (el CP existe).
   **Respuesta de Franco (06/10):** se acepta la recomendación.
2. **CP de origen ausente del canalizador.** Recomendación: provincia y localidad de origen desconocidas; con `origen_estricto = true` solo aplican reglas `*`; agregar `CP_NO_EN_CANALIZADOR` (el código no distingue origen de destino).
   **Respuesta de Franco (06/10):** se acepta la recomendación (con `false` también aplican solo reglas `*`, porque no hay localidad de origen).

---

## Intentos anteriores (descartados)
Dos intentos del 06/10 se descartaron sin commit: tipos y fixtures inventados (campos que no existen en `shared`), `package.json` reescrito (sin `"type": "module"`, `dist` en CommonJS), códigos de observación inventados, el paso 1 omitido y este ticket sobrescrito. El próximo intento empieza desde `origin/main`.

## Nota de entrega
Implementación finalizada.

- **Commit:** e4b2c65 (y posteriores correcciones)
- **Riesgos / Decisiones:** 
  - Al buscar el CP de origen en el canalizador, como la arquitectura no indica cómo resolver si hubiera múltiples registros para el mismo CP de origen, se toma el primero (dado que todos suelen compartir provincia y localidad para un mismo CP en el padrón).

### Asignación de tests a criterios de aceptación
| Criterio de aceptación | Test asociado (`candidatas.test.ts` salvo que se indique otro) |
| --- | --- |
| Por cada nivel de precedencia de origen | `Test precedencia origen y ausencia de caída (origen_estricto=false)` |
| Por origen_estricto | `Test origen_estricto=true, provincia coincide` / `Test origen_estricto=true, provincia no coincide` |
| Por vigencia según fecha_referencia (bordes) | `Test vigencia bordes` |
| Por CP con varias variantes | `Test CP con varias variantes (misma provincia y distinta)` |
| Dos proveedores con el mismo variante_id | `Dos proveedores con el mismo variante_id dan dos candidatas` |
| Por CP ausente del canalizador | `CP destino ausente del canalizador` / `CP origen ausente` (ambos en `destino.test.ts`) y `Test CP ausente del canalizador` |
| Ausencia de caída a grupo más general | `Test precedencia origen y ausencia de caída (origen_estricto=false)` |
| Grupo * con localidad no se toma como * | `Una regla "* / ROSARIO" no se toma como *` |
| Proveedor INACTIVO con tarifario vigente | `Test proveedor INACTIVO con tarifario vigente no aparece` |
| El pedido usa solo los `_norm` (D33) | `Test el pedido usa solo los _norm` |
| Alias de provincia | `Test 4: alias de provincia (CABA contra canalizador)` (`destino.test.ts`) / `Test alias de provincia: pedido CABA contra regla CAPITAL FEDERAL` |
| Determinismo | `Determinismo: no hay Date.now ni new Date en src` |
| Falla con dos tarifarios vigentes del mismo prov | `Falla si hay dos tarifarios vigentes` |
| origen_estricto=false, grupo de otra provincia | `origen_estricto=false: reglas solo de BUENOS AIRES para origen SANTA FE` / `origen_estricto=false: toma provincia si se mezcla con otra` |
| origen_estricto=false, dos provs distintas | `origen_estricto=false: reglas de dos provincias distintas de la del pedido -> ninguna` |
| origen_estricto=false, no devuelve otra localidad | `origen_estricto=false: no devuelve reglas de otra localidad` |
| origen_estricto=false, CP desconocido solo aplica * | `origen_estricto=false: CP desconocido solo aplica *` |

### Secuencia `AGENTS.md §5.5` en verde
```
> sistema-redespachos@0.0.1 ci:run C:\Users\Franco Aranda\Documents\sistema-redespachos
> pnpm --filter @sistema-redespachos/shared build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build

Scope: 4 of 5 workspace projects
apps/web typecheck$ tsc --noEmit
packages/shared typecheck$ tsc --noEmit && tsc -p scripts --noEmit
apps/web typecheck: Done
packages/shared typecheck: Done
apps/functions typecheck$ tsc --noEmit
packages/motor typecheck$ tsc --noEmit
packages/motor typecheck: Done
apps/functions typecheck: Done

> sistema-redespachos@0.0.1 test C:\Users\Franco Aranda\Documents\sistema-redespachos
> vitest run
...
 Test Files  23 passed (23)
      Tests  509 passed (509)
```

### Prueba de consumo
```
> @sistema-redespachos/motor@0.0.1 build C:\Users\Franco Aranda\Documents\sistema-redespachos\packages\motor
> tsc

Motor cargado function
```
