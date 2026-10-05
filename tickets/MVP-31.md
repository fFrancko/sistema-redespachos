# MVP-31 — Deploy de `apps/functions`

- **Carril:** Compartido (`CR`). Toca `.github`, `firebase.json`, `apps/functions/tsconfig.json` y `apps/functions/package.json`.
- **Agente:** el que no haya hecho el `CR` de cierre de Ola 0.
- **Rama:** `mvp-31-deploy-functions`
- **Depende de:** MVP-03 mergeado.
- **Origen:** evidencia levantada durante el `fix(shared)` de MVP-04. **No es un hallazgo de la auditoría de MVP-04**: el deploy está roto desde antes de ese ticket.

## Contexto

El criterio de aceptación de MVP-03 dice "deploy a dev en merge". No se cumple: el deploy de `functions` falla, y hoy está enmascarado porque el paso `Check deploy secrets` de `deploy.yml` omite el deploy con un `::warning` y el job sale verde mientras falten `GCP_WORKLOAD_IDENTITY_PROVIDER` y `GCP_SERVICE_ACCOUNT_EMAIL`.

Evidencia:

- **Sin punto de entrada:** `apps/functions/package.json` no declara `main` ni `engines`, y no existe `apps/functions/index.js`.
- **Build sin emisión:** `apps/functions/tsconfig.json` declara `outDir: "./lib"` pero no sobrescribe el `noEmit: true` que hereda del `tsconfig.json` raíz, así que `pnpm build` no genera nada. `lib/` además está en `.gitignore` (l.46).
- **Sin predeploy:** `firebase.json` declara `"source": "apps/functions"` y no define `predeploy`.
- **`workspace:*` en deploy:** desde el `fix(shared)`, `apps/functions` declara `@sistema-redespachos/shared` con el protocolo `workspace:`, que npm no resuelve en el deploy de Firebase.

## Alcance

1. `apps/functions/tsconfig.json`: `"noEmit": false`.
2. `apps/functions/package.json`: `main` apuntando al entry compilado en `lib/`, `engines.node` acorde al runtime de Functions 2ª gen, y el script de build.
3. Resolver el empaquetado de `packages/shared` para el deploy. Evaluá las opciones y justificá la elegida en la nota de entrega:
   - `predeploy` en `firebase.json` que construya `shared` y lo copie o empaquete dentro de `apps/functions`;
   - `pnpm deploy --filter` a un directorio de deploy con las dependencias resueltas;
   - bundle de `apps/functions` con las dependencias de workspace embebidas.
4. `deploy.yml`: que la ausencia de secrets **falle** el job en lugar de avisar y seguir en verde. Hoy ese comportamiento esconde el problema y va a esconder los próximos.
5. Verificá que `ci.yml` y `deploy.yml` conserven el paso `Build shared` antes de `Lint`.

## Fuera de alcance

- Cualquier cambio en `packages/shared`, `packages/motor` o el código de negocio de `apps/functions`.
- Los secrets de GCP: los configura Franco.

## Criterio de aceptación

1. `pnpm build` genera `apps/functions/lib` con un entry válido, y la salida pegada.
2. `firebase deploy --only functions --project proyecto-qx-dev` publica, y una callable responde. Si no tenés credenciales, dejá el comando y la verificación local con los emuladores, y marcá el punto como pendiente de Franco explícitamente.
3. Sin los secrets configurados, el job de deploy falla con un mensaje claro. Con la salida pegada.
4. `lint`, `typecheck`, `test` y `build` en verde sobre la rama.
5. Nota de entrega con la opción de empaquetado elegida y por qué.

## Plan

<lo completa el agente antes de empezar; Franco da el OK>

## PREGUNTAS

<dudas del agente>
