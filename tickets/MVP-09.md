# MVP-09 — ABM de proveedores

- **Carril:** B · Plataforma y circuito
- **Agente:** Claude Code · **Modelo:** Sonnet 5.5 · **Esfuerzo:** high
- **Auditor:** Gemini · auditoría estándar + casos borde de CUIT, porcentajes y alias
- **Rama:** `mvp-09-suppliers`
- **Depende de:** MVP-07 y MVP-08 mergeados. Puede solaparse con MVP-30.

## Contexto a leer
- `docs/arquitectura-v3.md`: §2.2 completo, §3.2 (punto Proveedores), §3.8 (fila `suppliers.upsert` / `suppliers.setStatus`), D8, D9, D21.
- `docs/documentacion-funcional.md`: §7.2.
- `packages/shared`: `schemas/suppliers.ts` (incluye `indice_cuit`), `primitives.ts` (`dec`), `normalize.ts`, `errors.ts`.

## Alcance
1. **`suppliers.upsert`** (`ADMIN`, `ATENCION_PROVEEDOR`): alta y modificación en una transacción que escribe `proveedores` e `indice_cuit`; al cambiar el CUIT libera el índice anterior. Con `withAudit`.
2. Validaciones: CUIT de 11 dígitos con dígito verificador válido y único; `aplica_seguro` exige `porcentaje_seguro`; IVA y seguro entre 0 y 100 como `dec`; al menos un `email_contacto`; `condicion_pago` del catálogo `parametros.condiciones_pago`; **alias únicos entre proveedores comparados con `norm()`** (incluido el `id_proveedor` y la `razon_social` de otro proveedor, a confirmar en PREGUNTAS).
3. **`suppliers.setStatus`**: baja lógica (`ACTIVO` ↔ `INACTIVO`), auditada.
4. **Web:** lista, alta y edición con React Hook Form y el esquema de `shared`; `email_config` (plantilla, `para_extra`, `cc`, `cco`) con el selector de plantilla vacío hasta MVP-23; `datos_adicionales` como pares clave-valor. Utilizable sin tarifario.
5. CUIT de prueba inventados (regla 8).

## Archivos permitidos
`apps/functions/src/callables/suppliers/**`, el `index.ts` del dominio `suppliers`, `apps/web/src/features/proveedores/**`, tests junto al código, este ticket.

## Archivos prohibidos
Todo lo demás, incluido `packages/shared`.

## Criterio de aceptación
Literal de la arquitectura §4: **"CUIT duplicado o con dígito verificador inválido se rechaza; `aplica_seguro` exige porcentaje; el IVA está entre 0 y 100; un alias repetido entre proveedores se rechaza."**

Agregados:
1. Tests en los bordes: IVA `0`, `100`, `100.0001`, `-0.0001`, `10.5`; CUIT con verificador 10 (caso especial del algoritmo); alias que difiere solo en tildes o mayúsculas.
2. Dos altas concurrentes con el mismo CUIT: solo una gana (test de transacción con emulador).
3. Cambiar el CUIT de un proveedor libera el anterior en `indice_cuit`.
4. Un proveedor `INACTIVO` queda marcado como tal y la callable lo audita.
5. Secuencia de `AGENTS.md` §5.5 y tests con emuladores en verde, con la salida pegada.

## Plan
<lo completa el agente antes de codear; Franco da el OK>

## PREGUNTAS
1. ¿Un alias puede coincidir con el `id_proveedor` o la `razon_social` de **otro** proveedor? La arquitectura solo dice "un alias no puede repetirse entre proveedores". Propuesta: tampoco, porque el importador del maestro (MVP-11) asigna filas por cualquiera de los tres.

---

## Nota de entrega
Usar la plantilla de `tickets/_TEMPLATE.md`.
