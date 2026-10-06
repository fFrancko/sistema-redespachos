# CR-04 — `CR: deps` del circuito de proformas y reportes

- **Carril:** Compartido (`CR: deps`). Lo aprueba Franco.
- **Agente:** Claude Code · **Modelo:** Sonnet 5.5 · **Esfuerzo:** low
- **Auditor:** Gemini · auditoría liviana
- **Rama:** `cr-04-deps-circuito`
- **Depende de:** MVP-09 mergeado.

## Contexto a leer
- `docs/arquitectura-v3.md`: §1 (filas Email, Plantillas de email, Excel).
- `apps/functions/package.json`, `apps/web/package.json`.

## Alcance
| Paquete | Dónde | Para |
| --- | --- | --- |
| `googleapis` (o `@googleapis/gmail` si alcanza) y `google-auth-library` | `apps/functions` | Gmail API con delegación de dominio (MVP-22) |
| `handlebars` | `apps/functions` y `apps/web` | Plantillas y vista previa (MVP-23) |
| `exceljs` | `apps/functions` | Adjuntos y reportes (MVP-24, 26, 27) |

Verificar que las dependencias entren en el empaquetado de deploy que eligió MVP-31.

## Archivos permitidos
`apps/functions/package.json`, `apps/web/package.json` (solo dependencias), `pnpm-lock.yaml` generado por `pnpm add`, este ticket.

## Criterio de aceptación
1. `pnpm install --frozen-lockfile` pasa en un clon limpio.
2. El build de deploy de MVP-31 incluye las tres dependencias y `lib/index.js` carga con Node puro.
3. Secuencia de `AGENTS.md` §5.5 en verde, con la salida pegada.

## Plan
<versiones exactas y por qué; Franco da el OK>

---

## Nota de entrega
Usar la plantilla de `tickets/_TEMPLATE.md`.
