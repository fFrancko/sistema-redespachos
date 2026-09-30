# Mapa de contexto por ticket

Una conversación por ticket. La memoria del proyecto es **el repo**, no el chat: cada conversación arranca limpia y se orienta con el código ya mergeado.

## Qué recibe siempre cada conversación
1. `AGENTS.md` (y `CLAUDE.md` / `GEMINI.md`, que lo referencian). Se cargan solos al abrir el repo.
2. El archivo del ticket (`tickets/MVP-XX.md`), que trae alcance, archivos permitidos y criterio de aceptación **copiado literal** de la arquitectura v3 (§4).
3. Las secciones de `docs/arquitectura-v3.md` que indica la tabla de abajo. Nada más del documento.
4. El código previo que indica la tabla (rutas del repo). Se lee del repo, no se pega.

## Qué NO recibe
- La arquitectura v2, el análisis B0 ni esta conversación de diseño.
- Los tickets del otro carril.
- El documento funcional completo (solo si el ticket lo pide).
- Datos reales (ver regla 8 de `AGENTS.md`).

## Prompt inicial (pegar igual en cada conversación, cambiando el ticket)
```
Sos el agente del carril <A|B> del Sistema de Redespachos. Trabajás en el ticket <MVP-XX>.
1. Leé AGENTS.md y tickets/MVP-XX.md.
2. Leé solo las secciones de docs/arquitectura-v3.md que el ticket lista.
3. Escribí tu plan (5 a 10 líneas) en el ticket y esperá mi OK antes de codear.
4. Implementá en la rama mvp-XX-<slug>, con tests, y cerrá con la nota de entrega.
No toques archivos fuera de tu carril. Si algo no cierra, registralo en PREGUNTAS y frená.
```
Para una auditoría, usá el prompt de `docs/auditoria-cruzada.md`.

## Ola 0 (un solo agente + Franco)
El repo arranca limpio: la herramienta de tarifas de la etapa B0 se movió a su propio repositorio (`herramientas-tarifas`). Ola 0 crea el monorepo desde cero con el stack de la v3.

| Ticket | Secciones v3 | Código previo a leer | Notas |
| --- | --- | --- | --- |
| MVP-01 | §1, convenciones | — | Monorepo pnpm con Vitest. Reemplaza `package.json`, `tsconfig.json` y `README.md` heredados (quedan solo si Franco aún no los borró). |
| MVP-02 | §1 (Blaze), §6.1 (gasto) | — | Lo hace Franco (cuentas y facturación). El agente solo deja los archivos de configuración de emuladores. |
| MVP-03 | §1 (CI/CD) | `package.json` | 01, 02 |
| MVP-04 | §2 completo, §3.2 (normalización, observaciones, errores), §3.7, §3.8, D28 | — | Incluye `ReglaTarifa` de la v3. La herramienta externa genera el maestro con `precio_kg_base` / `precio_m3_base`; el importador de MVP-11 los lee como `precio_tramo`. |

Al cerrar Ola 0: `packages/shared` queda congelado y el otro agente audita.

## Carril A · Cotización

| Ticket | Secciones v3 | Código y fixtures previos | Depende de |
| --- | --- | --- | --- |
| MVP-13 | §3.3 pasos 1 a 3, D24, D25 | `packages/shared` | 04 |
| MVP-14 | §3.3 completo (fórmulas y 2 casos de referencia), D2 a D11 | `packages/motor`, `packages/shared` | 13 |
| MVP-15 | §3.3 (casos), §4 (Hito 1A) | `packages/motor/test/golden/` | 14. Datos reales de costo pendientes: solo casos de referencia. |
| MVP-16 | §3.3 | `packages/motor` | 12, 14 |
| MVP-10 | §2.5 (canalizador, `solicitudes_cp`), §3.2 (canalizador), D27 | `packages/shared`; fixture sintético de canalizador | 07 (carril B) |
| MVP-11 | §2.3, §3.2 (tarifas), D2 a D4, D24, D29 | Fixture sintético del maestro (mismas columnas que genera la herramienta externa) | 04, 09 y 10. El sistema solo importa el maestro; no replica el transformador. |
| MVP-12 | §2.3 | código de 11 | 11 |
| MVP-17 | §3.2 (pedidos), §2.4, D12 a D15, D28 | `packages/shared`; fixture sintético de pedidos TMS | 07, 10, 30 |
| MVP-18 | §3.3 paso 7, §3.7, §2.4 | `packages/motor`, código de 17 | 14, 17 |
| MVP-19 | §3.7, §3.3 paso 6, §2.4 | código de 18, shell web | 18 |
| MVP-20 | §3.4 (disputa), §3.8 | código de 18 | 18 |
| MVP-21 | §4 (Hito 1A), D26 | código de 18 y 19 | 19 |

## Carril B · Plataforma y circuito

| Ticket | Secciones v3 | Código previo | Depende de |
| --- | --- | --- | --- |
| MVP-05 | §3.1, D22 | shell web | 02 |
| MVP-06 | §3.1 | código de 05 | 05 |
| MVP-07 | §3.1 (matriz), §2.1 | `packages/shared` | 04, 06 |
| MVP-08 | §3.8 (último párrafo), §2.5 (`auditoria`) | `packages/shared` | 04 |
| MVP-09 | §2.2, §3.2 (proveedores), D8, D9 | `packages/shared` | 07, 08 |
| MVP-30 | §2.5 (`sucursales`), D14 | `packages/shared` | 06, 07 |
| MVP-22 | §3.4 (worker), §2.5 (`emails_salida`) | `packages/shared` | 02, 04 |
| MVP-23 | §3.4 (parametrización), §2.5 (`plantillas_email`), D16 | código de 22 | 09, 22 |
| MVP-24 | §3.4, D16 | código de 22 y 23; pedidos `VALORIZADO` sembrados | 23 y carril A (18, 20): mientras tanto, datos sembrados |
| MVP-25 | §3.1 (control por oposición), §3.4 (respuesta), D17, D18 | código de 24 | 24 |
| MVP-26 | §3.5, D19 | código de 25 | 25 |
| MVP-27 | §3.6, D20 | código de 26 | 26 |

MVP-28 (formatos con Administración) y MVP-29 (capacitación) los conduce Franco.

## Orden recomendado entre carriles
- **B arranca con 05 a 08**, porque 07 (reglas de seguridad) y 09 (proveedores) los necesita A.
- **A arranca con 13 y 14** (motor puro, solo necesita `packages/shared`), y toma 10, 11 y 17 cuando B entregue 07, 09 y 30.
- Si A necesita algo de B que todavía no existe, lo **siembra** en los emuladores con un script propio en `test/` y lo deja anotado.
- Si una dependencia cruzada no está lista y no se puede sembrar, pasa a PREGUNTAS y se reordena el ticket.
