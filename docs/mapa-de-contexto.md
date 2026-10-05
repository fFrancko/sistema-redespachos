# Mapa de contexto por ticket

Una conversación por ticket. La memoria del proyecto es **el repo**, no el chat: cada conversación arranca limpia y se orienta con el código ya mergeado y con `docs/ola-0/estado-y-decisiones.md`.

## Qué recibe siempre cada conversación
1. `AGENTS.md` (y `CLAUDE.md` / `GEMINI.md`, que lo referencian). Se cargan solos al abrir el repo.
2. El archivo del ticket (`tickets/MVP-XX.md`), que trae alcance, archivos permitidos y criterio de aceptación **copiado literal** de la arquitectura v3 (§4).
3. Las secciones de `docs/arquitectura-v3.md` que indica la tabla de abajo, incluidas las decisiones D30 a D37 que figuran en la fila. Nada más del documento.
4. La sección 3 de `docs/ola-0/estado-y-decisiones.md` (estado real del repo).
5. El código previo que indica la tabla (rutas del repo). Se lee del repo, no se pega.

## Qué NO recibe
- La arquitectura v2, el análisis B0 ni las conversaciones de diseño.
- Los tickets del otro carril.
- `docs/documentacion-funcional.md`, salvo la sección que el ticket pida.
- Datos reales (ver regla 8 de `AGENTS.md`).

## Prompt inicial (pegar igual en cada conversación, cambiando el ticket)
```
Sos el agente del carril <A|B> del Sistema de Redespachos. Trabajás en el ticket <MVP-XX>.
1. Leé AGENTS.md, tickets/MVP-XX.md y la sección 3 de docs/ola-0/estado-y-decisiones.md.
2. Leé solo las secciones de docs/arquitectura-v3.md que el ticket lista.
3. Escribí tu plan (5 a 10 líneas, con los archivos a tocar) en el ticket y esperá mi OK antes de codear.
4. Implementá en la rama mvp-XX-<slug> creada desde origin/main, con tests, verificá con la secuencia de AGENTS.md §5.5 y commiteá. No pushees ni abras PR.
5. Cerrá con la nota de entrega (con el hash del commit) y frená.
No toques archivos fuera de tu carril ni packages/shared. Si algo no cierra, registralo en PREGUNTAS y frená.
```
Para una auditoría, usá el prompt de `docs/auditoria-cruzada.md`.

## Ola 0 (un solo agente + Franco) — cerrada con observaciones

| Ticket | Estado al cierre |
| --- | --- |
| MVP-01 | Cumplido. |
| MVP-02 | Parcial: emuladores sí; proyectos reales, alerta de presupuesto y deploy manual sin evidencia. |
| MVP-03 | Parcial: CI sí; preview por PR y prod por tag sin ticket; deploy a dev nunca corrió. |
| MVP-04 | Cumplido, con D36 pendiente en el código. Auditoría cerrada: APROBADO CON OBSERVACIONES. |

Detalle, hallazgos y preguntas abiertas: `docs/ola-0/informe-validacion.md`. `packages/shared` queda congelado (regla 11): se modifica solo con `CR`.

## Antes de abrir los carriles (puente)

| Tarea | Secciones v3 | Bloquea | Notas |
| --- | --- | --- | --- |
| ~~Cierre de la auditoría de MVP-04~~ | — | — | **Hecho:** cierre firmado el 5/10, veredicto final APROBADO CON OBSERVACIONES. |
| `CR-01` infraestructura (`tickets/CR-01-infraestructura.md`) | §1 | — | `ci:run` con `Build shared`, `.prettierrc`, Dependabot sin majors, reglas *deny-all*, `.gitignore` (H-04, H-07, H-08, H-11). |
| `CR-02` shared D36 (`tickets/CR-02-shared-d36.md`) | §2.4, D26, D32, D36, D37 | MVP-17, MVP-19 | `origen_tms` con las 47 columnas crudas en los pedidos con error (H-01). |
| MVP-31 | §1, §3.8 | Primer callable (MVP-06, MVP-10) | Ver fila en la tabla de abajo. Proyecto dev: `qx-redespachos-dev`. |

## Carril A · Cotización

| Ticket | Secciones v3 | Código y fixtures previos | Depende de |
| --- | --- | --- | --- |
| MVP-13 | §3.3 pasos 1 a 3, D24, D25, D33 | `packages/shared` (`orderSchema`, `tariffRuleSchema`, `postalRouterEntrySchema`) | 04. Elimina `packages/motor/src/schemas/` y `cotizarPlaceholder`; `motor` usa solo esquemas de `shared`. |
| MVP-14 | §3.3 completo (fórmulas y 2 casos de referencia), D2 a D11 | `packages/motor`, `packages/shared` (helpers de dinero) | 13. Activa el umbral de cobertura de 90 % en `motor` (`vitest.config.ts` es compartido: `CR`). |
| MVP-15 | §3.3 (casos), §4 (Hito 1A) | `packages/motor/test/golden/` | 14. Datos reales de costo pendientes: solo casos de referencia. |
| MVP-16 | §3.3 | `packages/motor` | 12, 14 |
| MVP-10 | §2.5 (canalizador, `solicitudes_cp`), §3.2 (canalizador), D27, D34 | `packages/shared`; fixture sintético de canalizador | 07 (carril B), MVP-31. Mismo patrón que `checkTmsFile` para validar contra el archivo real sin subirlo. |
| MVP-11 | §2.3, §3.2 (tarifas), D2 a D4, D24, D29, D30, D34 | Fixture sintético del maestro (mismas columnas que genera la herramienta externa) | 04, 09 y 10. El sistema solo importa el maestro; no replica el transformador. Lee `precio_kg_base` / `precio_m3_base` como `precio_tramo`. |
| MVP-12 | §2.3 | código de 11 | 11 |
| MVP-17 | §3.2 (pedidos), §2.4, D12 a D15, D28, D32, D33, D36, D37 | `packages/shared` (`parseTmsRow`, `TMS_COLUMNS`); fixture sintético de pedidos TMS | 07, 10, 30 y el `CR` de D36. Decisiones pendientes: supuestos 20 y 22 de MVP-04. |
| MVP-18 | §3.3 paso 7, §3.7, §2.4, D33 | `packages/motor`, código de 17 | 14, 17 |
| MVP-19 | §3.7, §3.3 paso 6, §2.4, D32, D36 | código de 18, shell web | 18. El export de errores sale de `origen_tms` (D36). |
| MVP-20 | §3.4 (disputa), §3.8 | código de 18 | 18. Decisión pendiente: supuesto 16 de MVP-04 (referencias nulas en cotización manual). |
| MVP-21 | §4 (Hito 1A), D26 | código de 18 y 19 | 19 |

## Carril B · Plataforma y circuito

| Ticket | Secciones v3 | Código previo | Depende de |
| --- | --- | --- | --- |
| MVP-05 | §3.1, D22 | `apps/web/src/firebase.ts` | 02. Crea el shell web con la lista fija de features de `AGENTS.md` §3 (decidido, P-07). |
| MVP-06 | §3.1, §2.5 (`usuarios`, `solicitudes_acceso`) | código de 05 | 05, MVP-31 (primer callable del carril). |
| MVP-07 | §3.1 (matriz), §2.1, §2.5 (índices) | `packages/shared`, `firestore.rules` provisorias | 04, 06. Incluye `storage.rules` y `firestore.indexes.json` (H-10). |
| MVP-08 | §3.8 (último párrafo), §2.5 (`auditoria`) | `packages/shared` | 04 |
| MVP-09 | §2.2, §3.2 (proveedores), D8, D9 | `packages/shared` | 07, 08 |
| MVP-30 | §2.5 (`sucursales`), D14 | `packages/shared` | 06, 07 |
| MVP-22 | §3.4 (worker), §2.5 (`emails_salida`) | `packages/shared` | 02, 04 |
| MVP-23 | §3.4 (parametrización), §2.5 (`plantillas_email`), D16 | código de 22 | 09, 22 |
| MVP-24 | §3.4, D16 | código de 22 y 23; pedidos `VALORIZADO` sembrados | 23 y carril A (18, 20): mientras tanto, datos sembrados |
| MVP-25 | §3.1 (control por oposición), §3.4 (respuesta), D17, D18, D31 | código de 24 | 24 |
| MVP-26 | §3.5, D19, D31, D37 | código de 25 | 25. Columnas en el orden de `TMS_COLUMNS` (D37). |
| MVP-27 | §3.6, D20 | código de 26 | 26 |

## Compartido

| Ticket | Secciones v3 | Código previo | Depende de |
| --- | --- | --- | --- |
| MVP-31 | §1, §3.8, §4 (fila MVP-31) | `apps/functions`, `firebase.json`, `.github/workflows/deploy.yml`, `docs/CI.md` | 03. Además de lo que lista el ticket: Functions 2ª gen con región `southamerica-east1`, `NodeNext` en `functions` y el índice raíz con una línea fija por dominio (decidido, P-07; H-05, H-09). |

MVP-28 (formatos con Administración) y MVP-29 (capacitación) los conduce Franco.

## Orden recomendado entre carriles
- **Primero el puente** (tabla de arriba).
- **B arranca con 05 a 08**, porque 07 (reglas de seguridad) y 09 (proveedores) los necesita A.
- **A arranca con 13 y 14** (motor puro, solo necesita `packages/shared`), y toma 10, 11 y 17 cuando B entregue 07, 09 y 30 y esté mergeado el `CR` de D36.
- Si A necesita algo de B que todavía no existe, lo **siembra** en los emuladores con un script propio en `test/` y lo deja anotado.
- Si una dependencia cruzada no está lista y no se puede sembrar, pasa a PREGUNTAS y se reordena el ticket.
