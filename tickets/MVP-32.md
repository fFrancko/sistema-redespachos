# MVP-32 — Preview de Hosting por PR

- **Carril:** Compartido (`CR`: toca `.github` y `firebase.json`).
- **Agente:** Claude Code · **Modelo:** Sonnet 5.5 · **Esfuerzo:** medium
- **Auditor:** Gemini · auditoría liviana + leer los pasos del run
- **Rama:** `mvp-32-preview-hosting`
- **Depende de:** MVP-31 y MVP-05 mergeados.
- **Origen:** criterio de MVP-03 en la arquitectura §4 ("un PR muestra los checks y una URL de preview"), quitado de MVP-03 y decidido el 5/10 como ticket nuevo después de MVP-31 (H-06, P-06). El deploy a prod por tag queda para el Hito 1B, sin ticket todavía.

## Contexto a leer
- `docs/arquitectura-v3.md`: §1 (fila CI/CD), §4 (fila MVP-03).
- `docs/CI.md`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `firebase.json`, `.firebaserc`.
- `tickets/MVP-31.md` (mecanismo `DEPLOY_ENABLED`).

## Alcance
1. Target de Hosting en `firebase.json` apuntando al build de `apps/web` (`apps/web/dist`), con rewrite de SPA a `index.html`.
2. Workflow (o job en `ci.yml`) que en cada PR construye `apps/web` y publica un **preview channel** de Hosting en `qx-redespachos-dev` con expiración de 7 días, y comenta la URL en la PR.
3. Mismo interruptor que MVP-31: sin `DEPLOY_ENABLED = 'true'` el preview se omite y el resumen del run lo dice; con la variable y sin secrets, el job falla.
4. Las variables `VITE_*` de Firebase del proyecto dev se inyectan desde variables del repositorio, no desde el código.
5. Actualizar `docs/CI.md`.

## Archivos permitidos
`firebase.json` (solo `hosting`), `.github/workflows/**`, `docs/CI.md`, este ticket.

## Archivos prohibidos
Todo lo demás.

## Criterio de aceptación
1. Literal de la arquitectura §4 (MVP-03): **"Un PR muestra los checks y una URL de preview."**
2. Sin `DEPLOY_ENABLED`, el resumen del run dice que el preview está desactivado; con la variable y sin secrets, el job falla. Con la salida pegada.
3. Si el agente no tiene credenciales, deja el workflow verificado con `act` o con una PR de prueba que Franco dispara, y marca el punto 1 como pendiente de Franco.

## Plan
<lo completa el agente antes de codear; Franco da el OK>

## PREGUNTAS
<dudas del agente>

---

## Nota de entrega
Usar la plantilla de `tickets/_TEMPLATE.md`.
