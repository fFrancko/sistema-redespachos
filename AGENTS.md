# AGENTS.md — Sistema de Redespachos

Instrucciones comunes para todos los agentes de código (Claude Code, Gemini). Este archivo se carga en cada conversación. Es obligatorio.

## 1. Proyecto en una línea
App web interna de QX para cotizar, valorizar, confirmar con el proveedor y liquidar pedidos de redespacho, cruzando el canalizador de CPs con los tarifarios de costos de los expresos. Stack: TypeScript + Firebase (Auth, Firestore, Functions 2ª gen, Hosting, Storage) en `southamerica-east1`, monorepo pnpm 9 (`apps/`, `packages/`), Node 22, tests con Vitest. La herramienta de tarifas de la etapa B0 vive en otro repositorio (`herramientas-tarifas`) y **no forma parte de este**.

## 2. Fuentes de verdad (en este orden)
1. **Tu ticket** (`tickets/MVP-XX.md`): alcance, archivos permitidos, criterio de aceptación.
2. **`docs/arquitectura-v3.md`**: solo las secciones que tu ticket lista, más las decisiones D30 a D37 si tu ticket toca `pedidos`, `reglas_tarifa`, `canalizador_cp` o el parser del TMS. No leas el resto.
3. **`packages/shared`**: contratos en código (esquemas Zod, estados, errores, columnas del TMS). Es la fuente de tipos.
4. **`docs/ola-0/estado-y-decisiones.md`**: qué existe de verdad en el repo, decisiones técnicas y supuestos vigentes. Leé la sección 3 (estado real) antes de planificar.
5. `docs/documentacion-funcional.md`: solo si el ticket lo pide, y solo la sección indicada.

Si dos fuentes se contradicen, **no decidas**: seguí la de menor número, dejá la duda en la sección PREGUNTAS del ticket y avisá en tu nota de entrega. Si la arquitectura dice algo que el código de `shared` no cumple (por ejemplo D36), es un hallazgo, no algo para resolver en tu ticket.

## 3. Carriles y propiedad de archivos
| Carril | Dueño de |
| --- | --- |
| **A · Cotización** | `packages/motor`, `apps/functions/src/<tipo>/{postalRouter,tariffs,orders}/`, `apps/web/src/features/{cotizacion,pedidos,tarifas,canalizador}/`, `test/fixtures/` de tarifas y pedidos |
| **B · Plataforma y circuito** | `apps/functions/src/<tipo>/{admin,auth,suppliers,emailTemplates,emails,proformas,settlement,purchaseOrders,reports}/`, `apps/functions/src/exporters/`, `apps/web/src/features/{usuarios,proveedores,sucursales,proformas,liquidacion,oc,auditoria,parametros}/`, `firestore.rules`, `storage.rules`, `firestore.indexes.json` |
| **Compartido (congelado)** | `packages/shared`, `apps/functions/src/index.ts`, `apps/functions/src/lib`, `apps/web/src/app` (shell y registro de rutas), `.github`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json` raíz, `vitest.config.ts`, `eslint.config.js`, `.prettierrc`, `.gitignore`, `firebase.json`, `.firebaserc`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` y `docs/` |

`<tipo>` es una de las carpetas que ya existen en `apps/functions/src`: `callables`, `triggers`, `workers`. Dentro de cada una se crea una subcarpeta por dominio (p. ej. `callables/tariffs/`).

- Solo editás archivos de tu carril y los que tu ticket permite explícitamente.
- Para tocar lo **compartido** abrí un cambio separado, con título `CR: <cambio>`, y detenete: lo aprueba Franco. El otro agente hace rebase.
- Dependencias nuevas: `CR: deps` aparte. Nunca edites `pnpm-lock.yaml` a mano. **Nunca mergees ni apruebes PRs de Dependabot.**
- **Índices compartidos (estado al cierre de la Ola 0):** hoy `apps/functions/src/index.ts` es un índice único y no existe `apps/web/src/app`. Decidido: MVP-31 deja el índice raíz con una línea fija por dominio de §3.8 y MVP-05 crea el shell web con la lista fija de features. Hasta entonces, tocar ese índice o crear el shell es un `CR`; después, cada carril edita solo los índices de sus dominios y features. No lo hagas "de paso".

## 4. Reglas inquebrantables
1. **Dinero:** tarifas como decimal en string (hasta 4 decimales, `dec`); resultados en centavos enteros (`cents`). Cálculos con `decimal.js` y los helpers de `shared` (`decToDecimal`, `decimalToCents`, `decimalToDec`). Nunca `number` para montos.
2. **Nombres:** campos de dominio en español `snake_case`, idénticos a la arquitectura (`peso_kgs`, `id_proveedor`); funciones, módulos y clases en inglés `camelCase`.
3. **Tipos:** un solo esquema Zod en `packages/shared`, usado por web, functions y motor. No dupliques tipos ni declares esquemas propios en `motor`, `functions` o `web`. Importá siempre desde `@sistema-redespachos/shared`, nunca por ruta relativa ni por el alias `@shared/*`.
4. **Escrituras:** el cliente nunca escribe colecciones de negocio. Toda escritura pasa por una callable que valida, audita (`withAudit`) y aplica la transacción.
5. **Motor:** `packages/motor` es puro: sin I/O, sin Firestore, sin fechas implícitas (recibe `fecha_referencia`). Determinístico.
6. **Estados:** las transiciones de pedido viven en una sola tabla de `packages/shared`. Cualquier cambio fuera de ella se rechaza con `TRANSICION_INVALIDA`.
7. **Tests:** cada ticket entrega tests que fallan si se rompe la regla que prueban (no `toBeDefined`). Todo cambio en `packages/motor` debe pasar los casos de referencia y dorados en CI.
8. **Datos reales:** no se suben al repo ni los Excel/CSV reales de transportes (tarifas: dato comercial) ni pedidos del TMS (destinatarios y direcciones: Ley 25.326). Solo fixtures **sintéticos**, generados con scripts propios. Los datos reales viven fuera del repo y se pasan por argumento; los scripts que los leen imprimen solo conteos, nunca valores de filas. CUIT de prueba: inventados, nunca uno de un contribuyente conocido. Nada de secretos ni claves en el código.
9. **Sin inventar:** no agregues campos, estados, códigos de error ni reglas de negocio que no estén en la arquitectura. Si falta algo, preguntá (sección PREGUNTAS del ticket).
10. **Alcance:** hacé lo que pide el ticket, nada más. Nada de refactors ni mejoras "de paso" fuera de tus archivos.
11. **`packages/shared` está congelado.** No se modifica dentro de un ticket de carril. Si tu ticket necesita un cambio ahí (un campo, un código, una decisión nueva de la arquitectura), frená y pedilo como `CR: shared — <cambio>`. Solo Franco lo aprueba y lo asigna.

## 5. Flujo por ticket
1. Leé el ticket, las secciones indicadas y la sección 3 de `docs/ola-0/estado-y-decisiones.md`.
2. Escribí un plan breve (5 a 10 líneas) en el ticket, con la lista de archivos que vas a tocar, y **esperá el OK de Franco** antes de codear.
3. Rama `mvp-XX-slug` desde `main` actualizado (`git fetch origin && git switch -c mvp-XX-slug origin/main`).
4. Implementá con tests.
5. Verificá con **la misma secuencia que CI**, desde un estado limpio (sin `dist/` previos):
   ```bash
   pnpm install --frozen-lockfile
   pnpm --filter @sistema-redespachos/shared build
   pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```
   Si tocás reglas o Functions, corré los tests con emuladores (`pnpm exec firebase emulators:exec --only auth,firestore --project demo-qx-ci "pnpm test"`). `pnpm ci:run` todavía **no** construye `shared` primero: no lo uses como sustituto de la secuencia de arriba.
6. **Commiteá en tu rama. No pushees ni abras PR:** Franco revisa el diff, pushea y abre la PR. Completá la nota de entrega en el ticket (plantilla en `tickets/_TEMPLATE.md`) con el hash del commit.
7. **Detenete.** No empieces otro ticket en la misma conversación.

## 6. Definición de terminado
- Criterio de aceptación del ticket cumplido, literalmente, con evidencia (comando o test que lo prueba). Si el ticket lo copió de la arquitectura §4, verificá también contra la arquitectura.
- Lint, typecheck, tests y build en verde con la secuencia del punto 5.5, pegando la salida real. Nunca afirmes "pasa" ni "CI verde" sin haberlo corrido o visto.
- Si tu código es consumido por otro paquete o corre en Node (Functions, scripts), probaste el consumo real: import desde el consumidor y ejecución con Node, no solo typecheck.
- Sin archivos fuera del alcance (`git diff --stat origin/main...HEAD`).
- Nota de entrega completa, con decisiones tomadas, riesgos, y **lo que quedó fuera del alcance con el ticket al que va** (o "sin ticket").

## 7. Auditoría cruzada
El trabajo de un carril lo audita el agente del otro. Reglas para el auditor:
- Trabajá en una conversación limpia y **leé el código y el ticket antes que la nota de entrega**.
- **No modifiques el código del autor.** Dejá hallazgos con severidad y evidencia; el autor corrige.
- Seguí `docs/auditoria-cruzada.md`, incluida la verificación de correcciones: una auditoría `RECHAZADO` no se cierra hasta que el auditor emite el veredicto final.

## 8. Cuando algo no cierra
Parate y dejá escrito: qué esperabas, qué encontraste, qué opciones ves. No adaptes los datos ni la especificación para que algo pase. Si un fixture real contradice la arquitectura, eso es un hallazgo, no algo para corregir en silencio.

## 9. Trampas técnicas conocidas (Ola 0)
- Los `tsconfig` de los paquetes extienden la raíz, que tiene `noEmit: true` y `moduleResolution: bundler`. Un paquete que tiene que emitir o correr en Node necesita `noEmit: false`, `module`/`moduleResolution` `NodeNext` e imports relativos con extensión `.js` (así está `shared`). Que el typecheck pase no prueba que el JS emitido corra.
- `packages/shared/dist` no está en git: en un clon limpio, nada que importe `shared` compila hasta construirlo.
- Las Functions van en **2ª gen** (`firebase-functions/v2/...`) con región `southamerica-east1`. El `helloWorld` actual es 1ª gen y se reemplaza en MVP-31.
- Un workflow en verde puede haber omitido pasos (por ejemplo `Deploy to Dev` sin secrets). Leé los pasos, no solo el color.
- `pedidos` tiene dos esquemas: `orderSchema` (de `VALIDADO` en adelante) e `invalidOrderSchema` (`CON_ERROR` y `CANCELADO` con errores). Elegí por `estado` antes de parsear; `orderDocumentSchema` es una unión sin discriminador y mezcla los mensajes de error.
- El cruce de destino usa solo los campos `_norm` del pedido (D33). `codigo_postal`, `localidad` y `provincia` son el dato crudo del TMS.
- Las columnas del TMS y su orden salen de `TMS_COLUMNS` en `shared` (D37). No las vuelvas a escribir a mano.
