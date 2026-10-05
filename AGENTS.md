# AGENTS.md — Sistema de Redespachos

Instrucciones comunes para todos los agentes de código (Claude Code, Gemini). Este archivo se carga en cada conversación. Es obligatorio.

## 1. Proyecto en una línea
App web interna de QX para cotizar, valorizar, confirmar con el proveedor y liquidar pedidos de redespacho, cruzando el canalizador de CPs con los tarifarios de costos de los expresos. Stack: TypeScript + Firebase (Auth, Firestore, Functions 2ª gen, Hosting, Storage), monorepo pnpm (`apps/`, `packages/`), Node ≥ 20, tests con Vitest. La herramienta de tarifas de la etapa B0 vive en otro repositorio (`herramientas-tarifas`) y **no forma parte de este**.

## 2. Fuentes de verdad (en este orden)
1. **Tu ticket** (`tickets/MVP-XX.md`): alcance, archivos permitidos, criterio de aceptación.
2. **`docs/arquitectura-v3.md`**: solo las secciones que tu ticket lista. No leas el resto: no hace falta y ensucia el contexto.
3. **`packages/shared`**: contratos en código (esquemas Zod, estados, errores). Es la fuente de tipos. El tipo `ReglaTarifa` de la herramienta externa no se importa: se reescribe como esquema Zod de la v3 (MVP-04).
4. `docs/documentacion-funcional.md`: solo si el ticket lo pide.

Si dos fuentes se contradicen, **no decidas**: seguí la de menor número, dejá la duda en la sección PREGUNTAS del ticket y avisá en tu nota de entrega.

## 3. Carriles y propiedad de archivos
| Carril | Dueño de |
| --- | --- |
| **A · Cotización** | `packages/motor`, `apps/functions/src/<tipo>/{postalRouter,tariffs,orders}/`, `apps/web/src/features/{cotizacion,pedidos,tarifas,canalizador}/`, `test/fixtures/` de tarifas y pedidos |
| **B · Plataforma y circuito** | `apps/functions/src/<tipo>/{admin,auth,suppliers,emailTemplates,emails,proformas,settlement,purchaseOrders,reports}/`, `apps/functions/src/exporters/`, `apps/web/src/features/{usuarios,proveedores,sucursales,proformas,liquidacion,oc}/`, `firestore.rules`, `storage.rules` |
| **Compartido (congelado)** | `packages/shared`, `apps/functions/src/lib`, `apps/web/src/app` (shell y registro de rutas), `.github`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` y `tsconfig` raíz |

`<tipo>` es una de las carpetas que ya existen en `apps/functions/src`: `callables`, `triggers`, `workers`. Dentro de cada una se crea una subcarpeta por dominio (p. ej. `callables/tariffs/`).

- Solo editás archivos de tu carril y los que tu ticket permite explícitamente.
- Para tocar lo **compartido** abrí un PR separado, con título `CR: <cambio>`, y detenete: lo aprueba Franco. El otro agente hace rebase.
- Dependencias nuevas: PR aparte `CR: deps`. Nunca edites `pnpm-lock.yaml` a mano.
- No hay archivos índice compartidos: las rutas web se registran con un módulo por feature y las Functions se exportan por carpeta. Si necesitás editar un índice que no es tuyo, es un `CR`.

## 4. Reglas inquebrantables
1. **Dinero:** tarifas como decimal en string (hasta 4 decimales, `dec`); resultados en centavos enteros (`cents`). Cálculos con `decimal.js`. Nunca `number` para montos.
2. **Nombres:** campos de dominio en español `snake_case`, idénticos a la arquitectura (`peso_kgs`, `id_proveedor`); funciones, módulos y clases en inglés `camelCase`.
3. **Tipos:** un solo esquema Zod en `packages/shared`, usado por web, functions y motor. No dupliques tipos.
4. **Escrituras:** el cliente nunca escribe colecciones de negocio. Toda escritura pasa por una callable que valida, audita (`withAudit`) y aplica la transacción.
5. **Motor:** `packages/motor` es puro: sin I/O, sin Firestore, sin fechas implícitas (recibe `fecha_referencia`). Determinístico.
6. **Estados:** las transiciones de pedido viven en una sola tabla de `packages/shared`. Cualquier cambio fuera de ella se rechaza con `TRANSICION_INVALIDA`.
7. **Tests:** cada ticket entrega tests. Todo cambio en `packages/motor` debe pasar los casos de referencia y dorados en CI.
8. **Datos reales:** no se suben al repo ni los Excel/CSV reales de transportes (tarifas: dato comercial) ni pedidos del TMS (destinatarios y direcciones: Ley 25.326). Solo fixtures **sintéticos**, generados con scripts propios. Los datos reales viven fuera del repo y se pasan por argumento. Nada de secretos ni claves en el código.
9. **Sin inventar:** no agregues campos, estados, códigos de error ni reglas de negocio que no estén en la arquitectura. Si falta algo, preguntá (sección PREGUNTAS del ticket).
10. **Alcance:** hacé lo que pide el ticket, nada más. Nada de refactors ni mejoras "de paso" fuera de tus archivos.
11. Ya no modificar más la carpeta y los archivos de `packages/shared`.

## 5. Flujo por ticket
1. Leé el ticket y las secciones indicadas.
2. Escribí un plan breve (5 a 10 líneas) en el ticket antes de codear.
3. Rama `mvp-XX-slug` desde `main` actualizado.
4. Implementá con tests. Corré `pnpm lint && pnpm typecheck && pnpm test` (con emuladores si toca reglas o Functions).
5. PR a `main` con la **nota de entrega** (plantilla en `tickets/_TEMPLATE.md`).
6. **Detenete.** No empieces otro ticket en la misma conversación.

## 6. Definición de terminado
- Criterio de aceptación del ticket cumplido, literalmente, con evidencia (comando o test que lo prueba).
- Lint, typecheck y tests en verde.
- Sin archivos fuera del alcance.
- Nota de entrega completa, con decisiones tomadas y riesgos.

## 7. Auditoría cruzada
El trabajo de un carril lo audita el agente del otro. Reglas para el auditor:
- Trabajá en una conversación limpia y **leé el código y el ticket antes que la nota de entrega**.
- **No modifiques el código del autor.** Dejá hallazgos con severidad y evidencia; el autor corrige.
- Seguí `docs/auditoria-cruzada.md`.

## 8. Cuando algo no cierra
Parate y dejá escrito: qué esperabas, qué encontraste, qué opciones ves. No adaptes los datos ni la especificación para que algo pase. Si un fixture real contradice la arquitectura, eso es un hallazgo, no algo para corregir en silencio.
