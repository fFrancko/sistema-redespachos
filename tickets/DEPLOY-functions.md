# DEPLOY-functions — Dejar desplegable `apps/functions` y que el deploy no enmascare fallas

> Borrador sin número, creado desde el FIX de MVP-04. Franco lo numera y lo asigna.

- **Carril:** Deploy (por definir)
- **Agente:** por definir
- **Rama:** `<NN>-deploy-functions`
- **Depende de:** MVP-02, MVP-03, MVP-04 (incluye el FIX de `shared`)
- **Severidad:** alta y latente. No rompe nada hoy porque el deploy no corre (faltan los secrets); rompe el primer deploy real de `functions`.

Este defecto existía antes del FIX de MVP-04. No es un hallazgo contra MVP-04.

## Contexto a leer

- `.github/workflows/deploy.yml`, `firebase.json`, `apps/functions/package.json`, `apps/functions/tsconfig.json`, `tsconfig.json` raíz, `.gitignore` (líneas 7 y 46).
- `docs/CI.md` y `docs/FIREBASE.md`.
- `tickets/MVP-04.md`, sección "Correcciones posteriores".

## Evidencia (verificada sobre la rama `mvp-04-fix-shared`, en un clon limpio)

1. **`deploy.yml` no espera ninguna carpeta de salida.** Ejecuta `Install`, `Lint`, `Typecheck`, `Test`, `Build` y después `firebase deploy --project proyecto-qx-dev --only hosting,functions --non-interactive`. No referencia `apps/functions/lib`.
2. **No hay punto de entrada para el CLI de Firebase.** `firebase.json` declara `"source": "apps/functions"` sin `predeploy` ni runtime. `apps/functions/package.json` no tiene `main` ni `engines`, y no existe `apps/functions/index.js`. El único código es `apps/functions/src/*.ts`.
3. **`pnpm build` de `functions` no emite nada.** `apps/functions/tsconfig.json` extiende el `tsconfig.json` raíz, que tiene `noEmit: true`, y no lo anula. Tras `pnpm install --frozen-lockfile && pnpm build` en un clon limpio, `apps/functions/lib` no existe (y `lib/` está ignorado en `.gitignore`, línea 46). Lo mismo pasa con `packages/motor/dist`.
4. **El paso `Check deploy secrets` enmascara el problema.** Si faltan `GCP_WORKLOAD_IDENTITY_PROVIDER` o `GCP_SERVICE_ACCOUNT_EMAIL`, deja `ready=false`, emite un `::warning` y los pasos de autenticación y deploy se omiten. El workflow sale **en verde** sin haber desplegado nada, y seguirá saliendo en verde con cualquier falla futura mientras falten los secrets.
5. **Segundo bloqueo desde el FIX de MVP-04.** `apps/functions` declara `"@sistema-redespachos/shared": "workspace:*"`. El CLI de Firebase despliega la carpeta `apps/functions` y corre `npm` sobre ella, que no resuelve `workspace:*`. Hay que empaquetar `shared` dentro del deploy.

## Alcance

1. `apps/functions/tsconfig.json`: `noEmit: false` para que `pnpm build` emita `lib/`. Evaluar el mismo cambio en `packages/motor/tsconfig.json`, que hoy tampoco emite.
2. `apps/functions/package.json`: `main` apuntando a la salida compilada y `engines.node` en `22` (coincide con la v3 §1 y con `setup-node` del CI).
3. Empaquetar `@sistema-redespachos/shared` para el deploy de modo que el `workspace:*` no llegue a `npm`. El ticket elige entre un bundler (por ejemplo `esbuild` o `tsup` sobre `functions`) y `pnpm deploy` o un tarball de `shared` en una carpeta de deploy. `shared` ya se importa con Node puro (`NodeNext`), así que cualquiera de las dos opciones es viable.
4. `firebase.json`: `predeploy` si el build no queda cubierto por el workflow, y revisar `ignore` para no subir `src` ni dependencias de desarrollo.
5. **`deploy.yml`, paso `Check deploy secrets`: que deje de salir verde cuando los secrets ya se esperan.** Hoy trata "faltan secrets" siempre como un warning. Propuesta a validar con Franco: una variable de repositorio (por ejemplo `vars.DEPLOY_ENABLED`). Con `DEPLOY_ENABLED = 'true'` y algún secret ausente, el paso falla con `exit 1`. Con la variable ausente o en otro valor, el deploy se omite con un `::notice` explícito en el resumen del job, no con un `::warning` que pase inadvertido. El objetivo es que un deploy esperado que no ocurre nunca deje el workflow en verde.
6. Documentar en `docs/CI.md` cómo se activa el deploy y qué se espera de cada secret.

## Archivos permitidos

`apps/functions/**`, `packages/motor/tsconfig.json` (si se evalúa el punto 1), `firebase.json`, `.github/workflows/deploy.yml`, `docs/CI.md`. Los cambios en lo compartido (`tsconfig.json` raíz, `.github`, `package.json` raíz) son un `CR` según `AGENTS.md` §3.

## Archivos prohibidos

Todo lo que no figure arriba. En particular `packages/shared`, que ya quedó listo en MVP-04.

## Criterio de aceptación

1. Con los secrets configurados, el push a `main` despliega `functions` en `proyecto-qx-dev` y una función de ejemplo que importa algo de `@sistema-redespachos/shared` responde correctamente.
2. `pnpm build` genera la salida de `functions` y el `main` apunta a un archivo que existe.
3. El deploy no depende de que `npm` resuelva `workspace:*`.
4. Con `DEPLOY_ENABLED = 'true'` y un secret ausente, el workflow termina en rojo. Con la variable apagada, el workflow explica en el resumen por qué omite el deploy.
5. `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` pasan y el CI de la PR queda verde.

## Plan
<lo completa el agente antes de codear; Franco da el OK>

## PREGUNTAS
- ¿Bundler o `pnpm deploy`/tarball para empaquetar `shared`? Supuesto: la opción que menos dependencias nuevas agregue.
- ¿Se evalúa también `noEmit: false` en `packages/motor`? Supuesto: sí, porque `motor` tampoco emite hoy.

---

## Nota de entrega (la completa el agente al terminar)
- **Qué se hizo:**
- **Archivos tocados:**
- **Cómo probarlo:**
- **Resultado de la verificación:**
- **Evidencia del criterio de aceptación:**
- **Decisiones tomadas:**
- **Riesgos y deuda:**
