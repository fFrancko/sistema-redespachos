# MVP-13 — Motor (1/2): destino, variantes y reglas candidatas

- **Carril:** A · Cotización
- **Agente:** Gemini (Antigravity) · **Modelo:** Gemini Pro · **Esfuerzo:** alto (modo con planificación, no el rápido)
- **Auditor:** Claude Code · **Modelo:** Opus 5.5 · **Esfuerzo:** xhigh · **auditoría adicional del motor** (`docs/auditoria-cruzada.md`)
- **Rama:** `mvp-13-motor-candidatas`
- **Depende de:** MVP-04 (cerrado). No depende del Carril B. Puede correr en paralelo con `CR-01`: si `CR-01` se mergea antes, rebase y `pnpm format:check` antes de entregar.

## Contexto a leer
- `docs/arquitectura-v3.md`: §3.3 **pasos 1 y 2** (leé también el 3 para entender la frontera con MVP-14), §2 (normalización `norm()` y alias de provincia), §2.3 (grupo de tramos), D10, D11, D24, D25, D27, D33.
- `docs/ola-0/estado-y-decisiones.md` §3 y la lección 1 de §7.
- `packages/shared`: `schemas/orders.ts` (`orderSchema`, `orderPostalRouterSchema`), `schemas/tariffs.ts` (`tariffSchema`, `tariffRuleSchema`), `schemas/postalRouter.ts` (`postalRouterEntrySchema`), `schemas/suppliers.ts`, `normalize.ts` (`norm`, `normProvincia`, `variantId`), `errors.ts` (`OBSERVATION_CODES`), `primitives.ts`.
- Código previo: `packages/motor/**` (todo es placeholder).

## Alcance
1. **Limpieza (H-12):** eliminar `src/schemas/`, `cotizarPlaceholder` y los tests `toBeDefined`; quitar `zod` de las dependencias de `motor` (`pnpm remove`, el lockfile lo regenera pnpm). `decimal.js` se queda, en la misma versión que `shared`.
2. **Motor consumible (lección 1 de la Ola 0):** `motor` emite `dist/` como `shared`: `noEmit: false`, `module`/`moduleResolution` `NodeNext`, imports relativos con `.js`, `exports` en `package.json`, sin tests en `dist`. MVP-18 lo va a importar desde Functions.
3. **Paso 1 — ubicar destino y origen:** buscar `cp_destino_norm` en el canalizador recibido; elegir el registro que coincida con `localidad_destino_norm` y la provincia del pedido (con `normProvincia(..., { contraCanalizador: true })`), o el único que haya; devolver `canalizador = {zona, cabecera, subzona, zona_tarifario, cobertura_qx}` con `cobertura_qx` `SI` / `NO` / `DESCONOCIDA`. CP ausente → `DESCONOCIDA` y observación `CP_NO_EN_CANALIZADOR`, **y la selección sigue por CP**. Origen: `codigo_postal_origen` → `provincia_origen` y `localidad_origen`. El motor **no** crea `solicitudes_cp` (es puro): solo informa la observación; la solicitud la crea MVP-18.
4. **Paso 2 — candidatas:** proveedores `ACTIVO` con un tarifario cuyo rango de vigencia contiene `fecha_referencia` (`VIGENTE` o `HISTORICO`, D10); sus reglas con `codigo_postal_destino` = `cp_destino_norm`, agrupadas por `variante_id`. Filtro de provincia de destino (comparación con `normProvincia(..., { contraCanalizador: false })` en ambos lados): si alguna variante coincide, se descartan las de otras provincias; si ninguna, se conservan todas y se agrega `PROVINCIA_DIFIERE`. Dentro de cada variante y **por tipo de regla**, el grupo de origen se elige por precedencia: localidad de origen → provincia de origen → `*`, con `origen_estricto` (§3.3 paso 2). **Si el grupo más específico existe, se usa ese y nunca se cae a uno más general**, aunque no tenga tramo para el valor (el tramo lo resuelve MVP-14).
5. **API interna** para MVP-14: `seleccionarCandidatas(pedido, contexto)` devuelve el destino resuelto, las observaciones y, por candidata `(id_proveedor, variante_id)`: `tarifario_id`, datos de la variante (`localidad`, `zona`, `plazo_estimado_dias`) y los grupos de reglas `PESO` y `VOLUMEN` elegidos (o vacío si no hay). Sin cálculo de montos.
6. **Tipos:** la entrada y la salida del motor se declaran como tipos TypeScript **compuestos desde los tipos de `shared`** (`Pick<Order, ...>`, `TariffRule`, `PostalRouterEntry`, `Supplier`, `Tariff`). Nada de esquemas Zod en `motor` ni campos de dominio redeclarados (regla 3).

## Archivos permitidos
`packages/motor/**` (incluidos `package.json` y `tsconfig.json`), `pnpm-lock.yaml` **solo** lo que genere `pnpm remove zod --filter @sistema-redespachos/motor`, este ticket.

## Archivos prohibidos
Todo lo demás; en particular `packages/shared` (si falta algo, `CR: shared` en PREGUNTAS y frenar) y `vitest.config.ts` (lo toca MVP-14).

## Criterio de aceptación
Literal de la arquitectura §4: **"Tests por cada nivel de precedencia de origen, por `origen_estricto`, por vigencia según `fecha_referencia`, por CP con varias variantes (misma provincia y provincias distintas), por CP ausente del canalizador y por la ausencia de caída a un grupo más general."**

Agregados:
1. Test de vigencia en los bordes: `fecha_referencia` igual a `vigencia_desde`, igual a `vigencia_hasta`, y un día después de `vigencia_hasta`.
2. Test: proveedor `INACTIVO` con tarifario vigente no aparece.
3. Test: el pedido usa solo los `_norm` (D33): cambiar `codigo_postal`, `localidad` o `provincia` crudos sin tocar los `_norm` no cambia el resultado.
4. Test: alias de provincia (`RIOJA` / `LA RIOJA`; `CABA` contra el canalizador).
5. Determinismo: dos corridas con la misma entrada dan el mismo resultado, sin `Date.now()` ni `new Date()` sin argumentos en `src` (un test lo verifica con búsqueda en el código).
6. **Consumo real:** `pnpm --filter @sistema-redespachos/motor build` emite `dist/` sin tests, y `node --input-type=module -e "import('@sistema-redespachos/motor')"` (desde un paquete del workspace) carga y ejecuta `seleccionarCandidatas` sobre un caso.
7. Secuencia de `AGENTS.md` §5.5 en verde, con la salida pegada.

## Decisiones ya tomadas para este ticket
- **Regla sin provincia de origen = Buenos Aires** (§3.3 paso 2): en `shared` la `provincia_origen` es obligatoria, así que el valor por defecto lo pone el importador (MVP-11). El motor siempre la recibe y no completa nada.
- **Comparación de provincias:** contra el canalizador, con el alias `CABA → BUENOS AIRES`; contra las reglas, sin ese alias (§2, normalización).

## Plan
<lo completa el agente antes de codear, con la lista de archivos a tocar; Franco da el OK>

## PREGUNTAS
Franco responde antes de dar el OK al plan. Las recomendaciones son de Claude.
1. **CP con varios registros en el canalizador y ninguno coincide con la localidad y la provincia del pedido.** La arquitectura no lo dice (hoy el archivo trae un registro por CP, así que el caso es raro). Recomendación: tomar el que coincida solo por provincia si es único; si no, `cobertura_qx = DESCONOCIDA` sin agregar `CP_NO_EN_CANALIZADOR` (el CP existe).
2. **CP de origen ausente del canalizador.** Recomendación: provincia y localidad de origen desconocidas; con `origen_estricto = true` solo aplican reglas `*`; agregar `CP_NO_EN_CANALIZADOR` (el código no distingue origen de destino).

---

## Nota de entrega
Usar la plantilla de `tickets/_TEMPLATE.md`.
