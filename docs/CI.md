# CI/CD Pipeline

## Overview

El sistema de Redespachos usa GitHub Actions para ejecutar verificaciones automáticas en cada PR y despliegue continuo a dev en cada merge a `main`.

## Flujo de CI en Pull Request

### Checks automáticos (obligatorios para merge)

Cuando abres una PR, se ejecutan estos checks **en paralelo** (con dependencias):

1. **Lint + Typecheck** (`lint-typecheck` job)
   - `pnpm lint` — validación de código con ESLint (0 warnings)
   - `pnpm typecheck` — verificación de tipos en todos los workspaces

2. **Tests + Coverage** (`test` job)
   - Inicia el Firebase Emulator Suite
   - `pnpm test --coverage` — corre tests de todos los workspaces (packages/motor, apps/web, etc.) con coverage
   - Comentario automático en el PR con resultado y resumen de coverage
   - **CI=true** detiene en el primer error de test

3. **Build** (`build` job)
   - Depende de lint + test
   - `pnpm build` — compila todas las apps y packages

4. **Preview Hosting** (`preview-hosting` job)
   - Depende de build (solo en PR)
   - Despliega un **preview channel** de Firebase Hosting en `proyecto-qx-dev`
   - Comenta en el PR con la URL `https://proyecto-qx-dev--preview-NNN.web.app` (donde NNN es el número del PR)
   - Perfecto para testing manual antes de merge

### Cómo leer los logs

- Abre el PR y busca la sección **"Checks"** (verde = pass, rojo = fail)
- Haz click en un check fallido para ver los logs detallados
- Para errores de test: busca la línea de error en los logs, o descarga el artifact de coverage

### Resultado en el PR

Verás dos comentarios:
1. **Checks de GitHub**: uno por cada job (lint, test, build, preview)
2. **Coverage comment**: resumen de líneas, branches y funciones cubiertas

## Flujo de Despliegue en Main

Cuando haces merge a `main`, se ejecuta automáticamente:

1. **Lint + Typecheck** — mismo que en PR
2. **Tests con emuladores** — mismo que en PR
3. **Build** — mismo que en PR
4. **Firebase Deploy**
   - Despliega Hosting, Functions y Firestore rules a `proyecto-qx-dev`
   - Actualiza el canal live
   - **Solo a dev**: no toca prod

## Umbrales de Coverage

- **Global**: 80% mínimo (líneas, branches, funciones)
- **packages/motor**: 90% mínimo (porque es el motor de cálculos críticos)

Si el coverage baja de estos umbrales, el PR no pasa. Agrega tests para mantener la cobertura.

## Node.js Version

**Todos los workflows usan Node 22.x** — coincide con Cloud Functions 2ª gen y la versión recomendada.

## Secretos de GitHub requeridos

Para que CI funcione necesitas:
- `FIREBASE_SERVICE_ACCOUNT_PROYECTO_QX_DEV`: cuenta de servicio JSON de Firebase (dev)
  - Se usa para authenticate en `firebase deploy` y preview channels
  - **NUNCA lo commits al repo**

## Cómo leer coverage

Después de que pase el test job, hay un artifact `coverage/` (HTML report). Los checks también muestran un resumen en el comentario del PR.

Para ver el reporte local después de correr `pnpm test --coverage`:
```
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

## Reglas de merge

✅ **Required**: 
- Lint en verde (0 warnings)
- Typecheck en verde (sin errores TS)
- Tests en verde (100% pass rate)
- Coverage >= umbrales (80% global, 90% motor)
- Preview Hosting accesible

❌ **Bloqueadores**:
- Cualquier check rojo
- Coverage por debajo de umbrales
- Test timeout o crash

## Deploy a Prod (futuro)

Prod se despliega por tag (e.g., `v1.0.0`) con un workflow separado. No se implementa en MVP-03.

## Troubleshooting

### "Coverage is below threshold"
- Agrega tests para alcanzar 80% (o 90% en motor)
- Revisa `coverage/index.html` para ver qué líneas no están cubiertas

### "Firebase Emulator failed to start"
- Verifica que `firebase-tools` esté instalado: `pnpm add -D firebase-tools`
- Revisa que `firebase.json` esté configurado correctamente

### "Preview Hosting didn't deploy"
- Verifica `FIREBASE_SERVICE_ACCOUNT_PROYECTO_QX_DEV` en GitHub Secrets
- Revisa que `firebase.json` tenga el bloque `hosting`

### Tests timeout
- Si un test tarda más de 30s, optimizalo o marca como `.skip`
- Revisa logs en el job de test
