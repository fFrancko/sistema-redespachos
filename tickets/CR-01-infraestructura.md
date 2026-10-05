# CR-01 — Infraestructura antes de abrir los carriles

- **Carril:** Compartido (`CR` aprobado por Franco el 5/10/2026).
- **Agente:** por definir (Franco asigna).
- **Rama:** `cr-01-infraestructura`
- **Depende de:** merge a `main` del cierre de la Ola 0 (`ola-0-cierre`).
- **Origen:** `docs/ola-0/informe-validacion.md`, hallazgos H-04, H-07, H-08, H-11 y H-14.

## Contexto a leer
- `AGENTS.md` completo.
- `docs/ola-0/informe-validacion.md`: H-04, H-07, H-08, H-11, H-14 y la sección "Respuestas a las preguntas abiertas" (P-02, P-12).
- `docs/CI.md`.
- No hace falta leer `docs/arquitectura-v3.md`.

## Alcance
1. **`ci:run` igual a CI (H-07).** En `package.json` raíz, `ci:run` = `pnpm --filter @sistema-redespachos/shared build && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
2. **Prettier (H-11).** Crear `.prettierrc` con el estilo que ya tiene el código (comillas simples, y lo que haga falta para que `prettier --check` no marque cambios en `packages/shared`). Agregar el script `format:check` (`prettier --check .`) y un `.prettierignore` (lockfile, `dist`, `coverage`, `lib`, `docs/**/*.md` y `tickets/**/*.md` si Prettier los reformatea). No reformatear código existente: si con la mejor configuración posible siguen quedando diferencias, listalas en PREGUNTAS y frená.
3. **Paso de formato en CI.** En `.github/workflows/ci.yml`, un paso `Format check` (`pnpm format:check`) después de `Lint`.
4. **Dependabot (H-08, P-12).** En `.github/dependabot.yml`, para `npm` y para `github-actions`: ignorar `version-update:semver-major` en todas las dependencias (`dependency-name: "*"`). Las majors entran a mano como `CR: deps`.
5. **Reglas *deny-all* (H-04, P-02).** `firestore.rules` con `allow read, write: if false;` sobre todo, y un comentario que diga que las reglas reales llegan con MVP-07. Verificar que los tests sigan pasando con los emuladores (hoy ningún test usa Firestore).
6. **`.gitignore` (H-14).** Quitar las reglas heredadas de la herramienta B0 (`/input/`, `output/`, `/tabla_maestra.json`, `test/fixtures/out/`, `test/fixtures/perfilar-out.txt` y las excepciones `!test/fixtures/input/*.xlsx` y `!test/fixtures/bad/*.xlsx`), conservando las de Excel reales (`*.xlsx`, `*.xls`, `*.xlsm`). Agregar `.claude/settings.local.json`.

## Archivos permitidos
`package.json` (solo scripts), `.prettierrc`, `.prettierignore`, `.github/workflows/ci.yml`, `.github/dependabot.yml`, `firestore.rules`, `.gitignore`, `docs/CI.md` (actualizar pasos y Dependabot), este ticket.

## Archivos prohibidos
Todo lo que no figure arriba; en particular `packages/**`, `apps/**`, `pnpm-lock.yaml` (Prettier ya está instalado) y `deploy.yml` (es de MVP-31).

## Criterio de aceptación
1. En un clon limpio, `pnpm ci:run` pasa sin haber construido `shared` antes a mano.
2. `pnpm format:check` pasa sin reformatear archivos existentes, y el paso `Format check` corre en CI.
3. `dependabot.yml` ignora las majors en los dos ecosistemas.
4. `firestore.rules` niega todo; la verificación con emuladores pasa.
5. `git status` limpio tras `pnpm install && pnpm ci:run && pnpm test:coverage` (nada nuevo sin ignorar).
6. Secuencia de `AGENTS.md` §5.5 en verde, con la salida pegada.

## Plan
<lo completa el agente antes de codear, con la lista de archivos a tocar; Franco da el OK>

## PREGUNTAS
<dudas del agente>

---

## Nota de entrega (la completa el agente al terminar)
Usar la plantilla de `tickets/_TEMPLATE.md`.
