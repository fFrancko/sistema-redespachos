# MVP-22 — Outbox de emails, worker con Cloud Tasks y Gmail API

- **Carril:** B · Plataforma y circuito
- **Agente:** Claude Code · **Modelo:** Opus 5.5 · **Esfuerzo:** high
- **Auditor:** Gemini · auditoría estándar + forzar fallos (3 intentos, reintento de la cola después de un éxito)
- **Rama:** `mvp-22-email-outbox`
- **Depende de:** `CR-04` mergeado.

## Contexto a leer
- `docs/arquitectura-v3.md`: §3.4 (puntos Worker e Idempotencia), §2.5 (`emails_salida`, `proformas`), §3.7 (filas `ERROR_COMUNICACION`), §1 (fila Email), §6.1 (filas de adjunto grande y spam).
- `packages/shared`: `schemas/emails.ts`, `schemas/proformas.ts`, `orderTransitions.ts`, `enums.ts`.

## Alcance
1. **Trigger** `onCreate` de `emails_salida` en `PENDIENTE` que encola el envío en Cloud Tasks (`onTaskDispatched`, 2ª gen, `southamerica-east1`) con backoff y **máximo 3 intentos**.
2. **Worker** `emails.worker`: relee el email en una transacción y **no envía si ya está `ENVIADO`** (idempotencia); envía; marca `ENVIADO` o incrementa `intentos` y guarda `ultimo_error`.
3. **Transporte** detrás de una interfaz (`EmailTransport`) con dos implementaciones: Gmail API (cuenta de servicio con delegación de dominio sobre el buzón compartido; `para`, `cc`, `cco`, adjunto desde Storage) y un transporte falso para emuladores y tests, que se elige por configuración. Credenciales por Secret Manager, nunca en el código.
4. **Efectos por proforma** (si el email tiene `proforma_id`): éxito → proforma `ENVIADA` y sus pedidos `PENDIENTE_CONFIRMACION`; tercer fallo → email `ERROR`, proforma `ERROR_COMUNICACION` y pedidos `ERROR_COMUNICACION`. Toda transición pasa por la tabla de `shared`.
5. **Reenvío** desde `ERROR_COMUNICACION`: callable que vuelve el email a `PENDIENTE` con `intentos = 0`, auditada (`ADMIN`, `ANALISTA` de la sucursal, `BACKOFFICE`).
6. Contador en la UI de pedidos en `ERROR_COMUNICACION` (por consulta, sin colección propia).
7. Habilita el email de aviso de `auth.requestAccess` (MVP-06) y de `solicitudes_cp` (MVP-10, Carril A, que solo crea el documento en el outbox).

## Archivos permitidos
`apps/functions/src/{triggers,workers,callables}/emails/**`, el `index.ts` del dominio `emails`, `apps/functions/src/callables/auth/**` (solo para encolar el aviso a `ADMIN`), `apps/web/src/features/proformas/**` (contador y botón de reenvío), tests junto al código, este ticket.

## Archivos prohibidos
Todo lo demás. Armar la proforma y el adjunto es MVP-24.

## Criterio de aceptación
Literal de la arquitectura §4: **"Con el envío forzado a fallar, el email queda en `ERROR` tras 3 intentos y los pedidos en `ERROR_COMUNICACION`; un email ya enviado nunca se envía dos veces."**

Agregados:
1. Test: transporte falso que falla siempre → 3 llamadas exactas, email `ERROR`, proforma y pedidos `ERROR_COMUNICACION`.
2. Test: la cola reentrega una tarea de un email ya `ENVIADO` → el transporte no se llama.
3. Test: falla en el intento 2 y éxito en el 3 → `ENVIADO`, pedidos `PENDIENTE_CONFIRMACION`.
4. Reenvío desde `ERROR_COMUNICACION` vuelve a enviar y audita.
5. Pantalla de "bandeja de salida" (solo `ADMIN`) que muestra los emails simulados con destinatarios, asunto, cuerpo y adjunto descargable, para la demostración. El envío real con Gmail API queda fuera de este ticket.
6. Secuencia de `AGENTS.md` §5.5 y tests con emuladores en verde, con la salida pegada.

## Plan
<lo completa el agente antes de codear; Franco da el OK>

## PREGUNTAS
- (Resuelto 5/10) QX no tendrá Google Workspace hasta después de la demostración. **El transporte por defecto es el simulado:** los emails quedan como `ENVIADO` en `emails_salida` con su contenido y adjunto visibles desde la UI, sin salir a internet. El transporte de Gmail API se programa y se prueba con mocks; el envío real queda como pendiente con ticket propio cuando exista Workspace.

---

## Nota de entrega
Usar la plantilla de `tickets/_TEMPLATE.md`.
