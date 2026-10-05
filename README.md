# Sistema de Redespachos

Aplicativo web interna de QX para cotizar, valorizar, confirmar con el proveedor y liquidar pedidos de redespacho, cruzando el canalizador de CPs con los tarifarios de costos de los expresos.

## Stack

- **Lenguaje:** TypeScript (de punta a punta)
- **Monorepo:** pnpm workspaces
- **Frontend:** React + Vite
- **Backend:** Firebase Cloud Functions 2ª gen
- **Base de datos:** Firestore (nativo)
- **Tests:** Vitest
- **Autenticación:** Firebase Auth con Google Workspace

## Estructura

```
├── apps/
│   ├── web/              # SPA React + Vite
│   └── functions/        # Firebase Cloud Functions
├── packages/
│   ├── shared/           # Tipos y esquemas Zod (fuente única)
│   └── motor/            # Lógica de cotización (puro, sin I/O)
└── docs/                 # Arquitectura y documentación
```

## Requisitos

Node 22 (igual que el runtime de Cloud Functions y que CI) y pnpm 9.

```bash
pnpm install
```

## Scripts

```bash
# Desarrollo
pnpm dev              # Lanza la web en http://localhost:5173
pnpm dev:emulator     # Inicia Firebase Emulator Suite (Firestore, Auth, Functions)

# Verificación (secuencia de CI: construir shared primero)
pnpm --filter @sistema-redespachos/shared build
pnpm typecheck        # TypeScript sin emitir
pnpm test             # Vitest en todos los workspaces
pnpm lint             # ESLint
pnpm format           # Prettier

# Build
pnpm build            # Compila todos los packages/apps
```

## Convenciones

- **Campos de dominio:** español `snake_case` (`peso_kgs`, `id_proveedor`)
- **Funciones/módulos:** inglés `camelCase`
- **Dinero:** decimal en string (tarifas, hasta 4 decimales) o centavos enteros (resultados)
- **Cálculos:** `decimal.js` (nunca `number` flotante para montos)
- **Tipos:** un solo esquema Zod en `packages/shared`, usado por web, functions y motor

## Carriles

- **Carril A (Cotización):** motor, functions de tarifas y órdenes, UI de cotización
- **Carril B (Plataforma):** auth, usuarios, proveedores, proformas, liquidación, OC

## Documentación

- [`docs/arquitectura-v3.md`](docs/arquitectura-v3.md): diseño completo, modelos de datos y decisiones cerradas (D1 a D37).
- [`docs/ola-0/estado-y-decisiones.md`](docs/ola-0/estado-y-decisiones.md): estado real del repo al cierre de la Ola 0, decisiones técnicas y supuestos vigentes.
- [`docs/ola-0/informe-validacion.md`](docs/ola-0/informe-validacion.md): validación de la Ola 0, hallazgos y preguntas abiertas.
- [`AGENTS.md`](AGENTS.md), [`docs/mapa-de-contexto.md`](docs/mapa-de-contexto.md) y [`docs/auditoria-cruzada.md`](docs/auditoria-cruzada.md): reglas y flujo de trabajo de los agentes.
- [`docs/CI.md`](docs/CI.md) y [`docs/FIREBASE.md`](docs/FIREBASE.md): CI/CD, emuladores y deploy.
