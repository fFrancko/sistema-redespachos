# Ola 0 — Cambios en las instrucciones de los agentes

Qué se cambió en las instrucciones para la Ola 1 y por qué. Cada cambio sale de un hallazgo (H-xx) de [`informe-validacion.md`](informe-validacion.md) o de una lección de [`estado-y-decisiones.md`](estado-y-decisiones.md) §7.

## `AGENTS.md`

| Sección | Cambio | Por qué |
| --- | --- | --- |
| §1 | Node 22, pnpm 9 y región `southamerica-east1` explícitos. | Decía solo "Node ≥ 20" de hecho (README) y no fijaba región. |
| §2 | Nueva fuente 4: `docs/ola-0/estado-y-decisiones.md` (estado real del repo). El documento funcional pasa a "lo pega Franco": no existe en el repo. D30-D37 se leen si el ticket toca `pedidos`, `reglas_tarifa`, `canalizador_cp` o el parser. | La fuente 4 anterior apuntaba a un archivo inexistente (H-14, P-10). Los agentes no tenían cómo saber qué es placeholder y qué es real. |
| §3 | `apps/functions/src/index.ts`, `firebase.json`, `.firebaserc`, `vitest.config.ts`, `eslint.config.js`, `.prettierrc`, `.gitignore`, `docs/` y los archivos de agentes pasan a **compartido**. `firestore.indexes.json` va al carril B. Aviso sobre el índice único de Functions y el shell web inexistente. Prohibido mergear PRs de Dependabot. | Esos archivos no tenían dueño y el primer callable de cada carril iba a chocar en el mismo índice (H-08, H-09, H-10). |
| §4, regla 1 | Nombra los helpers de dinero de `shared`. | Evitar reimplementaciones del redondeo. |
| §4, regla 3 | Importar solo `@sistema-redespachos/shared`; nunca ruta relativa ni alias `@shared/*`; no declarar esquemas en otros paquetes. | El alias de `tsconfig` no sirve en runtime y `motor/src/schemas` es un placeholder que invita a duplicar (H-12). |
| §4, regla 7 | Los tests tienen que fallar si se rompe la regla; `toBeDefined` no cuenta. | Dos de los 490 tests son placeholders de ese tipo (H-12). |
| §4, regla 8 | Scripts que leen datos reales imprimen solo conteos; CUIT de prueba inventados. | Patrón de `checkTmsFile` y hallazgo 9 de la auditoría (CUIT real del Banco Nación en un test). |
| §4, regla 11 | Reescrita: `shared` congelado, cambios solo por `CR: shared — <cambio>` que aprueba Franco. | La versión anterior ("ya no modificar más") contradecía el mecanismo de `CR` de §3 y dejaba sin camino a D36 y D37 (H-01, H-03). |
| §5 | Plan con lista de archivos y OK previo; rama desde `origin/main`; **secuencia de verificación completa empezando por `Build shared`**; advertencia de que `ci:run` no la replica; **commit sin push ni PR** con el hash en la nota. | `ci:run` omite `Build shared` (H-07). El flujo acordado por Franco es que el agente commitea y él revisa, pushea y abre la PR; `AGENTS.md` decía "PR a main" (inconsistencia de proceso). |
| §6 | Verificar contra la arquitectura cuando el criterio viene de §4; prohibido afirmar "CI verde" sin verlo; probar el consumo real de lo que otro paquete importa o corre en Node; declarar lo que queda fuera de alcance y su ticket. | Lecciones 1, 3 y 7: `shared` pasó todo y no era importable; MVP-03 dejó criterios sin ticket (H-06). |
| §7 | La auditoría `RECHAZADO` no se cierra sin veredicto final. | H-02. |
| §9 (nueva) | Trampas técnicas conocidas: `noEmit` y `bundler` heredados, `dist` fuera de git, Functions 2ª gen, workflows verdes que omiten pasos, dos esquemas de `pedidos`, cruce por `_norm` (D33), columnas desde `TMS_COLUMNS` (D37). | Lecciones 1 a 3 y supuesto 22 de MVP-04; evitar que cada agente las redescubra. |

## `CLAUDE.md` y `GEMINI.md`

- Esperar el OK del plan antes de editar (ya estaba en el prompt inicial, no en estos archivos).
- Secuencia de verificación de `AGENTS.md` §5.5 en lugar de "comandos de verificación".
- Commit sin push, sin PR, sin force-push ni borrado de ramas o tags.
- Claude: no tocar `shared` ni compartidos; archivos de prueba de auditoría fuera del repo o sin commitear.
- Gemini: no leer la arquitectura entera; en auditoría, citar línea y no contar como hallazgo lo que D30-D37 permite.

Por qué: el flujo de git acordado no estaba escrito en ningún archivo que los agentes carguen, y los dos puntos de Gemini son los que más ruido generaron en la auditoría de MVP-04 (hallazgos de conformidad que terminaron en decisiones nuevas).

## `docs/auditoria-cruzada.md`

- Prompt: diff contra `origin/main` por rama o hash (el autor no pushea), verificación desde clon limpio con `Build shared`, lectura del estado real del repo, informe en `tickets/MVP-XX-AUDITORIA.md`.
- Checklist: criterio de la arquitectura vs. del ticket (recortes sin ticket = hallazgo), D30-D37 incluidas, D35 no es hallazgo, mutaciones mínimas (3), **ítem 10: consumo real**, **ítem 11: leer los pasos del run de CI**.
- Cierre: lista de decisiones para Franco obligatoria y nueva **verificación de correcciones** con veredicto final; un `RECHAZADO` no congela ni cierra nada hasta ese veredicto.

Por qué: H-02 (auditoría sin cierre), lecciones 1, 3 y 6.

## `docs/mapa-de-contexto.md`

- Prompt inicial alineado con el flujo de commit sin push y con la lectura del estado real.
- Ola 0 marcada como cerrada con observaciones, con el estado de cada ticket.
- Nueva tabla **"Antes de abrir los carriles"**: cierre de auditoría, `CR` de infraestructura, `CR` de D36, MVP-31.
- Filas de Ola 1 con las decisiones D30-D37 que les tocan, dependencias nuevas (MVP-17 depende del `CR` de D36; MVP-06 y MVP-10 de MVP-31) y notas (MVP-13 borra placeholders; MVP-14 activa el umbral de cobertura; MVP-07 suma índices y `storage.rules`).
- Nueva fila de MVP-31 en "Compartido".

## `tickets/_TEMPLATE.md`, `tickets/MVP-31.md`, `tickets/DEPLOY-functions.md`

- Plantilla: hash del commit, `git diff --stat`, salida de la secuencia completa, consumo real, supuestos y fuera de alcance en la nota de entrega.
- MVP-31: 2ª gen y región, `NodeNext`, registro sin índice compartido (si se asigna) y el punto de secrets condicionado a P-05; criterio nuevo de carga con Node puro.
- DEPLOY-functions: marcado como reemplazado por MVP-31.

## Documentación de soporte corregida

`README.md` (Node 22, secuencia de verificación, enlaces), `docs/CI.md` (paso `Build shared`, `ci:run` incompleto, deploy verde que no despliega, Dependabot) y `docs/FIREBASE.md` (colecciones desde `shared`, proyectos provisorios, prohibición de desplegar reglas, reglas actuales solo para emulador).
