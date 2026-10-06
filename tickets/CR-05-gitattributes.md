# CR-05 — `.gitattributes` con LF y `.gitignore` con CSV reales

- **Carril:** Compartido (`CR`). Lo hace el Carril A en su espera del paso 5 de `tickets/_FLUJO.md`.
- **Agente:** Gemini (Antigravity) · **Modelo:** Gemini Pro · **Esfuerzo:** bajo
- **Auditor:** Claude Code · **Modelo:** Sonnet 5.5 · **Esfuerzo:** medium · auditoría liviana + correr `git ls-files --eol` en un clon nuevo
- **Rama:** `cr-05-gitattributes`
- **Depende de:** CR-01 mergeado (hecho). Va **antes** de CR-06.
- **Origen:** `tickets/CR-01-infraestructura.md`, nota de entrega: decisión 5 y "Fuera de alcance"; y la auditoría post-merge de CR-01 (Gemini): el `.gitignore` no protege los CSV reales del TMS.

## Contexto a leer

- `AGENTS.md` completo.
- `tickets/CR-01-infraestructura.md`: nota de entrega.
- `docs/CI.md`: paso 4 (Format check).
- `.prettierrc` y `.prettierignore`.
- No hace falta leer `docs/arquitectura-v3.md`.

## Problema

En la máquina de Franco (Windows, `core.autocrlf=true`) el working tree está en CRLF y en CI está en LF. CR-01 lo resolvió con `endOfLine: "auto"` en `.prettierrc`, que acepta los dos pero no detecta un archivo con finales de línea mezclados. Además, cada máquina o agente nuevo depende de su configuración local de git.

## Problema 2: los CSV reales no están protegidos

La regla 8 de `AGENTS.md` prohíbe subir pedidos reales del TMS (destinatarios y direcciones, Ley 25.326). Esos datos vienen en CSV (`pedidos_tms.csv`), pero el `.gitignore` solo protege Excel (`*.xlsx`, `*.xls`, `*.xlsm`). Hoy lo único que impide subir un CSV real es que nadie haga un `git add` descuidado. Existe un fixture sintético versionado, `packages/shared/test/fixtures/pedidos_tms_sintetico.csv`, que tiene que seguir permitido.

## Alcance

1. **`.gitattributes` nuevo en la raíz** con `* text=auto eol=lf`. Antes de escribirlo, revisá `git ls-files --eol`: si hay binarios versionados que git no detecta como binarios, declaralos con `binary`. No agregues reglas para tipos de archivo que no existan en el repo.
2. **`.prettierrc`:** `endOfLine` pasa de `"auto"` a `"lf"`. Nada más cambia.
3. **Renormalización:** `git add --renormalize .`. Como `core.autocrlf=true` ya guarda LF en el índice, lo esperable es que no cambie ningún archivo. Si cambia alguno, listalo en la nota y mostrá que el contenido es el mismo: `git diff --cached --ignore-cr-at-eol` debe salir vacío para esos archivos.
4. **`docs/CI.md`:** en el paso 4, `endOfLine: lf` en lugar de `auto`. Agregá una sección corta, "Finales de línea", que explique `.gitattributes` y el paso de refresco del punto 6.
5. **`.gitignore`: CSV reales.** Debajo de la regla de los Excel, agregar:

   ```gitignore
   # CSV de pedidos y tarifas REALES (destinatarios, direcciones, tarifas):
   # nunca van al repositorio. Los fixtures sintéticos terminan en _sintetico.csv.
   *.csv
   !**/test/fixtures/**/*_sintetico.csv
   ```

   Antes de escribirla, corré `git ls-files '*.csv'` y listá en la nota todo lo que devuelve. Cada CSV versionado que no termine en `_sintetico.csv` es un hallazgo: **frená y avisá a Franco**, no lo borres ni lo renombres. Los archivos ya versionados no se ven afectados por el ignore, pero un fixture nuevo que no termine en `_sintetico.csv` va a necesitar `git add -f`, y eso es lo que se busca. Esta regla no cubre `.json` ni `.jsonl` con datos reales: si el agente ve un riesgo parecido, lo anota en PREGUNTAS.

6. **Refresco de las copias locales (lo hace Franco después del merge, va en la nota):** en cada copia local del repo, **solo con `git status` vacío**:

   ```powershell
   git pull
   git rm -r --cached -q .
   git reset --hard
   ```

   Esto vuelve a escribir los archivos versionados en LF. Con cambios sin commitear, `git reset --hard` los borra. Por eso solo se corre con `git status` vacío. Los archivos no versionados (`node_modules`, `.env.local`) no se tocan.

## Archivos permitidos

`.gitattributes` (nuevo), `.prettierrc` (solo `endOfLine`), `.gitignore` (solo el bloque del punto 5), `docs/CI.md`, este ticket. Cualquier archivo cuyo único cambio sea la renormalización del punto 3, listado en la nota.

## Archivos prohibidos

Todo lo demás. En particular, **no reformatees nada ni toques `.prettierignore`**: eso es CR-06.

## Criterio de aceptación

1. `git ls-files --eol` en la rama: ninguna entrada con `i/crlf` ni `i/mixed`.
2. En un clon nuevo en Windows, con `core.autocrlf=true`, los archivos de texto quedan en LF: `git ls-files --eol` muestra `w/lf`.
3. En ese clon, `pnpm format:check` pasa con `endOfLine: "lf"`, sin reformatear ningún archivo y sin tocar la lista TEMPORAL de `.prettierignore`.
4. `git check-ignore -v` confirma que `pedidos_tms.csv` y `x/y/otro.csv` quedan ignorados, y que `packages/shared/test/fixtures/pedidos_tms_sintetico.csv` no. Pegá la salida de los tres.
5. `git ls-files '*.csv'` en la rama devuelve solo archivos que terminan en `_sintetico.csv`.
6. Secuencia de `AGENTS.md` §5.5 en verde, con la salida pegada.

## Plan

<lo completa el agente antes de codear, con la lista de archivos a tocar; Franco da el OK>

## PREGUNTAS

<dudas del agente>

---

## Nota de entrega (la completa el agente al terminar)

Usar la plantilla de `tickets/_TEMPLATE.md`. Incluir, además:

- La salida de `git ls-files --eol` resumida (conteo por combinación `i/… w/…`).
- La salida de `git ls-files '*.csv'` y de los tres `git check-ignore -v` del criterio 4.
- Los comandos de refresco del punto 6, para que Franco los corra después del merge.
