# Sistema de Redespachos — Arquitectura y Plan de Proyecto (v3)

Sep 30, 2026 · @Franco

## Resumen y decisiones cerradas

La v3 ajusta la v2 con lo que mostraron los datos reales de la etapa B0 (pedidos del TMS, Excel maestro de tarifas con dos proveedores y canalizador de CPs) y con las definiciones de negocio posteriores. El motor cotiza solo con peso y volumen; el IVA y el seguro se definen por proveedor; el circuito cierra con proforma agrupada, respuesta con control por oposición, reporte de liquidación (§7.8) y reporte de orden de compra (§7.9).

**Cambios respecto de la v2** (detalle en cada sección):

- El precio de cada regla es el **precio del tramo** (`precio_tramo`), con un excedente por unidad sobre el último tramo. Se abandona `precio_kg_base` / `precio_m3_base` como precio por unidad (D2, D4).
- El cruce del destino es **por código postal** (`codigo_postal_destino`). `zona_destino` del tarifario es una etiqueta del proveedor y no se cruza con las zonas del canalizador (D24).
- Un mismo CP puede tener **varias variantes** (localidad, zona, plazo y precio distintos). El motor las evalúa todas y la UI muestra las opciones (D11, D24).
- **Cobertura = QX propia o expresos.** `SIN_COBERTURA` solo si no hay ninguna opción. El canalizador es la base de CPs y localidades y la matriz de cobertura de QX (D25).
- `Codigo de Expreso` del TMS es el resultado de la operación manual de hoy: se guarda como referencia y no interviene en el motor (D26).
- No existe un filtro de "requiere redespacho": todo pedido importado se cotiza.
- CPs ausentes en el canalizador generan una solicitud a Control de Gestión (CDG) y no bloquean (D27).
- El formato del TMS es fijo: encabezados normalizados, miles con coma, decimal con punto (D28).
- El Excel maestro de tarifas admite **varios proveedores** y crece con el tiempo (D29).
- D3 acepta la fila de excedente del maestro; D15 deja de comparar zona y cabecera del TMS.
- La venta (Fase 2) requiere **dos motores**: Encomienda y Logística (D23).

**Revisión del 5 de octubre de 2026 — cierre de la Ola 0.** Decisiones tomadas a partir de la auditoría cruzada de MVP-04 (`tickets/MVP-04-AUDITORIA.md`) e incorporadas a este documento como D30 a D37:

- `localidad_destino` de `reglas_tarifa` pasa a **obligatoria** (D30): §2.3 la daba por opcional y `variante_id` la usa como componente.
- `fecha_aceptacion` se guarda en la **raíz** del pedido (D31): §2.4 la ubicaba dentro de `confirmacion` y el índice de §2.5 la espera de primer nivel.
- Un pedido que pasa de `CON_ERROR` a `CANCELADO` **conserva sus `errores[]`** (D32): §3.7 habilita la transición y el contrato no podía representarla.
- El cruce del destino va **solo por los campos `_norm`** del pedido (D33), con `localidad_destino_norm` nuevo. Los nombres crudos vienen del TMS y no se renombran.
- Los campos derivados **validan su derivación en Zod** (D34), no solo en la callable.
- Los campos de control genéricos se llevan **solo si no hay autoría propia del dominio** (D35). Cierra la discusión por colección.
- La exportación de filas con error sale de **`origen_tms`**, no de Storage (D36). Solo los pedidos con error guardan ahí las 47 columnas crudas, para no duplicar datos en los válidos.
- El orden canónico de las 47 columnas vive en **`packages/shared/src/tms/headers.ts`** (D37).

Ajuste del mismo día, tras las respuestas de Franco al cierre de la Ola 0: D36 y D26 se precisan para no duplicar datos en los pedidos válidos, y el criterio de MVP-31 sobre los secrets pasa a depender de la variable `DEPLOY_ENABLED`. El proyecto Firebase de desarrollo es `qx-redespachos-dev`.

**Convenciones obligatorias para agentes de código**

- Campos de dominio en español `snake_case`, idénticos al documento funcional (`peso_kgs`, `id_proveedor`); funciones, módulos y clases en inglés `camelCase`.
- Fuente única de tipos: esquemas Zod en `packages/shared`, usados por frontend, backend y motor.
- Dinero: tarifas como decimal en string (hasta 4 decimales) y resultados en centavos enteros. Nunca `number` flotante para montos.
- El cliente no escribe colecciones de negocio: toda escritura pasa por una Cloud Function callable que valida, audita y aplica la transacción.
- Cada ticket entrega tests. Todo cambio en `packages/motor` debe pasar el set de casos dorados en CI.

### Decisiones de diseño cerradas

La columna Origen dice de dónde sale cada decisión: **Negocio #n** es una resolución de negocio, **B0** es lo observado en los datos reales, **Doc. funcional** es el documento actualizado, y **Arquitectura** es una decisión tomada acá para cerrar un vacío del documento.

| # | Decisión | Origen |
| --- | --- | --- |
| D1 | El motor cotiza solo con `Peso Kgs` y `Volumen M3`. Km y paradas adicionales no existen en el modelo, el motor, la UI ni los reportes. | Negocio #1 |
| D2 | Cada fila de `reglas_tarifa` es un **tramo** de tipo `PESO` o `VOLUMEN` con un `precio_tramo` fijo (no por unidad). Por proveedor y variante de destino se elige un tramo de cada tipo y ambos costos se calculan de forma independiente (§3.3). | B0 y Negocio |
| D3 | Los tramos son intervalos (min, max\], el primero empieza en 0, y un tarifario no se publica con solapamientos, huecos ni datos obligatorios faltantes. **Excepción:** una fila con `min = max` igual al tope del último tramo, sin `precio_tramo` y con precio de excedente, es la marca de excedente del Excel maestro; el importador la pliega al último tramo y no cuenta como tramo. | Doc. funcional, Arquitectura y B0 |
| D4 | Sobre el tope del último tramo se cobra el sobrante a `precio_kg_excedente` o `precio_m3_excedente`, sumado al precio de ese último tramo. Sin ese precio, el proveedor queda descartado para el pedido. | Doc. funcional |
| D5 | `Peso Aforado` se guarda y se muestra pero no interviene en el cálculo; el peso cotizado es `Peso Kgs`. | Arquitectura |
| D6 | `precio_bulto` y `precio_pallet` (§6.3) se conservan como columnas reservadas, sin uso en el motor de costos. Se usarán en la venta Logística (Fase 2). | Doc. funcional y Negocio |
| D7 | La colecta se suma cuando la regla que determina el flete tiene `aplica_colecta = SI`. | Doc. funcional |
| D8 | El seguro es `valor_declarado × porcentaje_seguro del proveedor`, si el proveedor aplica seguro. Sin valor declarado, el seguro es 0 y el pedido lleva la observación `VALOR_DECLARADO_FALTANTE`. | Negocio #2 |
| D9 | Las tarifas se cargan netas. El IVA es un porcentaje del proveedor aplicado sobre `flete + colecta + seguro`. | Negocio #3 |
| D10 | La vigencia de tarifas se evalúa con la fecha de importación del lote (día calendario, huso America/Argentina/Buenos\_Aires). | Negocio #8 |
| D11 | Las **candidatas** son pares (proveedor, variante de destino). Por candidata se aplica Mayor Valor y se ordenan de menor a mayor **total final**; la primera es la opción principal. La UI muestra las dos más baratas y permite ver todas, y cuando un CP tiene varias variantes las muestra con localidad, zona y plazo. Empate: menor `id_proveedor` y luego menor `variante_id`. El total incluye el IVA de cada proveedor. | Negocio #4 y B0 |
| D12 | La plantilla de importación son las 47 columnas de §7.4 más tres opcionales al final: `alto_cm`, `ancho_cm`, `largo_cm`. El volumen cotizado es siempre `Volumen M3`; si vienen dimensiones y difieren más de 5%, se agrega una observación sin bloquear. | Negocio #8 y Arquitectura |
| D13 | `Valor Declarado` es opcional y se importa como `valor_declarado`. | Negocio #2 |
| D14 | El id del pedido es `{sucursal_id}_{nro_pedido}`, con `sucursal_id` igual a la `Cabecera Origen` normalizada. Reimportar un pedido existente en un estado distinto de `CON_ERROR` o `CANCELADO` se rechaza con el error `DUPLICADO`. | Arquitectura |
| D15 | Provincia y localidad de origen se resuelven desde `Código Postal Origen` en el canalizador. `Zona Destino` y `Cabecera` importadas se guardan sin compararlas: sus vocabularios difieren de los del canalizador. Solo se compara la provincia (normalizada) y, si difiere, se agrega la observación `DESTINO_DIFIERE_TMS`. Nunca bloquea. | B0 |
| D16 | Se envía un solo email por proveedor y lote. El cuerpo resume el lote y el adjunto (xlsx o csv) detalla cada pedido con importe y tarifa usada. Estructura, columnas del adjunto, CC y CCO son parametrizables. | Negocio #5 |
| D17 | La proforma es un documento propio. Atención al Proveedor registra la respuesta por proforma, con evidencia obligatoria y opción de rechazar pedidos puntuales. Quien envió la proforma no puede registrar su respuesta. | Negocio #6 |
| D18 | `fecha_aceptacion` es la fecha de la respuesta del proveedor que informa Atención al Proveedor al registrarla (no puede ser futura). Se guarda en la raíz del pedido (D31). | Arquitectura |
| D19 | El reporte de liquidación (§7.8) lo confirman y generan analistas o BackOffice. Trae las 47 columnas más `id_proveedor`, `razon_social`, `cuit`, `criterio`, `neto`, `iva`, `total` y `fecha_aceptacion`, y pasa los pedidos a `LISTO_PARA_OC`. | Negocio #7 y Doc. funcional |
| D20 | El reporte de OC (§7.9) lo genera Administración desde `LISTO_PARA_OC`: una OC por proveedor y reporte, una línea por pedido, `precio` = total con IVA. Los pedidos pasan a `LIQUIDADO`. | Doc. funcional y Arquitectura |
| D21 | Roles: `ADMIN`, `ATENCION_PROVEEDOR`, `ANALISTA`, `BACKOFFICE` y `ADMINISTRACION`; `COMERCIAL` se suma en la Fase 2. `ADMIN` incluye a Control de Gestión (CDG). | Negocio #6 |
| D22 | Firebase en plan Blaze vinculado a la cuenta de facturación de GCC, con alerta de presupuesto. Login con Google Workspace. | Decisión ya tomada en la v1 |
| D23 | La venta (Fase 2) usa **dos tarifarios y dos motores**: *Encomienda* (hasta 1 m³, hasta 50 kg y un solo bulto) y *Logística* (todo lo que no cae en Encomienda: más bultos o pallets). Una función `clasificarServicio(pedido)` decide cuál aplica. La comparación costo/venta se hace en neto. El motor de Encomienda busca por `cabecera_origen-cabecera_destino-subzona-rango_kg`; el de Logística se define con Comercial. | Negocio y Arquitectura |
| D24 | La clave de cruce del destino es el **código postal de 4 dígitos** (`codigo_postal_destino`). `zona_destino` y `localidad_destino` del tarifario son etiquetas del proveedor y no se cruzan con el canalizador, pero ambas son obligatorias porque componen `variante_id` (D30). Un CP puede repetirse para distintas localidades, zonas y hasta provincias; cada combinación (CP, localidad, zona) es una **variante** con su propio `variante_id`, plazo y precios. Si la provincia del pedido coincide con la de alguna variante, se descartan las variantes de otras provincias. | B0 y Negocio |
| D25 | Las coberturas son las de QX Logística (matriz del canalizador) o las de los expresos con tarifario cargado. `SIN_COBERTURA` solo si el pedido no tiene ninguna opción. Un pedido con cobertura QX pasa a `COBERTURA_QX` y, si hay expresos con tarifa, también muestra sus opciones para elegir una. En el MVP la cobertura QX no lleva precio: el precio de venta llega con el motor de la Fase 2. | Negocio |
| D26 | `Codigo de Expreso` importado es el resultado de la asignación manual de hoy. Se guarda en `expreso_manual` (y, en los pedidos con error, también crudo en `origen_tms`, D36); no interviene en la cotización. Sirve para el informe de modo sombra y para medir cuánto se diversifica la asignación. | Negocio |
| D27 | Un CP de pedido o de tarifario que no existe en el canalizador no bloquea: el pedido se cotiza igual por CP, lleva la observación `CP_NO_EN_CANALIZADOR` y se crea una solicitud a CDG (`solicitudes_cp`) con aviso por email y contador en la UI. | Negocio |
| D28 | El formato del TMS es fijo: encabezados con `:` final que se normalizan (`trim`, sin `:`, sin tildes, minúsculas) y se mapean a los nombres de §7.4; montos con coma de miles y punto decimal (`349,731.72`); fechas `dd/MM/yyyy` o `dd/MM/yyyy HH:mm:ss`; CP de 4 dígitos. Los importes y las magnitudes sin cero entero se normalizan anteponiendo el `0` (`.5` → `0.5`) en **todas** las columnas numéricas, no solo en peso; eso no relaja el rechazo de formatos ambiguos (`-.5`, `.5.5`, `1.234,56`, `1,5`, `1e3` siguen dando `FORMATO_INVALIDO`). | Negocio y B0 |
| D29 | El Excel maestro de tarifas admite varios proveedores en el mismo archivo. La importación crea un borrador por proveedor presente; el proveedor del maestro se identifica por `id_proveedor` o por sus `alias`. | Negocio |
| D30 | `localidad_destino` de `reglas_tarifa` es **obligatoria**. Sigue siendo una etiqueta del proveedor y no es clave de cruce, pero compone `variante_id` y sin ella la variante es ambigua. Una fila sin `localidad_destino` no se importa y el tarifario no se publica: la callable devuelve `TARIFARIO_INVALIDO` por dato obligatorio faltante (D3). | Negocio |
| D31 | `fecha_aceptacion` se guarda en la **raíz** del pedido, no dentro de `confirmacion`, para que el índice `pedidos(estado, fecha_aceptacion)` y los filtros de §3.5 y §7.8 operen sobre un campo de primer nivel. `confirmacion` conserva `respuesta` y `respuesta_id`. | Negocio |
| D32 | Al pasar de `CON_ERROR` a `CANCELADO` el pedido **conserva sus `errores[]`**, por trazabilidad de por qué se canceló. Un pedido `CANCELADO` puede, por lo tanto, tener `errores[]` no vacío y campos de importación ausentes o inválidos; el contrato de `pedidos` debe admitir ese documento. | Negocio |
| D33 | El cruce del destino entre `pedidos` y `reglas_tarifa` se hace **exclusivamente por los campos normalizados** del pedido: `cp_destino_norm`, `provincia_destino_norm` y `localidad_destino_norm`, contra `codigo_postal_destino`, `provincia_destino` y `localidad_destino` de la regla. Los campos `codigo_postal`, `localidad` y `provincia` de `pedidos` conservan los nombres de las columnas del TMS (§7.4) y **no se usan como clave de cruce**: son el dato crudo importado. El motor y toda consulta de cotización usan solo los `_norm`. | Negocio |
| D34 | Todo campo derivado que se persiste **valida su derivación en el esquema Zod**, no solo en la callable: `reglas_tarifa.variante_id` contra `{codigo_postal_destino}\|{norm(localidad_destino)}\|{norm(zona_destino)}`, `canalizador_cp.cobertura_qx` contra `subzona`, y `pedidos.cp_destino_norm`, `provincia_destino_norm` y `localidad_destino_norm` contra `codigo_postal`, `provincia` y `localidad`. En los cuatro casos las fuentes están en el mismo documento, así que la validación es local y no necesita leer otra colección. | Negocio |
| D35 | Una colección lleva los cuatro campos de control genéricos (`creado_por`, `creado_en`, `actualizado_por`, `actualizado_en`) **solo si no tiene un campo de autoría propio del dominio**. Por eso no los llevan `proformas` (`enviada_por`, `enviada_en`), `respuestas_proveedor` (`registrado_por`, `registrado_en`), los reportes (`generado_por`, `generado_en`), `pedidos` (`importado_por`, `importado_en`) ni `lotes_importacion` (`importado_por`, `importado_en`). Esa ausencia es deliberada y no es un hallazgo de auditoría. | Negocio |
| D36 | La exportación de filas con error del panel de revisión (§7.4, MVP-19) se construye **desde `pedidos.origen_tms`**, y no leyendo el archivo original de Storage. En los pedidos con error (`CON_ERROR`, y `CANCELADO` con `errores[]` no vacío), `origen_tms` conserva **las 47 columnas del TMS tal como vinieron**, incluidas las que también se mapean a campos, porque esos campos pueden haber fallado la validación. En los pedidos válidos guarda solo las columnas que no se mapean a un campo (§2.4), para no duplicar datos. El archivo en Storage queda como respaldo y trazabilidad, no como fuente del export. | Negocio |
| D37 | La lista y el **orden canónico de las 47 columnas** del TMS es el codificado en `packages/shared/src/tms/headers.ts`, derivado del archivo real en MVP-04. Es la fuente de verdad en el repo, y la usan el parser (MVP-17) y el reporte de liquidación (§7.8, MVP-26). Si el archivo real difiere, se corrige `headers.ts` con un `CR` y no cada consumidor. | Arquitectura |

## 1. Stack tecnológico recomendado

TypeScript de punta a punta sobre Firebase (Auth, Firestore, Cloud Functions 2ª gen, Hosting, Storage) en región `southamerica-east1`, con el proyecto en plan Blaze sobre la cuenta de facturación de GCC. Un solo lenguaje y un solo esquema de tipos es lo que más acelera a los agentes de código y reduce errores de integración.

| Capa | Elección | Justificación |
| --- | --- | --- |
| Monorepo | pnpm workspaces: `apps/web`, `apps/functions`, `packages/shared`, `packages/motor` | Tipos y validaciones compartidos; el motor se testea y reutiliza sin infraestructura. |
| Frontend | React + Vite + TypeScript, React Router, TanStack Query | Stack que los agentes dominan; build rápido; sin SSR porque es una app interna detrás de login. |
| UI | shadcn/ui + Tailwind con tema #323e48 (primario) y #f5333f (secundario), TanStack Table virtualizada | Componentes editables en el repo; la tabla virtualizada soporta el panel de revisión con miles de filas. |
| Formularios | React Hook Form + Zod (esquemas de `packages/shared`) | Misma validación en cliente y servidor. |
| Excel | SheetJS en el navegador (lectura), exceljs en Functions (generación de adjuntos y reportes) | Se previsualiza y valida el archivo antes de subirlo; los adjuntos y reportes se generan en servidor. |
| Backend | Cloud Functions 2ª gen, Node 22: callables, triggers de Firestore y colas `onTaskDispatched` | Sin servidores que mantener; las colas traen reintentos configurables (los 3 reintentos de §7.7). |
| Base de datos | Cloud Firestore (modo nativo) | Ver justificación del modelo híbrido abajo. |
| Archivos | Cloud Storage | Archivos importados, evidencias de respuesta del proveedor, adjuntos de proformas y reportes generados. |
| Autenticación | Firebase Auth con Google, restringido al dominio corporativo; roles por custom claims | Sin contraseñas propias; roles verificables en reglas de seguridad y en Functions. |
| Email | Gmail API desde un buzón compartido de Workspace (cuenta de servicio con delegación de dominio) | Soporta CC, CCO y adjuntos; las respuestas de los proveedores llegan a una bandeja del área, con trazabilidad. |
| Plantillas de email | Handlebars con HTML escapado y un catálogo cerrado de variables | Las plantillas las edita el negocio; el catálogo evita inyección y errores de tipeo. |
| Decimales | decimal.js dentro del motor | Aritmética exacta para tarifas y redondeo controlado. |
| Calidad | Vitest, Firebase Emulator Suite (reglas y Functions), ESLint, Prettier | Tests de integración locales sin tocar producción. |
| CI/CD | GitHub Actions: lint, typecheck, tests, deploy a dev en merge y a prod por tag; preview channels de Hosting por PR | Cada PR de un agente queda desplegado para revisión. |
| Data Warehouse (Fase 2) | Extensión Stream Firestore to BigQuery o export programado | Cumple §6.2 sin cambiar la base operativa. |

**Por qué Firestore con modelo tabular híbrido.** Cada regla de §6.3 es un documento plano en la colección `reglas_tarifa`, con las columnas del documento funcional: se comporta como una tabla y se exporta 1:1 a BigQuery. Las columnas de §6.3 que ahora viven en el proveedor (seguro e IVA) se exponen juntas en la vista `v_reglas_tarifa_completa` del DW. Firestore no ofrece restricciones de unicidad ni de no solapamiento, así que se imponen en las callables con transacciones. El motor no consulta Firestore por rangos: carga las reglas de los tarifarios vigentes (decenas de miles de filas, cacheadas por lote), las indexa por CP y resuelve en memoria, lo que lo hace determinístico y testeable.

**Plan Blaze sobre la facturación de GCC.** El plan Spark no alcanza: no permite desplegar Cloud Functions, y [Cloud Storage exige Blaze desde el 3 de febrero de 2026](https://www.verdent.ai/guides/devtools/firebase-pricing). Blaze conserva las cuotas gratuitas de Spark (Firestore: 50.000 lecturas y 20.000 escrituras diarias) y solo factura el excedente. Firebase no tiene tope de gasto, así que se configura una alerta de presupuesto en Cloud Billing desde el día uno (tarea MVP-02).

**Alternativa descartada: Postgres (Supabase o Cloud SQL).** Modela mejor las restricciones de rangos, pero suma un segundo proveedor fuera del ecosistema Google o un costo fijo mensual, y aleja la integración nativa con BigQuery y Vertex AI.

## 2. Diseño de arquitectura de datos

Diecinueve colecciones de Firestore en la Fase 1, todas planas y con campos en español `snake_case`. `reglas_tarifa` replica §6.3 sin ninguna variable de distancia ni paradas, y el seguro y el IVA viven en `proveedores`.

**Tipos usados en las tablas:** `string` · `int` · `bool` · `timestamp` · `date` (día calendario, huso America/Argentina/Buenos\_Aires) · `dec` (decimal en string, hasta 4 decimales, p. ej. `"1250.5000"`) · `cents` (entero en centavos de ARS) · `enum` · `ref` (id de otro documento).

**Normalización de texto** (`norm()`): mayúsculas, sin tildes, sin espacios sobrantes ni signos finales. Se usa para comparar provincias, localidades, zonas, cabeceras y nombres de proveedor. Además, un diccionario de alias de provincia unifica variantes conocidas (`RIOJA` → `LA RIOJA`, `CAPITAL FEDERAL` y `CABA` → `BUENOS AIRES` cuando se compara contra el canalizador).

### 2.1 Colecciones

| Colección | Contenido | Id del documento | Quién escribe |
| --- | --- | --- | --- |
| `usuarios` | Perfil, rol, sucursales asignadas, estado | uid de Auth | Callable admin |
| `solicitudes_acceso` | Pedidos de alta de usuarios sin rol | auto | Callable (usuario autenticado) |
| `sucursales` | Catálogo de referencia: cada sucursal es una `Cabecera Origen` del TMS. Se importa por `ADMIN` | `norm(cabecera_origen)` | Callable admin |
| `canalizador_cp` | CP + localidad + provincia → zona, cabecera, subzona y cobertura QX | `{cp}_{localidad_normalizada}` | Importación admin |
| `solicitudes_cp` | CPs de pedidos o tarifarios que no existen en el canalizador, para que CDG los agregue | `cp` | Callable y motor |
| `proveedores` | Expresos con su configuración de IVA, seguro, pago, email y alias (§7.2) | `id_proveedor` | Callable |
| `indice_cuit` | Garantiza CUIT único | CUIT sin guiones | Misma transacción que `proveedores` |
| `tarifarios` | Cabecera de versión por proveedor | auto | Callable |
| `reglas_tarifa` | Filas del tarifario (§6.3) | auto | Callable (solo en borrador) |
| `lotes_importacion` | Un archivo importado por un usuario | auto | Callable |
| `pedidos` | Línea de pedido con estado, cotización y confirmación | `{sucursal_id}_{nro_pedido}` | Callables y triggers |
| `plantillas_email` | Estructura parametrizable de la proforma | auto | Callable |
| `proformas` | Una por proveedor y lote, con totales congelados | auto | Callable y worker |
| `emails_salida` | Outbox de correos con intentos y errores | auto | Callables; worker actualiza |
| `respuestas_proveedor` | Respuesta registrada por Atención al Proveedor, con evidencia | auto | Callable |
| `reportes_liquidacion` | Historial de exportaciones §7.8 | auto | Callable |
| `reportes_oc` | Historial de exportaciones §7.9 | auto | Callable |
| `auditoria` | Log de cambios de cualquier entidad | auto | Solo backend |
| `parametros` | Configuración global | `global` | Callable admin |

### 2.2 `proveedores`

| Campo | Tipo | Oblig. | Regla |
| --- | --- | --- | --- |
| `id_proveedor` | string | sí | Único, mayúsculas, sin espacios. Es el código del proveedor en Finnegans (viaja a `proveedor` en la OC). |
| `razon_social` | string | sí | Es el `nombre_proveedor` de §6.3. |
| `alias` | string\[\] | no | Otros nombres con los que aparece el proveedor: el nombre del Excel maestro ("Hacha de Piedra") y el del TMS (`Codigo de Expreso`, "HACHA DE PIEDRA"). Se comparan con `norm()`. Un alias no puede repetirse entre proveedores. |
| `cuit` | string | sí | 11 dígitos con dígito verificador válido; único vía `indice_cuit`. |
| `email_contacto` | string\[\] | sí | Destinatarios por defecto de la proforma; al menos uno. |
| `telefono` | string | sí |  |
| `estado` | enum | sí | `ACTIVO` · `INACTIVO`. Un inactivo no participa de cotizaciones nuevas. |
| `condicion_pago` | string | sí | Valor del catálogo `parametros.condiciones_pago`; viaja a `condicionpago` en la OC. |
| `iva_porcentaje` | dec | sí | Entre 0 y 100 (21, 10.5, 0 …). Se aplica sobre el neto. |
| `aplica_seguro` | bool | sí |  |
| `porcentaje_seguro` | dec | si `aplica_seguro` | Entre 0 y 100, sobre `valor_declarado`. |
| `email_config` | map | no | `{plantilla_id?, para_extra[], cc[], cco[]}`: plantilla\_id reemplaza a la plantilla por defecto; para\_extra, cc y cco se suman a los de la plantilla. |
| `datos_adicionales` | map string→string | no | Información de gestión, contacto y liquidación (§7.2). |
| `creado_por`, `creado_en`, `actualizado_por`, `actualizado_en` | ref / timestamp | sí | Control. |

Los datos del proveedor (IVA, seguro, condición de pago, emails, alias) se cargan y editan desde la sección de proveedores del sistema, aunque su tarifario todavía esté en construcción: un proveedor puede existir sin tarifario y no participa de cotizaciones hasta tener uno vigente.

### 2.3 `tarifarios` y `reglas_tarifa` (modelo principal, §6.3)

`tarifarios`: `id_proveedor`, `version` (int correlativo por proveedor), `vigencia_desde` (date), `vigencia_hasta` (date, nula si es la última), `estado`, `archivo_origen_path`, `publicado_por`, `publicado_en`, `creado_por`, `creado_en` (quién creó el borrador; `publicado_por` y `publicado_en` son de la publicación, que puede ser otra persona). Estados: `BORRADOR` · `VIGENTE` (publicado y no reemplazado) · `HISTORICO` (con `vigencia_hasta` cerrada). El motor usa los tarifarios `VIGENTE` e `HISTORICO` cuyo rango contiene la fecha de referencia del lote. La vigencia no viene en el Excel maestro: la indica quien importa, por proveedor.

| Campo de `reglas_tarifa` | Tipo | Oblig. | Regla |
| --- | --- | --- | --- |
| `tarifario_id`, `id_proveedor` | ref | sí | Versión y proveedor de la fila. |
| `tipo_regla` | enum | sí | `PESO` · `VOLUMEN`. |
| `provincia_origen`, `localidad_origen` | string | provincia sí | `*` = cualquier origen. Normalizadas con `norm()`. Ver precedencia en §3.3. |
| `provincia_destino`, `localidad_destino` | string | sí | Etiquetas de la variante. Se usan para descartar variantes de otras provincias y para mostrar la opción; no son clave de cruce. Ambas son obligatorias: `localidad_destino` compone `variante_id`, y una fila sin ella no se importa (`TARIFARIO_INVALIDO`, ver D30 y D3). |
| `codigo_postal_destino` | string | sí | 4 dígitos. Clave de cruce con el pedido. |
| `zona_destino` | string | sí | Zona del proveedor (p. ej. "Ramal Norte", "Zona facturación 2"). Informativa; no se cruza con el canalizador. |
| `plazo_estimado_dias` | int | no | Tiempo estimado de entrega de la variante. Se muestra en las opciones. |
| `variante_id` | string | derivado | `{codigo_postal_destino}\|{norm(localidad_destino)}\|{norm(zona_destino)}`. Calculado al guardar. |
| `kg_min`, `kg_max` | dec | si `PESO` | Tramo de peso, intervalo (min, max\]. Nulos si `VOLUMEN`. |
| `m3_min`, `m3_max` | dec | si `VOLUMEN` | Tramo de volumen, intervalo (min, max\]. Nulos si `PESO`. |
| `precio_tramo` | dec | sí | Precio fijo del tramo, neto. El importador lo toma de `precio_kg_base` (`PESO`) o `precio_m3_base` (`VOLUMEN`) cuando el Excel usa esos nombres. |
| `costo_base_viaje` | dec | sí | Cargo fijo adicional del componente (puede ser 0). |
| `precio_kg_excedente` | dec | no | Solo en el último tramo de `PESO`; precio por kg sobre `kg_max`. |
| `precio_m3_excedente` | dec | no | Solo en el último tramo de `VOLUMEN`; precio por m3 sobre `m3_max`. |
| `precio_bulto`, `precio_pallet` | dec | no | Reservadas por §6.3. Se almacenan pero el motor de costos no las usa. |
| `aplica_colecta` | bool | sí |  |
| `costo_colecta` | dec | si `aplica_colecta` | Cargo fijo por colecta. |
| `vigencia_desde`, `vigencia_hasta`, `estado` | date / date / enum | sí | Copiados de la cabecera para filtrar sin joins. |
| `creado_por`, `creado_en`, `actualizado_por`, `actualizado_en` | ref / timestamp | sí | Control. |

Todos los importes de la tabla son netos de IVA (§7.3).

**Grupo de tramos (variante).** Clave: `tarifario_id` + `tipo_regla` + origen (provincia y localidad) + `variante_id`. Dentro de cada grupo se validan los tramos.

**Validaciones al guardar y al publicar (§7.3):**

- Dentro de cada grupo, los tramos no pueden solaparse ni dejar huecos, y el primero empieza en 0. La fila de excedente del Excel maestro (D3) se pliega al último tramo antes de validar.
- `precio_*_excedente` solo es válido en el último tramo del grupo.
- Todos los montos y precios son mayores o iguales a 0; los porcentajes están entre 0 y 100.
- Un mismo CP puede aparecer en varias variantes (distinta localidad o zona). Es válido y no es un duplicado; sí lo es repetir el mismo `variante_id` con el mismo tramo.
- Publicar exige `vigencia_desde` posterior a la del último tarifario publicado del proveedor; la versión anterior queda `HISTORICO` con `vigencia_hasta = vigencia_desde − 1 día`.
- Nunca se editan filas de un tarifario publicado: se corrige con una versión nueva.

**Advertencias al publicar (no bloquean):**

- `TARIFARIO_SOSPECHOSO`: un grupo de `VOLUMEN` con un único tramo cuyo `precio_m3_excedente` es igual al `precio_tramo` (parece un precio por m3 cargado como tramo: el volumen ganaría siempre por Mayor Valor).
- `CP_NO_EN_CANALIZADOR`: lista de CPs del tarifario que no existen en el canalizador; se crean las solicitudes a CDG (D27).

### 2.4 `pedidos`

Columnas de la plantilla de importación que usa el sistema (los nombres del Excel son los de §7.4; el parser los reconoce tras normalizar los encabezados, D28):

| Columna del Excel | Campo | Tipo | Oblig. | Uso |
| --- | --- | --- | --- | --- |
| Nro Pedido | `nro_pedido` | string | sí | Identidad del pedido. |
| Peso Kgs | `peso_kgs` | dec | sí | Mayor que 0; base del costo por peso. |
| Volumen M3 | `volumen_m3` | dec | sí | Mayor que 0; base del costo por volumen. |
| Peso Aforado | `peso_aforado` | dec | sí (presente) | Se guarda y se muestra; no interviene en el cálculo. Un valor 0 es observación, no error. |
| Cantidad de Bultos | `cantidad_bultos` | int | sí | Mayor que 0; informativo en el MVP (clasificación Encomienda/Logística en la Fase 2). |
| Valor Declarado | `valor_declarado` | cents | no | Base del seguro. |
| Fecha de Interfaz | `fecha_interfaz` | date | sí | Informativo. |
| Zona Origen, Cabecera Origen | `zona_origen`, `cabecera_origen` | string | sí | `cabecera_origen` es la sucursal del pedido y debe estar entre las sucursales asignadas al usuario. |
| Código Postal Origen | `codigo_postal_origen` | string | sí | Resuelve provincia y localidad de origen. |
| Código Postal, Localidad, Provincia | `codigo_postal`, `localidad`, `provincia` | string | sí | Destino; `codigo_postal` es la clave de cruce. |
| Zona Destino, Cabecera | `zona_destino_importada`, `cabecera_destino_importada` | string | no | Se guardan sin comparar (D15). |
| Codigo de Expreso | `expreso_manual` | string | no | Resultado de la operación manual actual. No interviene en la cotización (D26). |
| Destinatario, Dirección, Número | `destinatario`, `direccion`, `numero` | string | no | Informativo. |
| (al final de la plantilla) | `alto_cm`, `ancho_cm`, `largo_cm` | dec | no | Control del volumen; no bloquean. |

El resto de las 47 columnas (Código de Empresa, Código ERP, Tipo de Operación, Tipo de Servicio, Categoría, Sub Categoria, Código de Referencia, Valor Contra Reembolso, Tipo de Vehículo, Representante, Código de Dock, datos de carta de porte, chofer, patente, y las columnas de liquidación e importes) se validan como texto o fecha y se guardan tal cual en el mapa `origen_tms`, con su nombre `snake_case`. No participan de la cotización. En los pedidos con error, `origen_tms` guarda además las columnas mapeadas, con su valor crudo (D36).

| Grupo | Campos | Tipo |
| --- | --- | --- |
| Contexto | `sucursal_id`, `lote_id`, `importado_por`, `importado_en` | ref / timestamp |
| Normalización | `cp_destino_norm`, `provincia_destino_norm`, `localidad_destino_norm`, `provincia_origen`, `localidad_origen`, `observaciones[]`. Los tres `_destino_norm` son la clave de cruce contra `reglas_tarifa` (D33) y validan su derivación en el esquema (D34) | string / array |
| Canalizador | `canalizador` = `{zona, cabecera, subzona, zona_tarifario, cobertura_qx: SI\|NO\|DESCONOCIDA}`; `cobertura_qx` es `NO` cuando `subzona` es `SIN COBERTURA` y `DESCONOCIDA` si el CP no está en el canalizador | map |
| Estado | `estado` (ver §3.7), `errores[]` = `{campo, codigo, mensaje}`. Los `errores[]` de un pedido `CON_ERROR` se conservan al pasar a `CANCELADO` (D32) | enum / array |
| Cotización elegida | `cotizacion` = `{id_proveedor, tarifario_id, variante_id, variante: {localidad, zona, plazo_estimado_dias}, regla_peso_id, regla_volumen_id, criterio: PESO\|VOLUMEN, detalle_tarifa, costo_peso, costo_volumen, flete, colecta, seguro, neto, iva_porcentaje, iva, total, origen: MOTOR\|MANUAL, justificacion?, fecha_referencia, motor_version, calculado_en}` | map; montos en cents |
| Alternativas | `alternativas[]` = `{id_proveedor, variante_id, variante, criterio, neto, total}` ordenadas de menor a mayor total (máximo 20) y `descartes[]` = `{id_proveedor, variante_id?, motivo}` | array |
| Confirmación | `fecha_aceptacion` (date, en la raíz del pedido; ver D31), `proforma_id`, `confirmacion` = `{respuesta: ACEPTA\|RECHAZA, respuesta_id}` | date / ref / map |
| Liquidación | `reporte_liquidacion_id`, `reporte_oc_id` | ref |

La cotización es una **foto**: guarda los valores con los que se calculó, así un cambio posterior de tarifa no altera pedidos ya valorizados. `detalle_tarifa` es el texto legible que ve el proveedor en la proforma, p. ej. `PESO 10–50 kg: tramo $1.600,00`.

### 2.5 Resto de colecciones (campos clave)

- `usuarios`: `email`, `nombre`, `rol`, `sucursales[]` (ids de `sucursales`), `estado` (`ACTIVO` · `INACTIVO`), más los cuatro campos de control. No guarda último acceso: `lastSignInTime` de Firebase Auth es la fuente de ese dato y no se duplica.
- `solicitudes_acceso`: `uid` (de Auth), `email`, `nombre`, `estado` (`PENDIENTE` · `APROBADA` · `RECHAZADA`), `creado_en`, `resuelto_por` (ref, nula mientras está `PENDIENTE`), `resuelto_en` (timestamp, nulo mientras está `PENDIENTE`). La resuelve `admin.setUserRole` desde la pantalla de solicitudes (§3.1, MVP-06).
- `canalizador_cp`: `cp` (4 dígitos), `localidad`, `provincia`, `partido`, `zona`, `cabecera`, `subzona`, `zona_tarifario`, `cobertura_qx` (derivado: `false` si `subzona` es `SIN COBERTURA`; la derivación se valida en el esquema, D34), `version`. Puede haber más de un registro por CP (distintas localidades o provincias). El archivo actual trae un registro por CP y sus provincias vienen con escritura inconsistente: se normalizan al importar.
- `solicitudes_cp`: `cp`, `localidad`, `provincia`, `origen` (`PEDIDO` · `TARIFARIO`), `referencia_id`, `estado` (`PENDIENTE` · `RESUELTA`), `creado_en`, `resuelta_en`. Una por CP; nuevas apariciones suman a `referencias`. Se resuelve sola cuando `postalRouter.import` incorpora el CP.
- `sucursales`: `cabecera_origen` (nombre TMS), `activa`. Es el catálogo contra el que se validan `cabecera_origen` y las sucursales de cada usuario.
- `lotes_importacion`: `sucursal_id` (o `MULTIPLE` si el archivo mezcla cabeceras), `archivo_path`, `fecha_referencia` (date, día de la importación, fija para todo el lote), `total_filas`, `validas`, `con_error`, `sin_cobertura`, `cobertura_qx`, `estado` (`PROCESANDO` · `LISTO` · `CERRADO`), `importado_por`, `importado_en` (autoría del lote; por D35 no lleva campos de control genéricos).
- `plantillas_email`: `nombre`, `asunto`, `cuerpo_html` (Handlebars), `columnas_adjunto[]` (del catálogo: `nro_pedido`, `fecha_interfaz`, `cabecera_origen`, `localidad`, `provincia`, `codigo_postal`, `peso_kgs`, `volumen_m3`, `cantidad_bultos`, `criterio`, `detalle_tarifa`, `neto`, `iva`, `total`), `formato_adjunto` (`XLSX` · `CSV`), `para_extra[]`, `cc[]`, `cco[]`, `es_default`.
- `proformas`: `lote_id`, `id_proveedor`, `pedido_ids[]`, `totales` = `{cantidad, neto, iva, total}` (congelados al enviar), `plantilla_id`, `email_id`, `adjunto_path`, `enviada_por`, `enviada_en`, `estado` (`ENVIADA` · `ERROR_COMUNICACION` · `RESPONDIDA_PARCIAL` · `RESPONDIDA`).
- `emails_salida`: `para[]`, `cc[]`, `cco[]`, `asunto`, `cuerpo_html`, `adjunto_path`, `proforma_id`, `estado` (`PENDIENTE` · `ENVIADO` · `ERROR`), `intentos` (int, máximo 3), `ultimo_error`.
- `respuestas_proveedor`: `proforma_id`, `pedidos` = `[{pedido_id, resultado: ACEPTA\|RECHAZA}]`, `justificacion` (obligatoria si hay rechazos), `evidencia_paths[]` (obligatoria: imagen, PDF o .eml, hasta 10 MB c/u), `fecha_respuesta` (date), `registrado_por`, `registrado_en`.
- `reportes_liquidacion`: `generado_por`, `generado_en`, `filtros`, `cantidad_pedidos`, `total_neto_cents`, `total_cents`, `numero` (correlativo), `archivo_path`, `estado` (`PROCESANDO` · `LISTO`).
- `reportes_oc`: `generado_por`, `generado_en`, `cantidad_pedidos`, `cantidad_oc`, `total_cents`, `archivo_path`, `estado`.
- `parametros/global`: `condiciones_pago[]`, `tolerancia_volumen_pct` (5), `email_cdg[]` (destinatarios de las solicitudes de CP), `origen_estricto` (bool, por defecto `true`, ver §3.3 paso 2), `oc_constantes` = `{moneda: "PES", moneda_cotizacion: "PES", cotizacion: 1, preciosobre: 1, workflow: "CPRA-SERCON", cantidad_por_pedido: 1}`, `formato_fecha_oc` (`dd/MM/yyyy`).
- `auditoria`: `entidad`, `entidad_id`, `accion`, `usuario`, `antes`, `despues`, `timestamp`.

**Índices compuestos iniciales:** `pedidos(sucursal_id, estado, importado_en desc)`, `pedidos(lote_id, estado)`, `pedidos(estado, fecha_aceptacion)`, `pedidos(proforma_id)`, `reglas_tarifa(tarifario_id, tipo_regla)`, `reglas_tarifa(tarifario_id, codigo_postal_destino)`, `tarifarios(id_proveedor, vigencia_desde desc)`, `solicitudes_cp(estado, creado_en desc)`, `auditoria(entidad, entidad_id, timestamp desc)`.

### 2.6 Modelo de la Fase 2 (venta y comparación)

La venta tiene dos tarifarios y dos motores (D23).

- `tarifarios_venta`: `tipo_servicio` (`ENCOMIENDA` · `LOGISTICA`), `version`, `vigencia_desde`, `vigencia_hasta`, `estado`, `archivo_origen_path`.
- `reglas_venta` (Encomienda), una fila por fila del Tarifario QX: `cabecera_origen`, `cabecera_destino`, `subzona`, `rango_kg`, `kg_desde`, `kg_hasta`, `codigo_buscador` (`{cabecera_origen}-{cabecera_destino}-{subzona}-{rango_kg}`), `colecta`, `lh`, `lm`, `total_con_colecta`, `total_sin_colecta`. La cabecera de origen se deriva del canalizador por `codigo_postal_origen`; la del TMS ("ZONA SUR", "SANTA FE") no sirve como código.
- `reglas_venta` (Logística): se define con Comercial. Usará bultos y pallets (`precio_bulto`, `precio_pallet`).
- `clasificarServicio(pedido)`: `ENCOMIENDA` si `volumen_m3` ≤ 1, `peso_kgs` ≤ 50 y `cantidad_bultos` = 1; si no, `LOGISTICA`. Los límites inclusivos se confirman con Comercial.
- En `pedidos`: `venta` = `{tipo_servicio, tarifario_venta_id, codigo_buscador, precio_venta, origen: TARIFARIO\|MANUAL, margen_monto, margen_pct, avance_con_margen_negativo?}`. En Encomienda, el precio de venta es `total_con_colecta` si la regla ganadora de costo aplica colecta y `total_sin_colecta` si no.
- Con el motor de venta, la cobertura QX pasa a ser una opción con precio dentro del ranking de opciones (D25).

## 3. Arquitectura del sistema

La SPA lee Firestore en vivo y escribe solo a través de callables; el motor es una librería pura que las Functions invocan; los emails salen por un outbox con cola de reintentos.

&#91;embedded content: componentes · MVP en línea continua, Fase 2 punteada\]

El motor no conoce Firestore ni la UI: recibe datos y devuelve un resultado, por eso se prueba aislado y se reutiliza en el simulador.

### 3.1 Autenticación y roles (§7.1)

- Login con Google limitado al dominio corporativo, verificado también en backend.
- Un usuario autenticado sin rol ve una pantalla de acceso pendiente con el botón *Solicitar acceso*: crea un documento en `solicitudes_acceso` y avisa a los `ADMIN` (contador en la UI y email por outbox).
- Rol y sucursales viajan en custom claims. `ANALISTA` opera solo sus sucursales (una o más cabeceras de origen); `BACKOFFICE`, que asiste a la operación gestionando pedidos, opera todas.

| Capacidad | ADMIN | ATENCION\_PROVEEDOR | ANALISTA | BACKOFFICE | ADMINISTRACION |
| --- | --- | --- | --- | --- | --- |
| Usuarios, roles, sucursales, canalizador, parámetros, solicitudes de CP | Sí |  |  |  |  |
| ABM de proveedores (incluye IVA, seguro y alias) y de tarifas | Sí | Sí |  |  |  |
| Plantillas de email | Sí | Sí |  |  |  |
| Importar, revisar, valorizar, cotizar manual y cancelar pedidos | Sí |  | Sus sucursales | Todas |  |
| Enviar proformas | Sí |  | Sus sucursales | Todas |  |
| Registrar la respuesta del proveedor | Sí | Sí |  |  |  |
| Confirmar el bloque y generar el reporte de liquidación (§7.8) | Sí |  | Sus sucursales | Todas |  |
| Generar el reporte de OC (§7.9) | Sí |  |  |  | Sí |
| Reabrir un pedido aceptado | Sí |  |  |  |  |
| Consultar pedidos, proformas y reportes | Sí | Lectura | Sus sucursales | Todas | Lectura |
| Auditoría | Sí |  |  |  |  |

**Control por oposición.** Quien envió una proforma no puede registrar su respuesta, ni siquiera un `ADMIN`: `proformas.registerResponse` rechaza la llamada si `registrado_por` es igual a `enviada_por`. Así el analista que valoriza nunca valida su propia tarifa.

### 3.2 Carga de datos (§7.2, §7.3, §7.4)

- **Proveedores:** formulario ABM; CUIT validado por dígito verificador y único vía `indice_cuit` en la misma transacción. La baja es lógica (`INACTIVO`). En el mismo formulario se configuran condición de pago, IVA, seguro, alias y parámetros de email. Se puede cargar un proveedor antes de tener su tarifario.
- **Tarifas:** además del ABM fila a fila, importación masiva desde el **Excel maestro**, que reúne a todos los proveedores y crece a medida que Atención al Proveedor suma tarifarios (D29). Flujo:
  1. Subir el maestro. Cada fila se asigna a un proveedor por `id_proveedor` o alias (`norm()`); los nombres sin proveedor se listan como error y se piden dar de alta.
  2. Se validan las filas (D3, §2.3) y se pliega la fila de excedente.
  3. Se crea un tarifario `BORRADOR` por cada proveedor presente en el archivo y se indica la `vigencia_desde` de cada uno. Los proveedores ausentes del archivo no se tocan.
  4. Se ven las advertencias (`TARIFARIO_SOSPECHOSO`, `CP_NO_EN_CANALIZADOR`) y las diferencias contra la versión vigente.
  5. Se publica cada borrador por separado. Todos los importes se cargan netos.
  - El estado y las columnas `precio_kg_base` / `precio_m3_base` del maestro actual se aceptan: el estado se ignora y los precios se leen como `precio_tramo`.
- **Canalizador de CP:** `postalRouter.import` (ADMIN) reemplaza el canalizador desde el archivo de 8 columnas (`CODIGO_POSTAL`, `PROVINCIA`, `LOCALIDAD`, `PARTIDO`, `ZONA`, `CABECERA`, `SUBZONA`, `ZONA TARIFARIO`), versionado, y resuelve las `solicitudes_cp` cuyos CPs ya existen. El ABM de zonas y CP sigue fuera de alcance: los CPs faltantes los agrega CDG en el archivo.
- **Pedidos:**
  1. El usuario descarga la plantilla oficial: las 47 columnas de §7.4 más `alto_cm`, `ancho_cm` y `largo_cm` opcionales.
  2. SheetJS lee el archivo en el navegador, normaliza los encabezados (D28) y Zod valida cada fila (obligatorias, tipos, peso y volumen mayores que 0, cabecera de origen entre las sucursales del usuario); los errores se ven antes de subir.
  3. El archivo original va a Storage. `orders.importBatch` crea el lote con `fecha_referencia` igual al día actual (huso de Buenos Aires) y las filas viajan en bloques de 500.
  4. El servidor revalida, normaliza y deduplica por `{sucursal_id}_{nro_pedido}`; reimportar el mismo archivo no crea duplicados.
  5. Al llegar el último bloque el lote pasa a `LISTO` y `orders.onBatchReady` lo valoriza con el motor; el panel de revisión se actualiza en vivo.
- **Normalización de entrada (D28):** los encabezados se comparan sin `:` final, sin tildes y sin distinguir mayúsculas. Los montos traen coma de miles y punto decimal (`349,731.72`); las fechas son `dd/MM/yyyy` o `dd/MM/yyyy HH:mm:ss`; el CP debe tener 4 dígitos. Localidades, provincias y cabeceras se normalizan con `norm()`. Con dimensiones en centímetros se calcula un volumen de control (`alto_cm × ancho_cm × largo_cm ÷ 1.000.000`); si difiere más de 5% de `Volumen M3`, observación `VOLUMEN_INCONSISTENTE`.
- **Observaciones (no bloquean):** `VOLUMEN_INCONSISTENTE`, `AFORADO_MENOR_A_PESO`, `AFORADO_CERO` (peso aforado igual a 0; se corrige en el sistema de origen con el área responsable, y el panel permite exportarlas), `VALOR_DECLARADO_FALTANTE`, `DESTINO_DIFIERE_TMS`, `CP_NO_EN_CANALIZADOR`, `CP_AMBIGUO` (el CP tiene más de una variante con precios o plazos distintos), `PROVINCIA_DIFIERE` (ninguna variante coincide con la provincia del pedido; se conservan todas).
- **Códigos de error de fila (bloquean):** `CAMPO_OBLIGATORIO` (incluye `cabecera_origen` vacía), `FORMATO_INVALIDO`, `PESO_INVALIDO` (vacío o menor o igual a 0), `VOLUMEN_INVALIDO` (menor o igual a 0), `CABECERA_NO_PERMITIDA`, `DUPLICADO`. Los errores de datos del TMS (peso, volumen o cabecera en 0 o vacíos) se exportan desde el panel para su corrección en origen y se reimportan.

### 3.3 Motor de cotización y regla de Mayor Valor (§7.5)

`packages/motor` expone `cotizar(pedido, contexto)`, donde `contexto` trae el canalizador, los proveedores, sus reglas indexadas por CP, la `fecha_referencia` del lote y `origen_estricto`. Es una función pura, sin I/O, versionada con `MOTOR_VERSION`. Devuelve el desglose completo, el criterio aplicado, las reglas usadas, el ranking de candidatas y el motivo de descarte de cada una.

1. **Ubicar el destino:** se busca el `codigo_postal` del pedido en el canalizador. Con uno o más registros, se toma el que coincida con la localidad y la provincia normalizadas del pedido, o el único que haya; de ahí salen `zona`, `cabecera`, `subzona` y `cobertura_qx`. Si el CP no existe, `cobertura_qx` es `DESCONOCIDA`, el pedido lleva `CP_NO_EN_CANALIZADOR` y se crea la solicitud a CDG (D27); **la cotización sigue por CP**. El origen se resuelve por `codigo_postal_origen` → `provincia_origen` y `localidad_origen`.
2. **Candidatas:** se toman los proveedores `ACTIVO` con un tarifario cuyo rango de vigencia contiene la `fecha_referencia` del lote, y sus reglas con `codigo_postal_destino` igual al CP del pedido, agrupadas por `variante_id`. Si el pedido trae provincia y alguna variante coincide con ella, se descartan las variantes de otras provincias; si ninguna coincide, se conservan todas con `PROVINCIA_DIFIERE`. Dentro de cada variante, el origen se resuelve por precedencia: localidad de origen, luego provincia de origen, luego `*`. Con `origen_estricto = true` (valor por defecto), una regla con provincia de origen distinta a la del pedido no aplica; una regla sin provincia de origen informada se toma como `Buenos Aires`. Con `false`, se ignora la provincia de origen y solo cuenta `*` y la localidad. Si el grupo más específico existe pero no tiene tramo para el valor, esa candidata se descarta para ese componente y no cae a un grupo más general.
3. **Tramos:** el tramo de peso es la regla `PESO` con `peso_kgs` en (kg\_min, kg\_max\] y el de volumen es la regla `VOLUMEN` con `volumen_m3` en (m3\_min, m3\_max\]. Se eligen de forma independiente. Si el valor supera el último tramo se usa el último y el sobrante se cobra a `precio_kg_excedente` o `precio_m3_excedente`; sin ese precio la candidata se descarta (`PESO_EXCEDIDO_SIN_REGLA` o `VOLUMEN_EXCEDIDO_SIN_REGLA`). Una candidata sin reglas de un tipo aporta 0 a ese costo; sin reglas de ninguno se descarta con `SIN_TARIFA`.
4. **Cálculo por candidata:** fórmulas de abajo, con redondeo half-up a centavo en `costo_peso`, `costo_volumen`, `seguro` e `iva`.
5. **Criterio y adicionales:** el criterio es `PESO` si `costo_peso` ≥ `costo_volumen` y `VOLUMEN` en caso contrario. La colecta sale de la regla del tramo del criterio ganador si tiene `aplica_colecta`. Seguro e IVA salen del proveedor.
6. **Ranking:** las candidatas válidas se ordenan por `total final` ascendente; el empate lo desempata el menor `id_proveedor` y luego el menor `variante_id`. La primera es la cotización elegida y queda en `cotizacion`; todas las válidas quedan en `alternativas` y la UI muestra las dos primeras con acceso al resto. Si el CP tiene varias variantes, el pedido lleva `CP_AMBIGUO` y el panel lo resalta para que el analista confirme la variante.
7. **Resultado del pedido:**
   - Con `cobertura_qx = SI`: `COBERTURA_QX`, haya o no candidatas de expreso. Si las hay, quedan en `alternativas` y en `cotizacion` se guarda la mejor como sugerencia, pero el pedido no entra al circuito de proformas hasta que el analista elija una opción de expreso (`orders.chooseAlternative`), que lo pasa a `VALORIZADO`. En el MVP la cobertura QX no lleva precio.
   - Con al menos una candidata válida y sin cobertura QX (`NO` o `DESCONOCIDA`): `VALORIZADO`.
   - Sin candidatas y sin cobertura QX: `SIN_COBERTURA` (Requiere cotización manual), con los motivos por candidata.
   - El lote nunca se detiene.

El precio de venta de QX y su competencia dentro del ranking llegan con el motor de la Fase 2 (D23, D25).

```latex
\begin{aligned}
\text{costo\_peso} &= C^{kg}_{base} + P^{kg}_{tramo} + \max(0,\ kg - kg_{tope}) \cdot P^{exc}_{kg} \\
\text{costo\_volumen} &= C^{m3}_{base} + P^{m3}_{tramo} + \max(0,\ m3 - m3_{tope}) \cdot P^{exc}_{m3} \\
\text{flete} &= \max(\text{costo\_peso},\ \text{costo\_volumen}) \\
\text{seguro} &= \text{valor\_declarado} \cdot \tfrac{\%\,seguro_{prov}}{100} \\
\text{neto} &= \text{flete} + \text{colecta} + \text{seguro} \\
\text{iva} &= \text{neto} \cdot \tfrac{IVA_{prov}}{100} \qquad \text{total} = \text{neto} + \text{iva}
\end{aligned}
```

`P_tramo` es el `precio_tramo` del tramo que contiene el valor (el último si el valor lo supera) y `kg_tope` / `m3_tope` es el máximo del último tramo. El término de excedente es 0 si el valor no supera el tope.

**Caso de referencia 1 (MVP-14).** Proveedor con IVA 21%, seguro 0,5% y estos datos: pedido de 30 kg, 0,2 m3 y valor declarado $100.000; tramo de peso (10, 50\] con precio $1.600; tramo de volumen (0,05, 0,5\] con precio $2.600 y colecta $320,83.

| Componente | Cálculo | Resultado |
| --- | --- | --- |
| `costo_peso` | precio del tramo (10, 50\] | $1.600,00 |
| `costo_volumen` | precio del tramo (0,05, 0,5\] | $2.600,00 |
| `flete` y `criterio` | máximo de ambos | $2.600,00, `VOLUMEN` |
| `colecta` | de la regla de volumen | $320,83 |
| `seguro` | 100.000 × 0,5 ÷ 100 | $500,00 |
| `neto` | 2.600,00 + 320,83 + 500,00 | $3.420,83 |
| `iva` | 3.420,83 × 21% = 718,3743, redondeado | $718,37 |
| `total` | 3.420,83 + 718,37 | $4.139,20 |

**Caso de referencia 2 (excedente).** Sin seguro ni IVA ni colecta; pedido de 1.050 kg y 0,1 m3; último tramo de peso (900, 1.000\] con precio $500.000 y `precio_kg_excedente` $600; tramo de volumen (0, 0,2\] con precio $20.000. `costo_peso` = 500.000 + (1.050 − 1.000) × 600 = $530.000,00; `costo_volumen` = $20.000,00; `flete` = $530.000,00, criterio `PESO`.

### 3.4 Proformas, emails y confirmación (§7.7)

- **Envío:** `proformas.send` toma los pedidos `VALORIZADO` del lote, los agrupa por el proveedor de la cotización elegida y crea una proforma y un email por proveedor. Congela los totales, genera el adjunto con exceljs según la plantilla y deja el email en el outbox. Los pedidos en `CON_ERROR`, `VALIDADO`, `SIN_COBERTURA` o `COBERTURA_QX` no se pueden enviar.
- **Parametrización (§7.7):** existe una plantilla por defecto y cada proveedor puede tener la suya (`email_config.plantilla_id`). La plantilla define asunto, cuerpo HTML, columnas del adjunto, formato del adjunto (`XLSX` o `CSV`), destinatarios extra, CC y CCO. `para_extra`, `cc` y `cco` del proveedor se suman a los de la plantilla, sin duplicados; el destinatario base es `email_contacto`. El cuerpo solo acepta las variables del catálogo: `{{proveedor.razon_social}}`, `{{lote.id}}`, `{{fecha}}`, `{{resumen.cantidad}}`, `{{resumen.neto}}`, `{{resumen.iva}}` y `{{resumen.total}}`. Antes de guardar hay vista previa con datos de ejemplo.
- **Contenido:** el cuerpo resume el lote (cantidad de pedidos, neto, IVA y total) y el adjunto detalla cada pedido con las columnas elegidas, entre ellas `criterio`, `detalle_tarifa` (la tarifa utilizada), `neto`, `iva` y `total`.
- **Worker:** un trigger encola cada email en Cloud Tasks y el worker lo envía por Gmail API. Éxito: proforma `ENVIADA` y pedidos a `PENDIENTE_CONFIRMACION`. Fallo: reintento con backoff; al tercer fallo, el email queda en `ERROR`, la proforma en `ERROR_COMUNICACION`, los pedidos en `ERROR_COMUNICACION` y el analista recibe un aviso en la UI. Desde ahí se puede reenviar.
- **Idempotencia:** el worker verifica el estado del email antes de enviar, para no duplicar correos si la cola reintenta después de un éxito.
- **Respuesta del proveedor:** `proformas.registerResponse`, a cargo de Atención al Proveedor, registra por pedido `ACEPTA` o `RECHAZA` (por defecto, todos los de la proforma). Exige evidencia (captura de mail, imagen, PDF o .eml) en toda respuesta, justificación de texto si hay rechazos y la fecha de la respuesta. Los aceptados pasan a `ACEPTADO_PROVEEDOR` con `fecha_aceptacion`; los rechazados, a `EN_DISPUTA`. La proforma queda `RESPONDIDA` o `RESPONDIDA_PARCIAL`.
- **Disputa:** un pedido `EN_DISPUTA` sale por tres caminos: corregir la tarifa y `orders.requote`, elegir otra alternativa con `orders.chooseAlternative`, o cotizar a mano con `orders.setManualQuote`. Al volver a `VALORIZADO` se incluye en una proforma nueva del proveedor elegido.
- **Notificaciones internas (MVP):** contadores en la UI calculados por consulta (solicitudes de acceso pendientes, solicitudes de CP pendientes, pedidos en `ERROR_COMUNICACION`, pedidos en `EN_DISPUTA`), sin colección propia. Las solicitudes de CP además salen por email a `parametros.email_cdg`.

### 3.5 Reporte de liquidación (§7.8)

El reporte alimenta la liquidación en el TMS y lo confirman analistas o BackOffice. Administración toma después los pedidos para la orden de compra (§3.6).

1. `settlement.preview` lista los pedidos `ACEPTADO_PROVEEDOR`, filtrables por fecha de aceptación, sucursal y proveedor, con subtotales por proveedor, para que el analista observe y detecte errores.
2. El analista puede excluir pedidos del bloque y luego confirma el bloque con `settlement.confirmBlock`.
3. La función crea el reporte en `PROCESANDO`, genera el xlsx o csv con exceljs, lo guarda en Storage, registra `reportes_liquidacion`, marca los pedidos `LISTO_PARA_OC` y guarda `reporte_liquidacion_id`. Con más de 500 pedidos escribe en tandas (BulkWriter).
4. El historial lista los reportes generados y permite volver a descargarlos.
5. `confirmBlock` rechaza con `PEDIDO_NO_EXPORTABLE` cualquier pedido que no esté `ACEPTADO_PROVEEDOR`, en particular los `PENDIENTE_CONFIRMACION` y `EN_DISPUTA`.

**Columnas:** las 47 de §7.4 en su orden original, con los valores que completa el sistema, y al final ocho columnas técnicas: `id_proveedor`, `razon_social`, `cuit`, `criterio`, `neto`, `iva`, `total` y `fecha_aceptacion`. Los importes van con 2 decimales (punto decimal en CSV, numérico en xlsx) y las fechas nuevas en formato `yyyy-MM-dd`. Los valores que el TMS exporta con coma de miles no se reutilizan: el reporte usa su propio formato.

| Columna del reporte | Valor |
| --- | --- |
| Id Tarifa | `{id_proveedor}-v{version}` del tarifario usado |
| Valor Calculado Tarifa | `flete + colecta` (neto) |
| Valor Calculado Seguro | `seguro` |
| Valor Calculado Reembolso | El valor importado; el sistema no lo calcula |
| Total a Facturar | `total` (con IVA) |
| Status y Fecha Status | `Aceptado por Proveedor` y `fecha_aceptacion` |
| Codigo de Expreso y Transporte | `id_proveedor` y `razon_social` |
| Nro de Liquidación e IdLiquidacion | `numero` correlativo del reporte e id del reporte |
| Fecha de Liquidación y Usuario Liquidación | Fecha de generación y usuario que confirmó el bloque |
| Todas las demás | Valores importados, sin cambios (`origen_tms`) |

### 3.6 Reporte de orden de compra (§7.9)

Lo genera Administración (`purchaseOrders.generateReport`) con los pedidos `LISTO_PARA_OC`. Genera una OC por proveedor y reporte, con una línea por pedido, en xlsx o csv. Guarda el archivo en Storage, registra `reportes_oc` (historial con re-descarga), guarda `reporte_oc_id` y pasa los pedidos a `LIQUIDADO`. Rechaza con `PEDIDO_NO_EXPORTABLE` los pedidos en cualquier otro estado.

| Columna | Valor |
| --- | --- |
| `numero` | Correlativo de la OC dentro del reporte (1, 2, 3 …), igual para todas las líneas de un proveedor |
| `fecha`, `fechacomprobante`, `fechabasevencimiento` | Fecha de generación, en el formato de `parametros.formato_fecha_oc` |
| `proveedor` | `id_proveedor` |
| `condicionpago` | `condicion_pago` del proveedor |
| `cantidad` | 1 por pedido (`oc_constantes.cantidad_por_pedido`) |
| `precio` | `total` del pedido con IVA, con 2 decimales |
| `preciosobre` | 1 |
| `moneda_cotizacion` y `moneda` | `PES` |
| `cotizacion` | 1 |
| `workflow` | `CPRA-SERCON` |
| Vacías | `comprobante`, `sucursal`, `descripcion`, `producto`, `descripcionitem`, `destinatario`, `provincia_destino`, `provincia_destino_item`, `fechaproximopaso`, `dimension`, `dimensionvalor` |

Las constantes salen de `parametros.oc_constantes` y todo el mapeo vive en un único módulo `exporters/purchaseOrder.ts`, para ajustarlo sin tocar el resto.

### 3.7 Estados del pedido

| Estado | Llega desde | Disparador | Puede pasar a |
| --- | --- | --- | --- |
| `CON_ERROR` | Importación | Fila inválida | `CANCELADO` (se corrige y se reimporta; conserva sus `errores[]`, D32) |
| `VALIDADO` | Importación | Fila válida | `VALORIZADO`, `COBERTURA_QX`, `SIN_COBERTURA`, `CANCELADO` |
| `SIN_COBERTURA` | `VALIDADO`, `COBERTURA_QX`, `VALORIZADO`, `EN_DISPUTA` | Motor sin candidata válida ni cobertura QX | `VALORIZADO` (manual o al revalorizar), `COBERTURA_QX` (al revalorizar), `CANCELADO` |
| `COBERTURA_QX` | `VALIDADO`, `SIN_COBERTURA`, `VALORIZADO`, `EN_DISPUTA` | Motor con cobertura QX (con o sin opciones de expreso) | `VALORIZADO` (elegir una opción de expreso, cotizar a mano, o revalorizar tras cargar un tarifario), `SIN_COBERTURA` (al revalorizar), `CANCELADO` |
| `VALORIZADO` | `VALIDADO`, `SIN_COBERTURA`, `COBERTURA_QX`, `EN_DISPUTA`, `ERROR_COMUNICACION` | Motor o cotización manual | `PENDIENTE_CONFIRMACION`, `ERROR_COMUNICACION`, `SIN_COBERTURA`, `COBERTURA_QX`, `CANCELADO` |
| `ERROR_COMUNICACION` | `VALORIZADO` | Tres envíos fallidos | `PENDIENTE_CONFIRMACION` (reenvío), `VALORIZADO` (revalorizar), `CANCELADO` |
| `PENDIENTE_CONFIRMACION` | `VALORIZADO`, `ERROR_COMUNICACION` | Proforma enviada | `ACEPTADO_PROVEEDOR`, `EN_DISPUTA` |
| `EN_DISPUTA` | `PENDIENTE_CONFIRMACION`, `ACEPTADO_PROVEEDOR` | El proveedor rechaza, o `ADMIN` reabre | `VALORIZADO`, `SIN_COBERTURA`, `COBERTURA_QX`, `CANCELADO` |
| `ACEPTADO_PROVEEDOR` | `PENDIENTE_CONFIRMACION` | El proveedor acepta | `LISTO_PARA_OC`, `EN_DISPUTA` (solo `ADMIN`) |
| `LISTO_PARA_OC` | `ACEPTADO_PROVEEDOR` | Bloque confirmado en el reporte §7.8 | `LIQUIDADO` |
| `LIQUIDADO` | `LISTO_PARA_OC` | Incluido en un reporte de OC | Final |
| `CANCELADO` | `CON_ERROR`, `VALIDADO`, `SIN_COBERTURA`, `COBERTURA_QX`, `VALORIZADO`, `ERROR_COMUNICACION`, `EN_DISPUTA` | Acción del analista | Final |

Las transiciones viven en `packages/shared` como tabla única; cualquier cambio de estado fuera de ella se rechaza con `TRANSICION_INVALIDA`. Un pedido que llega a `CANCELADO` desde `CON_ERROR` conserva sus `errores[]` y puede tener campos de importación ausentes o inválidos (D32): el esquema de `pedidos` tiene que admitir esa combinación de `estado` y `errores[]`. "Tarifa en Disputa" y "En Disputa" del documento funcional son el mismo estado, `EN_DISPUTA`. La UI muestra las etiquetas del documento funcional: "Pendiente de Confirmación", "En Disputa", "Aceptado por Proveedor", "Listo para generar OC", "Sin Cobertura / Requiere Cotización Manual" y "Error de Comunicación"; `COBERTURA_QX` se muestra como "Cobertura QX (sin expreso)". Un pedido en este estado muestra también las opciones de expreso, si las hay.

### 3.8 Contratos de Functions del MVP

| Función | Tipo | Rol | Responsabilidad |
| --- | --- | --- | --- |
| `auth.requestAccess` | callable | Autenticado sin rol | Crea la solicitud y avisa a los `ADMIN`. |
| `admin.setUserRole` | callable | `ADMIN` | Asigna rol y sucursales (claims y `usuarios`). |
| `admin.updateParams` | callable | `ADMIN` | Edita `parametros/global`. |
| `admin.importBranches` | callable | `ADMIN` | Carga o actualiza el catálogo `sucursales` (cabeceras de origen). |
| `postalRouter.import` | callable | `ADMIN` | Carga o reemplaza el canalizador, versionado; resuelve `solicitudes_cp`. |
| `postalRouter.resolveRequest` | callable | `ADMIN` | Marca una solicitud de CP como resuelta o la descarta. |
| `suppliers.upsert` / `suppliers.setStatus` | callable | `ADMIN`, `ATENCION_PROVEEDOR` | Alta, modificación y baja lógica con CUIT único, IVA, seguro, condición de pago, alias y `email_config`. |
| `tariffs.importDraft` | callable | `ADMIN`, `ATENCION_PROVEEDOR` | Importa el Excel maestro (varios proveedores) y crea un tarifario `BORRADOR` por proveedor. |
| `tariffs.upsertRule` / `tariffs.deleteRule` | callable | `ADMIN`, `ATENCION_PROVEEDOR` | Edita filas solo en borrador. |
| `tariffs.publish` | callable | `ADMIN`, `ATENCION_PROVEEDOR` | Valida solapamientos, huecos y datos obligatorios; publica y cierra la versión anterior; emite advertencias. |
| `emailTemplates.upsert` | callable | `ADMIN`, `ATENCION_PROVEEDOR` | Crea o edita plantillas de proforma, con vista previa. |
| `orders.importBatch` | callable | `ADMIN`, `ANALISTA`, `BACKOFFICE` | Crea el lote, valida, deduplica y persiste filas. |
| `orders.onBatchReady` | trigger | Sistema | Valoriza el lote con el motor y crea las `solicitudes_cp`. |
| `orders.requote` / `orders.chooseAlternative` / `orders.setManualQuote` / `orders.cancel` | callable | `ADMIN`, `ANALISTA`, `BACKOFFICE` | Acciones del panel de revisión y de disputas. `chooseAlternative` elige entre proveedor y variante. La cotización manual exige proveedor, montos y justificación. |
| `orders.reopen` | callable | `ADMIN` | Pasa un `ACEPTADO_PROVEEDOR` a `EN_DISPUTA`, con justificación. |
| `proformas.send` | callable | `ADMIN`, `ANALISTA`, `BACKOFFICE` | Agrupa por proveedor, genera el adjunto y crea los emails en el outbox. |
| `emails.worker` | cola | Sistema | Envía con 3 reintentos y actualiza estados. |
| `proformas.registerResponse` | callable | `ADMIN`, `ATENCION_PROVEEDOR` | Registra la respuesta con evidencia; rechaza si `registrado_por` es quien envió. |
| `settlement.preview` / `settlement.confirmBlock` | callable | `ADMIN`, `ANALISTA`, `BACKOFFICE` | Previsualiza el bloque, genera el reporte §7.8 y pasa los pedidos a `LISTO_PARA_OC`. |
| `purchaseOrders.generateReport` | callable | `ADMIN`, `ADMINISTRACION` | Genera el reporte §7.9 y pasa los pedidos a `LIQUIDADO`. |
| `reports.getDownloadUrl` | callable | Roles con acceso al reporte | Devuelve una URL firmada de corta duración. |

Toda callable que escribe pasa por el helper `withAudit`, que registra `antes` y `despues` en `auditoria` dentro de la misma transacción. Los errores de negocio se devuelven como `HttpsError` con un `code` definido en `packages/shared` (`DUPLICADO`, `TRANSICION_INVALIDA`, `PEDIDO_NO_EXPORTABLE`, `MISMO_USUARIO`, `TARIFARIO_INVALIDO`, `PROVEEDOR_NO_ENCONTRADO`).

## 4. Fase 1: MVP

El MVP cubre §7.1 a §7.5, §7.7, §7.8 y §7.9 completos, incluida la plantilla de email parametrizable, y deja para la Fase 2 la comparación costo/venta (§7.6) con sus dos motores, el reporte de tarifas a Drive y la integración con BigQuery. Sin confirmación, liquidación y orden de compra el sistema no reemplaza el proceso manual, por eso entran todos.

Se entrega en dos hitos:

- **Hito 1A · Validación del motor en modo sombra:** tareas MVP-01 a MVP-21 y MVP-30. Las sucursales piloto importan en paralelo al proceso manual y se comparan los resultados.
  - **Criterio de salida:** el motor coincide con la liquidación manual en al menos 98% de los pedidos de un mes histórico **que caen en proveedores con tarifario cargado**, y cada diferencia restante tiene causa documentada (error de la planilla o regla faltante). Requiere la planilla de liquidación manual con el costo real por pedido y tarifarios de los expresos usados en ese mes.
- **Hito 1B · Operación:** tareas MVP-22 a MVP-29. Se habilitan proformas, respuesta del proveedor, liquidación y OC, y se apaga la planilla manual en la sucursal piloto.
  - **Criterio de salida:** la sucursal piloto completa un ciclo mensual, de la importación a la OC, sin planilla manual y sin correcciones de formato en el TMS ni en Finnegans.

| ID | Tarea | Depende de | Criterio de aceptación |
| --- | --- | --- | --- |
| MVP-01 | Monorepo pnpm con `apps/web`, `apps/functions`, `packages/shared`, `packages/motor`; TS estricto, ESLint, Prettier, Vitest | — | `pnpm test` y `pnpm typecheck` pasan en un repo vacío. |
| MVP-02 | Proyectos Firebase dev y prod en Blaze, vinculados a la cuenta de facturación de GCC, región `southamerica-east1`, alerta de presupuesto, Emulator Suite | — | Deploy manual a dev funciona; los emuladores levantan con un comando; la alerta de presupuesto dispara con un umbral de prueba. |
| MVP-03 | GitHub Actions: lint, typecheck, tests con emuladores, deploy a dev en merge, prod por tag, preview de Hosting por PR | 01, 02 | Un PR muestra los checks y una URL de preview. |
| MVP-04 | `packages/shared`: esquemas Zod de todas las entidades y de las columnas de importación, roles, enums de estado, tabla de transiciones, códigos de error, tipos `dec` y `cents`, `norm()` con alias de provincia y parser del TMS (encabezados, montos y fechas, D28) | 01 | Tests de parseo válido e inválido por entidad; la tabla de transiciones coincide con §3.7; el parser lee `pedidos_tms.csv` real (538 filas, encabezados con `:`, `349,731.72`, fechas `dd/MM/yyyy`) sin errores de formato. |
| MVP-05 | Login con Google restringido al dominio; pantalla de acceso pendiente con *Solicitar acceso* | 02 | Un email externo al dominio no entra; uno interno sin rol ve la pantalla pendiente. |
| MVP-06 | Custom claims de rol y sucursales; `admin.setUserRole`; pantalla de usuarios y solicitudes | 05 | Cambiar un rol se refleja al refrescar el token y queda en auditoría; existen los cinco roles. |
| MVP-07 | Reglas de seguridad de Firestore y Storage por rol y sucursal, con tests en emulador | 04, 06 | Un `ANALISTA` no lee pedidos de otra sucursal; `ATENCION_PROVEEDOR` y `ADMINISTRACION` solo leen; ningún cliente escribe colecciones de negocio. |
| MVP-08 | Helper `withAudit`, colección `auditoria` y visor para `ADMIN` | 04 | Toda callable de escritura deja registro con antes y después. |
| MVP-09 | ABM de proveedores (§7.2) con condición de pago, IVA, seguro, alias y `email_config`; utilizable sin tarifario | 07, 08 | CUIT duplicado o con dígito verificador inválido se rechaza; `aplica_seguro` exige porcentaje; el IVA está entre 0 y 100; un alias repetido entre proveedores se rechaza. |
| MVP-10 | Importación del canalizador de CP (`ADMIN`), consulta de solo lectura y `solicitudes_cp` con aviso a CDG | 07 | Carga `canalizador.csv` real (3.469 CPs), normaliza las provincias inconsistentes y resuelve zona, cabecera, subzona y cobertura QX para una muestra de 100 CP; un CP inexistente crea una solicitud y envía el aviso; reimportar el canalizador con ese CP la resuelve. |
| MVP-11 | Tarifarios: importación del Excel maestro multi-proveedor a `BORRADOR` (uno por proveedor), asignación por `id_proveedor` o alias, pliegue de la fila de excedente, validaciones (solapamientos, huecos, obligatorios, excedente solo en el último tramo), advertencias `TARIFARIO_SOSPECHOSO` y `CP_NO_EN_CANALIZADOR`, y publicación | 04, 09, 10 | Importa `tarifa_por_proveedor.csv` real (11.453 filas, 2 proveedores) creando 2 borradores; los CPs con varias variantes (p. ej. 4500 de Hacha de Piedra) se conservan como variantes; un maestro con un nombre sin proveedor lista el error; un tarifario con tramos solapados o con huecos no se publica; publicar cierra la versión anterior con `vigencia_hasta` igual a la nueva `vigencia_desde` menos 1 día. |
| MVP-12 | Editor de reglas en grilla (alta, baja, modificación de filas en borrador) y vista de diferencias contra la versión vigente | 11 | Cada cambio queda auditado; las filas publicadas no son editables. |
| MVP-13 | `packages/motor`: ubicación por CP, variantes, filtro por provincia y selección de reglas candidatas con precedencia de origen y vigencia | 04 | Tests por cada nivel de precedencia de origen, por `origen_estricto`, por vigencia según `fecha_referencia`, por CP con varias variantes (misma provincia y provincias distintas), por CP ausente del canalizador y por la ausencia de caída a un grupo más general. |
| MVP-14 | `packages/motor`: tramos, excedentes, Mayor Valor, colecta, seguro, IVA, redondeo, ranking por total final, motivos de descarte, resultado `COBERTURA_QX` / `SIN_COBERTURA` y `MOTOR_VERSION` | 13 | Cobertura de tests de 90% o más; el caso de referencia 1 de §3.3 da exactamente $4.139,20 y el 2 da un flete de $530.000,00; ningún cálculo usa `number` para dinero; no existe ninguna variable de km ni de paradas. |
| MVP-15 | Set de casos dorados: 50 o más pedidos históricos con el costo real del proveedor, como test de regresión en CI | 14 | CI falla si un cambio en el motor altera un caso dorado sin actualizarlo explícitamente. Depende de obtener la planilla de liquidación manual. |
| MVP-16 | Simulador en la UI: kg, m3, CP de origen y destino, valor declarado y fecha → desglose por proveedor y variante | 12, 14 | Atención al Proveedor reproduce a mano tres casos de su planilla y obtiene el mismo resultado. |
| MVP-17 | Plantilla de pedidos, parser SheetJS con normalización de encabezados y validación por fila, control de dimensiones, subida en bloques a `orders.importBatch` y deduplicación | 07, 10, 30 | Un archivo de 5.000 filas se importa; `pedidos_tms.csv` real se importa con sus errores de datos (peso, volumen o cabecera vacíos o en 0) en el panel y las observaciones `AFORADO_CERO` sin bloquear; reimportarlo no crea duplicados; dimensiones inconsistentes dan observación sin bloquear. |
| MVP-18 | Trigger `orders.onBatchReady`: valoriza el lote y guarda cotización, alternativas, descartes y `cobertura_qx`; crea `solicitudes_cp` | 14, 17 | Ningún pedido queda sin estado final de valorización; `SIN_COBERTURA` trae motivos; `COBERTURA_QX` conserva las opciones de expreso y no pasa a proforma hasta elegir una; toda cotización guarda `fecha_referencia` y `motor_version`. |
| MVP-19 | Panel de revisión (§7.4): tabla virtualizada, errores y sin cobertura primero, las dos primeras opciones por pedido con acceso a todas (proveedor, variante, plazo), `CP_AMBIGUO` resaltado, columna `expreso_manual`, cambiar de alternativa, cancelar y exportar errores a xlsx | 18 | Con 5.000 filas el panel filtra y hace scroll sin trabas; un pedido con CP de varias variantes las muestra con localidad, zona y plazo; el xlsx de errores se reimporta tras corregirlo; se puede avanzar solo con los validados. |
| MVP-20 | Cotización manual para `SIN_COBERTURA` y `EN_DISPUTA`: proveedor, montos y justificación obligatoria | 18 | El pedido pasa a `VALORIZADO` con `origen: MANUAL` y queda auditado. |
| MVP-21 | Informe de modo sombra: diferencias entre el motor y la planilla manual por pedido; comparación del proveedor sugerido contra `expreso_manual` y distribución de proveedores | 19 | Informe mensual con porcentaje de coincidencia de costo, porcentaje de coincidencia de proveedor y causa de cada diferencia. |
| MVP-22 | Outbox `emails_salida`, worker con Cloud Tasks e integración con Gmail API (CC, CCO y adjuntos), con 3 reintentos | 02, 04 | Con el envío forzado a fallar, el email queda en `ERROR` tras 3 intentos y los pedidos en `ERROR_COMUNICACION`; un email ya enviado nunca se envía dos veces. |
| MVP-23 | Plantillas de email parametrizables: editor con variables del catálogo, columnas y formato del adjunto, CC y CCO, override por proveedor y vista previa | 09, 22 | Cambiar el CC o las columnas de una plantilla cambia el siguiente email sin desplegar código; una variable fuera del catálogo se rechaza. |
| MVP-24 | Proforma: agrupación por proveedor, adjunto xlsx o csv, totales congelados y `proformas.send` | 18, 23 | Se envía un email por proveedor y lote; el adjunto trae criterio, tarifa utilizada, neto, IVA y total de cada pedido, y su suma coincide con los totales de la proforma. |
| MVP-25 | Registro de la respuesta con evidencia, control por oposición y flujo de disputa | 20, 24 | Quien envió la proforma no puede registrar la respuesta (`MISMO_USUARIO`); sin evidencia se rechaza; un rechazo deja `EN_DISPUTA` con sus tres salidas; se guarda `fecha_aceptacion`. |
| MVP-26 | Reporte de liquidación §7.8: previsualización, confirmación del bloque, 47 columnas más las 8 técnicas, historial y re-descarga | 25 | Solo se exportan `ACEPTADO_PROVEEDOR`; los pedidos pasan a `LISTO_PARA_OC`; ninguno aparece en dos reportes; el orden de columnas es el de §3.5. |
| MVP-27 | Reporte de OC §7.9: una OC por proveedor, historial y re-descarga | 26 | Solo se exportan `LISTO_PARA_OC`; `precio` es el total con IVA; los pedidos pasan a `LIQUIDADO`; ninguno aparece en dos reportes de OC. |
| MVP-28 | Validación de formatos con Administración: importar los archivos de prueba de OC en Finnegans y de liquidación en el TMS | 26, 27 | Ambos archivos se importan en los ambientes de prueba sin errores; cualquier ajuste queda confinado a `exporters/`. |
| MVP-29 | Manual operativo breve y capacitación de la sucursal piloto, Atención al Proveedor, BackOffice y Administración | 28 | Cada rol completa su tramo del ciclo, de la importación a la OC, sin asistencia. |
| MVP-30 | Catálogo de sucursales: importación de las cabeceras de origen (`admin.importBranches`) y asignación a usuarios | 06, 07 | Las cabeceras de `pedidos_tms.csv` (SANTA FE, CABA, ZONA SUR, ZONA OESTE, ZONA NORTE, MENDOZA, CORDOBA, …) existen como sucursales; un `ANALISTA` solo importa pedidos de sus sucursales; una cabecera desconocida da `CABECERA_NO_PERMITIDA`. |
| MVP-31 | Deploy de `apps/functions`: punto de entrada y `engines`, emisión del build (`noEmit: false`), empaquetado de `packages/shared` para el deploy (el protocolo `workspace:` no lo resuelve npm) y paso `Build shared` en los workflows | 03 | `firebase deploy --only functions` publica en dev y una callable responde; con el deploy activado (variable `DEPLOY_ENABLED` del repo) el job **falla** si faltan los secrets; con el deploy desactivado, el resumen del run lo dice explícitamente. |

## 5. Fase 2: Plataforma terminada

La Fase 2 suma el control de rentabilidad (§7.6) con los dos motores de venta, la integración con BigQuery (§6.2), el reporte de tarifas a Drive (§3) y automatiza la respuesta del proveedor y el seguimiento de disputas. Se agrega el rol `COMERCIAL`, que carga los tarifarios de venta. Las fases no dependen de km ni de paradas: esas variables no existen en ninguna tarea.

| ID | Tarea | Origen | Criterio de aceptación |
| --- | --- | --- | --- |
| F2-01 | Tarifario QX de venta **Encomienda**: colecciones `tarifarios_venta` y `reglas_venta`, importación xlsx con las columnas de §7.6 más `kg_desde` y `kg_hasta` por rango, versionado y vigencia, y rol `COMERCIAL` | §7.6 | Comercial carga y publica un tarifario de venta sin asistencia, y cada `codigo_buscador` es único. |
| F2-01b | Motor de venta **Logística**: definición con Comercial de las reglas por bultos y pallets, tarifario y carga | §7.6 | Un pedido fuera de Encomienda obtiene precio de venta por el motor de Logística. |
| F2-01c | `clasificarServicio(pedido)`: Encomienda hasta 1 m³, hasta 50 kg y un bulto; Logística en el resto | §7.6 | Casos de borde (1 m³, 50 kg, 2 bultos) clasificados según lo confirmado con Comercial. |
| F2-02 | Comparación costo/venta: busca la venta con el motor del servicio clasificado, calcula margen en monto y porcentaje sobre neto y resalta los negativos; enviar la proforma con margen negativo exige una justificación que queda en el log | §7.6 | Un pedido con margen negativo solo avanza con justificación auditada. |
| F2-02b | La cobertura QX entra al ranking de opciones con su precio de venta junto a los expresos | §7.5, §7.6 | Las opciones de un pedido muestran QX y expresos ordenados por costo, con la cobertura QX marcada. |
| F2-03 | Carga manual del precio de venta cuando falta la tarifa, con alerta a `ADMIN` | §7.6 | El pedido sin venta queda identificado y el `ADMIN` recibe el aviso. |
| F2-04 | Reporte de tarifas a carpeta de Drive al publicar un tarifario (Drive API, unidad compartida) | §3 | Cada publicación deja un xlsx versionado en la carpeta acordada. |
| F2-05 | Respuesta del proveedor por enlace firmado desde el email, sin login. Complementa la carga manual y queda registrada como evidencia; el control por oposición se mantiene | §7.7 | La respuesta cambia el estado del pedido sin intervención del equipo y queda auditada. |
| F2-06 | Flujo de disputa completo: motivos tipificados, contraoferta del proveedor, vencimientos, recordatorios e historial por pedido | §7.7 | Toda disputa tiene motivo, responsable y fecha límite visibles. |
| F2-07 | Integración BigQuery: export continuo de Firestore, vista `v_reglas_tarifa_completa` con las columnas de §6.3, y carga de sucursales y canalizador desde el DW | §6.2 | Las tablas del DW se actualizan en minutos y los maestros dejan de cargarse a mano. |
| F2-08 | Tableros en Looker Studio sobre BigQuery: costo por proveedor, zona y sucursal, cobertura, diversificación de proveedores, tasa de rechazo y margen | §3, §7.6 | Dirección consulta los indicadores sin pedir extracciones. |
| F2-09 | API HTTPS documentada (OpenAPI) para otras apps del ecosistema, con cuentas de servicio | §6.2 | Otra app consulta cotizaciones y estados con credenciales propias. |
| F2-10 | Centro de notificaciones y emails internos: tarifarios por vencer, disputas abiertas, errores de comunicación y solicitudes de CP | §7.1, §7.7 | Cada usuario ve y marca como leídas sus alertas. |
| F2-11 | Comparación entre versiones de tarifario con impacto estimado sobre los pedidos recientes | §7.3 | Atención al Proveedor ve cuánto cambia el costo antes de publicar una versión nueva. |
| F2-12 | Pruebas end-to-end con Playwright, backups programados de Firestore, monitoreo y alertas de errores | Calidad | El flujo completo corre en CI y hay una restauración de backup probada. |

## 6. Consideraciones de riesgo y escalabilidad

Con las definiciones de negocio cerradas, los riesgos que quedan son de datos maestros, de implementación y de integración con Finnegans y el TMS, que se cubren con pruebas de formato antes de operar.

### 6.1 Riesgos técnicos

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Formato de la OC o del reporte de liquidación rechazado por Finnegans o el TMS | Reprocesos manuales de Administración | Validación con archivos reales en MVP-28 antes de operar; todo el mapeo aislado en `exporters/`. |
| IVA doble en la OC: `precio` lleva el total con IVA (§7.9) y Finnegans podría sumar IVA por su cuenta | Órdenes de compra infladas | Se confirma con el archivo de prueba de MVP-28; si hiciera falta, el cambio a neto es una línea en `exporters/purchaseOrder.ts`. |
| Tramo cargado como precio por unidad (o al revés) en el Excel maestro | Costos inflados o deflactados por órdenes de magnitud; el volumen o el peso ganan siempre por Mayor Valor | Advertencia `TARIFARIO_SOSPECHOSO` al publicar, simulador (MVP-16) contra la planilla de Atención al Proveedor y casos dorados (MVP-15). |
| Un CP con varias variantes y precios distintos | El motor elige una variante distinta a la real | Todas las variantes se evalúan y se muestran con localidad, zona y plazo; el pedido lleva `CP_AMBIGUO` y el analista confirma; el filtro por provincia reduce las falsas variantes. |
| Origen `Buenos Aires` en las tarifas frente a pedidos que salen de otras provincias | Pedidos sin cobertura o cotizados con una tarifa que no rige para ese origen | Parámetro `origen_estricto`; se define con Atención al Proveedor antes de operar (§7). |
| Arrancar en Spark | Sin Functions ni Storage no hay motor en servidor, emails ni reportes | Decisión tomada: Blaze sobre la cuenta de GCC, con alerta de presupuesto (MVP-02). |
| Gasto descontrolado en Blaze | Un listener o un bucle de escrituras puede facturar mucho en horas | Alerta de presupuesto, paginación en todas las vistas, listeners solo sobre el lote abierto, tests de reglas. |
| Errores de redondeo con flotantes | Diferencias de centavos que rompen la conciliación | `dec` y `cents` en todo el modelo, decimal.js en el motor, redondeo definido por componente y casos de referencia con resultado exacto. |
| Cambio de tarifa con pedidos en curso | Pedidos valorizados con una tarifa que ya no rige | La cotización es una foto con `tarifario_id`, `fecha_referencia` y `motor_version`; los tarifarios publicados son inmutables y se corrigen con una versión nueva. |
| Tarifario con vigencia retroactiva | Revalorizar pedidos ya enviados al proveedor | Solo se puede revalorizar en `VALORIZADO`, `SIN_COBERTURA`, `COBERTURA_QX`, `ERROR_COMUNICACION` y `EN_DISPUTA`; un pedido con proforma enviada se corrige por el circuito de disputa. |
| Publicar tarifas mientras se valoriza un lote | Un lote mezcla dos versiones | El motor carga las reglas una vez por lote y registra la versión usada en cada cotización. |
| Límites de Firestore | 500 operaciones por batch, 1 MiB por documento, escrituras sostenidas de 1 por segundo por documento | Tandas con BulkWriter, sin contadores calientes en `lotes_importacion` (se agregan al cerrar), arrays acotados (`alternativas` máximo 20). |
| Excel heterogéneos de las sucursales | Importaciones fallidas o datos mal interpretados | Plantilla única con validación en el navegador; el formato del TMS es fijo (D28). |
| Datos del TMS en 0 o vacíos (peso, volumen, cabecera) | Filas bloqueadas en cada importación | Exportar los errores desde el panel y corregirlos en origen con el área responsable; las filas corregidas se reimportan. |
| Reimportación del mismo archivo | Pedidos y liquidaciones duplicados | Id determinístico `{sucursal_id}_{nro_pedido}`, rechazo `DUPLICADO` y `LIQUIDADO` como estado final. |
| Adjunto de proforma demasiado grande | Gmail rechaza correos de más de 25 MB | Si el adjunto supera 20 MB, la proforma se divide en varias del mismo proveedor y lote, cada una con su email. |
| Correo marcado como spam o sin respuesta | Proveedores que no confirman | Buzón corporativo con SPF y DKIM, respuestas a una bandeja del área, reenvío desde `ERROR_COMUNICACION`. |
| Plantillas de email editables por el negocio | HTML roto o inyección de contenido | Handlebars con HTML escapado, catálogo cerrado de variables y vista previa obligatoria antes de guardar. |
| Control por oposición eludido | El analista valida su propia tarifa | La regla `registrado_por ≠ enviada_por` se aplica en backend, incluso a `ADMIN`, y queda auditada. |
| Canalizador desactualizado o con provincias inconsistentes | CPs sin localidad ni cobertura QX; falsos descartes de variantes por provincia | Normalización con `norm()` y alias de provincia al importar; solicitudes a CDG por CP inexistente (D27); carga automática desde el DW en la Fase 2 (F2-07). |
| Nombre del proveedor distinto entre el maestro, el TMS y Finnegans | Tarifas sin proveedor asignado o OC con código equivocado | `id_proveedor` = código de Finnegans; `alias` para los otros nombres; la importación lista los nombres sin resolver. |
| Solo hay tarifarios de algunos expresos | Gran parte de los pedidos queda sin opción de expreso y el modo sombra cubre poco | El Excel maestro crece por proveedor (D29); el informe de modo sombra separa los pedidos con y sin tarifario cargado. |
| Código generado por agentes inconsistente | Modelos duplicados, validaciones distintas en cliente y servidor | Esquemas únicos en `packages/shared`, contratos de §3.8, CI obligatoria y revisión humana de todo cambio en `packages/motor`. |
| Datos personales en destinatarios y direcciones | Exposición indebida (Ley 25.326) | Acceso por sucursal en reglas de seguridad y URLs firmadas de corta duración para los reportes. |
| Dependencia de Firebase | Migración costosa si cambia la estrategia | Motor sin dependencias de Firebase; export a BigQuery como copia de salida. |

### 6.2 Escalabilidad

- **Volumen:** el diseño soporta decenas de miles de pedidos por mes sin cambios. Si el volumen supera los 5.000 pedidos diarios se revisan las cuotas de lectura y escritura de Firestore y se agrega paginación por lote.
- **Motor:** el maestro actual tiene unas 11.500 filas para dos proveedores; con decenas de proveedores serán cientos de miles. Resolver en memoria con las reglas indexadas por CP escala bien a ese volumen; más allá, se precalcula un índice por CP al publicar cada tarifario.
- **Lotes grandes:** por encima de 10.000 filas por archivo, la valorización pasa a procesarse en tareas de cola por bloques en lugar de un solo trigger.
- **Integración:** Firestore queda como base operativa y BigQuery como base analítica; el DW nunca escribe directo sobre la base operativa, entra por callables o por la API de F2-09.

## 7. Pendientes de definición

Ninguno bloquea el inicio del MVP; el 3 condiciona el criterio de salida del Hito 1A.

1. **Origen de las tarifas (decidido para el MVP).** El origen por defecto es `Buenos Aires` y `origen_estricto` es `true`: los pedidos que salen de otras provincias (p. ej. Rosario) no aplican a esas reglas y quedan sin opción de expreso. Se revisa cuando las tarifas traigan sus orígenes completos.
2. **Carga por tramos de Hacha de Piedra en volumen.** Hoy tiene un único tramo (0, 1\] m³ con precio de $262.095 para Catamarca. Con el modelo por tramos, cualquier bulto de hasta 1 m³ cuesta eso y el volumen gana siempre. Hay que cargarlo por tramos, como Logicargo, o el sistema lo marca como `TARIFARIO_SOSPECHOSO`.
3. **Datos para validar el motor.** Planilla de liquidación manual con el costo real por pedido (el campo `Valor Calculado Tarifa` del TMS parece ser precio de venta) y tarifarios de los expresos más usados.
4. **Estado `COBERTURA_QX`.** Cerrado: se usa para todo pedido con cobertura QX y muestra también las opciones de expreso.
5. **Límites de Encomienda.** Si "hasta 1 m³ y hasta 50 kg" es inclusivo, y el tratamiento de pedidos con 1 bulto y más de 50 kg.
6. **Datos de los proveedores cargados:** IVA, seguro, colecta, vigencia, CUIT, email y condición de pago de Hacha de Piedra y Logicargo (se cargan desde la sección de proveedores).
