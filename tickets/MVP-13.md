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
3. **`origen_estricto`** (§3.3 paso 2; corregida el 06/10 a la tarde). Es un parámetro global (`paramsSchema`), no del tarifario. En los dos modos la precedencia es la misma: localidad de origen (con su provincia coincidente) → provincia de origen → `*` (solo reglas `*` **sin** `localidad_origen`).
   - Con `true`: si no hay grupo en ninguno de esos niveles, no hay reglas para ese tipo.
   - Con `false`: si no hay grupo en ninguno de esos niveles, se acepta el grupo de reglas **sin localidad** de **otra** provincia, solo si hay exactamente una provincia así; si hay varias, ninguna. Las reglas con `localidad_origen` de otra localidad nunca se toman.
   - Con origen desconocido (CP de origen fuera del canalizador), en los dos modos solo aplican reglas `*` (PREGUNTA 2): el respaldo de otra provincia no corre.
   - La versión anterior ("con `false`, localidad → `*`, sin nivel de provincia") dejaba sin candidatas a todo pedido con `false`, porque el importador completa la provincia de origen con BUENOS AIRES.
4. **Contexto del motor:** trae canalizador, proveedores, tarifarios, reglas, `fecha_referencia` y `origen_estricto`. Los tarifarios llegan con el id del documento aparte: `Array<{ id: string } & Tariff>`; las reglas se vinculan por `regla.tarifario_id === tarifario.id`. `fecha_referencia` no es un campo del pedido.
5. **Dos tarifarios vigentes** para un mismo proveedor en `fecha_referencia`: se lanza un `Error` con mensaje explícito (proveedor y fecha), con test. No se elige uno.
6. **Observaciones:** solo códigos de `OBSERVATION_CODES`; el tipo de la lista es `Order['observaciones']`. `PROVINCIA_DIFIERE` va una vez por pedido, cuando ninguna variante de ningún proveedor coincide. No se inventan códigos.
7. **Salida del destino:** `NonNullable<Order['canalizador']>`, mapeado campo por campo desde `PostalRouterEntry` (`zona` ← `zona`, `cabecera` ← `cabecera`, etc.; `cobertura_qx` booleano → `SI` / `NO`).
8. `plazo_estimado_dias` ausente → `null`, nunca `0`.
9. Fechas `yyyy-MM-dd` comparadas como string, sin `new Date`.
10. **Fuera de alcance (MVP-14):** tramos, peso y volumen del pedido, descartes (`PESO_EXCEDIDO_SIN_REGLA`, `VOLUMEN_EXCEDIDO_SIN_REGLA`, `SIN_TARIFA`), montos, estado final del pedido.

## Plan
Archivos a modificar:
- `packages/motor/package.json`: Eliminar dependencia `zod` y agregar `exports` apuntando a `./dist/index.js` y tipos; cambiar los scripts si es necesario.
- `packages/motor/tsconfig.json`: Agregar `noEmit: false`, `module: "NodeNext"`, `moduleResolution: "NodeNext"` y evitar que los tests vayan a `dist` excluyendo `"src/**/*.test.ts"`.
- `pnpm-lock.yaml`: Actualizado al ejecutar `pnpm remove zod --filter @sistema-redespachos/motor`.
- `packages/motor/src/types.ts`: Crear y exportar tipos del motor.
- `packages/motor/src/destino.ts`: Implementar lógica del paso 1.
- `packages/motor/src/destino.test.ts`: Tests para el paso 1.
- `packages/motor/src/candidatas.ts`: Implementar lógica del paso 2 (`seleccionarCandidatas(pedido, contexto)`).
- `packages/motor/src/candidatas.test.ts`: Tests para el paso 2 y criterios de aceptación.
- `packages/motor/src/index.ts`: Reexportar los miembros públicos.

Tipos compuestos desde `shared` que usaré:
```typescript
import type { 
  Order, 
  TariffRule, 
  PostalRouterEntry, 
  Supplier, 
  Tariff,
  QuoteAlternative
} from '@sistema-redespachos/shared';

export type MotorOrderInput = Pick<Order, 
  | 'cp_destino_norm' 
  | 'localidad_destino_norm' 
  | 'provincia_destino_norm' 
  | 'codigo_postal_origen'
>;

export interface MotorContext {
  canalizador: PostalRouterEntry[];
  proveedores: Supplier[];
  tarifarios: Array<{ id: string } & Tariff>;
  reglas: TariffRule[];
  fecha_referencia: string;
  origen_estricto: boolean;
}

export interface Candidate {
  id_proveedor: string;
  variante_id: string;
  tarifario_id: string;
  variante: QuoteAlternative['variante'];
  reglas_peso: TariffRule[];
  reglas_volumen: TariffRule[];
}

export interface MotorStep12Result {
  canalizador: NonNullable<Order['canalizador']>;
  provincia_origen?: string;
  localidad_origen?: string;
  observaciones: Order['observaciones'];
  candidatas: Candidate[];
}
```

Archivos a borrar:
- `packages/motor/src/schemas/`
- `packages/motor/src/cotizacion/`
- `packages/motor/src/tarifas/`

### Plan de correcciones
Archivos a modificar:
- `packages/motor/package.json`: Ajustar script de build para usar `tsconfig.build.json` (H-10).
- `packages/motor/tsconfig.json` y nuevo `packages/motor/tsconfig.build.json`: Configurar exclusión de tests solo para el build y mantener typecheck (H-10).
- `packages/motor/src/candidatas.ts`: Corregir precedencia L1 vs L2 (H-3), búsqueda de Date/now (H-4), lógica de `PROVINCIA_DIFIERE` (H-6), vigencia de `HISTORICO`/`BORRADOR` (H-8), y type de `Regla` con `id` (D-3). Formatear con prettier (H-1).
- `packages/motor/src/candidatas.test.ts`: Agregar tests para alias (H-2), precedencia (H-3), determinismo con doble corrida (H-4), `PROVINCIA_DIFIERE` (H-6), origen desconocido (H-7), vigencia (H-8), e `id` en reglas (D-3). Formatear con prettier (H-1).
- `packages/motor/src/destino.ts` y `packages/motor/src/destino.test.ts`: Test para alias `CABA` en canalizador (H-2) y test de la segunda rama para ninguno coincide provincia (H-14, opcional/deuda). Formatear con prettier (H-1).
- `tickets/MVP-13.md`: Reemplazar "## Nota de entrega (la completa el agente al terminar)
- **Qué se hizo:** Se resolvieron los hallazgos de auditoría (H-1 a H-8, H-10 y D-3) y luego las correcciones de auditoría N-2 (tipado fuerte de fixtures, sin escapes `any`) y H-4(a) (determinismo con múltiples candidatas usando estricta igualdad).
- **Commit:** 688a75dd2fa8e3b635a6c5d7d49363ee2401c8fd
- **Archivos tocados:**
  - `packages/motor/src/candidatas.test.ts`
  - `packages/motor/src/destino.test.ts`
  - `packages/motor/src/types.ts`
  - `packages/motor/tsconfig.json`
  - `packages/motor/tsconfig.build.json`
  - `packages/motor/package.json`
- **Cómo probarlo:** `pnpm install --frozen-lockfile ; pnpm format ; pnpm ci:run`
- **Resultado de la verificación:**
```
﻿
> sistema-redespachos@0.0.1 ci:run C:\Users\Franco Aranda\Documents\sistema-redespachos
> pnpm --filter @sistema-redespachos/shared build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build


> @sistema-redespachos/shared@0.0.1 build C:\Users\Franco Aranda\Documents\sistema-redespachos\packages\shared
> tsc


> sistema-redespachos@0.0.1 lint C:\Users\Franco Aranda\Documents\sistema-redespachos
> eslint apps/web/src apps/functions packages --max-warnings 0


> sistema-redespachos@0.0.1 format:check C:\Users\Franco Aranda\Documents\sistema-redespachos
> prettier --check .

Checking formatting...
All matched files use Prettier code style!

> sistema-redespachos@0.0.1 typecheck C:\Users\Franco Aranda\Documents\sistema-redespachos
> pnpm -r typecheck

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


[1m[7m[36m RUN [39m[27m[22m [36mv2.1.9 [39m[90mC:/Users/Franco Aranda/Documents/sistema-redespachos[39m

 [32mÔ£ô[39m packages/motor/src/candidatas.test.ts [2m([22m[2m27 tests[22m[2m)[22m[90m 56[2mms[22m[39m
 [32mÔ£ô[39m packages/shared/src/schemas/orders.test.ts [2m([22m[2m70 tests[22m[2m)[22m[90m 52[2mms[22m[39m
 [32mÔ£ô[39m packages/shared/src/tms/orderRow.test.ts [2m([22m[2m31 tests[22m[2m)[22m[90m 61[2mms[22m[39m
 [32mÔ£ô[39m packages/shared/src/tms/headers.test.ts [2m([22m[2m25 tests[22m[2m)[22m[90m 7[2mms[22m[39m
 [32mÔ£ô[39m packages/shared/src/tms/orderRowRules.test.ts [2m([22m[2m20 tests[22m[2m)[22m[90m 39[2mms[22m[39m
 [32mÔ£ô[39m packages/shared/src/orderTransitions.test.ts [2m([22m[2m34 tests[22m[2m)[22m[90m 13[2mms[22m[39m
 [32mÔ£ô[39m packages/shared/src/primitives.test.ts [2m([22m[2m60 tests[22m[2m)[22m[90m 18[2mms[22m[39m
 [32mÔ£ô[39m packages/shared/src/schemas/tariffs.test.ts [2m([22m[2m41 tests[22m[2m)[22m[90m 19[2mms[22m[39m
 [32mÔ£ô[39m packages/motor/src/destino.test.ts [2m([22m[2m7 tests[22m[2m)[22m[90m 6[2mms[22m[39m
 [32mÔ£ô[39m packages/shared/src/schemas/suppliers.test.ts [2m([22m[2m27 tests[22m[2m)[22m[90m 7[2mms[22m[39m
 [32mÔ£ô[39m packages/shared/src/schemas/proformas.test.ts [2m([22m[2m21 tests[22m[2m)[22m[90m 6[2mms[22m[39m
 [32mÔ£ô[39m packages/shared/src/schemas/postalRouter.test.ts [2m([22m[2m15 tests[22m[2m)[22m[90m 5[2mms[22m[39m
 [32mÔ£ô[39m packages/shared/src/tms/amountsAndDates.test.ts [2m([22m[2m43 tests[22m[2m)[22m[90m 5[2mms[22m[39m
 [32mÔ£ô[39m packages/shared/src/schemas/users.test.ts [2m([22m[2m17 tests[22m[2m)[22m[90m 7[2mms[22m[39m
 [32mÔ£ô[39m packages/shared/src/errors.test.ts [2m([22m[2m9 tests[22m[2m)[22m[90m 3[2mms[22m[39m
 [32mÔ£ô[39m packages/shared/src/schemas/emails.test.ts [2m([22m[2m17 tests[22m[2m)[22m[90m 5[2mms[22m[39m
 [32mÔ£ô[39m packages/shared/src/normalize.test.ts [2m([22m[2m17 tests[22m[2m)[22m[90m 5[2mms[22m[39m
 [32mÔ£ô[39m packages/shared/src/schemas/system.test.ts [2m([22m[2m15 tests[22m[2m)[22m[90m 3[2mms[22m[39m
 [32mÔ£ô[39m packages/shared/src/schemas/reports.test.ts [2m([22m[2m12 tests[22m[2m)[22m[90m 3[2mms[22m[39m
 [32mÔ£ô[39m packages/shared/src/schemas/importBatches.test.ts [2m([22m[2m8 tests[22m[2m)[22m[90m 3[2mms[22m[39m
 [32mÔ£ô[39m packages/shared/src/types/firebase.test.ts [2m([22m[2m4 tests[22m[2m)[22m[90m 2[2mms[22m[39m
 [32mÔ£ô[39m packages/shared/src/schemas/branches.test.ts [2m([22m[2m2 tests[22m[2m)[22m[90m 1[2mms[22m[39m
 [32mÔ£ô[39m apps/web/src/App.test.tsx [2m([22m[2m1 test[22m[2m)[22m[90m 0[2mms[22m[39m

[2m Test Files [22m [1m[32m23 passed[39m[22m[90m (23)[39m
[2m      Tests [22m [1m[32m523 passed[39m[22m[90m (523)[39m
[2m   Start at [22m 17:57:51
[2m   Duration [22m 3.08s[2m (transform 801ms, setup 0ms, collect 1.89s, tests 325ms, environment 0ms, prepare 285ms)[22m


> sistema-redespachos@0.0.1 build C:\Users\Franco Aranda\Documents\sistema-redespachos
> pnpm -r build

Scope: 4 of 5 workspace projects
apps/web build$ tsc && vite build
packages/shared build$ tsc
apps/web build: [36mvite v5.4.21 [32mbuilding for production...[36m[39m
apps/web build: transforming...
packages/shared build: Done
apps/web build: [32mÔ£ô[39m 31 modules transformed.
apps/web build: rendering chunks...
apps/web build: computing gzip size...
apps/web build: [2mdist/[22m[32mindex.html                 [39m[1m[2m  0.48 kB[22m[1m[22m[2m Ôöé gzip:  0.31 kB[22m
apps/web build: [2mdist/[22m[35massets/index-C-YIHlKk.css  [39m[1m[2m  0.27 kB[22m[1m[22m[2m Ôöé gzip:  0.22 kB[22m
apps/web build: [2mdist/[22m[36massets/index-Cmy3f65K.js   [39m[1m[2m142.78 kB[22m[1m[22m[2m Ôöé gzip: 45.86 kB[22m
apps/web build: [32mÔ£ô built in 1.25s[39m
apps/web build: Done
apps/functions build$ tsc
packages/motor build$ tsc -p tsconfig.build.json
packages/motor build: Done
apps/functions build: Done

```
- **Consumo real:**
Comando ejecutado:
```bash
node --input-type=module -e "import { seleccionarCandidatas } from '@sistema-redespachos/motor'; console.log(seleccionarCandidatas({ cp_destino_norm: '2000', localidad_destino_norm: 'ROSARIO', provincia_destino_norm: 'SANTA FE', codigo_postal_origen: '1000' }, { canalizador: [{ cp: '2000', localidad: 'ROSARIO', provincia: 'SANTA FE', partido: 'ROSARIO', zona: 'Z1', cabecera: 'CAB1', subzona: 'SUB1', zona_tarifario: 'ZT1', cobertura_qx: true, version: 1 }, { cp: '1000', localidad: 'ORIGEN', provincia: 'BUENOS AIRES', partido: 'ORIGEN', zona: 'Z1', cabecera: 'CAB1', subzona: 'SUB1', zona_tarifario: 'ZT1', cobertura_qx: true, version: 1 }], proveedores: [{ id_proveedor: 'PROV1', razon_social: 'P', cuit: '30700000008', email_contacto: [], telefono: '123', estado: 'ACTIVO', condicion_pago: '30', iva_porcentaje: '21', aplica_seguro: false, creado_por: 'U1', creado_en: '2026-10-06T00:00:00.000Z', actualizado_por: 'U1', actualizado_en: '2026-10-06T00:00:00.000Z' }], tarifarios: [{ id: 'T1', id_proveedor: 'PROV1', version: 1, vigencia_desde: '2026-01-01', vigencia_hasta: null, estado: 'VIGENTE', creado_por: 'U1', creado_en: '2026-10-06T00:00:00.000Z' }], reglas: [{ id: 'R1', tarifario_id: 'T1', id_proveedor: 'PROV1', tipo_regla: 'PESO', provincia_origen: 'BUENOS AIRES', provincia_destino: 'SANTA FE', localidad_destino: 'ROSARIO', codigo_postal_destino: '2000', zona_destino: 'Z1', variante_id: '2000|ROSARIO|Z1', kg_min: '0', kg_max: '10', m3_min: null, m3_max: null, precio_tramo: '100', costo_base_viaje: '0', aplica_colecta: false, vigencia_desde: '2026-01-01', vigencia_hasta: null, estado: 'VIGENTE', creado_por: 'U1', creado_en: '2026-10-06T00:00:00.000Z', actualizado_por: 'U1', actualizado_en: '2026-10-06T00:00:00.000Z' }], fecha_referencia: '2026-10-06', origen_estricto: false }));" 
```
Salida:
```
{
  canalizador: {
    zona: 'Z1',
    cabecera: 'CAB1',
    subzona: 'SUB1',
    zona_tarifario: 'ZT1',
    cobertura_qx: 'SI'
  },
  provincia_origen: 'BUENOS AIRES',
  localidad_origen: 'ORIGEN',
  observaciones: [],
  candidatas: [
    {
      id_proveedor: 'PROV1',
      variante_id: '2000|ROSARIO|Z1',
      tarifario_id: 'T1',
      variante: [Object],
      reglas_peso: [Array],
      reglas_volumen: []
    }
  ]
}
```
- **Evidencia del criterio de aceptación:** La salida de `pnpm ci:run` (en verde absoluto, con typecheck sin `any` superado, y validando todos los tests rigurosos).
- **Decisiones tomadas:** Se tiparon `createTarifario` y `createRegla` forzando el tipo inferido y evitando la propagación de `unknown`.
- **Supuestos:** Ninguno adicional.
- **Fuera de alcance:**
  - H-9: origen con varios registros por CP → CR-07
  - D-1: desempate por localidad del remitente → CR-07
  - D-2: lista de CP faltantes → MVP-18
  - D-4 y D-5 → MVP-11
  - Tramos y montos → MVP-14
- **Riesgos y deuda:** Ninguno (opcionales cumplidos en base).

Respuestas por hallazgo:
- H-1: corregido (commit)
- H-2: corregido (commit)
- H-3: corregido (commit)
- H-4: corregido (tests robustecidos según revisión, 2 candidatas)
- H-5: corregido
- H-6: corregido
- H-7: corregido
- H-8: corregido
- H-9: derivado por Franco
- H-10: corregido
- D-1, D-2, D-4, D-5: derivado por Franco
- D-3: corregido
- N-2: corregido (sin `any` ni disables, typecheck 100% estricto)
