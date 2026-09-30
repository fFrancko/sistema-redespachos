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

Node 20 o superior.

```bash
pnpm install
```

## Scripts

```bash
# Desarrollo
pnpm dev              # Lanza la web en http://localhost:5173

# Verificación
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

Ver [`docs/arquitectura-v3.md`](docs/arquitectura-v3.md) para el diseño completo, modelos de datos y decisiones cerradas.
