# Auditoría de CR-01-infraestructura

## Checklist

1. **Verificación:** Corrí `pnpm install --frozen-lockfile` y `pnpm ci:run` localmente en `main`. El workflow falló en `format:check` debido a dos archivos de `motor` (`candidatas.test.ts` y `candidatas.ts`). Dado que CR-01 ya está mergeado y hubo commits posteriores (como MVP-13), esto demuestra que el paso `format:check` **corre de verdad** y rompe el build ante faltas de formato.
2. **Criterio de aceptación:** Se cumplió lo pedido, excepto que `.gitignore` quedó incompleto respecto a la protección de datos reales (falta ignorar CSV).
3. **Conformidad con la arquitectura:** Aprobado.
4. **Dinero:** N/A.
5. **Alcance:** Aprobado.
6. **Contratos:** Aprobado.
7. **Seguridad y datos:** `firestore.rules` contiene un deny-all real (`allow read, write: if false;`). Riesgo de datos en `.gitignore` (ver hallazgo).
8. **Casos borde:** N/A.
9. **Tests:** N/A.
10. **Consumo real:** N/A.
11. **CI:** `.github/workflows/ci.yml` incluye todos los pasos en el orden de `ci:run`. `dependabot.yml` ignora correctamente `version-update:semver-major` en ambos ecosistemas. `docs/CI.md` coincide y `.prettierignore` protege el bloque TEMPORAL usando rutas explícitas sin afectar `apps/functions/src/lib`.

## Formato de hallazgos

| #   | Severidad      | Dónde        | Qué pasa                                                                                                      | Evidencia                                                                                                                                        | Sugerencia                                                                 |
| --- | -------------- | ------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| 1   | **Bloqueante** | `.gitignore` | El archivo no ignora los `*.csv`, abriendo la puerta a que se versionen los CSV reales del TMS por accidente. | `*.csv` no está en `.gitignore`. La regla 8 de `AGENTS.md` prohíbe explícitamente: "no se suben al repo ni los Excel/CSV reales de transportes". | Al estar ya mergeado, crear un *_CR: infra - agregar *.csv a .gitignore*_. |

## Veredicto

**RECHAZADO** (debido al hallazgo Bloqueante en `.gitignore`).

## Decisiones para Franco

- **CR Propuesto:** Crear un CR para agregar `*.csv` y/u otras extensiones relevantes (`*.jsonl`) al `.gitignore` a fin de cumplir la regla 8.
