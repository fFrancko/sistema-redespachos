# Ola 0 — Estado, decisiones y supuestos

Registro de cierre de la Ola 0 (5 de octubre de 2026). Los hallazgos y el veredicto están en [`informe-validacion.md`](informe-validacion.md). Este documento dice qué hay en el repo, qué quedó pendiente y por qué se decidió lo que se decidió. Es la referencia para los agentes de la Ola 1: si contradice a un ticket viejo, gana este documento; si contradice a `docs/arquitectura-v3.md`, gana la arquitectura y se avisa a Franco.

## 1. Qué era la Ola 0

Un solo agente y Franco, en serie, para dejar la base sobre la que trabajan los dos carriles: monorepo (MVP-01), Firebase y emuladores (MVP-02), CI/CD (MVP-03) y los contratos de `packages/shared` (MVP-04), con auditoría cruzada al final. Se planificó corta y se extendió por la auditoría de MVP-04, que obligó a corregir `shared` dos veces y a sumar ocho decisiones de arquitectura (D30 a D37).

## 2. Qué se entregó, ticket por ticket

Se compara contra el criterio de aceptación de la **arquitectura v3 §4**, no solo contra el ticket, porque varios tickets se reescoparon.

| Ticket | Entregado | Criterio de la arquitectura | Estado |
| --- | --- | --- | --- |
| MVP-01 | Monorepo pnpm (`apps/web`, `apps/functions`, `packages/shared`, `packages/motor`), TS estricto, ESLint 9 con 0 warnings, Vitest único desde la raíz, scripts raíz. Correcciones de la auditoría de Gemini aplicadas. | `pnpm test` y `pnpm typecheck` pasan en un repo vacío. | **Cumplido.** Prettier está instalado pero sin configuración (H-11). |
| MVP-02 | `firebase.json` con emuladores (Auth 9099, Firestore 8080, Functions 5001, Storage 9199, UI 4000), `.firebaserc` con IDs **ficticios**, `apps/web/src/firebase.ts`, `apps/functions/src/firebase-init.ts`, `firestore.rules` provisorias, `docs/FIREBASE.md`. | Proyectos dev y prod en Blaze, región `southamerica-east1`, alerta de presupuesto, deploy manual a dev, emuladores con un comando. | **Parcial.** Solo emuladores. Proyectos reales, alerta y deploy manual sin evidencia (H-06, P-01). |
| MVP-03 | `ci.yml` (install congelado, `Build shared`, lint, typecheck, test de `motor` separable, tests con emuladores y cobertura, build, comentario de cobertura) y `deploy.yml` hacia dev; `dependabot.yml`; `docs/CI.md`; script `ci:run`. Umbrales de cobertura definidos pero inactivos. | Un PR muestra los checks y una URL de preview; deploy a dev en merge; prod por tag. | **Parcial.** Checks sí; preview por PR y prod por tag quitados del ticket por Franco y sin ticket nuevo; el deploy a dev nunca corrió (H-05, H-06). |
| MVP-04 | `packages/shared` completo: primitivas, `norm`/`normProvincia`/`variantId`, roles y enums, tabla de transiciones, catálogos de códigos y `DomainError`, esquemas Zod de las 19 colecciones, parser del TMS (47 + 3 columnas), fixture sintético y `checkTmsFile`. | Tests válidos e inválidos por entidad; transiciones iguales a §3.7; el parser lee el archivo real sin errores de formato. | **Cumplido**, con D36 sin implementar (H-01). |
| MVP-04-AUD | Auditoría de Gemini: matriz de 19 colecciones, 21 supuestos clasificados, transiciones verificadas de forma independiente, 5 mutaciones. Veredicto inicial **RECHAZADO** (1 bloqueante, 4 mayores, 4 menores). | — | **Cerrada** el 5/10 con cierre firmado por Franco y verificación técnica de Claude: APROBADO CON OBSERVACIONES. |
| Correcciones (PR #18 y #19) | `shared` consumible (`noEmit: false`, `exports`, NodeNext, `workspace:*` en `motor` y `functions`), `Build shared` en ambos workflows, D30 a D35 implementadas, hallazgos 8 y 9 corregidos, D36 y D37 incorporadas a la arquitectura. | — | **Mergeadas** en `main` (`b0bf5ec`). D36 solo en la arquitectura, no en el código. |
| Regla 11 de `AGENTS.md` | Congela `packages/shared`. | — | En `mvp-04-fix-shared` (`80d4735`), **no en `main`** (H-03). |

## 3. Estado real del repo al cierre

**Existe y funciona**

- `packages/shared` es la única fuente de tipos y se importa como `@sistema-redespachos/shared` desde `motor` y `functions`. Emite `dist/` (ignorado por git), así que **hay que construirlo antes** de lint, typecheck o tests de otro paquete en un clon limpio.
- 490 tests en verde (488 de `shared`; los 2 restantes son placeholders de `motor` y `web`).
- CI verde en `main`, con emuladores de Auth y Firestore (`--project demo-qx-ci`, sin credenciales).

**Existe pero es placeholder**

- `packages/motor`: `cotizarPlaceholder`, `schemaPlaceholder` en `src/schemas/` (se elimina en MVP-13), `test/golden/` vacío.
- `apps/web`: `App.tsx` vacío y `firebase.ts`. No hay shell, router, ni carpeta `src/app` ni `src/features`.
- `apps/functions`: `index.ts` exporta `helloWorld`, una callable de **1ª gen** sin región. Carpetas `callables`, `triggers`, `workers`, `exporters`, `lib` vacías.
- `firestore.rules`: permisivas para cualquier usuario autenticado (H-04).

**No existe todavía**

- Proyectos Firebase reales confirmados, secrets de GCP, target de Hosting mapeado.
- `firestore.indexes.json` (referenciado por `firebase.json`), `storage.rules`.
- `.prettierrc`.
- Mecanismo de registro de Functions y rutas web sin índice compartido (H-09).
- (Resuelto) `docs/documentacion-funcional.md` ya está en la carpeta del repo, pendiente de commit.

## 4. Decisiones tomadas en la Ola 0

### 4.1 De arquitectura (incorporadas a `docs/arquitectura-v3.md`)

| # | Decisión | Impacto en Ola 1 |
| --- | --- | --- |
| D28 (ampliada) | Los importes sin cero entero (`.5`) se normalizan a `0.5` en **todas** las columnas numéricas; los formatos ambiguos siguen siendo `FORMATO_INVALIDO`. | MVP-17 |
| D30 | `localidad_destino` de `reglas_tarifa` es obligatoria (compone `variante_id`). | MVP-11 |
| D31 | `fecha_aceptacion` va en la raíz del pedido. | MVP-25, MVP-26 |
| D32 | `CON_ERROR → CANCELADO` conserva `errores[]`. | MVP-17, MVP-19 |
| D33 | El cruce de destino usa solo `cp_destino_norm`, `provincia_destino_norm` y `localidad_destino_norm`; los campos crudos del TMS no se renombran. | MVP-13, MVP-17, MVP-18 |
| D34 | Los campos derivados validan su derivación en el esquema Zod. | MVP-10, MVP-11, MVP-17 |
| D35 | Campos de control genéricos solo si no hay autoría propia del dominio. Su ausencia no es hallazgo. | Auditorías |
| D36 | El export de filas con error sale de `origen_tms`, con las 47 columnas tal como vinieron. **No implementado** (H-01). | MVP-17, MVP-19 |
| D37 | El orden canónico de las 47 columnas es `packages/shared/src/tms/headers.ts`. | MVP-17, MVP-26 |

### 4.2 Técnicas y de proceso

| Decisión | Dónde quedó |
| --- | --- |
| Node 22.x fijo en CI y como `engines` raíz; pnpm 9. | `docs/CI.md`, `package.json` |
| Vitest corre una sola vez desde la raíz; los paquetes no declaran su propio runner. | `vitest.config.ts` |
| Umbrales de cobertura (80 % global, 90 % `motor`) definidos e **inactivos** hasta MVP-14. | `vitest.config.ts`, `docs/CI.md` |
| Zod se queda en 3.x (no migrar a 4); una sola versión en el lockfile. | MVP-04, decisión 8 |
| `shared` se publica como ESM con `NodeNext`, imports relativos con `.js`, y se construye antes de lint en CI. | MVP-04, correcciones 6 y 9 |
| Preview por PR y deploy a prod por tag fuera de MVP-03, "para un ticket aparte" (no creado). | `tickets/MVP-03.md` |
| `pedidos` tiene dos esquemas (`orderSchema` estricto e `invalidOrderSchema` para `CON_ERROR`/`CANCELADO`) unidos en `orderDocumentSchema`. | MVP-04, supuesto 18 |
| `packages/shared` queda congelado: solo se modifica con un `CR` aprobado por Franco. | `AGENTS.md` regla 11 |
| Flujo de git: el agente commitea en la rama de su ticket y **no** pushea ni abre PR; Franco revisa el diff, pushea y abre la PR. | `AGENTS.md` §5 (actualizado en este cierre) |
| Deploy de `functions` como ticket propio (MVP-31). `DEPLOY-functions.md` queda reemplazado. | `docs/arquitectura-v3.md` §4 |

### 4.3 Decisiones del 5 de octubre (respuestas de Franco al cierre)

| Decisión | Dónde se aplica |
| --- | --- |
| Proyecto Firebase de desarrollo: `qx-redespachos-dev` ("Sistema Expresos", número 775726638194). Prod se crea más adelante. | `.firebaserc`, `deploy.yml`, `firebase-init.ts`, `.env.local.template` |
| Auditoría de MVP-04 cerrada con firma de Franco y verificación técnica de Claude, sin re-auditoría. | `tickets/MVP-04-AUDITORIA.md` |
| D36 precisada: `origen_tms` con las 47 columnas crudas **solo en pedidos con error**; los válidos no duplican datos. D26 ajustada en consecuencia. | `docs/arquitectura-v3.md`, `tickets/CR-02-shared-d36.md` |
| El deploy a dev se activa con la variable de repositorio `DEPLOY_ENABLED`; activado y sin secrets, el job falla; desactivado, lo informa en el resumen. | MVP-31 |
| Preview por PR: ticket nuevo después de MVP-31. Deploy a prod por tag: Hito 1B, antes de operar. | Tickets a crear |
| `apps/functions/src/index.ts` con una línea fija por dominio de §3.8 hacia un `index.ts` de dominio; el shell web lo crea MVP-05 con la lista fija de features. Ningún carril edita el índice raíz después. | MVP-31, MVP-05 |
| Se aceptan los supuestos 16 (cotización manual con referencias nulas), 20 (criterios del parser) y 22 (elegir esquema de `pedidos` por `estado`) de MVP-04 tal como están. | MVP-17, MVP-19, MVP-20 |
| Dependabot: solo parches y menores; las majors entran como `CR: deps`. Las 15 PRs abiertas se cierran. | `tickets/CR-01-infraestructura.md` |
| `docs/documentacion-funcional.md` se versiona en el repo. | `AGENTS.md` §2 |

## 5. Supuestos vigentes

Supuestos que se tomaron y nadie confirmó todavía. Si un ticket depende de uno, lo cita. (Los supuestos 16, 20 y 22 de MVP-04 pasaron a decisiones el 5/10: ver §4.3.)

1. **Proyecto Firebase de prod:** no existe todavía; `proyecto-qx-prod` es un nombre provisorio. El de dev es real: `qx-redespachos-dev`.
2. **`parametros`:** `tolerancia_volumen_pct`, `oc_constantes.cotizacion` y `preciosobre` son `dec` (MVP-04, supuesto 13).
3. **Fixtures:** solo sintéticos. El CUIT de prueba `20001555554` es sintético por construcción; no se verificó contra el padrón.

## 6. Pendientes (deuda) con destino

| Pendiente | Destino propuesto |
| --- | --- |
| D36 en `shared` (H-01) | `tickets/CR-02-shared-d36.md`, antes de MVP-17 |
| ~~Cierre de auditoría (H-02)~~ | Hecho el 5/10 |
| Merge de `80d4735` y de este cierre a `main` (H-03) | Antes de Ola 1 |
| Reglas *deny-all* (H-04) | `CR` de infraestructura; reglas reales en MVP-07 |
| Deploy de `functions`, 2ª gen, región, NodeNext (H-05) | MVP-31 |
| Proyectos reales, alerta, preview por PR, prod por tag (H-06) | Tickets nuevos (P-06) |
| `ci:run` con `Build shared` (H-07), `.prettierrc` (H-11), Dependabot sin majors (H-08) | `CR` de infraestructura |
| Registro de Functions y rutas sin índice compartido (H-09) | MVP-31 o `CR` propio, antes de MVP-06 |
| `firestore.indexes.json` y `storage.rules` (H-10) | MVP-07 |
| Placeholders de `motor` (H-12) | MVP-13 |
| Umbrales de cobertura | MVP-14 |
| ~~Supuestos 16, 20 y 22 (H-13)~~ | Aceptados el 5/10 |
| `.gitignore` con reglas de B0 | `CR` menor |
| Residuos locales de B0 (H-15) | Franco (no son datos reales; limpieza opcional) |
| Ramas y tag (H-16) | Tras cerrar H-02 |

## 7. Lecciones de la Ola 0

Cada lección quedó convertida en una regla en `AGENTS.md`, `docs/auditoria-cruzada.md` o la plantilla de tickets.

1. **"Typecheck verde" no es "consumible".** `shared` pasó lint, typecheck, 459 tests y build, y aun así nadie podía importarlo: heredaba `noEmit: true` y no declaraba `exports`. → Todo paquete que otro consume se prueba importándolo desde el consumidor en un clon limpio.
2. **Un `tsconfig` que extiende la raíz hereda `noEmit: true` y `moduleResolution: bundler`.** Lo que corre en Node (Functions, scripts) necesita `NodeNext`, emisión y extensiones `.js`. → Regla explícita en `AGENTS.md`.
3. **Un workflow verde puede no haber hecho nada.** `Deploy to Dev` sale verde omitiendo el deploy. → El auditor y el autor leen los pasos del run, no solo el color.
4. **La secuencia local tiene que ser la de CI.** `ci:run` y la nota de entrega omitían `Build shared`. → `AGENTS.md` §5 fija la secuencia completa.
5. **Una decisión de arquitectura nueva no está cerrada hasta que el código la cumple.** D36 se escribió en la arquitectura y no en el código. → Toda decisión nueva sale con su `CR` o con el ticket que la implementa, y el auditor la verifica.
6. **Una auditoría con veredicto RECHAZADO necesita una verificación de las correcciones.** → `docs/auditoria-cruzada.md` agrega la verificación de correcciones y el veredicto final.
7. **Tickets reescopados dejan criterios huérfanos.** Preview por PR y prod por tag salieron de MVP-03 sin ticket nuevo. → La nota de entrega lista lo que sale del alcance y a qué ticket va; si no existe, lo dice.
8. **Las severidades necesitan la cita.** Las que se justificaron con la línea de la arquitectura se resolvieron rápido; las que no, terminaron en decisiones nuevas. → Se mantiene la regla de citar línea y obligatoriedad.
9. **Los supuestos se acumulan.** MVP-04 terminó con 22. → Cada ticket cierra sus PREGUNTAS con una respuesta de Franco o con el supuesto registrado en este documento.
10. **Los datos reales se manejan bien cuando hay herramienta.** `checkTmsFile` permitió validar contra el archivo real sin exponerlo. → Mismo patrón para el canalizador (MVP-10) y el maestro de tarifas (MVP-11).
