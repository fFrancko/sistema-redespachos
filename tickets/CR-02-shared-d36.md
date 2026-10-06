# CR-02 — `packages/shared`: `origen_tms` completo en los pedidos con error (D36)

- **Carril:** Compartido (`CR: shared`, aprobado por Franco el 5/10/2026). Es el único cambio permitido a `packages/shared` en este ticket.
- **Agente:** Gemini (Antigravity) · **Modelo:** Gemini Pro · **Esfuerzo:** medio
- **Auditor:** Claude Code · **Modelo:** Opus 5.5 · **Esfuerzo:** high · auditoría estándar + reconstruir desde `origen_tms` una fila con error y compararla con el CSV
- **Rama:** `cr-02-shared-d36`
- **Depende de:** merge a `main` del cierre de la Ola 0. Tiene que estar mergeado **antes de MVP-17**. No bloquea MVP-13 ni MVP-14.
- **Origen:** `docs/ola-0/informe-validacion.md`, H-01; decisión P-03.

## Contexto a leer
- `AGENTS.md` completo.
- `docs/arquitectura-v3.md`: §2.4 (incluido el párrafo de `origen_tms`), D26, D32, D36 y D37.
- `docs/ola-0/informe-validacion.md`: H-01 y P-03.
- Código: `packages/shared/src/tms/orderRow.ts`, `src/tms/headers.ts`, `src/schemas/orders.ts` y sus tests.

## Problema
D36 dice que la exportación de filas con error (MVP-19) sale de `origen_tms`. Hoy `parseTmsRow` guarda en `origen_tms` solo las 28 columnas que no se mapean a un campo; las 19 mapeadas van a `datos` y, si fallan la validación, se descartan. Un pedido con `Peso Kgs: 0` pierde el `0`, y el xlsx de errores no se puede reconstruir.

## Decisión (P-03)
- **Pedido con error** (la fila tiene al menos un error): `origen_tms` guarda **todas las columnas del TMS que trae la fila**, las 47 y las 3 opcionales si vienen, con su valor crudo (recortado con `trim`, sin convertir) y con la clave `origenKey` de `headers.ts`.
- **Pedido válido:** sin cambios. `origen_tms` guarda solo las columnas que no se mapean a un campo. No se duplican datos.

## Alcance
1. `parseTmsRow`: si `errores` no está vacío, completar `datos.origen_tms` con las columnas mapeadas presentes en la fila (valor crudo). El resto del comportamiento no cambia.
2. Esquema: `invalidOrderSchema` documenta y prueba que `origen_tms` puede traer las claves de las columnas mapeadas. `orderSchema` sigue igual.
3. Tests:
   - Fila con `Peso Kgs: 0`: `origen_tms.peso_kgs === '0'` y error `PESO_INVALIDO`.
   - Fila con `Cabecera Origen` vacía: la clave está en `origen_tms` con `''`.
   - `Codigo de Expreso` presente en `origen_tms` de una fila con error.
   - Fila válida: `origen_tms` no contiene ninguna clave de columna mapeada (no hay duplicación).
   - Con el fixture sintético: cada fila con error reconstruye, desde `origen_tms`, todas sus columnas en el orden de `TMS_COLUMNS` (D37), con los mismos valores del CSV.
4. `checkTmsFile` sobre el archivo real sigue dando 538 filas y 0 errores de formato (lo corre Franco; el archivo no entra al repo).

## Archivos permitidos
`packages/shared/src/tms/orderRow.ts`, `packages/shared/src/schemas/orders.ts`, sus `*.test.ts`, `packages/shared/src/tms/orderRowRules.test.ts`, este ticket.

## Archivos prohibidos
Todo lo demás, incluidos `headers.ts` (D37: las columnas no cambian), el fixture sintético y cualquier archivo fuera de `packages/shared`.

## Criterio de aceptación
1. Los tests del punto 3 existen y pasan; fallan si se vuelve al comportamiento anterior.
2. Ningún cambio en la salida de `parseTmsRow` para filas válidas (los tests existentes pasan sin tocarlos).
3. Secuencia de `AGENTS.md` §5.5 en verde, con la salida pegada, y prueba de consumo: el `dist` de `shared` se importa con Node y `parseTmsRow` devuelve el `origen_tms` completo para una fila con error.

## Plan
<lo completa el agente antes de codear, con la lista de archivos a tocar; Franco da el OK>

## PREGUNTAS
<dudas del agente>

---

## Nota de entrega (la completa el agente al terminar)
Usar la plantilla de `tickets/_TEMPLATE.md`.
