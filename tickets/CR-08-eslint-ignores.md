# CR: eslint — ignorar salidas de build anidadas

- **Carril:** Compartido (`CR`). Toca `eslint.config.js`.
- **Origen:** MVP-31.

## Problema

`eslint.config.js` ignora `lib/**` y `dist/**` solo en la raíz, pero `pnpm lint` recorre `apps/functions` y `packages`. Después de un build local lintea `apps/functions/lib`, `apps/functions/dist` y `packages/*/dist`. En CI no se nota (lint corre antes de build), pero un `pnpm ci:run` repetido en local puede dar rojo por código generado.

## Cambio

Agregar `'apps/functions/lib/**'` y `'**/dist/**'` a `ignores`. No usar `'**/lib/**'`: ignoraría `apps/functions/src/lib/`, que es código fuente.

## Criterio de aceptación

Con todo construido (`pnpm build`), `pnpm lint` sigue en verde y sigue linteando `apps/functions/src/lib`.
