# CR-06 — Reformateo de los archivos TEMPORAL de Prettier

- **Carril:** Compartido (`CR`). Lo hace el Carril A en su espera del paso 6 de `tickets/_FLUJO.md`.
- **Agente:** Gemini (Antigravity) · **Modelo:** Gemini Pro · **Esfuerzo:** bajo
- **Auditor:** Claude Code · **Modelo:** Sonnet 5.5 · **Esfuerzo:** medium · auditoría liviana + repetir la comparación del punto 3 sobre 5 archivos elegidos por el auditor, incluido `docs/arquitectura-v3.md`
- **Rama:** `cr-06-reformateo`
- **Depende de:** CR-05 mergeado y las copias locales refrescadas (punto 6 de CR-05).
- **Origen:** `tickets/CR-01-infraestructura.md`, nota de entrega: "Archivos que quedaron ignorados por Prettier" y "Fuera de alcance".

## Contexto a leer

- `AGENTS.md` completo.
- `tickets/CR-01-infraestructura.md`: nota de entrega.
- `.prettierrc`, `.prettierignore` y `docs/CI.md` (paso 4).
- No hace falta leer `docs/arquitectura-v3.md`. Solo se reformatea.

## Problema

CR-01 dejó 47 archivos fuera de `Format check`: 43 `.md`, `apps/web/index.html`, `apps/web/src/index.css`, `apps/web/src/main.tsx` y `eslint.config.js`. Están listados uno por uno en `.prettierignore`, bajo `# TEMPORAL – se elimina en CR de reformateo`. Mientras ese bloque exista, esos archivos se pueden desordenar sin que CI lo detecte.

## Alcance

1. **`.prettierignore`:** borrar el bloque TEMPORAL completo, con su comentario y todas sus rutas. Queda solo la sección "Generado / no versionado".
2. **Reformatear:** `pnpm format`. Solo cambios de formato. No se corrige redacción, no se arreglan links y no se actualiza contenido, aunque esté desactualizado (si encontrás algo, va a PREGUNTAS).
3. **Probar que no cambió el contenido:**
   - **Código** (`index.html`, `index.css`, `main.tsx`, `eslint.config.js`): lint, typecheck, test y build en verde.
   - **Markdown:** por cada `.md` modificado, renderizá a HTML la versión de `origin/main` y la nueva (por ejemplo con `pnpm dlx markdown-it`) y compará ignorando espacios en blanco. Las dos versiones tienen que coincidir. Si alguna no coincide, listá el archivo y la diferencia, y justificala o revertí ese cambio. El script de comparación vive fuera del repo y no se commitea. En la nota pegás el comando y el resultado (archivos comparados, archivos iguales, diferencias).
4. **`docs/CI.md`:** en el paso 4, sacar la frase sobre el bloque TEMPORAL. Dejar la indicación de que todo archivo nuevo pasa por `pnpm format`.

## Conflictos con el ticket en curso del Carril B

Este CR toca muchos tickets `.md` y el Carril B va a estar trabajando en el suyo al mismo tiempo (paso 6 del flujo).

- **Antes de arrancar:** preguntale a Franco qué ticket está en curso en B. **No reformatees su `.md`**: dejá esa ruta sola en `.prettierignore`, con el comentario `# TEMPORAL – lo formatea <ticket> al entregar`, y anotalo en la nota.
- **El agente de B**, al entregar, corre `pnpm format` sobre su ticket y saca esa línea de `.prettierignore`. Si su rama se mergea después de este CR, primero hace rebase (regla 5 del flujo).

## Archivos permitidos

Los archivos del bloque TEMPORAL (solo cambios de formato), `.prettierignore`, `docs/CI.md` (paso 4), este ticket.

## Archivos prohibidos

Todo lo demás. Un archivo que no estaba en el bloque TEMPORAL ya pasa `Format check`, así que no debería cambiar. Si `pnpm format` lo toca, es un hallazgo: frená y avisá.

## Criterio de aceptación

1. `.prettierignore` sin bloque TEMPORAL (salvo la excepción del ticket en curso de B) y `pnpm format:check` en verde.
2. `git diff --stat origin/main...HEAD`: solo archivos permitidos.
3. Comparación del punto 3: todos los `.md` modificados renderizan igual, o cada diferencia está listada y justificada.
4. Secuencia de `AGENTS.md` §5.5 en verde, con la salida pegada.

## Plan

<lo completa el agente antes de codear, con la lista de archivos a tocar; Franco da el OK>

## PREGUNTAS

<dudas del agente>

---

## Nota de entrega (la completa el agente al terminar)

Usar la plantilla de `tickets/_TEMPLATE.md`.
