# CR-03 — `CR: deps` base del Carril B

- **Carril:** Compartido (`CR: deps`). Lo aprueba Franco.
- **Agente:** Claude Code · **Modelo:** Sonnet 5.5 · **Esfuerzo:** low
- **Auditor:** Gemini · auditoría liviana (alcance, lockfile, verificación)
- **Rama:** `cr-03-deps-carril-b`
- **Depende de:** `CR-01` mergeado.

## Contexto a leer
- `AGENTS.md` §3 y regla 3.
- `docs/arquitectura-v3.md`: §1 (tabla de stack).
- `apps/web/package.json`, `apps/functions/package.json`, `package.json` raíz.

## Alcance
Agregar solo las dependencias que necesitan MVP-05 a MVP-09, en versiones compatibles con lo instalado (React 18, Vite 5, Vitest 2, Node 22, `firebase` 10, `firebase-functions` 5, Zod 3). Ninguna major de lo ya instalado.

| Paquete | Dónde | Para |
| --- | --- | --- |
| `react-router-dom` | `apps/web` | Shell y rutas (MVP-05) |
| `@tanstack/react-query` | `apps/web` | Lecturas y llamadas a callables |
| `@tanstack/react-table`, `@tanstack/react-virtual` | `apps/web` | Tablas de usuarios, proveedores, auditoría |
| `react-hook-form`, `@hookform/resolvers`, `zod` (misma versión que `shared`) | `apps/web` | Formularios con esquemas de `shared` |
| `tailwindcss` y lo que pida la versión elegida, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` | `apps/web` | shadcn/ui con el tema #323e48 / #f5333f |
| `@testing-library/react`, `@testing-library/user-event`, `jsdom` | `apps/web` (dev) | Tests de componentes |
| `@firebase/rules-unit-testing` | raíz (dev) | Tests de reglas en emulador (MVP-07) |
| `@sistema-redespachos/shared` (`workspace:*`) | `apps/web` | Esquemas y roles |

## Archivos permitidos
`apps/web/package.json`, `apps/functions/package.json`, `package.json` raíz (solo dependencias), `pnpm-lock.yaml` **generado por `pnpm add`**, este ticket.

## Archivos prohibidos
Todo lo demás. No se configura Tailwind, shadcn ni el router: eso es MVP-05.

## Criterio de aceptación
1. `pnpm install --frozen-lockfile` pasa en un clon limpio.
2. Una sola versión de `zod` en el lockfile (`pnpm why zod`), igual a la de `shared`.
3. Ninguna dependencia fuera de la tabla; ninguna major nueva de lo ya instalado.
4. Secuencia de `AGENTS.md` §5.5 en verde, con la salida pegada.

## Plan
<el agente propone versiones exactas y por qué; Franco da el OK>

## PREGUNTAS
<dudas del agente>

---

## Nota de entrega
Usar la plantilla de `tickets/_TEMPLATE.md`.
