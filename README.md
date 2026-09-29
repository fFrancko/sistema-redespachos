# sistema-redespachos

Aplicativo web para identificar, gestionar, valorizar y liquidar pedidos con
redespacho (expresos). Este repositorio es un monorepo (`apps/`, `packages/`).

## Requisitos

Node 20 o superior.

```bash
npm install
```

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run transformar-tarifas -- <opciones>` | Cruza Cobertura + Tarifario de un expreso y genera la tabla maestra `reglas_tarifa` (ver `--help`). |
| `npm run fixtures` | Regenera los Excel sintéticos de `test/fixtures/`. |
| `npm test` | Tests unitarios y de punta a punta del transformador. |
| `npm run typecheck` | Chequeo de tipos de todo el repo. |

## Convención de rangos de tarifa

Los rangos de peso y volumen son intervalos `(min, max]`: `min` exclusivo y
`max` inclusivo (`(0;10]`, `(10;25]`). Un valor exacto pertenece a un único
rango. Las filas de excedente (`> 50`) llevan `min = max = límite` y aplican a
todo lo que supere ese límite. Detalle en `packages/shared/src/tarifas.ts`.

## Datos de transportes reales

Los Excel reales de los expresos **no se suben al repositorio** (`*.xlsx` está
en el `.gitignore`). Solo se versionan los fixtures sintéticos de
`test/fixtures/input/` y `test/fixtures/bad/`. Más en
[`test/fixtures/README.md`](test/fixtures/README.md).
