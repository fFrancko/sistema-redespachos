# MVP-04 — Contratos de `packages/shared`: esquemas Zod, estados, transiciones, errores, tipos y parser del TMS

- **Carril:** Ola 0 (serial). Al cerrar, `packages/shared` queda congelado y lo audita el otro agente.
- **Agente:** Claude Code
- **Rama:** `mvp-04-zod-schemas` (se rehace desde `main`; ver "Rama")
- **Depende de:** MVP-01, MVP-03 (CI en `main`)

Este ticket reemplaza la versión anterior de MVP-04. Aquella contradecía `docs/arquitectura-v3.md` y `AGENTS.md` (roles, estados, modelo de tarifas, nombres de campos, dinero). La fuente es la arquitectura v3. Si este ticket y la arquitectura no coinciden, gana la arquitectura y lo anotás en PREGUNTAS.

## Contexto a leer

- `AGENTS.md` completo, en especial §3 (carriles) y §4 (reglas inquebrantables 1, 2, 3, 6, 8, 9 y 10).
- `docs/arquitectura-v3.md`:
  - §2 completo: tipos (`dec`, `cents`, `date`, `timestamp`, `ref`), `norm()`, §2.1 colecciones, §2.2 a §2.5. No §2.6 (Fase 2).
  - §3.1: roles. §3.2: normalización de entrada (D28), observaciones y códigos de error de fila. §3.3: motivos de descarte del motor (solo los códigos). §3.7: estados y transiciones. §3.8: códigos de error de negocio.
  - §4: fila MVP-04 (criterio de aceptación).
- `docs/mapa-de-contexto.md`: fila MVP-04.
- Código previo: `packages/shared/src/` (placeholders de MVP-01/02 que este ticket reemplaza).
- No reutilices la rama WIP anterior. Solo podés mirar `base.ts` como referencia del patrón Zod + decimal.js.

## Decisiones cerradas (no reabrir)

1. **Nombres:** los campos de dominio van en español `snake_case`, idénticos a la arquitectura (`id_proveedor`, `peso_kgs`, `nro_pedido`, `razon_social`…), también en runtime. No hay transformación a camelCase. Módulos, funciones y esquemas van en inglés camelCase (`supplierSchema`, `canTransition`). La única excepción es `norm`, que mantiene el nombre de la arquitectura. Los tipos se derivan con `z.infer` (`type Supplier = z.infer<typeof supplierSchema>`) y nunca se duplican a mano.
2. **`dec`:** string decimal no negativo con hasta 4 decimales (`/^\d+(\.\d{1,4})?$/`). Rechaza `number`, notación científica, coma decimal y negativos. Los porcentajes son `dec` en el rango [0, 100]. Hay helpers con decimal.js para convertir entre `dec` y `Decimal`, con redondeo half-up a 4 decimales.
3. **`cents`:** entero ≥ 0 y `Number.isSafeInteger`. Es el único monto que se guarda como `number`, por ser entero. Todo cálculo se hace con decimal.js. Hay un helper `Decimal → cents` con redondeo half-up a centavo (§3.3 paso 4).
4. **`date`:** string `yyyy-MM-dd` que debe ser un día calendario válido (rechaza `2026-02-30`). No se convierte a `Date`, para no arrastrar husos horarios.
5. **`timestamp`:** acepta `Date` o un string ISO 8601 con offset o `Z` (por ejemplo `2026-10-01T10:00:00-03:00`) y lo transforma a `Date`. `packages/shared` no depende de Firebase: la conversión desde `Timestamp` de Firestore la hacen web y functions.
6. **`ref`:** string no vacío. Enums: strings literales, tal cual figuran en la arquitectura.
7. **Alcance de la validación:** el esquema valida un documento aislado. Las reglas que necesitan otros documentos (CUIT único, alias único entre proveedores, solapamientos y huecos entre tramos, deduplicación) no van acá: son de MVP-09, MVP-11 y MVP-17. Sí van las reglas internas de un documento (ver Alcance, punto 2).
8. **Dependencias de `packages/shared`:** `zod` (última 3.x estable; no migrar a v4 en este ticket) y `decimal.js` ^10. No agregues `vitest` al paquete: los tests corren desde la raíz (MVP-03). Para el script del punto 6 se permite `csv-parse` como devDependency.
9. **Cobertura:** no toques los umbrales del `vitest.config.ts` raíz. Reportá la cobertura de `packages/shared` en la nota de entrega.
10. **Datos reales (regla 8):** `pedidos_tms.csv` real no entra al repo, ni copiado ni como fixture. Se lee por argumento desde una ruta fuera del repo.

## Rama

1. Guardá la WIP anterior como tag: `git push origin origin/mvp-04-zod-schemas:refs/tags/archivo/mvp-04-wip`.
2. Recreá `mvp-04-zod-schemas` desde `main` actualizado y pusheala con `--force-with-lease`. Pedime OK antes de este push.
3. La PR va contra `main` y tiene que mostrar solo archivos permitidos.

## Alcance

### 1. Primitivas y normalización

- Esquemas de `dec`, `cents`, `date`, `timestamp` y `ref`, con sus helpers (decisiones 2 a 6).
- `norm(texto)`: mayúsculas, sin tildes, sin espacios sobrantes (trim y colapso de espacios internos) y sin signos de puntuación finales.
- `normProvincia(texto, { contraCanalizador })` aplica el diccionario de alias de la arquitectura y solo esos:
  - Siempre: `RIOJA → LA RIOJA`.
  - Solo cuando `contraCanalizador = true`: `CAPITAL FEDERAL → BUENOS AIRES` y `CABA → BUENOS AIRES`.
- `variantId(codigo_postal_destino, localidad_destino, zona_destino)` = `{cp}|{norm(localidad)}|{norm(zona)}` (§2.3).

### 2. Esquemas Zod de las 19 colecciones de la Fase 1 (§2.1 a §2.5)

`usuarios`, `solicitudes_acceso`, `sucursales`, `canalizador_cp`, `solicitudes_cp`, `proveedores`, `indice_cuit`, `tarifarios`, `reglas_tarifa`, `lotes_importacion`, `pedidos` (con los mapas `canalizador`, `cotizacion`, `alternativas[]`, `descartes[]`, `confirmacion`, `errores[]`, `origen_tms`), `plantillas_email`, `proformas`, `emails_salida`, `respuestas_proveedor`, `reportes_liquidacion`, `reportes_oc`, `auditoria`, `parametros`.

Usá los campos de la arquitectura, ni uno más (regla 9). Si un campo no tiene tipo u obligatoriedad explícitos (por ejemplo, los de `solicitudes_acceso` o el `estado` de `usuarios`), anotalo en PREGUNTAS con el supuesto que tomaste.

Reglas internas de documento que el esquema tiene que hacer cumplir:

- `proveedores`:
  - `cuit` con 11 dígitos y dígito verificador válido (algoritmo módulo 11 de AFIP), con la función exportada (`isValidCuit`).
  - `email_contacto` con al menos un email.
  - Si `aplica_seguro`, `porcentaje_seguro` es obligatorio.
  - `iva_porcentaje` y `porcentaje_seguro` en [0, 100].
  - `id_proveedor` en mayúsculas y sin espacios.
- `reglas_tarifa`:
  - `PESO` exige `kg_min` y `kg_max`, con `m3_min` y `m3_max` nulos. `VOLUMEN` es al revés.
  - `min < max`.
  - `precio_kg_excedente` solo con `PESO` y `precio_m3_excedente` solo con `VOLUMEN`.
  - Si `aplica_colecta`, `costo_colecta` es obligatorio.
  - `codigo_postal_destino` con 4 dígitos.
  - `vigencia_hasta` nula o ≥ `vigencia_desde`.
- `tarifarios`: `vigencia_hasta` nula o ≥ `vigencia_desde`. `version` es un entero ≥ 1.
- `pedidos`:
  - `peso_kgs` y `volumen_m3` > 0. `cantidad_bultos` es un entero > 0.
  - `peso_aforado` ≥ 0, porque 0 es observación y no error.
  - `valor_declarado` en `cents`.
  - Los montos de `cotizacion` y `alternativas` en `cents`.
  - `alternativas` tiene como máximo 20 elementos.
  - `cotizacion.origen = MANUAL` exige `justificacion`.
- `respuestas_proveedor`: `justificacion` obligatoria si algún pedido es `RECHAZA`. `evidencia_paths` con al menos un elemento.
- `emails_salida`: `intentos` es un entero entre 0 y 3.
- `canalizador_cp` y `solicitudes_cp`: `cp` con 4 dígitos.

### 3. Roles y enums

- `Rol`: `ADMIN`, `ATENCION_PROVEEDOR`, `ANALISTA`, `BACKOFFICE`, `ADMINISTRACION` (D21). `COMERCIAL` no (Fase 2). No crees un enum de permisos: la matriz de §3.1 la aplican las reglas (MVP-07) y las callables.
- Todos los enums de estado de §2 y §3.7: pedido, tarifario, proveedor, lote, solicitud de CP, proforma, email, reporte. También `tipo_regla`, `criterio`, `origen` de cotización, `cobertura_qx` (`SI | NO | DESCONOCIDA`), `respuesta` (`ACEPTA | RECHAZA`) y `formato_adjunto`.

### 4. Tabla de transiciones de pedido (§3.7, regla 6)

- Una sola tabla de datos: `estado → estados destino`. Cada transición puede llevar una restricción de rol, que hoy solo aplica a `ACEPTADO_PROVEEDOR → EN_DISPUTA`, permitida únicamente a `ADMIN`.
- `canTransition(desde, hacia, rol?)` devuelve un booleano.
- `assertTransition(desde, hacia, rol?)` lanza un error de dominio con código `TRANSICION_INVALIDA`.
- `CANCELADO` y `LIQUIDADO` son finales.

### 5. Códigos de error y observación

Catálogos `as const` con sus tipos, separados por grupo:

- De negocio (§3.8): `DUPLICADO`, `TRANSICION_INVALIDA`, `PEDIDO_NO_EXPORTABLE`, `MISMO_USUARIO`, `TARIFARIO_INVALIDO`, `PROVEEDOR_NO_ENCONTRADO`.
- De fila (§3.2): `CAMPO_OBLIGATORIO`, `FORMATO_INVALIDO`, `PESO_INVALIDO`, `VOLUMEN_INVALIDO`, `CABECERA_NO_PERMITIDA`, `DUPLICADO`.
- Observaciones (§3.2): `VOLUMEN_INCONSISTENTE`, `AFORADO_MENOR_A_PESO`, `AFORADO_CERO`, `VALOR_DECLARADO_FALTANTE`, `DESTINO_DIFIERE_TMS`, `CP_NO_EN_CANALIZADOR`, `CP_AMBIGUO`, `PROVINCIA_DIFIERE`.
- Motivos de descarte del motor (§3.3): `PESO_EXCEDIDO_SIN_REGLA`, `VOLUMEN_EXCEDIDO_SIN_REGLA`, `SIN_TARIFA`.
- Advertencias de tarifario (§2.3): `TARIFARIO_SOSPECHOSO`, `CP_NO_EN_CANALIZADOR`.

Agregá una clase de error de dominio (`DomainError`, con `code` tipado) para que functions la traduzca a `HttpsError`.

### 6. Parser del TMS (D28, §2.4, §3.2)

Son funciones puras, sin SheetJS (eso es MVP-17) y sin I/O.

- Las 47 columnas de §7.4, en este orden:
  Código de Empresa; Código ERP; Tipo de Operación; Nro Pedido; Tipo de Servicio; Categoría; Sub Categoria; Código de Referencia; Peso Kgs; Volumen M3; Peso Aforado; Cantidad de Bultos; Valor Declarado; Valor Contra Reembolso; Tipo de Vehículo; Nro de Liquidación; Fecha de Liquidación; Id Tarifa; Valor Calculado Tarifa; Valor Calculado Seguro; Valor Calculado Reembolso; Total a Facturar; Status; Fecha Status; Fecha de Interfaz; Zona Origen; Cabecera Origen; Destinatario; Dirección; Número; Código Postal; Localidad; Provincia; Zona Destino; Cabecera; Fecha de Alta; Representante; Código de Dock; Codigo de Expreso; Nro Carta Porte; Fecha de Carta de Porte; Transporte; Chofer; Patente; Usuario Liquidación; IdLiquidacion; Código Postal Origen
  A esas se suman las opcionales `alto_cm`, `ancho_cm` y `largo_cm` al final.
- **Mapeo:** constante con las 47 columnas, más las 3 opcionales, hacia su campo (tabla de §2.4). Las columnas que no participan van a `origen_tms` con su nombre `snake_case` derivado del encabezado normalizado (por ejemplo, `Código de Empresa` → `codigo_de_empresa`).
- **Encabezados:**
  - `normalizeHeader` ignora el `:` final, las tildes y las mayúsculas.
  - Tiene que distinguir sin ambigüedad `Cabecera` de `Cabecera Origen` y `Código Postal` de `Código Postal Origen`.
  - Si falta una columna obligatoria, el error es a nivel de archivo, no de fila.
- **Montos:** `349,731.72` (coma de miles, punto decimal) se convierte a `dec` y, para `valor_declarado`, a `cents`. Un formato ambiguo o inválido da `FORMATO_INVALIDO`.
- **Fechas:** `dd/MM/yyyy` y `dd/MM/yyyy HH:mm:ss` se convierten a `date` (`yyyy-MM-dd`). Una fecha inexistente da `FORMATO_INVALIDO`.
- **CP:** 4 dígitos. Cualquier otra cosa da `FORMATO_INVALIDO`.
- `parseTmsRow(fila, contexto)` recibe `contexto = { sucursales_permitidas?: string[], tolerancia_volumen_pct: dec }` y devuelve `{ datos, errores[], observaciones[] }` con los códigos del punto 5:
  - Errores: `CAMPO_OBLIGATORIO` (incluye `cabecera_origen` vacía), `FORMATO_INVALIDO`, `PESO_INVALIDO`, `VOLUMEN_INVALIDO` y `CABECERA_NO_PERMITIDA` (solo si llegan `sucursales_permitidas`; compara con `norm`).
  - Observaciones intrínsecas a la fila: `VOLUMEN_INCONSISTENTE` (volumen de control `alto×ancho×largo÷1.000.000` contra `Volumen M3`, con la tolerancia recibida), `AFORADO_MENOR_A_PESO`, `AFORADO_CERO` y `VALOR_DECLARADO_FALTANTE`.
  - `DUPLICADO` y las observaciones que dependen del canalizador no se calculan acá.
- **Fixture sintético:** `packages/shared/test/fixtures/pedidos_tms_sintetico.csv`, generado por un script propio (`packages/shared/scripts/generateTmsFixture.ts`). Debe tener unas 20 filas y cubrir encabezados con `:`, montos con coma de miles, ambos formatos de fecha, una fila por cada código de error y por cada observación intrínseca, y una fila válida completa. Los nombres, direcciones y CUIT tienen que ser inventados.
- **Chequeo del archivo real:** `packages/shared/scripts/checkTmsFile.ts <ruta>` lee un CSV desde una ruta fuera del repo. Detecta el delimitador (`,` o `;`) y respeta las comillas. Imprime solo un resumen: filas leídas, errores de formato por código, errores de datos por código y observaciones por código. Nunca imprime valores de las filas, porque contienen destinatarios y direcciones (Ley 25.326).

### 7. Limpieza de placeholders

- Reemplazá `src/types/firebase.ts`: el stub `Collections` inventa colecciones que no existen (`tarifas`, `coberturas`, `liquidaciones`). Dejá una constante con los 19 nombres de §2.1 y los tipos derivados de los esquemas.
- Eliminá `noop` y los placeholders vacíos.
- `src/index.ts` exporta todo lo público del paquete.

## Archivos permitidos

- `packages/shared/src/**`
- `packages/shared/test/**`
- `packages/shared/scripts/**`
- `packages/shared/package.json`: solo dependencias (`zod`, `decimal.js`, `csv-parse` y `tsx` como dev), los scripts para correr `checkTmsFile` y `generateTmsFixture`, y el script `typecheck` (`tsc --noEmit && tsc -p scripts --noEmit`). Ampliado por Franco en las decisiones sobre las preguntas 6 y 7.
- `packages/shared/scripts/tsconfig.json`: extiende `../tsconfig.json` con `noEmit`, `rootDir ".."` e `include ["./**/*.ts", "../src/**/*.ts"]`, para que `scripts/` entre en `pnpm typecheck`. Ampliado por Franco.
- `pnpm-lock.yaml`: solo lo que resulte de esas dependencias.
- `tickets/MVP-04.md`: este ticket, con el plan y la nota de entrega.

Organización sugerida, con módulos en inglés:

- `src/primitives.ts`, `src/normalize.ts`, `src/roles.ts`, `src/enums.ts`, `src/orderTransitions.ts`, `src/errors.ts`
- `src/schemas/<coleccion>.ts`
- `src/tms/{headers,amounts,dates,orderRow}.ts`
- Tests junto al código (`*.test.ts`) o en `packages/shared/test/`, siempre que el `include` del `vitest.config.ts` raíz los encuentre. Verificalo.

## Archivos prohibidos

Todo lo que no figure arriba. En particular: `packages/motor`, `apps/**`, `.github/**`, `docs/**`, `package.json` raíz, `vitest.config.ts` raíz, `tsconfig*` raíz, `firebase.json` y las reglas. Si necesitás algo de ahí, es un `CR:` (`AGENTS.md` §3) y lo anotás en PREGUNTAS. No implementes lógica del motor (MVP-13/14) ni callables.

## Criterio de aceptación

Literal de la arquitectura v3, §4:

1. Hay tests de parseo válido e inválido por entidad.
2. La tabla de transiciones coincide con §3.7.
3. El parser lee `pedidos_tms.csv` real (538 filas, encabezados con `:`, montos como `349,731.72`, fechas `dd/MM/yyyy`) sin errores de formato.

Cómo se prueba cada uno en este ticket:

1. Cada uno de los 19 esquemas tiene al menos un caso válido y uno inválido por cada regla interna del punto 2. Además:
   - `dec` rechaza `number`, `"1e3"`, `"1,5"`, negativos y más de 4 decimales.
   - `cents` rechaza decimales.
   - `timestamp` acepta el offset `-03:00`.
   - `isValidCuit` tiene casos válidos e inválidos.
2. El test copia literalmente las dos columnas de §3.7 ("Llega desde" y "Puede pasar a") y verifica que la tabla las reproduzca exactamente:
   - Para cada estado, el conjunto de "Puede pasar a" es el de la tabla.
   - El conjunto inverso derivado es igual a "Llega desde".
   - `ACEPTADO_PROVEEDOR → EN_DISPUTA` solo vale con `ADMIN`.
   - Desde los estados finales no hay salidas.
3. Sobre el archivo real:
   - Con el fixture sintético, el test de `parseTmsRow` produce exactamente los códigos esperados por fila.
   - Con el archivo real, `checkTmsFile` lee 538 filas con 0 errores `FORMATO_INVALIDO` atribuibles al formato. Los errores de datos del TMS (peso, volumen o cabecera vacíos o en 0) son esperables: se reportan con su código y no cuentan como fallo.
   - El resumen va pegado en la nota de entrega.

Además:
4. `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` pasan en local, y el CI de la PR queda verde en GitHub.
5. Ningún monto se modela como `number` salvo `cents`. No hay ningún campo, estado o código que no esté en la arquitectura.
6. La PR muestra solo archivos permitidos.

## Plan

Estado: implementado y verificado en local, incluido el archivo real (criterio 3 cumplido tras tu decisión sobre `.5`). Sin commit ni push: esperan tu OK.

0. **Rama (con tu OK, pendiente):** la rama local `mvp-04-zod-schemas` ya está recreada desde `origin/main` (`d91abf2`, incluye MVP-03). Falta: tag `archivo/mvp-04-wip` (la WIP vive en `origin/mvp-04-zod-schemas`, commit `dbd4363`), commit, push con `--force-with-lease` y PR contra `main`.
1. Dependencias: `zod` ^3 (resolvió 3.25.x), `decimal.js` ^10, y como dev `csv-parse` y `tsx` (aprobado en la pregunta 7). Hecho.
2. Primitivas y normalización (`primitives.ts`, `normalize.ts`). Hecho.
3. Enums, roles y errores (`enums.ts`, `roles.ts`, `errors.ts`). Hecho.
4. Transiciones (`orderTransitions.ts`), con el test que copia las dos columnas de §3.7. Hecho.
5. Esquemas de las 19 colecciones en `src/schemas/`. Hecho.
6. Parser del TMS en `src/tms/`. Hecho.
7. Scripts y fixture: `scripts/generateTmsFixture.ts`, `scripts/checkTmsFile.ts`, `scripts/tsconfig.json`, fixture de 20 filas. Hecho.
8. Limpieza de placeholders y `src/index.ts`. Hecho.
9. Verificación local: lint, typecheck, test, build, cobertura y `checkTmsFile` sobre el archivo real. Hecho (ver nota de entrega).
10. Detenerme tras tu OK de commit, push y PR.

## PREGUNTAS

Cada una lleva el supuesto con el que avancé. Las contradicciones que ya resolviste (`cobertura_qx`, `solicitudes_cp`, `respuesta`/`resultado`) y las preguntas 6 a 8 ya están aplicadas y no se repiten.

**Resueltas por Franco (ya aplicadas)**

1. **Pesos sin cero entero en el archivo real (criterio 3).** El archivo real traía 92 pesos con la forma `.5`, que `parseTmsAmount` rechazaba. Decisión de Franco (opción A): se aceptan y se toman como `0.5`. Cambio: `parseTmsAmount` acepta `.dd` y lo normaliza anteponiendo `0`, para cualquier columna de importe. Siguen rechazados `.`, `-.5`, `.5.5`, `,5` y `.12345` (más de 4 decimales). Con esto el archivo real da 0 errores de formato.
2. **`Valor Declarado` en 0.** Decisión de Franco: es un valor válido (`cents` = 0) y no genera `VALOR_DECLARADO_FALTANTE`; esa observación solo sale con la celda vacía o la columna ausente. Es lo que ya hacía el parser, y ahora tiene un test explícito.

**Heredadas del ticket**

3. **`norm()` y la Ñ.** Se conserva la Ñ y solo se quitan acentos. Con tests.
4. **Alias de provincia.** Solo los tres de la arquitectura. En el archivo real hay 19 provincias distintas; la única variante que requiere alias es `CAPITAL FEDERAL` (14 filas), que ya cubre `normProvincia(..., { contraCanalizador: true })`. `LA RIOJA` aparece con 4 filas y ninguna como `RIOJA`. No apareció ninguna otra variante.
5. **CP con formato distinto de 4 dígitos.** No se normaliza en silencio: es `FORMATO_INVALIDO`. En el archivo real hay 0 casos.

**Campos sin tipo u obligatoriedad explícita (supuestos tomados, para que revises)**

6. `usuarios`: `email`, `nombre`, `rol`, `sucursales` (`ref[]`), `estado` (`ACTIVO | INACTIVO`) y los 4 campos de control. §2.1 solo dice "Perfil, rol, sucursales asignadas, estado".
7. `solicitudes_acceso`: `uid`, `email`, `nombre`, `estado` (`PENDIENTE | RESUELTA`) y `creado_en`. §3.1 no lista campos.
8. `indice_cuit`: solo `id_proveedor` (el CUIT es el id del documento).
9. `tarifarios`: `archivo_origen_path`, `publicado_por` y `publicado_en` opcionales, porque un borrador todavía no se publicó. `vigencia_hasta` es nullable (clave obligatoria, valor `null` si es la última).
10. `reglas_tarifa`: `kg_min`, `kg_max`, `m3_min` y `m3_max` son nullable y obligan a `null` explícito en el tipo que no corresponde. `variante_id` es obligatorio pero no se verifica que coincida con `variantId(...)` (§2.3 dice "calculado al guardar": lo hace la callable). `norm()` de provincias y localidades tampoco se verifica en el esquema.
11. `emails_salida`: `adjunto_path` y `proforma_id` opcionales, porque el outbox también sirve a los avisos internos (§3.1: email a los `ADMIN`; §3.4: email a CDG) que no tienen proforma ni adjunto.
12. `reportes_liquidacion` y `reportes_oc`: `archivo_path` opcional (el reporte nace `PROCESANDO` y el archivo aparece al pasar a `LISTO`, §3.5). `reportes_oc.estado` no tiene valores en §2.5: uso los de `reportes_liquidacion` (`PROCESANDO | LISTO`).
13. `parametros`: `tolerancia_volumen_pct` es `dec` en [0, 100] (la arquitectura escribe `5`); `oc_constantes.cotizacion` y `preciosobre` son `dec` (regla 1: ningún número no entero como `number`); `cantidad_por_pedido` es `int` > 0. No hay valores por defecto en el esquema.
14. `auditoria.antes` y `despues` son `record | null` con clave obligatoria (una alta no tiene `antes`). `reportes_liquidacion.filtros` es `record(string, unknown)`.
15. `lotes_importacion` no lleva campo de creador: §2.5 no lo lista, aunque §2.1 dice "un archivo importado por un usuario".
16. `pedidos.cotizacion`: `tarifario_id`, `variante_id` y `variante` son nullable y solo son obligatorios si `origen = MOTOR`, porque §3.8 dice que la cotización manual exige "proveedor, montos y justificación". `regla_peso_id` y `regla_volumen_id` son nullable (una candidata sin reglas de un tipo aporta 0, §3.3 paso 3).
17. `pedidos.canalizador`: `zona`, `cabecera`, `subzona` y `zona_tarifario` son nullable, porque con `cobertura_qx = DESCONOCIDA` el CP no está en el canalizador y no hay datos.
18. **Pedidos `CON_ERROR`: dos esquemas.** §2.4 y §3.7 dicen que una fila inválida se persiste con `estado = CON_ERROR` y `errores[]`, pero los campos que fallaron (peso en 0, cabecera vacía) no pueden cumplir las reglas de `pedidos` (`peso_kgs > 0`). Solución: `orderSchema` (VALIDADO en adelante, estricto, `errores` vacío), `invalidOrderSchema` (`CON_ERROR`, campos de importación opcionales, `errores` con al menos uno) y `orderDocumentSchema` (unión de ambos, que es el que usa la colección `pedidos`). `parseTmsRow` nunca deja en `datos` un valor que falló. Consecuencia para MVP-19: un `CON_ERROR` no conserva el valor original inválido (p. ej. el peso en 0), así que la exportación de errores a xlsx dependerá del archivo original en Storage.
19. `pedidos.fecha_aceptacion`: el índice `pedidos(estado, fecha_aceptacion)` de §2.5 y el filtro de §3.5 la usan como campo del pedido, pero §2.4 solo la lista dentro de `confirmacion`. No agregué el campo (regla 9). Mirar en MVP-07 y MVP-22.
20. **Parser: criterios que la arquitectura no fija.**
    - `Volumen M3` vacío: `VOLUMEN_INVALIDO` (§3.2 solo lo dice de `PESO_INVALIDO`).
    - `Cantidad de Bultos` en 0, decimal o negativo: `FORMATO_INVALIDO`, porque no hay un código específico.
    - `AFORADO_CERO` y `AFORADO_MENOR_A_PESO` son excluyentes: con aforado 0 solo sale `AFORADO_CERO`.
    - `Peso Aforado` ausente o vacío: `CAMPO_OBLIGATORIO` ("sí (presente)").
    - Las columnas de `origen_tms` con fecha (`Fecha de Liquidación`, `Fecha Status`, `Fecha de Alta`, `Fecha de Carta de Porte`) se validan solo si traen valor; los importes de `origen_tms` se guardan como texto sin validar, como dice §2.4.
    - Encabezados: obligatorias son las 12 columnas con "Oblig. = sí" de §2.4. Repetidos son `FORMATO_INVALIDO` de archivo; los desconocidos se listan y se ignoran.
21. **Las 47 columnas de §7.4 no están en el repo** (la arquitectura solo las referencia y `docs/documentacion-funcional.md` no existe). Usé el orden y los nombres de este ticket.

---

## Nota de entrega

- **Qué se hizo:**
  - `packages/shared` pasa de placeholders a los contratos de la v3: primitivas `dec`, `cents`, `date`, `timestamp`, `ref` con helpers decimal.js; `norm`, `normProvincia`, `variantId`; roles y enums de estado; tabla única de transiciones de pedido con `canTransition` y `assertTransition`; catálogos de códigos y `DomainError`; esquemas Zod de las 19 colecciones con las reglas internas del ticket; `isValidCuit`.
  - Parser del TMS (47 + 3 columnas, encabezados, montos, fechas, `parseTmsRow`) y dos scripts: `generateTmsFixture` (fixture sintético de 20 filas) y `checkTmsFile` (resumen sin valores).
  - `types/firebase.ts` ahora es la lista de las 19 colecciones con su esquema; se eliminaron `constants`, `utils`, `types/index.ts` y los stubs inventados (`tarifas`, `coberturas`, `liquidaciones`).
  - Criterio 3 cumplido sobre el archivo real: 538 filas, 0 errores de formato (con la decisión de aceptar `.5` como `0.5`).
- **Archivos tocados:**
  - Modificados: `packages/shared/package.json`, `pnpm-lock.yaml` (solo las dependencias; +297 líneas), `packages/shared/src/index.ts`, `packages/shared/src/types/firebase.ts`.
  - Eliminados: `packages/shared/src/constants/index.ts`, `packages/shared/src/utils/index.ts`, `packages/shared/src/types/index.ts`.
  - Nuevos en `packages/shared/src/`: `primitives.ts`, `normalize.ts`, `roles.ts`, `enums.ts`, `errors.ts`, `orderTransitions.ts`; `schemas/{common,users,branches,postalRouter,suppliers,tariffs,importBatches,orders,emails,proformas,reports,system,index}.ts`; `tms/{headers,amounts,dates,orderRow,index}.ts`; y un `*.test.ts` por módulo (20 archivos de test en total).
  - Nuevos fuera de `src`: `packages/shared/scripts/{generateTmsFixture.ts,checkTmsFile.ts,tsconfig.json}`, `packages/shared/test/fixtures/pedidos_tms_sintetico.csv`.
  - `tickets/MVP-04.md`.
- **Cómo probarlo:**
  ```bash
  pnpm install --frozen-lockfile
  pnpm lint && pnpm typecheck && pnpm test && pnpm build
  pnpm exec vitest run --coverage packages/shared
  pnpm --filter @sistema-redespachos/shared tms:fixture
  pnpm --filter @sistema-redespachos/shared tms:check "<ruta fuera del repo>\pedidos_tms.csv" --provincias
  ```
- **Resultado de la verificación** (corrida real, en local):
  - `pnpm install --frozen-lockfile`: sin errores.
  - `pnpm lint`: sin salida de error, `--max-warnings 0`.
  - `pnpm typecheck`: `apps/functions`, `apps/web`, `packages/motor` y `packages/shared` en `Done`. En shared corre `tsc --noEmit && tsc -p scripts --noEmit`.
  - `pnpm test`: `Test Files 22 passed (22)`, `Tests 459 passed (459)`; `packages/shared` aporta 457 tests en 20 archivos.
  - `pnpm build`: `packages/shared build: Done` y el resto de los paquetes en `Done`.
  - Cobertura de `packages/shared/src` (suma de todos sus archivos): statements 98.86 % (1127/1140), branches 95.26 % (181/190), functions 92.59 % (25/27), lines 98.86 %. Los esquemas, normalización, transiciones, errores, primitivas, montos y fechas están en 100 %. Lo que no cubre son los `index.ts` que solo reexportan. No toqué los umbrales de `vitest.config.ts`.
  - CI de la PR en GitHub: pendiente, la PR todavía no existe.
  - `checkTmsFile` sobre el archivo real (solo conteos; sin valores de filas):
    ```
    Codificación: utf-8 · Delimitador: coma · Filas leídas: 538
    Encabezados reconocidos: 47 de 50 columnas conocidas (las 3 opcionales no vienen) · desconocidos: 0
    Errores de archivo: 0
    Filas con al menos un error: 5 · Filas sin errores: 533
    Errores de formato por código:   (ninguno)
    Errores de datos por código:     CAMPO_OBLIGATORIO: 2 (cabecera_origen) · PESO_INVALIDO: 1 · VOLUMEN_INVALIDO: 3
    Observaciones por código:        AFORADO_CERO: 266
    Provincias: 19 distintas; la única variante con alias es CAPITAL FEDERAL (14 filas)
    Código de salida: 0
    ```
- **Evidencia del criterio de aceptación:**
  1. Parseo válido e inválido por entidad: un archivo de test por módulo en `src/schemas/*.test.ts` con casos válidos e inválidos por cada regla interna del punto 2; `src/primitives.test.ts` cubre `dec` (rechaza `number`, `"1e3"`, `"1,5"`, negativos y más de 4 decimales), `cents` (rechaza decimales) y `timestamp` (acepta `-03:00`); `src/schemas/suppliers.test.ts` cubre `isValidCuit` válido e inválido, incluido el caso en que el cálculo da 10.
  2. Tabla de transiciones: `src/orderTransitions.test.ts` copia literalmente las dos columnas de §3.7 y compara "Puede pasar a" por estado, el conjunto inverso contra "Llega desde", el rol `ADMIN` en `ACEPTADO_PROVEEDOR → EN_DISPUTA`, la ausencia de salidas desde `CANCELADO` y `LIQUIDADO`, y los 144 pares posibles.
  3. Parser: `src/tms/orderRow.test.ts` verifica que el fixture sintético produce exactamente los códigos esperados por fila (hay una fila por cada error y por cada observación intrínseca, y 8 filas válidas; la fila 18 usa un peso `.5`). Sobre el archivo real: `checkTmsFile` lee 538 filas, con 0 errores de archivo y 0 errores de formato; los errores de datos del TMS (6) se reportan con su código y no cuentan como fallo. **Criterio cumplido.**
  4 a 6. Lint, typecheck, test y build en verde en local (arriba). El CI de GitHub queda para cuando haya PR. Ningún monto es `number` salvo `cents`: `dec` rechaza `number` y los importes de `parametros` son `dec`. No agregué campos, estados ni códigos fuera de la arquitectura salvo los supuestos listados en PREGUNTAS. La PR mostrará solo archivos permitidos (ver "Archivos tocados").
- **Decisiones tomadas:** las listadas en PREGUNTAS 1 a 21 (la 1 y la 2 son decisiones tuyas). Además: `parseTmsAmount` acepta `.dd` y lo normaliza a `0.dd`; `scripts/tsconfig.json` y el script `typecheck` de `packages/shared` como indicaste; `package.json` suma los scripts `tms:fixture` y `tms:check`; las versiones de `zod` y `decimal.js` usan rango (`^3`, `^10`).
- **Riesgos y deuda (qué mirar primero):**
  1. La normalización de `.dd` a `0.dd` vale para toda columna de importe que pase por `parseTmsAmount`, no solo para `peso_kgs`. Es una ampliación de D28 que conviene reflejar en la arquitectura.
  2. El diseño `orderSchema` + `invalidOrderSchema` (pregunta 18) y lo que implica para el export de errores en MVP-19.
  3. Los esquemas de `usuarios` y `solicitudes_acceso` (preguntas 6 y 7) son casi enteramente supuestos: la arquitectura no lista sus campos.
  4. `quoteSchema` acepta cotizaciones manuales con referencias nulas (pregunta 16); MVP-13/14 deben decidir si eso alcanza.
  5. Los tests de `src/` incluyen el fixture por ruta relativa (`test/fixtures/…`); si alguien mueve el fixture, fallan `orderRow.test.ts` y `orderRowRules.test.ts`.
  6. El estilo es el existente en el repo (comillas simples). Prettier no tiene configuración en el repo y con sus valores por defecto reformatearía todo a comillas dobles: conviene un `CR` con `.prettierrc` antes de que alguien corra `pnpm format`.
