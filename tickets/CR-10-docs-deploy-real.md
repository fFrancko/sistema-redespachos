# CR-10 — Documentar la infraestructura del primer deploy real y actualizar CR-09

- **Carril:** Compartido (`CR`, solo documentación). Toca `docs/` y tickets.
- **Agente:** Claude Code · **Modelo:** Opus 5.5 · pedido directo de Franco (9/10/2026), sin ticket previo
- **Auditor:** no requiere auditoría cruzada (no cambia código ni workflows). Franco revisa el diff.
- **Rama:** `cr-10-docs-deploy-real`, **sobre `cr-09-actions-node24`** (PR #30): los dos tocan `docs/CI.md` y el ticket de CR-09 existe solo en esa rama.
- **Depende de:** CR-09 (PR #30). Se mergea después de #30.

## Contexto

El 8/10/2026 Franco configuró a mano, en `qx-redespachos-dev`, Workload Identity Federation, la cuenta de servicio de deploy, sus roles y las APIs que pidió la CLI de Firebase. Cargó los secrets y activó `DEPLOY_ENABLED`. El run [37676044027](https://github.com/fFrancko/sistema-redespachos/actions/runs/37676044027) desplegó `helloWorld` en el intento 8, y la callable respondió por HTTP.

Nada de eso estaba registrado en el repo, y tres documentos quedaron desactualizados:

- MVP-31 seguía con "el deploy real no se probó".
- El criterio 5 de CR-09 esperaba "Deploy a dev desactivado".
- `docs/FIREBASE.md` describía reglas de Firestore que ya no existen.

## Alcance

1. `docs/CI.md`, sección "Deploy a dev":
   - Dónde se cargan los secrets (Repository secrets, no Variables), con el error que dio cargarlos mal.
   - Estado actual del deploy: activado, con el primer run real.
   - Subsección nueva "Infraestructura en Google Cloud (dev)": WIF (pool, provider, condición, mapeo), la cuenta de servicio y sus roles, las APIs activadas a mano, los comandos para verificar el estado, la prueba de humo con `curl` y la facturación.
   - En "Fuera de alcance", la referencia a prod y el upgrade de `firebase-functions`.
2. `docs/FIREBASE.md`: deploy activado, con referencia a `docs/CI.md`, y reglas de Firestore en su estado real (_deny-all_).
3. `tickets/MVP-31.md`: cierre del riesgo 1 con la evidencia.
4. `tickets/CR-09-actions-node24.md`: el criterio 5 pasa a "despliega de verdad con `auth@v3`", y se actualizan "Fuera de alcance" y "Riesgos". Los cambios quedan marcados como actualización del 9/10 y no reescriben la nota del agente.
5. `docs/ola-0/estado-y-decisiones.md` §3: una línea de "resuelto en parte" en "No existe todavía", porque los agentes leen esa sección antes de planificar (`AGENTS.md` §5.1).

## Archivos permitidos

`docs/CI.md`, `docs/FIREBASE.md`, `docs/ola-0/estado-y-decisiones.md` (solo la línea del punto 5), `tickets/MVP-31.md`, `tickets/CR-09-actions-node24.md` y este ticket.

## Archivos prohibidos

Todo lo demás, en particular `.github/`, `firebase.json`, `.firebaserc` y el código.

## Criterio de aceptación

1. `git diff --stat cr-09-actions-node24...HEAD` muestra solo archivos permitidos.
2. `pnpm format:check` en verde.
3. Cada dato de infraestructura en `docs/CI.md` sale de una salida real de Cloud Shell pegada por Franco el 8/10, o de la API de GitHub (runs e intentos). Lo que no se pudo confirmar queda marcado como tal.

## Plan

Pedido y alcance definidos por Franco en la conversación del 9/10 ("documentá lo que configuramos y ajustá CR-09 en la misma PR"). Rama sobre `cr-09-actions-node24` para evitar el conflicto en `docs/CI.md`. Un solo commit.

## PREGUNTAS

1. **`roles/firebase.viewer`:** se sugirió durante la configuración, pero no hay salida que confirme que se asignó. Se marcó como "confirmar" en `docs/CI.md`. Franco: corré el primer comando de "Verificar el estado" y, si no aparece, decidí si se agrega o se borra la fila.
2. **Alerta de presupuesto** (criterio de MVP-02): sigue pendiente. Los montos sugeridos están en la conversación del 9/10.

---

## Nota de entrega

- **Qué se hizo:** se registró en `docs/CI.md` toda la infraestructura del deploy a dev: WIF, la cuenta de servicio `github-deploy`, sus roles, las APIs, cómo verificar el estado y la prueba de humo. Se actualizaron `docs/FIREBASE.md` (deploy activado, reglas _deny-all_), el cierre del riesgo 1 de MVP-31, el criterio 5 de CR-09 y una línea del estado de la Ola 0.
- **Commit:** ver `git log -1` en `cr-10-docs-deploy-real` (este ticket va en el mismo commit). Sin push: la sesión no tiene permiso de escritura en el repo, así que Franco aplica el parche y pushea.
- **Archivos tocados:** `docs/CI.md`, `docs/FIREBASE.md`, `docs/ola-0/estado-y-decisiones.md`, `tickets/MVP-31.md`, `tickets/CR-09-actions-node24.md` y este ticket.
- **Cómo probarlo:** leer el diff. Los comandos de "Verificar el estado" en `docs/CI.md` se corren en Cloud Shell y no modifican nada.
- **Resultado de la verificación:** `pnpm format:check` (ver el mensaje del commit). No hay cambios de código, así que no aplica el resto de §5.5.
- **Consumo real:** no aplica.
- **Evidencia del criterio de aceptación:**
  - Intentos del run 37676044027, leídos por la API de GitHub:
    - Intento 1, del 7/10: verde, sin deploy.
    - Intentos 2 a 5: fallaron en `Check deploy config` (secrets cargados como variables).
    - Intentos 6 y 7: fallaron en `Deploy Functions` (APIs sin activar).
    - Intento 8: verde, con `Authenticate to Google Cloud` y `Deploy Functions` en `success`.
  - Los roles, el pool, el provider y la condición salen de las salidas de `gcloud` pegadas por Franco.
- **Decisiones tomadas:**
  - Los identificadores de WIF (número de proyecto, pool, provider y email de la cuenta) se documentan en claro: no son credenciales, y sin ellos no se puede auditar ni repetir la configuración. Siguen viajando como secrets porque así los lee `deploy.yml`.
  - En CR-09 no se reescribió la nota del agente. Se agregaron líneas marcadas "Actualización del 9/10/2026".
- **Supuestos:** las APIs `firebaseextensions`, `eventarc`, `pubsub`, `storage` y `cloudbilling` se activaron entre los intentos 5 y 8: el deploy del intento 8 no habría pasado sin `firebaseextensions` ni `eventarc`.
- **Fuera de alcance:**
  - `docs/ola-0/estado-y-decisiones.md` §3 tiene otras líneas desactualizadas: `.prettierrc` existe, las reglas ya son _deny-all_, H-09 se resolvió en MVP-31 y `helloWorld` ya es de 2ª gen. Sin ticket. Conviene un repaso de esa sección o marcarla como histórica.
  - La alerta de presupuesto (MVP-02) y las APIs y roles de Cloud Tasks para MVP-22.
- **Riesgos y deuda:**
  - Desde el 8/10, todo merge a `main` despliega. Un ticket que agregue triggers, colas o funciones programadas necesita APIs y roles nuevos **antes** del merge, o el deploy falla.
  - La condición del provider limita por repositorio, no por rama. Se revisa con MVP-32.
