# MVP-31 — Deploy de `apps/functions`

- **Carril:** Compartido (`CR`). Toca `.github`, `firebase.json`, `apps/functions/tsconfig.json` y `apps/functions/package.json`.
- **Agente:** Claude Code · **Modelo:** Opus 5.5 · **Esfuerzo:** high
- **Auditor:** Gemini · auditoría estándar + leer los pasos del run (un paso `skipped` que debía correr es hallazgo)
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

### Agregado en el cierre de la Ola 0 (`docs/ola-0/informe-validacion.md`, H-05 y H-09)

6. **Functions de 2ª gen y región.** El `helloWorld` actual se registra como 1ª gen (`firebase-functions` 5.1.1, `platform: 'gcfv1'`), contra la v3 §1. Reemplazalo por una callable de ejemplo con `firebase-functions/v2/https` y `region: 'southamerica-east1'` que importe algo de `@sistema-redespachos/shared`.
7. **`NodeNext` en `apps/functions`.** Hoy hereda `moduleResolution: bundler` de la raíz: un import relativo sin `.js` pasa el typecheck y falla al cargar en Node. Mismo esquema que `packages/shared`.
8. **Registro de Functions sin índice compartido** (decidido el 5/10, P-07): `apps/functions/src/index.ts` queda con una línea por cada dominio de §3.8 (`auth`, `admin`, `postalRouter`, `suppliers`, `tariffs`, `emailTemplates`, `orders`, `proformas`, `emails`, `settlement`, `purchaseOrders`, `reports`) que reexporta un `index.ts` de dominio vacío. Después de este ticket, el índice raíz no se edita más; cada carril edita los índices de sus dominios.
9. **Punto 4, decidido el 5/10 (P-05):** el deploy se activa con la variable de repositorio `DEPLOY_ENABLED`. Con `DEPLOY_ENABLED = 'true'` y algún secret ausente, el job falla con `exit 1`; con la variable ausente o en otro valor, el deploy se omite con un aviso explícito en el resumen del job (`$GITHUB_STEP_SUMMARY`), no con un warning que pase inadvertido.
10. **Proyecto real:** el proyecto de dev es `qx-redespachos-dev` (ya configurado en `.firebaserc` y `deploy.yml`).

## Fuera de alcance

- Cualquier cambio en `packages/shared`, `packages/motor` o el código de negocio de `apps/functions`.
- Los secrets de GCP: los configura Franco.

## Criterio de aceptación

1. `pnpm build` genera `apps/functions/lib` con un entry válido, y la salida pegada.
2. `firebase deploy --only functions --project qx-redespachos-dev` publica, y una callable responde. Si no tenés credenciales, dejá el comando y la verificación local con los emuladores, y marcá el punto como pendiente de Franco explícitamente.
3. Con `DEPLOY_ENABLED = 'true'` y sin los secrets, el job de deploy falla con un mensaje claro; sin la variable, el resumen del run dice que el deploy está desactivado. Con la salida pegada.
4. `lint`, `typecheck`, `test` y `build` en verde sobre la rama, con la secuencia de `AGENTS.md` §5.5.
5. Nota de entrega con la opción de empaquetado elegida y por qué.
6. El JS emitido de `apps/functions/lib` carga con Node puro (`node --input-type=module -e "import('./apps/functions/lib/index.js')"`) y la callable de ejemplo es de 2ª gen en `southamerica-east1`.

## Plan

<lo completa el agente antes de empezar; Franco da el OK>

## PREGUNTAS

<dudas del agente>
