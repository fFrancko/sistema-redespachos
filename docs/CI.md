
# CI/CD (Integración y Despliegue Continuo)

## Flujo de Pull Request (CI)

El workflow `.github/workflows/ci.yml` se dispara con cada Pull Request abierto hacia la rama `main`.

### Pasos del Job `validate`:

1.  **Checkout & Setup:** Configura el entorno con Node.js 22.x y pnpm 9.x.
2.  **Verificación Estática:** Ejecuta `pnpm lint`, `pnpm typecheck` y `pnpm build`.
3.  **Tests con Emuladores:** Lanza los emuladores de Firebase necesarios y ejecuta `pnpm test --coverage`.
4.  **Comentario de Coverage:** Publica un comentario en la PR con el resumen de la cobertura de tests.
5.  **Deploy a Preview Channel:** Despliega la aplicación web a un canal de preview temporal en Firebase Hosting.
6.  **Comentario de Preview:** Publica un comentario en la PR con la URL del preview.

### Emuladores en CI

**Política de Emuladores Explícitos:** Para garantizar que la CI sea robusta y rápida, todo job que utilice emuladores debe declararlos explícitamente con la flag `--only`.

```yaml
- name: Run Tests with Coverage
  run: |
    pnpm exec firebase emulators:exec --only auth,firestore --project demo-qx-ci "pnpm test --coverage"
```

- **`--only auth,firestore`**: Esta lista solo debe contener los emuladores que los tests del comando necesitan. A medida que se agreguen tests que usen Cloud Functions o Storage, se deberán añadir `functions` o `storage` a esta lista.
- **`--project demo-qx-ci`**: Se utiliza un ID de proyecto ficticio que empieza con `demo-` para evitar que la CLI de Firebase intente acceder a recursos de producción.

## Flujo de Merge a `main` (CD)

El workflow `.github/workflows/deploy.yml` se dispara con cada merge a la rama `main`.

### Pasos del Job `deploy`:

1.  **Checkout, Setup & Build:** Realiza los mismos pasos de configuración y construcción que el job de CI.
2.  **Autenticación con Google Cloud:** Se autentica con Google Cloud usando Workload Identity Federation.
3.  **Deploy a `dev`:** Despliega `hosting`, `firestore` (reglas) y `functions` al proyecto de desarrollo (`proyecto-qx-dev`).

## Umbrales de Cobertura

La configuración de Vitest en `vitest.config.ts` define los siguientes umbrales de cobertura:

- **Global:** 80% en `lines`, `functions`, `branches` y `statements`.
- **`packages/motor`:** 90% en las mismas métricas.

Un PR que no cumpla con estos umbrales fallará en el paso de tests.
