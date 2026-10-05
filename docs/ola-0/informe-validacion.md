# Ola 0 — Informe de validación

- **Fecha:** 5 de octubre de 2026
- **Alcance:** MVP-01, MVP-02, MVP-03, MVP-04, la auditoría MVP-04-AUD y las correcciones posteriores (PR #18 y #19).
- **Base validada:** rama `mvp-04-fix-shared`, commit `80d4735` (un commit por delante de `origin/main` = `b0bf5ec`). El árbol de trabajo local de Franco coincide con ese commit (índice de git idéntico a `HEAD`).
- **Estado y decisiones de la ola:** ver [`estado-y-decisiones.md`](estado-y-decisiones.md).
- **Cambios en las instrucciones de los agentes:** ver [`cambios-instrucciones-agentes.md`](cambios-instrucciones-agentes.md).

## Veredicto

**Ola 0: CERRADA CON OBSERVACIONES, condicionada a tres acciones previas.** La base técnica es sólida (contratos de `packages/shared`, CI, convenciones), pero hay un hallazgo bloqueante contra la arquitectura que todavía no afecta a ningún ticket en curso (H-01, D36), un cierre de auditoría que nunca se formalizó (H-02) y la regla de congelamiento de `shared` que no llegó a `main` (H-03).

**Actualización (5 de octubre, tarde):** H-02 quedó resuelto con el cierre firmado (sección "Verificación de correcciones" de `tickets/MVP-04-AUDITORIA.md`, veredicto final APROBADO CON OBSERVACIONES). Las respuestas de Franco y las propuestas pendientes de su OK están en la sección **Respuestas a las preguntas abiertas**, al final.

| Se puede arrancar | Condición |
| --- | --- |
| Ola 1, primeros tickets de cada carril (A: MVP-13 y MVP-14; B: MVP-05) | Resolver H-02 y H-03. |
| Primer callable de cualquier carril (B: MVP-06; A: MVP-10) | Además, H-09 (mecanismo de export de Functions sin índice compartido) y MVP-31 (H-05). |
| MVP-17, MVP-19 y MVP-26 | Además, el `CR` de H-01 (D36) mergeado. |
| Deploy de reglas a cualquier proyecto real | Además, H-04. |

## Verificación ejecutada

Corrida en un clon limpio del commit `80d4735`, con Node 22.22.0 y pnpm 9.0.0, en el mismo orden que `ci.yml`:

| Paso | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile` | OK |
| `pnpm --filter @sistema-redespachos/shared build` | OK; `dist/` sin ningún `*.test.*` |
| `pnpm lint` | OK (0 warnings) |
| `pnpm typecheck` | OK en los 4 paquetes |
| `pnpm test:coverage` | 22 archivos, **490 tests** en verde. Cobertura total 94,34 % statements |
| `pnpm build` | OK, pero **no emite** `apps/functions/lib` ni `packages/motor/dist` (confirma H-05) |

CI en GitHub sobre `main` (`b0bf5ec`): `CI` en verde (run 37337222646, incluye emuladores de Auth y Firestore); `Deploy to Dev` en verde (run 37337222604) **con los pasos de autenticación y deploy omitidos** (H-05). En la PR #19 se publicó el comentario de cobertura.

**Sin verificar en esta validación:** los emuladores en local, `checkTmsFile` sobre `pedidos_tms.csv` real (el archivo no está ni debe estar en el repo; se toma la evidencia de la nota de entrega de MVP-04), y la existencia de los proyectos Firebase reales (ver preguntas abiertas).

## Fortalezas

1. **Contrato de `packages/shared` completo y probado.** 19 colecciones, primitivas `dec`/`cents`/`date`/`timestamp`/`ref`, tabla única de transiciones probada sobre los 144 pares, catálogos de códigos, `DomainError`, parser del TMS. 98,9 % de cobertura de statements en `shared`, y el auditor confirmó con 5 mutaciones que los tests fallan al romper las reglas.
2. **Dinero bien resuelto.** `dec` rechaza `number`, notación científica, coma decimal y negativos; redondeo half-up verificado en los bordes (`0.005 → 1`, `0.0049 → 0`, `718.3743 → 71837`, `1250.50005 → 1250.5001`), con tests.
3. **Parser validado contra el archivo real** (538 filas, 0 errores de formato) sin que el archivo entre al repo, y `checkTmsFile` no imprime valores de filas (Ley 25.326).
4. **`shared` consumible de verdad:** emite ESM con `NodeNext`, `exports` declarados, dependencia `workspace:*` en `motor` y `functions`, y prueba de punta a punta con Node puro.
5. **CI útil desde el día uno:** lockfile congelado, lint con 0 warnings, typecheck, tests con emuladores, build y comentario de cobertura en la PR.
6. **La auditoría cruzada funcionó:** detectó un bloqueante real (paquete no consumible) y cuatro mayores, que terminaron en decisiones de arquitectura explícitas (D30 a D37).
7. **Trazabilidad:** cada ticket tiene plan, preguntas, nota de entrega con salida de comandos y correcciones post-auditoría; la WIP anterior se preservó con tag y el force-push se hizo con `--force-with-lease`.

## Hallazgos

Severidades según `docs/auditoria-cruzada.md`: **Bloqueante** (incumple criterio o arquitectura, o riesgo de dinero o datos), **Mayor** (falla probable), **Menor** (claridad o deuda).

| # | Severidad | Dónde | Qué pasa | Evidencia | Qué hacer y cuándo |
| --- | --- | --- | --- | --- | --- |
| H-01 | **Bloqueante** (incumple D36 y D26) | `packages/shared/src/tms/orderRow.ts`, `schemas/orders.ts` | D36 dice que `origen_tms` "conserva las 47 columnas del TMS tal como vinieron" y que el export de errores de MVP-19 sale de ahí. El parser solo guarda en `origen_tms` las 28 columnas que **no** se mapean a un campo; las 19 mapeadas van a `datos` y, si fallan la validación, se descartan. Un pedido `CON_ERROR` con peso `0` pierde el `0`. D26 además pide `Codigo de Expreso` en `origen_tms`, y no está. | Script fuera del repo con una fila de 47 columnas y `Peso Kgs: 0`: `origen_tms` con 28 claves; error `PESO_INVALIDO`; el valor original no está ni en `datos` ni en `origen_tms`; `Codigo de Expreso` solo en `expreso_manual`. | `CR` a `packages/shared`: `origen_tms` con las 47 columnas crudas (o la alternativa que decida Franco, ver P-03). **Antes de MVP-17.** No bloquea MVP-13/14. |
| H-02 | **Bloqueante** (de proceso) | `tickets/MVP-04-AUDITORIA.md` | El veredicto vigente de la auditoría es **RECHAZADO**. Las correcciones (PR #18 y #19) no tuvieron verificación del auditor ni un veredicto final. MVP-04-AUD dice: "Hasta tu veredicto, `packages/shared` no se considera congelado"; sin embargo, la regla 11 de `AGENTS.md` lo congela. | Ningún documento posterior al informe de Gemini registra un veredicto. | Verificación de correcciones (re-auditoría acotada a los hallazgos 1-9 y D30-D35) o cierre firmado por Franco en el informe de auditoría. **Antes de Ola 1.** |
| H-03 | Mayor | Git | El commit `80d4735` (regla 11, congelamiento de `shared`) está en `origin/mvp-04-fix-shared` pero no en `main`. Un agente que ramifique desde `main` no lo ve. El `main` local de Franco está en `5be13d6`, dos merges atrás de `origin/main`. | `git rev-list origin/main..mvp-04-fix-shared` = 1; `.git/refs/heads/main` local = `5be13d6`. | Mergear este commit y los documentos de este cierre a `main`; actualizar `main` local. **Antes de Ola 1.** |
| H-04 | Mayor (latente, riesgo de datos) | `firestore.rules`, `docs/FIREBASE.md` | Las reglas permiten `read, write` a cualquier usuario autenticado sobre todas las colecciones. Contradice la regla 4 (el cliente no escribe colecciones de negocio) y §3.1. El login todavía no está restringido al dominio (MVP-05), así que "autenticado" es cualquier cuenta de Google. `FIREBASE.md` daba instrucciones para desplegarlas a prod. Hoy no se despliegan (el workflow no incluye `firestore`). | `firestore.rules` línea 6. | `CR`: reglas *deny-all* hasta MVP-07, y no desplegar reglas a mano. `FIREBASE.md` ya corregido en este cierre. |
| H-05 | Mayor (latente) | `apps/functions`, `deploy.yml` | Conocido y ticketeado como MVP-31: `functions` no emite build, no tiene `main` ni `engines`, `workspace:*` no se resuelve en el deploy y el job de deploy sale verde sin desplegar. **Se agregan tres puntos que MVP-31 no lista:** (a) `helloWorld` se registra como función de **1ª gen** (`gcfv1`), contra la v3 §1 (2ª gen); (b) sin región `southamerica-east1`; (c) `functions` hereda `moduleResolution: bundler`, así que imports relativos sin `.js` pasarán typecheck y fallarán en Node. Además, `DEPLOY-functions.md` y `MVP-31.md` describen lo mismo con criterios distintos para los secrets. | `firebase-functions` 5.1.1: `https.onCall(...).__endpoint.platform = 'gcfv1'`. `ls apps/functions/lib` tras `pnpm build`: no existe. | (a), (b) y (c) agregados a `tickets/MVP-31.md` y `DEPLOY-functions.md` marcado como reemplazado en este cierre; falta decidir P-05. **Antes del primer callable.** |
| H-06 | Mayor | Arquitectura §4 (MVP-02 y MVP-03) | Criterios de aceptación de la arquitectura que no se cumplieron y que no tienen ticket: MVP-02 (proyectos reales en Blaze, región, alerta de presupuesto, deploy manual a dev; `.firebaserc` tiene IDs ficticios) y MVP-03 (URL de preview por PR y deploy a prod por tag; target de Hosting sin mapear). | `tickets/MVP-03.md`, sección ESTADO; `.firebaserc`. | Abrir tickets (o decidir que pasan al Hito 1B). Ver P-01 y P-06. |
| H-07 | Mayor | `package.json` raíz | `pnpm ci:run` no replica CI: le falta `Build shared`. Desde que `motor` o `functions` importen `shared` (MVP-13), en un clon limpio fallará con `TS2307`, y un agente puede reportar un rojo falso o, peor, no correr la secuencia completa. | `ci:run` = `lint && typecheck && test && build`; `ci.yml` construye `shared` antes de `lint`. | `CR`: anteponer `pnpm --filter @sistema-redespachos/shared build` en `ci:run`. Mientras tanto, `AGENTS.md` §5 indica la secuencia completa. |
| H-08 | Mayor | `.github/dependabot.yml` | 15 PRs de Dependabot abiertas, con majors que contradicen decisiones: `zod` 4 (decisión de MVP-04: quedarse en 3; su CI falla), `@types/node` 26 (runtime 22), `firebase` 12, `firebase-functions` 7, `vite` 8, `eslint` 10, `@vitejs/plugin-react` 6. No hay `ignore` de majors. | `gh api .../pulls?state=open`. | `CR`: ignorar `semver-major` (o agrupar) y cerrar las PRs de majors. Ningún agente mergea PRs de Dependabot. |
| H-09 | Mayor | `apps/functions/src/index.ts`, `apps/web/src` | `AGENTS.md` §3 dice que no hay índices compartidos y que las Functions "se exportan por carpeta", pero hoy existe un único `index.ts` en `functions` y no hay mecanismo de registro por carpeta ni shell web (`apps/web/src/app`). El primer callable de cada carril (MVP-06 en B, MVP-10 en A) tendrá que editar el mismo archivo. | `apps/functions/src/index.ts` exporta `helloWorld`; `apps/web/src/app` no existe. | Decidir el mecanismo (P-07) y crearlo en MVP-31 o en un `CR` propio. **Antes de MVP-06.** |
| H-10 | Menor | `firebase.json` | Referencia `firestore.indexes.json`, que no existe; los índices compuestos de §2.5 no están definidos. `storage.rules` tampoco existe (`AGENTS.md` lo asigna al carril B). | `ls firestore.indexes.json storage.rules`: no existen. | Incluirlo en MVP-07. |
| H-11 | Menor | Raíz | Prettier está en las dependencias y en el script `format`, pero sin configuración. `prettier --check` marca 46 archivos de `shared`; `pnpm format` reformatearía todo a comillas dobles. | `pnpm exec prettier --check "packages/shared/src/**/*.ts"`. | `CR`: `.prettierrc` con el estilo actual (comillas simples) y `prettier --check` en CI. |
| H-12 | Menor | `packages/motor`, `apps/web` | Quedan placeholders: `motor/src/schemas/index.ts` (riesgo de tipos duplicados, hallazgo 7 de la auditoría), `cotizarPlaceholder` y dos tests que solo hacen `toBeDefined`. `motor` declara `zod` y `decimal.js` propios. | Archivos citados. | Eliminar en MVP-13; `motor` consume los esquemas solo desde `@sistema-redespachos/shared`. |
| H-13 | Menor | MVP-04, PREGUNTAS | Supuestos todavía abiertos que impactan Ola 1: 16 (cotización manual con referencias nulas), 20 (criterios del parser que la arquitectura no fija), 22 (`orderDocumentSchema` sin discriminador). | `tickets/MVP-04.md` líneas 230-242. | Decidir antes de MVP-17, MVP-19 y MVP-20 (P-08). |
| H-14 | Menor | Documentación | Desactualizados: `FIREBASE.md` (colección inexistente `liquidaciones`, reglas "en MVP-09", Node 20, deploy de reglas a prod), `README.md` (Node 20), `CI.md` (sin `Build shared`), `AGENTS.md` (fuente 4 inexistente en el repo, flujo de PR), `mapa-de-contexto.md` (sin D30-D37 ni MVP-31). `.gitignore` conserva reglas de la herramienta B0. | Archivos citados. | Corregidos en este cierre salvo `.gitignore` (compartido; `CR` menor). |
| H-15 | Menor (datos) | Carpeta local de Franco (no versionada) | Quedan artefactos de la etapa B0 en la carpeta del repo: `test/fixtures/output/tabla_maestra.json` y `test/fixtures/out/t.jsonl`, más `coverage/`, `tsconfig.tsbuildinfo` y `.claude/settings.local.json`. Están ignorados por git, pero un agente que trabaje en la carpeta los puede leer. Si son tarifas reales, es dato comercial. | `device_list_dir` de la carpeta. | Moverlos a `herramientas-tarifas` (P-11). |
| H-16 | Menor | Git | Ramas y tags para limpiar: remotas `mvp-02-firebase-setup`, `mvp-03-ci-setup`, `mvp-04-zod-schemas` ya mergeadas; local `mvp-04-auditoria` sin commits propios; tag `archivo/mvp-04-wip` (su condición de borrado se cumple al cerrar H-02). | `git branch -a`. | Limpiar tras cerrar H-02. |

## Preguntas abiertas

No se asumió ninguna respuesta. Cada una indica qué bloquea.

| # | Pregunta | Bloquea |
| --- | --- | --- |
| P-01 | ¿Existen los proyectos Firebase reales de dev y prod en Blaze, en `southamerica-east1`, con la alerta de presupuesto? ¿Cuáles son sus IDs? `.firebaserc` tiene `proyecto-qx-dev` y `proyecto-qx-prod`, que MVP-02 dejó como ficticios. | MVP-31, deploy a dev, H-06 |
| P-02 | ¿Las `firestore.rules` actuales se desplegaron alguna vez a un proyecto real? Si sí, hay que reemplazarlas ya. | H-04 |
| P-03 | D36: ¿`origen_tms` guarda las 47 columnas crudas, incluidas las que también se mapean a campos (duplica unos 19 valores por pedido), o preferís otro campo (por ejemplo, la fila original solo para `CON_ERROR`)? La lectura literal de D36 es la primera. | H-01, MVP-17, MVP-19 |
| P-04 | Cierre de la auditoría: ¿re-auditoría acotada de Gemini o cierre firmado por vos? | H-02, inicio de Ola 1 |
| P-05 | Deploy sin secrets: ¿falla siempre (MVP-31: cada push a `main` queda en rojo hasta cargar los secrets) o se activa con una variable `DEPLOY_ENABLED` (borrador `DEPLOY-functions.md`)? | MVP-31 |
| P-06 | Preview de Hosting por PR y deploy a prod por tag: ¿tickets nuevos? ¿En qué hito? | H-06 |
| P-07 | ¿Cómo se registran las Functions y las rutas web sin un índice compartido? Opciones: un `index.ts` por dominio reexportado por un índice generado, o un `CR` por cada alta. ¿Quién crea el shell web y antes de qué ticket? | H-09, MVP-05, MVP-06, MVP-10 |
| P-08 | Supuestos abiertos de MVP-04: 16 (cotización manual con `tarifario_id` y `variante_id` nulos), 20 (volumen vacío → `VOLUMEN_INVALIDO`; bultos 0 → `FORMATO_INVALIDO`) y 22 (discriminar `pedidos` por `estado` antes de parsear). | MVP-17, MVP-19, MVP-20 |
| P-09 | ¿Qué agente toma cada carril en la Ola 1? El repo no lo registra; en la Ola 0 Claude Code fue autor de MVP-04 y Gemini lo auditó. | Prompts de inicio |
| P-10 | `docs/documentacion-funcional.md` no existe en el repo (vive en el Project). ¿Se versiona en el repo o se elimina la referencia de `AGENTS.md`? Por ahora `AGENTS.md` lo marca como "a pedido, lo pega Franco". | Tickets que lo citen |
| P-11 | `tabla_maestra.json` y `t.jsonl` en `test/fixtures/` de tu carpeta local: ¿son datos reales? ¿Se mueven a `herramientas-tarifas`? | H-15 |
| P-12 | Política para Dependabot: ¿solo parches y menores, con majors como `CR: deps` manual? | H-08 |

## Secuencia recomendada antes de abrir los carriles

1. Mergear a `main` el commit `80d4735` y los documentos de este cierre (H-03, H-14).
2. Cerrar la auditoría (H-02, P-04) y limpiar ramas y tag (H-16).
3. `CR` de infraestructura en una sola PR: `ci:run` con `Build shared` (H-07), `.prettierrc` (H-11), `dependabot.yml` sin majors (H-08), reglas *deny-all* (H-04).
4. Decidir P-03 y abrir el `CR` de `shared` para D36 (H-01). Puede correr en paralelo con MVP-13 y MVP-14, pero debe estar mergeado antes de MVP-17.
5. MVP-31 con los puntos agregados (H-05) y el mecanismo de registro de Functions (H-09, P-07).
6. Abrir carriles: A con MVP-13 y MVP-14; B con MVP-05 a MVP-08.

## Respuestas a las preguntas abiertas

Respuestas de Franco del 5 de octubre. Donde respondió "no tengo el conocimiento técnico", Claude hizo una propuesta y **Franco dio el OK a todas** el mismo día (15:51): pasan a decididas.

| # | Respuesta / propuesta | Estado | Efecto |
| --- | --- | --- | --- |
| P-01 | Proyecto de desarrollo **creado**: nombre "Sistema Expresos", ID `qx-redespachos-dev`, número 775726638194. Prod todavía no existe. | Respondida | `.firebaserc`, `deploy.yml`, `firebase-init.ts` y `.env.local.template` apuntan al ID real (`CR` aprobado por Franco). Falta confirmar Blaze, presupuesto y ubicación de Firestore. |
| P-02 | Las reglas **nunca se desplegaron**. | Respondida | H-04 baja a riesgo futuro; el `CR` *deny-all* sigue antes del primer deploy real. |
| P-03 | Franco no quiere duplicar campos. **Propuesta:** `origen_tms` completo (las 47 columnas crudas) **solo en pedidos con error** (`invalidOrderSchema`), que son los únicos que se exportan (D36). Los pedidos válidos siguen como hoy: sus campos mapeados ya son correctos y el reporte de liquidación los toma de ahí. D26 se ajusta a "se guarda en `expreso_manual`". Duplica unos 19 valores solo en las filas con error (5 de 538 en el archivo real). | **Decidida** | Define el `CR` de H-01. Requiere ajustar el texto de D26 y D36 en la arquitectura. |
| P-04 | **Cierre firmado por Franco y Claude**, sin re-auditoría. | Respondida y aplicada | H-02 resuelto. |
| P-05 | Franco no conocía el concepto de secrets. **Propuesta:** activar el deploy con una variable de GitHub (`DEPLOY_ENABLED`), como en `DEPLOY-functions.md`. Mientras no existan los proyectos, cada push a `main` quedaría en rojo con la opción de "fallar siempre", y un CI siempre rojo se deja de mirar. | **Decidida** | Punto 4 de MVP-31. |
| P-06 | **Propuesta:** preview por PR en un ticket nuevo después de MVP-31 (cuando haya proyecto dev); deploy a prod por tag en el Hito 1B, antes de operar. | **Decidida** | H-06. |
| P-07 | **Propuesta:** MVP-31 deja creado `apps/functions/src/index.ts` con **una línea por cada dominio de §3.8** (auth, admin, postalRouter, suppliers, tariffs, emailTemplates, orders, proformas, emails, settlement, purchaseOrders, reports), cada una apuntando a un `index.ts` de dominio vacío. Desde ahí cada carril edita solo los índices de sus dominios y el índice raíz no se toca más. Mismo criterio para el shell web: lo crea MVP-05 con la lista fija de features de `AGENTS.md` §3. | **Decidida** | H-09. Amplía MVP-31 y MVP-05. |
| P-08 | **Propuesta:** aceptar los tres supuestos tal como están, porque no requieren código nuevo y son coherentes con la arquitectura: 16 (la cotización manual exige proveedor, montos y justificación, §3.8), 20 (criterios del parser) y 22 (los consumidores eligen `orderSchema` o `invalidOrderSchema` según `estado`). | **Decidida** | H-13. |
| P-09 | Franco propone que **Gemini (Antigravity) desarrolle un carril y Claude lo audite**; abierto a sugerencias. Ver nota abajo. | Abierta | Prompts de inicio. |
| P-10 | `docs/documentacion-funcional.md` **agregado** al repo (en la carpeta local, sin commitear). | Respondida | `AGENTS.md` §2 vuelve a apuntar al archivo. |
| P-11 | `tabla_maestra.json` y `t.jsonl` **no son datos reales** (Expreso ALFA es ficticio). | Respondida | H-15 sin riesgo de datos; se pueden borrar o mover cuando quieras. |
| P-12 | **Propuesta:** Dependabot solo abre PRs de parches y versiones menores; las majors entran a mano como `CR: deps`. Las 15 PRs abiertas se cierran (todas son majors). | **Decidida** | H-08. |

**P-09 (abierta).** Falta confirmar qué carril es el "carril 1" y quién desarrolla el otro. **Nota:** En la Ola 1 el carril A (motor de cotización) es el de mayor riesgo, porque calcula dinero. Lo que más protege ese carril no es qué agente lo escribe sino la auditoría adicional del motor (`docs/auditoria-cruzada.md`): el auditor recalcula por su cuenta los casos de referencia sin mirar el código del autor. Con la propuesta de Franco (Gemini desarrolla A, Claude audita) ese control queda del lado de Claude. Hay que confirmar que Antigravity cargue `GEMINI.md` y `AGENTS.md` al abrir el repo; si no, se pegan al inicio de cada conversación.
