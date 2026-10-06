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
Aprobado por Franco (06/10). Versiones: `react-router-dom ^7.18.4`, `@tanstack/react-query ^5.104.1`, `@tanstack/react-table ^8` (la v9 es major nueva), `@tanstack/react-virtual ^3.14.13`, `react-hook-form ^7.89.0`, `@hookform/resolvers ^5.9.1`, `zod ^3.22.0` (mismo rango que `shared`), `tailwindcss ^3.4.19` (+ `postcss`, `autoprefixer`), `class-variance-authority`, `clsx`, `tailwind-merge ^2` (la 3.x es para Tailwind 4), `lucide-react`, testing-library (`react`, `user-event`), `jsdom ^30`, `@firebase/rules-unit-testing ^3.0.4` (la 5.x exige firebase 12), `shared` como `workspace:*`. Archivos: `apps/web/package.json`, `package.json` (solo devDependencies), `pnpm-lock.yaml` (generado), este ticket.

## PREGUNTAS
1. CR-01 mergeado: confirmado por Franco.
2. `tailwindcss-animate` y `@testing-library/jest-dom`: no se agregan; si MVP-05 los necesita, pide `CR`.
3. Tailwind 3.4: confirmado por Franco.

---

## Nota de entrega
- **Qué se hizo:** se agregaron a `apps/web` las dependencias de la tabla (runtime y dev) y `@firebase/rules-unit-testing` en la raíz (dev). `apps/functions/package.json` no cambió. Lockfile generado con `pnpm add`.
- **Commit:** ver `git log` de la rama `cr-03-deps-carril-b`; sin push ni PR.
- **Archivos tocados:** `apps/web/package.json`, `package.json`, `pnpm-lock.yaml`, este ticket.
- **Cómo probarlo:** `pnpm install --frozen-lockfile && pnpm format && pnpm ci:run && pnpm why zod -r`.
- **Resultado de la verificación (desde estado limpio, sin `dist/`):** `pnpm install --frozen-lockfile` OK ("Lockfile is up to date"); `pnpm format` sin cambios fuera de lo tocado; `pnpm ci:run` completo: Build shared, lint (`--max-warnings 0`), format check ("All matched files use Prettier code style!"), typecheck (motor, web, functions: Done), test (22 archivos, 490 tests pasados) y build (shared, functions, motor, web: Done).
- **Consumo real:** no aplica (solo dependencias; `shared` queda declarado en web, aún sin importarse).
- **Evidencia del criterio de aceptación:** (1) install congelado OK; (2) `pnpm why zod -r` muestra solo `zod 3.25.76` y el lockfile tiene una única entrada `zod@3.25.76`; (3) sin paquetes fuera de la tabla salvo los que esta pide (`postcss`, `autoprefixer`), y sin majors nuevas de lo instalado; (4) `ci:run` en verde.
- **Decisiones tomadas:** `react-table` v8 y `tailwind-merge` v2 (par de Tailwind 3); `rules-unit-testing` v3 por `firebase 10`; `shared` como `workspace:*` (pnpm puso `workspace:^`, se corrigió a mano a lo que pide el ticket y se re-resolvió el lockfile con `pnpm install`).
- **Supuestos:** `@testing-library/dom` llega como peer vía `auto-install-peers`.
- **Fuera de alcance:** configurar Tailwind/shadcn/router/jsdom en Vitest: MVP-05. `tailwindcss-animate` y `jest-dom`: `CR` si MVP-05 los pide.
- **Riesgos y deuda:** `pnpm` avisa de un peer opcional sin cumplir (`ajv-formats` de `@hookform/resolvers`, solo para el validador ajv, no usado). `jsdom ^30` con Vitest 2 no se probó en ejecución (aún no hay tests con jsdom); si falla en MVP-05, bajar de versión. Los avisos "LF → CRLF" de git los resuelve CR-05.
