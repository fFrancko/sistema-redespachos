# MVP-04-AUD — Informe de Auditoría de `packages/shared`

- **Carril:** Auditoría de Ola 0
- **Agente Auditor:** Gemini
- **Rama:** `mvp-04-auditoria`
- **Diff auditado:** `d91abf2..5be13d6`
- **Veredicto:** **RECHAZADO** (por hallazgo Bloqueante en consumo del contrato y 4 hallazgos Mayores)

---

## Plan de Auditoría

1. **Preparación de Rama:**
   * Crear la rama `mvp-04-auditoria` desde `main` (commit `5be13d6`).
2. **Lectura Obligatoria:**
   * `AGENTS.md` (reglas generales).
   * `tickets/MVP-04.md` (sin nota de entrega ni PREGUNTAS inicialmente).
   * `docs/arquitectura-v3.md` (§2 excepto §2.6, §3.1, §3.2, §3.3 descarte, §3.7, §3.8).
   * `docs/auditoria-cruzada.md` (checklist, severidades y reglas).
   * Diff completo `d91abf2..5be13d6`.
3. **Verificación de Base:**
   * Ejecutar `pnpm install --frozen-lockfile`.
   * Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
4. **Ejecución y Evidencia Empírica:**
   * **Punto 1 (Matriz de Conformidad):** Las 19 colecciones campo por campo, una fila por campo, incluyendo todos los campos de control explícitos y la totalidad de los 47 campos de `pedidos`.
   * **Punto 3 (Dinero):** Verificación de tipos `dec` y `cents`. Ejecución real de los tres valores de borde (`0.005`, `0.0049`, `1250.50005`) sin alterar código del autor. Evaluación de riesgo de la ampliación de D28 (`.dd` → `0.dd`).
   * **Punto 4 (Estados y Transiciones):** Construcción independiente de la matriz de 144 pares (12x12) desde §3.7 incorporando el eje de rol (`ADMIN`). Prueba y tabla generada por script de auditoría propio.
   * **Punto 5 (Parser TMS):** Pruebas con salidas `entrada → obtenido → esperado` para encabezados repetidos/desconocidos, montos, fechas y CP. Cruce bidireccional del inventario de códigos.
   * **Punto 6 (Datos y Privacidad):** Verificación de `checkTmsFile.ts`, análisis del fixture sintético y auditoría del CUIT `30500010912` frente a padrón público de AFIP.
   * **Punto 7 (Consumo del Contrato):** Prueba de importación de `@sistema-redespachos/shared` desde `packages/motor` y `apps/functions`, verificación de `dist`, `noEmit` y `exports`.
   * **Punto 8 (Calidad de Tests):** 5 mutaciones locales en copia de trabajo comprobando que los tests fallen.
5. **Checklist y Cierre:**
   * Evaluación de los 9 puntos de `docs/auditoria-cruzada.md`.
   * Clasificación de los 21 supuestos de PREGUNTAS.
   * Tabla completa de hallazgos con severidad asignada según impacto.
   * Emisión de veredicto final y lista de decisiones para Franco.

---

## Criterio de Aceptación 1: Verificación de `main`

Ejecutado sobre el commit `5be13d6`:

### `pnpm lint`
```
> sistema-redespachos@0.0.1 lint C:\Users\Franco Aranda\Documents\sistema-redespachos
> eslint apps/web/src apps/functions packages --max-warnings 0
```
*(Salida limpia, 0 advertencias, 0 errores).*

### `pnpm typecheck`
```
> sistema-redespachos@0.0.1 typecheck C:\Users\Franco Aranda\Documents\sistema-redespachos
> pnpm -r typecheck

Scope: 4 of 5 workspace projects
apps/functions typecheck$ tsc --noEmit
packages/motor typecheck$ tsc --noEmit
apps/web typecheck$ tsc --noEmit
packages/shared typecheck$ tsc --noEmit && tsc -p scripts --noEmit
packages/motor typecheck: Done
apps/web typecheck: Done
apps/functions typecheck: Done
packages/shared typecheck: Done
```

### `pnpm test`
```
> sistema-redespachos@0.0.1 test C:\Users\Franco Aranda\Documents\sistema-redespachos
> vitest run

 Test Files  22 passed (22)
      Tests  459 passed (459)
   Start at  17:35:10
   Duration  1.84s
```

### `pnpm build`
```
> sistema-redespachos@0.0.1 build C:\Users\Franco Aranda\Documents\sistema-redespachos
> pnpm -r build

Scope: 4 of 5 workspace projects
apps/functions build$ tsc
apps/web build$ tsc && vite build
packages/motor build$ tsc
packages/shared build$ tsc
packages/motor build: Done
apps/web build: vite v5.4.21 building for production...
apps/functions build: Done
apps/web build: Done
packages/shared build: Done
```

---

## Criterio de Aceptación 2: Matriz de Conformidad Campo por Campo

Comparación exhaustiva campo por campo de las 19 colecciones de la arquitectura v3 contra los esquemas Zod de `packages/shared/src/schemas/`. Ningún campo agrupado; cada campo de control se audita explícitamente en cada colección.

### 1. `usuarios` (Id: uid de Auth)
| Campo en la arquitectura | Campo en el esquema | Tipo | Obligatoriedad | Coincide | Notas / Hallazgo |
| :--- | :--- | :--- | :--- | :---: | :--- |
| (perfil: email) | `email` | `email` | sí | **No** | Hallazgo 6: Campo no explicitado en §2.1. |
| (perfil: nombre) | `nombre` | `string` | sí | **No** | Hallazgo 6: Campo no explicitado en §2.1. |
| `rol` | `rol` | `enum` | sí | **Sí** | Coincide con `roleSchema`. |
| `sucursales` | `sucursales` | `array<ref>` | sí | **Sí** | IDs de `sucursales`. |
| `estado` | `estado` | `enum` | sí | **Sí** | `userStatusSchema` (`ACTIVO \| INACTIVO`). |
| `creado_por` | `creado_por` | `ref` | sí | **No** | Hallazgo 6: §2.1 no lista controlFieldsShape en usuarios. |
| `creado_en` | `creado_en` | `timestamp` | sí | **No** | Hallazgo 6: §2.1 no lista controlFieldsShape en usuarios. |
| `actualizado_por` | `actualizado_por` | `ref` | sí | **No** | Hallazgo 6: §2.1 no lista controlFieldsShape en usuarios. |
| `actualizado_en` | `actualizado_en` | `timestamp` | sí | **No** | Hallazgo 6: §2.1 no lista controlFieldsShape en usuarios. |

### 2. `solicitudes_acceso` (Id: auto)
| Campo en la arquitectura | Campo en el esquema | Tipo | Obligatoriedad | Coincide | Notas / Hallazgo |
| :--- | :--- | :--- | :--- | :---: | :--- |
| (uid) | `uid` | `ref` | sí | **No** | Hallazgo 6: No explicitado en §2.1 / §3.1. |
| (email) | `email` | `email` | sí | **No** | Hallazgo 6: No explicitado en §2.1 / §3.1. |
| (nombre) | `nombre` | `string` | sí | **No** | Hallazgo 6: No explicitado en §2.1 / §3.1. |
| (estado) | `estado` | `enum` | sí | **No** | Hallazgo 6: No explicitado en §2.1 / §3.1. |
| (creado_en) | `creado_en` | `timestamp` | sí | **No** | Hallazgo 6: No explicitado en §2.1 / §3.1. |
| `creado_por` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `actualizado_por` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `actualizado_en` | — | — | — | **Sí** | Ausente en arq y esquema. |

### 3. `sucursales` (Id: norm(cabecera_origen))
| Campo en la arquitectura | Campo en el esquema | Tipo | Obligatoriedad | Coincide | Notas / Hallazgo |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `cabecera_origen` | `cabecera_origen` | `string` | sí | **Sí** | |
| `activa` | `activa` | `bool` | sí | **Sí** | |
| `creado_por` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `creado_en` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `actualizado_por` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `actualizado_en` | — | — | — | **Sí** | Ausente en arq y esquema. |

### 4. `canalizador_cp` (Id: {cp}_{localidad_normalizada})
| Campo en la arquitectura | Campo en el esquema | Tipo | Obligatoriedad | Coincide | Notas / Hallazgo |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `cp` | `cp` | `string` | sí | **Sí** | Valida con `cpSchema` (4 dígitos). |
| `localidad` | `localidad` | `string` | sí | **Sí** | |
| `provincia` | `provincia` | `string` | sí | **Sí** | |
| `partido` | `partido` | `string` | sí | **Sí** | |
| `zona` | `zona` | `string` | sí | **Sí** | |
| `cabecera` | `cabecera` | `string` | sí | **Sí** | |
| `subzona` | `subzona` | `string` | sí | **Sí** | |
| `zona_tarifario` | `zona_tarifario` | `string` | sí | **Sí** | |
| `cobertura_qx` | `cobertura_qx` | `bool` | sí | **No** | Hallazgo 4: Booleano derivado (`subzona !== 'SIN COBERTURA'`) persistido sin validación de derivación en el esquema. |
| `version` | `version` | `int` | sí | **Sí** | |
| `creado_por` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `creado_en` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `actualizado_por` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `actualizado_en` | — | — | — | **Sí** | Ausente en arq y esquema. |

### 5. `solicitudes_cp` (Id: cp)
| Campo en la arquitectura | Campo en el esquema | Tipo | Obligatoriedad | Coincide | Notas / Hallazgo |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `cp` | `cp` | `string` | sí | **Sí** | `cpSchema`. |
| `localidad` | `localidad` | `string` | sí | **Sí** | |
| `provincia` | `provincia` | `string` | sí | **Sí** | |
| `origen` | `origen` | `enum` | sí | **Sí** | `PEDIDO \| TARIFARIO`. |
| `referencia_id` | `referencia_id` | `ref` | sí | **Sí** | |
| `referencias` | `referencias` | `array<ref>` | sí | **No** | Hallazgo 6: Campo acumulativo no listado en §2.1. |
| `estado` | `estado` | `enum` | sí | **Sí** | `PENDIENTE \| RESUELTA`. |
| `creado_en` | `creado_en` | `timestamp` | sí | **Sí** | |
| `resuelta_en` | `resuelta_en` | `timestamp` | no | **Sí** | Nullable. |
| `creado_por` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `actualizado_por` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `actualizado_en` | — | — | — | **Sí** | Ausente en arq y esquema. |

### 6. `proveedores` (Id: id_proveedor)
| Campo en la arquitectura | Campo en el esquema | Tipo | Obligatoriedad | Coincide | Notas / Hallazgo |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `id_proveedor` | `id_proveedor` | `string` | sí | **Sí** | Mayúsculas y sin espacios. |
| `razon_social` | `razon_social` | `string` | sí | **Sí** | |
| `alias` | `alias` | `array<string>` | no | **Sí** | |
| `cuit` | `cuit` | `string` | sí | **Sí** | 11 dígitos con dígito verificador AFIP. |
| `email_contacto` | `email_contacto` | `array<email>` | sí | **Sí** | Al menos uno. |
| `telefono` | `telefono` | `string` | sí | **Sí** | |
| `estado` | `estado` | `enum` | sí | **Sí** | `ACTIVO \| INACTIVO`. |
| `condicion_pago` | `condicion_pago` | `string` | sí | **Sí** | |
| `iva_porcentaje` | `iva_porcentaje` | `dec` | sí | **Sí** | Rango [0, 100]. |
| `aplica_seguro` | `aplica_seguro` | `bool` | sí | **Sí** | |
| `porcentaje_seguro` | `porcentaje_seguro` | `dec` | condicional | **Sí** | Obligatorio si `aplica_seguro`. |
| `email_config` | `email_config` | `map` | no | **Sí** | |
| `datos_adicionales` | `datos_adicionales` | `map` | no | **Sí** | |
| `creado_por` | `creado_por` | `ref` | sí | **Sí** | Incluido vía `controlFieldsShape`. |
| `creado_en` | `creado_en` | `timestamp` | sí | **Sí** | Incluido vía `controlFieldsShape`. |
| `actualizado_por` | `actualizado_por` | `ref` | sí | **Sí** | Incluido vía `controlFieldsShape`. |
| `actualizado_en` | `actualizado_en` | `timestamp` | sí | **Sí** | Incluido vía `controlFieldsShape`. |

### 7. `indice_cuit` (Id: CUIT sin guiones)
| Campo en la arquitectura | Campo en el esquema | Tipo | Obligatoriedad | Coincide | Notas / Hallazgo |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `id_proveedor` | `id_proveedor` | `ref` | sí | **Sí** | Deducido de §2.1 y §2.2 como puntero de unicidad. |
| `creado_por` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `creado_en` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `actualizado_por` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `actualizado_en` | — | — | — | **Sí** | Ausente en arq y esquema. |

### 8. `tarifarios` (Id: auto)
| Campo en la arquitectura | Campo en el esquema | Tipo | Obligatoriedad | Coincide | Notas / Hallazgo |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `id_proveedor` | `id_proveedor` | `ref` | sí | **Sí** | |
| `version` | `version` | `int` | sí | **Sí** | Entero ≥ 1. |
| `vigencia_desde` | `vigencia_desde` | `date` | sí | **Sí** | |
| `vigencia_hasta` | `vigencia_hasta` | `date` | no | **Sí** | Nullable. |
| `estado` | `estado` | `enum` | sí | **Sí** | `BORRADOR \| VIGENTE \| HISTORICO`. |
| `archivo_origen_path` | `archivo_origen_path` | `string` | no | **Sí** | Opcional en borrador. |
| `publicado_por` | `publicado_por` | `ref` | no | **Sí** | Opcional en borrador. |
| `publicado_en` | `publicado_en` | `timestamp` | no | **Sí** | Opcional en borrador. |
| `creado_por` | — | — | — | **No** | Hallazgo 6: §2.3 no lo incluyó y el autor no lo agregó. |
| `creado_en` | — | — | — | **No** | Hallazgo 6: §2.3 no lo incluyó y el autor no lo agregó. |
| `actualizado_por` | — | — | — | **No** | Hallazgo 6: Ausente. |
| `actualizado_en` | — | — | — | **No** | Hallazgo 6: Ausente. |

### 9. `reglas_tarifa` (Id: auto)
| Campo en la arquitectura | Campo en el esquema | Tipo | Obligatoriedad | Coincide | Notas / Hallazgo |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `tarifario_id` | `tarifario_id` | `ref` | sí | **Sí** | |
| `id_proveedor` | `id_proveedor` | `ref` | sí | **Sí** | |
| `tipo_regla` | `tipo_regla` | `enum` | sí | **Sí** | `PESO \| VOLUMEN`. |
| `provincia_origen` | `provincia_origen` | `string` | sí | **Sí** | |
| `localidad_origen` | `localidad_origen` | `string` | no | **Sí** | Opcional por arquitectura (`*` = toda la provincia). |
| `provincia_destino` | `provincia_destino` | `string` | sí | **Sí** | |
| `localidad_destino` | `localidad_destino` | `string` | no | **No** | **Hallazgo 5 (Mayor)**: Opcional en Zod contradice §2.3 donde compone `variantId`. |
| `codigo_postal_destino` | `codigo_postal_destino` | `string` | sí | **No** | **Hallazgo 3 (Mayor)**: Nombre asimétrico frente a `codigo_postal` en `pedidos`. |
| `zona_destino` | `zona_destino` | `string` | sí | **Sí** | |
| `plazo_estimado_dias` | `plazo_estimado_dias` | `int` | no | **Sí** | |
| `variante_id` | `variante_id` | `string` | sí | **No** | **Hallazgo 4 (Mayor)**: Se valida como `min(1)` sin verificar su derivación `{cp}\|{loc}\|{zona}`. |
| `kg_min` | `kg_min` | `dec` | condicional | **Sí** | Obligatorio si PESO, null si VOLUMEN. |
| `kg_max` | `kg_max` | `dec` | condicional | **Sí** | Obligatorio si PESO, null si VOLUMEN. |
| `m3_min` | `m3_min` | `dec` | condicional | **Sí** | Obligatorio si VOLUMEN, null si PESO. |
| `m3_max` | `m3_max` | `dec` | condicional | **Sí** | Obligatorio si VOLUMEN, null si PESO. |
| `precio_tramo` | `precio_tramo` | `dec` | sí | **Sí** | |
| `costo_base_viaje` | `costo_base_viaje` | `dec` | sí | **Sí** | |
| `precio_kg_excedente` | `precio_kg_excedente` | `dec` | no | **Sí** | Solo si PESO. |
| `precio_m3_excedente` | `precio_m3_excedente` | `dec` | no | **Sí** | Solo si VOLUMEN. |
| `precio_bulto` | `precio_bulto` | `dec` | no | **Sí** | |
| `precio_pallet` | `precio_pallet` | `dec` | no | **Sí** | |
| `aplica_colecta` | `aplica_colecta` | `bool` | sí | **Sí** | |
| `costo_colecta` | `costo_colecta` | `dec` | condicional | **Sí** | Obligatorio si `aplica_colecta`. |
| `vigencia_desde` | `vigencia_desde` | `date` | sí | **Sí** | |
| `vigencia_hasta` | `vigencia_hasta` | `date` | no | **Sí** | |
| `estado` | `estado` | `enum` | sí | **Sí** | |
| `creado_por` | `creado_por` | `ref` | sí | **Sí** | Incluido vía `controlFieldsShape`. |
| `creado_en` | `creado_en` | `timestamp` | sí | **Sí** | Incluido vía `controlFieldsShape`. |
| `actualizado_por` | `actualizado_por` | `ref` | sí | **Sí** | Incluido vía `controlFieldsShape`. |
| `actualizado_en` | `actualizado_en` | `timestamp` | sí | **Sí** | Incluido vía `controlFieldsShape`. |

### 10. `lotes_importacion` (Id: auto)
| Campo en la arquitectura | Campo en el esquema | Tipo | Obligatoriedad | Coincide | Notas / Hallazgo |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `sucursal_id` | `sucursal_id` | `string` | sí | **Sí** | |
| `archivo_path` | `archivo_path` | `string` | sí | **Sí** | |
| `fecha_referencia` | `fecha_referencia` | `date` | sí | **Sí** | |
| `total_filas` | `total_filas` | `int` | sí | **Sí** | |
| `validas` | `validas` | `int` | sí | **Sí** | |
| `con_error` | `con_error` | `int` | sí | **Sí** | |
| `sin_cobertura` | `sin_cobertura` | `int` | sí | **Sí** | |
| `cobertura_qx` | `cobertura_qx` | `int` | sí | **Sí** | |
| `estado` | `estado` | `enum` | sí | **Sí** | `PROCESANDO \| LISTO \| CERRADO`. |
| `creado_por` | — | — | — | **No** | Hallazgo 6: §2.1 dice "importado por un usuario", pero §2.5 y el esquema lo omiten. |
| `creado_en` | — | — | — | **No** | Hallazgo 6: Ausente en esquema. |
| `actualizado_por` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `actualizado_en` | — | — | — | **Sí** | Ausente en arq y esquema. |

### 11. `pedidos` (Id: {sucursal_id}_{nro_pedido})
*Auditoría de los 47 campos individuales:*
| Campo en la arquitectura | Campo en el esquema | Tipo | Obligatoriedad | Coincide | Notas / Hallazgo |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `nro_pedido` | `nro_pedido` | `string` | sí | **Sí** | Identidad del pedido. |
| `peso_kgs` | `peso_kgs` | `dec` | sí | **Sí** | `positiveDecSchema` (> 0). |
| `volumen_m3` | `volumen_m3` | `dec` | sí | **Sí** | `positiveDecSchema` (> 0). |
| `peso_aforado` | `peso_aforado` | `dec` | sí (presente) | **Sí** | `decSchema` (0 es observación). |
| `cantidad_bultos` | `cantidad_bultos` | `int` | sí | **Sí** | Entero positivo. |
| `valor_declarado` | `valor_declarado` | `cents` | no | **Sí** | Monto en centavos. |
| `fecha_interfaz` | `fecha_interfaz` | `date` | sí | **Sí** | `dateSchema`. |
| `zona_origen` | `zona_origen` | `string` | sí | **Sí** | |
| `cabecera_origen` | `cabecera_origen` | `string` | sí | **Sí** | |
| `codigo_postal_origen` | `codigo_postal_origen` | `string` | sí | **Sí** | Valida 4 dígitos con `cpSchema`. |
| `codigo_postal` | `codigo_postal` | `string` | sí | **No** | **Hallazgo 3 (Mayor)**: Representa destino pero se llama `codigo_postal` a secas. |
| `localidad` | `localidad` | `string` | sí | **No** | **Hallazgo 3 (Mayor)**: Representa destino pero es `localidad` a secas. |
| `provincia` | `provincia` | `string` | sí | **No** | **Hallazgo 3 (Mayor)**: Representa destino pero es `provincia` a secas. |
| `zona_destino_importada` | `zona_destino_importada` | `string` | no | **Sí** | |
| `cabecera_destino_importada` | `cabecera_destino_importada` | `string` | no | **Sí** | |
| `expreso_manual` | `expreso_manual` | `string` | no | **Sí** | |
| `destinatario` | `destinatario` | `string` | no | **Sí** | |
| `direccion` | `direccion` | `string` | no | **Sí** | |
| `numero` | `numero` | `string` | no | **Sí** | |
| `alto_cm` | `alto_cm` | `dec` | no | **Sí** | |
| `ancho_cm` | `ancho_cm` | `dec` | no | **Sí** | |
| `largo_cm` | `largo_cm` | `dec` | no | **Sí** | |
| `origen_tms` | `origen_tms` | `record<str,str>` | sí | **Sí** | Mapa de las columnas TMS restantes. |
| `sucursal_id` | `sucursal_id` | `string` | sí | **Sí** | |
| `lote_id` | `lote_id` | `ref` | sí | **Sí** | |
| `importado_por` | `importado_por` | `ref` | sí | **Sí** | |
| `importado_en` | `importado_en` | `timestamp` | sí | **Sí** | |
| `observaciones` | `observaciones` | `array<enum>` | sí | **Sí** | `observationCodeSchema`. |
| `cp_destino_norm` | `cp_destino_norm` | `string` | no en arq | **No** | **Hallazgo 3 y 4 (Mayor)**: Campo redundante/derivado no validado. |
| `provincia_destino_norm` | `provincia_destino_norm` | `string` | no en arq | **No** | **Hallazgo 3 y 4 (Mayor)**: Campo redundante/derivado no validado. |
| `provincia_origen` | `provincia_origen` | `string` | no en arq | **No** | **Hallazgo 6 (Menor)**: Campo extra en raíz no especificado en §2.4. |
| `localidad_origen` | `localidad_origen` | `string` | no en arq | **No** | **Hallazgo 6 (Menor)**: Campo extra en raíz no especificado en §2.4. |
| `canalizador` | `canalizador` | `map` | no | **Sí** | `orderPostalRouterSchema`. |
| `estado` | `estado` | `enum` | sí | **Sí** | `orderStatusSchema`. |
| `errores` | `errores` | `array<map>` | sí | **Sí** | Separación `orderSchema` / `invalidOrderSchema`. |
| `cotizacion` | `cotizacion` | `map` | no | **Sí** | `quoteSchema` (montos en cents). |
| `alternativas` | `alternativas` | `array<map>` | no | **No** | **Hallazgo 6 (Menor)**: `.max(20)` es restricción no fijada en §2.5. |
| `descartes` | `descartes` | `array<map>` | no | **Sí** | `quoteDiscardSchema`. |
| `proforma_id` | `proforma_id` | `ref` | no | **Sí** | |
| `confirmacion` | `confirmacion` | `map` | no | **Sí** | `orderConfirmationSchema`. |
| `reporte_liquidacion_id` | `reporte_liquidacion_id` | `ref` | no | **Sí** | |
| `reporte_oc_id` | `reporte_oc_id` | `ref` | no | **Sí** | |
| `fecha_aceptacion` | (en confirmación) | `date` | sí | **No** | **Hallazgo 2 (Mayor)**: Falta a nivel raíz para el índice §2.5 y filtro §3.5. |
| `creado_por` | — | — | — | **Sí** | Sustituido por `importado_por`. |
| `creado_en` | — | — | — | **Sí** | Sustituido por `importado_en`. |
| `actualizado_por` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `actualizado_en` | — | — | — | **Sí** | Ausente en arq y esquema. |

### 12. `plantillas_email` (Id: auto)
| Campo en la arquitectura | Campo en el esquema | Tipo | Obligatoriedad | Coincide | Notas / Hallazgo |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `nombre` | `nombre` | `string` | sí | **Sí** | |
| `asunto` | `asunto` | `string` | sí | **Sí** | |
| `cuerpo_html` | `cuerpo_html` | `string` | sí | **Sí** | |
| `columnas_adjunto` | `columnas_adjunto` | `array<enum>` | sí | **Sí** | |
| `formato_adjunto` | `formato_adjunto` | `enum` | sí | **Sí** | `XLSX \| CSV`. |
| `para_extra` | `para_extra` | `array<email>` | sí | **Sí** | |
| `cc` | `cc` | `array<email>` | sí | **Sí** | |
| `cco` | `cco` | `array<email>` | sí | **Sí** | |
| `es_default` | `es_default` | `bool` | sí | **Sí** | |
| `creado_por` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `creado_en` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `actualizado_por` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `actualizado_en` | — | — | — | **Sí** | Ausente en arq y esquema. |

### 13. `proformas` (Id: auto)
| Campo en la arquitectura | Campo en el esquema | Tipo | Obligatoriedad | Coincide | Notas / Hallazgo |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `lote_id` | `lote_id` | `ref` | sí | **Sí** | |
| `id_proveedor` | `id_proveedor` | `ref` | sí | **Sí** | |
| `pedido_ids` | `pedido_ids` | `array<ref>` | sí | **Sí** | |
| `totales` | `totales` | `map` | sí | **Sí** | `cantidad`, `neto`, `iva`, `total` en cents. |
| `plantilla_id` | `plantilla_id` | `ref` | sí | **Sí** | |
| `email_id` | `email_id` | `ref` | sí | **Sí** | |
| `adjunto_path` | `adjunto_path` | `string` | sí | **Sí** | |
| `enviada_por` | `enviada_por` | `ref` | sí | **Sí** | |
| `enviada_en` | `enviada_en` | `timestamp` | sí | **Sí** | |
| `estado` | `estado` | `enum` | sí | **Sí** | `proformaStatusSchema`. |
| `creado_por` | — | — | — | **Sí** | Cubierto por `enviada_por`. |
| `creado_en` | — | — | — | **Sí** | Cubierto por `enviada_en`. |
| `actualizado_por` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `actualizado_en` | — | — | — | **Sí** | Ausente en arq y esquema. |

### 14. `emails_salida` (Id: auto)
| Campo en la arquitectura | Campo en el esquema | Tipo | Obligatoriedad | Coincide | Notas / Hallazgo |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `para` | `para` | `array<email>` | sí | **Sí** | |
| `cc` | `cc` | `array<email>` | sí | **Sí** | |
| `cco` | `cco` | `array<email>` | sí | **Sí** | |
| `asunto` | `asunto` | `string` | sí | **Sí** | |
| `cuerpo_html` | `cuerpo_html` | `string` | sí | **Sí** | |
| `adjunto_path` | `adjunto_path` | `string` | no | **Sí** | |
| `proforma_id` | `proforma_id` | `ref` | no | **Sí** | |
| `estado` | `estado` | `enum` | sí | **Sí** | `emailStatusSchema`. |
| `intentos` | `intentos` | `int` | sí | **Sí** | 0 a 3. |
| `ultimo_error` | `ultimo_error` | `string` | no | **Sí** | |
| `creado_por` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `creado_en` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `actualizado_por` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `actualizado_en` | — | — | — | **Sí** | Ausente en arq y esquema. |

### 15. `respuestas_proveedor` (Id: auto)
| Campo en la arquitectura | Campo en el esquema | Tipo | Obligatoriedad | Coincide | Notas / Hallazgo |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `proforma_id` | `proforma_id` | `ref` | sí | **Sí** | |
| `pedidos` | `pedidos` | `array<map>` | sí | **Sí** | `[{pedido_id, resultado}]`. |
| `justificacion` | `justificacion` | `string` | condicional | **Sí** | Obligatoria si algún pedido es RECHAZA. |
| `evidencia_paths` | `evidencia_paths` | `array<string>` | sí | **Sí** | min(1). |
| `fecha_respuesta` | `fecha_respuesta` | `date` | sí | **Sí** | |
| `registrado_por` | `registrado_por` | `ref` | sí | **Sí** | |
| `registrado_en` | `registrado_en` | `timestamp` | sí | **Sí** | |
| `creado_por` | — | — | — | **Sí** | Cubierto por `registrado_por`. |
| `creado_en` | — | — | — | **Sí** | Cubierto por `registrado_en`. |
| `actualizado_por` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `actualizado_en` | — | — | — | **Sí** | Ausente en arq y esquema. |

### 16. `reportes_liquidacion` (Id: auto)
| Campo en la arquitectura | Campo en el esquema | Tipo | Obligatoriedad | Coincide | Notas / Hallazgo |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `generado_por` | `generado_por` | `ref` | sí | **Sí** | |
| `generado_en` | `generado_en` | `timestamp` | sí | **Sí** | |
| `filtros` | `filtros` | `map` | sí | **Sí** | `record(string, unknown)`. |
| `cantidad_pedidos` | `cantidad_pedidos` | `int` | sí | **Sí** | |
| `total_neto_cents` | `total_neto_cents` | `cents` | sí | **Sí** | |
| `total_cents` | `total_cents` | `cents` | sí | **Sí** | |
| `numero` | `numero` | `int` | sí | **Sí** | Correlativo. |
| `archivo_path` | `archivo_path` | `string` | no | **Sí** | Opcional en `PROCESANDO`. |
| `estado` | `estado` | `enum` | sí | **Sí** | `reportStatusSchema`. |
| `creado_por` | — | — | — | **Sí** | Cubierto por `generado_por`. |
| `creado_en` | — | — | — | **Sí** | Cubierto por `generado_en`. |
| `actualizado_por` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `actualizado_en` | — | — | — | **Sí** | Ausente en arq y esquema. |

### 17. `reportes_oc` (Id: auto)
| Campo en la arquitectura | Campo en el esquema | Tipo | Obligatoriedad | Coincide | Notas / Hallazgo |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `generado_por` | `generado_por` | `ref` | sí | **Sí** | |
| `generado_en` | `generado_en` | `timestamp` | sí | **Sí** | |
| `cantidad_pedidos` | `cantidad_pedidos` | `int` | sí | **Sí** | |
| `cantidad_oc` | `cantidad_oc` | `int` | sí | **Sí** | |
| `total_cents` | `total_cents` | `cents` | sí | **Sí** | |
| `archivo_path` | `archivo_path` | `string` | no | **Sí** | Opcional en `PROCESANDO`. |
| `estado` | `estado` | `enum` | sí | **Sí** | `reportStatusSchema`. |
| `creado_por` | — | — | — | **Sí** | Cubierto por `generado_por`. |
| `creado_en` | — | — | — | **Sí** | Cubierto por `generado_en`. |
| `actualizado_por` | — | — | — | **Sí** | Ausente en arq y esquema. |
| `actualizado_en` | — | — | — | **Sí** | Ausente en arq y esquema. |

### 18. `auditoria` (Id: auto)
| Campo en la arquitectura | Campo en el esquema | Tipo | Obligatoriedad | Coincide | Notas / Hallazgo |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `entidad` | `entidad` | `string` | sí | **Sí** | |
| `entidad_id` | `entidad_id` | `ref` | sí | **Sí** | |
| `accion` | `accion` | `string` | sí | **Sí** | |
| `usuario` | `usuario` | `ref` | sí | **Sí** | |
| `antes` | `antes` | `map` | no | **Sí** | Nullable. |
| `despues` | `despues` | `map` | no | **Sí** | Nullable. |
| `timestamp` | `timestamp` | `timestamp` | sí | **Sí** | |

### 19. `parametros` (Id: global)
| Campo en la arquitectura | Campo en el esquema | Tipo | Obligatoriedad | Coincide | Notas / Hallazgo |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `condiciones_pago` | `condiciones_pago` | `array<string>` | sí | **Sí** | |
| `tolerancia_volumen_pct` | `tolerancia_volumen_pct` | `dec` | sí | **Sí** | `percentSchema`. |
| `email_cdg` | `email_cdg` | `array<email>` | sí | **Sí** | |
| `origen_estricto` | `origen_estricto` | `bool` | sí | **Sí** | |
| `oc_constantes` | `oc_constantes` | `map` | sí | **Sí** | `moneda`, `cotizacion`, `workflow`, etc. |
| `formato_fecha_oc` | `formato_fecha_oc` | `string` | sí | **Sí** | |
| `creado_por` | — | — | — | **Sí** | Documento singleton `global`. |
| `creado_en` | — | — | — | **Sí** | Documento singleton `global`. |
| `actualizado_por` | — | — | — | **Sí** | Documento singleton `global`. |
| `actualizado_en` | — | — | — | **Sí** | Documento singleton `global`. |

---

## Criterio de Aceptación 3: Clasificación de Supuestos

Análisis y clasificación de los 21 supuestos de PREGUNTAS de `MVP-04.md`:

1. **Pesos sin cero entero (`.5` → `0.5`): (a)**
   - *Justificación:* Se deduce formalmente de la resolución y aprobación expresa de Franco documentada antes de la entrega ("Decisión de Franco: opción A").
2. **`Valor Declarado` en 0: (a)**
   - *Justificación:* Se deduce de §3.2 (la observación `VALOR_DECLARADO_FALTANTE` se define exclusivamente para celda vacía o columna ausente; el valor numérico 0 es un monto válido).
3. **`norm()` y la Ñ: (a)**
   - *Justificación:* Se deduce de la arquitectura v3, que establece que la normalización retira acentos diacríticos pero conserva el alfabeto castellano.
4. **Alias de provincia: (a)**
   - *Justificación:* Reproduce exactamente los 3 alias estipulados en §2.3 de `docs/arquitectura-v3.md`.
5. **CP con formato distinto de 4 dígitos: (a)**
   - *Justificación:* Se deduce de §3.2 (el CP debe contener estrictamente 4 dígitos numéricos; cualquier desviación genera `FORMATO_INVALIDO`).
6. **Campos de `usuarios`: (b)**
   - *Justificación:* Decisión de diseño razonable para vincular Firebase Auth y claims, pero §2.1 no lista los campos de perfil ni los 4 campos de control. Franco debe confirmarlo.
7. **Campos de `solicitudes_acceso`: (b)**
   - *Justificación:* Estructura lógica para la pantalla de acceso pendiente (§3.1, §3.8), pero §2.1 no lista campos para esta colección. Decisión de Franco.
8. **`indice_cuit`: (a)**
   - *Justificación:* Se deduce directamente de §2.1 y §2.2 como índice de clave primaria CUIT que apunta a `id_proveedor`. Coincide con la arquitectura.
9. **`tarifarios` (campos opcionales): (a)**
   - *Justificación:* Se deduce del ciclo de vida en §2.3 (`BORRADOR` no publicado carece de `publicado_por` y `publicado_en`).
10. **`reglas_tarifa` (localidad_destino opcional): (c)**
    - *Justificación:* Contradice §2.3 al permitir omitir `localidad_destino`, lo que vuelve ambiguo el cálculo de `variantId`.
11. **`emails_salida` (adjunto y proforma opcionales): (a)**
    - *Justificación:* Se deduce de §3.1 y §3.4 (el outbox gestiona avisos internos a ADMIN y CDG que no tienen proforma ni adjuntos).
12. **`reportes_liquidacion` y `reportes_oc` (asincrónicos): (a)**
    - *Justificación:* Se deduce de §3.5 y §3.6 (los reportes nacen `PROCESANDO` y reciben su `archivo_path` al pasar a `LISTO`).
13. **`parametros` (tipos monetarios en dec): (a)**
    - *Justificación:* Se deduce de §2.5 y la Regla 1 (ningún decimal comercial se guarda como `number`).
14. **`auditoria.antes`/`despues` y `filtros`: (a)**
    - *Justificación:* Se deduce de §2.5 (altas no poseen estado anterior; filtros de liquidación son dinámicos).
15. **`lotes_importacion` sin `creado_por`: (b)**
    - *Justificación:* §2.5 no lista campos de control para lotes, pero §2.1 indica "un archivo importado por un usuario". Franco debe confirmar si se añade trazabilidad de autor en el lote.
16. **Cotización manual con referencias nulas: (b)**
    - *Justificación:* §3.8 exige "proveedor, montos y justificación", pero dejar `tarifario_id` y `variante_id` nulos requiere confirmación de negocio de cara al motor y reportes.
17. **`pedidos.canalizador` nulo en `DESCONOCIDA`: (a)**
    - *Justificación:* Se deduce de §2.3 y §2.4 (un CP no presente en el canalizador no tiene zona, cabecera ni subzona).
18. **Doble esquema de pedidos (`orderSchema` / `invalidOrderSchema`): (b)**
    - *Justificación:* Decisión arquitectónica crucial: resuelve la persistencia de pedidos `CON_ERROR` en Firestore, pero supedita la exportación de errores de MVP-19 a la lectura del archivo original en Storage. Franco debe confirmarlo.
19. **Falta de `fecha_aceptacion` a nivel raíz en `pedidos`: (c)**
    - *Justificación:* Contradice §2.5 (índice compuesto `pedidos(estado, fecha_aceptacion)`) y §3.5 (consultas de exportación que filtran en la raíz).
20. **Criterios no fijados del parser TMS: (a)**
    - *Justificación:* Deducciones lógicas e intrínsecas a partir de las especificaciones de §3.2 y D28.
21. **Orden y lista de 47 columnas TMS: (b)**
    - *Justificación:* El autor justificó que el archivo real no está en el repo y tomó el orden del ticket MVP-04. Al no provenir de un archivo de arquitectura formal en el repo, es una definición que Franco debe ratificar.

---

## Criterio de Aceptación 4: Puntos de Auditoría 3 a 8

### Punto 3: Dinero (Regla 1)

**Veredicto: APROBADO CON OBSERVACIONES**

- **Modelado:** `dec` valida `/^\d+(\.\d{1,4})?$/` rechazando `number`, notación científica, coma decimal y negativos. `cents` valida entero seguro `≥ 0`. Ningún monto se almacena como `number` salvo `cents`.
- **Ejecución Empírica de Bordes de Redondeo (sin alterar el código del autor):**
  Se ejecutó un script externo contra `packages/shared/src/primitives.ts` para verificar el redondeo half-up:
  ```
  decimalToCents(new Decimal('0.005'))    -> 1
  decimalToCents(new Decimal('0.0049'))   -> 0
  decimalToDec(new Decimal('1250.50005')) -> '1250.5001'
  ```
  *Evidencia:* La implementación de `decimalToCents` y `decimalToDec` utiliza efectivamente `Decimal.ROUND_HALF_UP` y cumple con la regla matemática.
  *Observación (Hallazgo 8):* En la suite de tests del autor (`primitives.test.ts`) se probaron valores análogos (`10.005` y `1.23455`), pero faltaban estos tres casos de borde explícitos. Confirmamos expresamente que **no** modificamos el archivo de tests del autor.
- **Ampliación de D28 (`.dd` → `0.dd`):**
  `parseTmsAmount` normaliza `.dd` anteponiendo `0` para todas las columnas de importe del TMS.
  *Evaluación de Riesgo:* Bajo. Es coherente con la entrada de datos del TMS y evita errores de parseo en decimales menores a 1, manteniendo el rechazo de entradas ambiguas como `-.5`, `.5.5`, etc.

---

### Punto 4: Estados y Transiciones (Regla 6)

**Veredicto: APROBADO**

Se verificó la totalidad de transiciones de forma independiente a partir de `docs/arquitectura-v3.md` §3.7. Se evaluaron los 144 pares posibles ($12 \times 12$) incorporando la dimensión de roles mediante un script propio de auditoría.

#### Salida del Test Propio de Transiciones:
```
Total states: 12
Válidas sin rol: 27
Válidas solo ADMIN: 1
Inválidas: 116
Total pares: 144
assertTransition test: DomainError thrown? true code: TRANSICION_INVALIDA
```

#### Matriz Completa de Transiciones (144 pares + Restricción de Rol):
| Desde \ Hacia | CON_ERROR | VALIDADO | SIN_COBERTURA | COBERTURA_QX | VALORIZADO | ERROR_COMUNICACION | PENDIENTE_CONFIRMACION | EN_DISPUTA | ACEPTADO_PROVEEDOR | LISTO_PARA_OC | LIQUIDADO | CANCELADO |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **CON_ERROR** | — | — | — | — | — | — | — | — | — | — | — | ✓ |
| **VALIDADO** | — | — | ✓ | ✓ | ✓ | — | — | — | — | — | — | ✓ |
| **SIN_COBERTURA** | — | — | — | ✓ | ✓ | — | — | — | — | — | — | ✓ |
| **COBERTURA_QX** | — | — | ✓ | — | ✓ | — | — | — | — | — | — | ✓ |
| **VALORIZADO** | — | — | ✓ | ✓ | — | ✓ | ✓ | — | — | — | — | ✓ |
| **ERROR_COMUNICACION** | — | — | — | — | ✓ | — | ✓ | — | — | — | — | ✓ |
| **PENDIENTE_CONFIRMACION** | — | — | — | — | — | — | — | ✓ | ✓ | — | — | — |
| **EN_DISPUTA** | — | — | ✓ | ✓ | ✓ | — | — | — | — | — | — | ✓ |
| **ACEPTADO_PROVEEDOR** | — | — | — | — | — | — | — | **ADMIN** | — | ✓ | — | — |
| **LISTO_PARA_OC** | — | — | — | — | — | — | — | — | — | — | ✓ | — |
| **LIQUIDADO** | — | — | — | — | — | — | — | — | — | — | — | — |
| **CANCELADO** | — | — | — | — | — | — | — | — | — | — | — | — |

*Referencias:* `✓` = Permitida para cualquier rol; `ADMIN` = Permitida exclusivamente para el rol `ADMIN`; `—` = Transición inválida (rechazada con `TRANSICION_INVALIDA`).

---

### Punto 5: Parser del TMS (D28, §3.2, §3.3)

**Veredicto: APROBADO**

Pruebas ejecutadas con script de auditoría registrando `entrada → obtenido → esperado`:

#### 1. Encabezados Repetidos y Desconocidos
- **Entrada:** `['Nro Pedido', 'Cabecera Origen:', 'Cabecera Origen', 'Columna Desconocida Inexistente', 'Código Postal', 'Código Postal Origen']`
- **Obtenido:**
  - `desconocidas: ['Columna Desconocida Inexistente']`
  - `errores_archivo:`
    - `{ campo: 'cabecera_origen', codigo: 'FORMATO_INVALIDO', mensaje: 'Encabezado repetido' }`
    - Faltantes obligatorias: `peso_kgs`, `volumen_m3`, `peso_aforado`, `cantidad_bultos`, `fecha_interfaz`, `zona_origen`, `localidad`, `provincia` con `CAMPO_OBLIGATORIO`.
- **Esperado:** Distinción unívoca `Cabecera Origen` de `Cabecera`, detección del duplicado como `FORMATO_INVALIDO` a nivel archivo y reporte de la columna desconocida.

#### 2. Montos
| Entrada | Obtenido | Esperado | Coincide |
| :--- | :--- | :--- | :---: |
| `"349,731.72"` | `"349731.72"` | `"349731.72"` | **Sí** |
| `".5"` | `"0.5"` | `"0.5"` (D28 ampliado) | **Sí** |
| `"1.234,56"` | `null` | `null` (formato europeo rechazado) | **Sí** |
| `"1,5"` | `null` | `null` | **Sí** |
| `"1e3"` | `null` | `null` (notación científica rechazada) | **Sí** |
| `"-5"` | `null` | `null` (negativo rechazado) | **Sí** |
| `".5.5"` | `null` | `null` (punto ambiguo rechazado) | **Sí** |

#### 3. Fechas
| Entrada | Obtenido | Esperado | Coincide |
| :--- | :--- | :--- | :---: |
| `"01/10/2026"` | `"2026-10-01"` | `"2026-10-01"` | **Sí** |
| `"01/10/2026 14:30:00"` | `"2026-10-01"` | `"2026-10-01"` | **Sí** |
| `"31/02/2026"` | `null` | `null` (día inexistente) | **Sí** |
| `"29/02/2027"` | `null` | `null` (no bisiesto) | **Sí** |
| `"29/02/2028"` | `"2028-02-29"` | `"2028-02-29"` (bisiesto válido) | **Sí** |

#### 4. Códigos Postales
| Entrada | Obtenido | Esperado | Coincide |
| :--- | :--- | :--- | :---: |
| `"0123"` | `true` | `true` (4 dígitos con 0 a la izquierda) | **Sí** |
| `"123"` | `false` | `false` | **Sí** |
| `"12345"` | `false` | `false` | **Sí** |
| `"1406.0"` | `false` | `false` | **Sí** |

#### 5. Inventario Bidireccional de Códigos
Se cruzaron los catálogos de `packages/shared/src/errors.ts` contra la arquitectura en ambas direcciones:
- **Errores de fila (§3.2):** `CAMPO_OBLIGATORIO`, `FORMATO_INVALIDO`, `PESO_INVALIDO`, `VOLUMEN_INVALIDO`, `CABECERA_NO_PERMITIDA`, `DUPLICADO`. Coincidencia: **100% exacto**.
- **Observaciones de fila (§3.2):** `VOLUMEN_INCONSISTENTE`, `AFORADO_MENOR_A_PESO`, `AFORADO_CERO`, `VALOR_DECLARADO_FALTANTE`, `DESTINO_DIFIERE_TMS`, `CP_NO_EN_CANALIZADOR`, `CP_AMBIGUO`, `PROVINCIA_DIFIERE`. Coincidencia: **100% exacto**.
- **Motivos de descarte del motor (§3.3):** `PESO_EXCEDIDO_SIN_REGLA`, `VOLUMEN_EXCEDIDO_SIN_REGLA`, `SIN_TARIFA`. Coincidencia: **100% exacto**.
- **Errores de negocio (§3.8):** `DUPLICADO`, `TRANSICION_INVALIDA`, `PEDIDO_NO_EXPORTABLE`, `MISMO_USUARIO`, `TARIFARIO_INVALIDO`, `PROVEEDOR_NO_ENCONTRADO`. Coincidencia: **100% exacto**.
*Resultado:* No se emite ningún código ajeno a la arquitectura y todos los códigos requeridos están contemplados.

---

### Punto 6: Datos y Privacidad (Regla 8, Ley 25.326)

**Veredicto: APROBADO CON OBSERVACIONES**

- **`scripts/checkTmsFile.ts`:** Se inspeccionó el script. Solo emite conteos estadísticos agregados y resúmenes de errores. Nunca imprime valores de celdas ni datos de clientes o domicilios.
- **Fixture `pedidos_tms_sintetico.csv`:** Las 20 filas contienen valores artificiales ("CLIENTE SINTETICO 0001", "CALLE INVENTADA 101"). Las 47 columnas de la plantilla del TMS no contemplan CUITs de destinatarios.
- **Auditoría de CUITs en el código (Hallazgo 9 - Menor):**
  En `packages/shared/src/schemas/suppliers.test.ts` l.25 se utiliza el CUIT `30500010912`.
  *Método de determinación:* Consulta al padrón público de personas jurídicas de AFIP y RITE (Registro de Integridad y Transparencia para Empresas).
  *Resultado:* El CUIT `30-50001091-2` pertenece a una entidad real y activa: **Banco de la Nación Argentina**. Aunque no expone datos sensibles ni secretos comerciales, infringe la regla de usar CUITs puramente sintéticos (como el `20123456786` utilizado en el mismo archivo).

---

### Punto 7: Consumo del Contrato

**Veredicto: BLOQUEANTE / NO CUMPLIDO**

- **`packages/shared/package.json`:** No declara los puntos de entrada obligatorios para un paquete de monorepo: faltan `"main": "dist/index.js"`, `"types": "dist/index.d.ts"` y el bloque `"exports"`.
- **Falla en `pnpm build`:** `packages/shared/tsconfig.json` extiende el `tsconfig.json` raíz que contiene `"noEmit": true`. Al no sobreescribir con `"noEmit": false`, la ejecución de `pnpm --filter @sistema-redespachos/shared build` ejecuta `tsc` sin emitir ningún archivo en `packages/shared/dist`.
- **Evidencia Empírica de Bloqueo:**
  Al crear un archivo de prueba en `packages/motor/src/test_consumer.ts` importando `@sistema-redespachos/shared` y ejecutar `pnpm --filter @sistema-redespachos/motor typecheck`:
  ```
  error TS2307: Cannot find module '@sistema-redespachos/shared' or its corresponding type declarations.
  ```
  Al intentar importar mediante el alias `@shared/index`, `tsc` falla con:
  ```
  error TS6059: File '.../packages/shared/src/orderTransitions.ts' is not under 'rootDir' '.../packages/motor/src'.
  ```
- **Impacto Crítico:** **El ticket MVP-13 (`packages/motor`) y subsiguientes desarrollos en `apps/functions` se encuentran estrictamente bloqueados** hasta que `packages/shared` emita tipos e implementaciones compiladas y declare sus exports correctamente.

---

### Punto 8: Calidad de los Tests (Checklist 9)

**Veredicto: APROBADO**

Se realizaron 5 mutaciones locales en el código de `packages/shared` y se verificó que la suite de Vitest detectara inmediatamente la rotura:

1. **Algoritmo CUIT (`isValidCuit` forzado a `return true`):**
   - *Fallo obtenido:* 3 tests fallaron en `suppliers.test.ts` (`rechaza dígito verificador incorrecto`, `rechaza cuando el cálculo da 10`, `rechaza cuit con dígito verificador inválido`).
2. **Condicionalidad de Seguro (`aplica_seguro` sin exigir `porcentaje_seguro`):**
   - *Fallo obtenido:* 1 test falló en `suppliers.test.ts` (`aplica_seguro exige porcentaje_seguro`).
3. **Exclusividad PESO / VOLUMEN en Tarifas (anulación de check de campos requeridos):**
   - *Fallo obtenido:* 5 tests fallaron en `tariffs.test.ts` (`rechaza PESO sin kg_min`, `rechaza PESO sin kg_max`, `rechaza VOLUMEN sin m3_min`, etc.).
4. **Validación `min < max` en Tramos (anulación del check):**
   - *Fallo obtenido:* 4 tests fallaron en `tariffs.test.ts` (`rechaza kg_min igual a kg_max`, `rechaza kg_min mayor que kg_max`, etc.).
5. **Justificación obligatoria en Rechazo de Proveedor (anulación del check):**
   - *Fallo obtenido:* 1 test falló en `proformas.test.ts` (`justificacion es obligatoria si algún pedido es RECHAZA`).

*Evidencia de limpieza:* Tras revertir las mutaciones locales, `git status` retornó árbol limpio sin archivos modificados.

---

## Checklist de `docs/auditoria-cruzada.md`

| # | Ítem del Checklist | Estado | Observación |
|---|---|:---:|---|
| 1 | **Verificación:** typecheck y tests en verde, corridos por el auditor | **CUMPLE** | 459 tests en verde, lint y typecheck pasando en `main`. |
| 2 | **Criterio de aceptación:** cada punto probado con evidencia empírica | **NO CUMPLE** | Punto 7 no cumplido (el paquete no es consumible). |
| 3 | **Conformidad con la arquitectura:** nombres, estados, errores y fórmulas idénticos | **NO CUMPLE** | Hallazgos 2, 3, 4 y 5 rompen la conformidad estricta. |
| 4 | **Dinero:** ningún `number` para montos; redondeo half-up a centavo | **CUMPLE** | `dec` y `cents` respetados; `ROUND_HALF_UP` verificado en ejecución. |
| 5 | **Alcance:** ningún archivo fuera del permitido; sin dependencias no autorizadas | **CUMPLE** | Solo dependencias autorizadas (`zod`, `decimal.js`, `csv-parse`, `tsx`). |
| 6 | **Contratos:** `packages/shared` no modificado fuera de un `CR` | **CUMPLE** | No se editó código compartido en esta auditoría. |
| 7 | **Seguridad y datos:** ningún dato real ni secreto en el repo | **OBSERVADO** | Se detectó CUIT real de Banco Nación en tests (Hallazgo 9). |
| 8 | **Casos borde:** bordes de tramo, decimales, opcionales, transiciones | **CUMPLE** | Transiciones y validaciones TMS probadas rigurosamente. |
| 9 | **Tests:** que prueben comportamiento y fallen si se rompe la regla | **CUMPLE** | Verificado con 5 mutaciones locales en Punto 8. |

---

## Criterio de Aceptación 5: Tabla de Hallazgos

| # | Severidad | Dónde | Qué pasa | Evidencia | Sugerencia |
|---|---|---|---|---|---|
| 1 | **Bloqueante** | `packages/shared/package.json`, `tsconfig.json` | `packages/shared` no es consumible: no declara `main`/`types`/`exports`, su build hereda `noEmit: true` y no genera `dist/`. Bloquea MVP-13. | `pnpm --filter @sistema-redespachos/shared build` deja `dist/` inexistente; al importar desde `motor` da `error TS2307: Cannot find module '@sistema-redespachos/shared'`. | Configurar `"noEmit": false` en `packages/shared/tsconfig.json` y declarar `"main"`, `"types"` y `"exports"` en su `package.json`. |
| 2 | **Mayor** | `packages/shared/src/schemas/orders.ts` | Falta `fecha_aceptacion` a nivel raíz en el esquema de `pedidos`. Solo existe anidada en `confirmacion`. | En §2.5 se define el índice compuesto `pedidos(estado, fecha_aceptacion)` y en §3.5 se filtra a nivel raíz. En `orders.ts` l.155 no existe el campo. | Agregar `fecha_aceptacion: dateSchema.nullable()` o `timestampSchema.nullable()` a nivel raíz en `orderSchema`. |
| 3 | **Mayor** | `packages/shared/src/schemas/orders.ts`, `tariffs.ts` | Triple convención de nombres y asimetría en la clave de join destino: en `pedidos` es `codigo_postal`/`provincia`/`localidad`, en `reglas_tarifa` es `codigo_postal_destino`/`provincia_destino`/`localidad_destino`, y además existen `cp_destino_norm` y `provincia_destino_norm`. | En `orders.ts` l.33-36 y `tariffs.ts` l.40-43. En `pedidos`, `codigo_postal` es el destino mientras `codigo_postal_origen` es origen, induciendo a error al joinear en MVP-13. | Documentar el mapeo formal para MVP-13 o unificar en arquitectura el naming del destino a `codigo_postal_destino`, etc. |
| 4 | **Mayor** | `packages/shared/src/schemas/{tariffs,postalRouter,orders}.ts` | Campos derivados se persisten sin que el esquema valide la derivación: `variante_id` acepta cualquier string (`min(1)`), `cobertura_qx` en canalizador no valida contra `subzona`, y `cp_destino_norm`/`provincia_destino_norm` no validan contra `norm()`. | `tariffs.ts` l.45 (`variante_id: z.string().min(1)`), `postalRouter.ts` l.16 (`cobertura_qx: z.boolean()`), `orders.ts` l.157-158. | Agregar refinamientos (`superRefine`) en los esquemas Zod o documentar explícitamente que la garantía de derivación descansa exclusivamente en la callable. |
| 5 | **Mayor** | `packages/shared/src/schemas/tariffs.ts` | `localidad_destino` es `.optional()` en `tariffRuleSchema`. | En `tariffs.ts` l.41: `localidad_destino: z.string().min(1).optional()`. En §2.3 la clave de variante requiere obligatoriamente `norm(localidad_destino)`. | Hacer `localidad_destino` obligatoria en el esquema (a diferencia de `localidad_origen`, que sí admite `*` o genérico provincial por §3.3). |
| 6 | **Menor** | `packages/shared/src/schemas/{users,orders,postalRouter}.ts` | Campos extras no explicitados en la arquitectura: `provincia_origen` y `localidad_origen` en la raíz de `pedidos` (l.159-160); `.max(20)` en `alternativas` inventado (regla 9); `referencias[]` en `solicitudes_cp`; y datos de perfil/control en `usuarios`. | `orders.ts` l.159-165, `postalRouter.ts` l.30, `users.ts` l.8-15. | Confirmar con Franco o retirar restricciones inventadas. |
| 7 | **Menor** | `packages/motor/src/schemas/index.ts` | Existe la carpeta `packages/motor/src/schemas/` con un archivo placeholder. Riesgo de tipos duplicados (Regla 3). | `packages/motor/src/schemas/index.ts` en `main`. | Eliminar este directorio al iniciar MVP-13 y consumir exclusivamente `@sistema-redespachos/shared`. |
| 8 | **Menor** | `packages/shared/src/primitives.test.ts` | La suite de tests del autor no incluye los casos de borde exactos de redondeo half-up requeridos en la auditoría (`0.005` → 1, `0.0049` → 0, `1250.50005` → `1250.5001`). | `primitives.test.ts` l.58 y l.94 prueban `1.23455` y `10.005`. | Incorporar los tres casos de borde explícitos en `primitives.test.ts`. |
| 9 | **Menor** | `packages/shared/src/schemas/suppliers.test.ts` | Uso de CUIT real correspondiente a una entidad jurídica existente (Banco de la Nación Argentina `30500010912`). | `suppliers.test.ts` l.25. Verificado mediante consulta a padrón público de AFIP/RITE. | Reemplazar por un CUIT sintético válido generado aleatoriamente que no pertenezca a un contribuyente real. |

---

## Criterio de Aceptación 6: Veredicto Final

**VEREDICTO: RECHAZADO**

*Fundamentación:*
De acuerdo con las reglas de `docs/auditoria-cruzada.md` §3.3 ("El autor corrige los Bloqueantes y los Mayores..."), la existencia de **1 hallazgo Bloqueante** (Hallazgo 1: `packages/shared` no es consumible ni emite build, bloqueando el inicio de MVP-13 en `packages/motor`) sumada a **4 hallazgos Mayores** (Hallazgos 2, 3, 4 y 5 sobre integridad de datos, derivaciones e índices) determina el veredicto de **RECHAZADO**.

El autor de MVP-04 debe emitir un PR de corrección `fix(shared): solucionar hallazgos de auditoria MVP-04` que resuelva prioritariamente los hallazgos 1, 2, 3, 4 y 5 antes de considerar `packages/shared` congelado y antes de dar inicio a la Ola 1.

---

## Criterio de Aceptación 7: Decisiones para Franco

1. **Consumo de `packages/shared` (Hallazgo 1):** Aprobar la inclusión de `"noEmit": false` en `packages/shared/tsconfig.json` y la configuración de `"main"`, `"types"` y `"exports"` en su `package.json` para desbloquear MVP-13.
2. **Normalización de Nombres de Join (Hallazgo 3):** Definir si para MVP-13 se conserva el mapeo asimétrico (`pedidos.codigo_postal` contra `reglas_tarifa.codigo_postal_destino`) o si se realiza un CR para normalizar `pedidos.codigo_postal_destino`.
3. **Validación de Campos Derivados (Hallazgo 4):** Definir si `variante_id`, `cobertura_qx` y los campos `_norm` deben ser estrictamente validados en el esquema Zod mediante `superRefine`, o si se confía la consistencia a la lógica de las callables/triggers.
4. **Doble Esquema de Pedidos (Supuesto 18):** Ratificar  la solución `orderSchema` / `invalidOrderSchema` y la estrategia de leer el archivo original en Storage para exportar filas con error en MVP-19.
5. **Campos de Control Globales (Hallazgo 6 y Supuesto 15):** Determinar si `lotes_importacion`, `tarifarios` y `solicitudes_acceso` deben recibir campos homogéneos de auditoría (`creado_por`, `creado_en`).
6. **Ampliación de D28:** Confirmar en la documentación de arquitectura la normalización de importes sin cero entero (`.dd` → `0.dd`) para todas las columnas numéricas del TMS.


---

## Verificación de correcciones

- **Fecha:** 5 de octubre de 2026.
- **Modalidad:** cierre firmado por Franco, sin re-auditoría de Gemini (decisión de Franco, pregunta P-04 de `docs/ola-0/informe-validacion.md`). La verificación técnica la hizo Claude sobre el commit `80d4735` en un clon limpio: install congelado, `Build shared`, lint, typecheck, 490 tests y build en verde.
- **Correcciones revisadas:** PR #18 y #19 (`74917ba` a `473e531`).

| # | Severidad original | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | Bloqueante | **RESUELTO** | `packages/shared` emite `dist/` sin tests, declara `main`, `types` y `exports`, compila con `NodeNext`; el `dist` se importa con Node puro (117 exports) y `motor` y `functions` lo declaran como `workspace:*`. |
| 2 | Mayor | **RESUELTO** (D31) | `fecha_aceptacion` en la raíz de `orderSchema` (`orders.ts` l.173), obligatoria con `confirmacion`. |
| 3 | Mayor | **RESUELTO** (D33) | El cruce de destino usa solo `cp_destino_norm`, `provincia_destino_norm` y el nuevo `localidad_destino_norm`; los nombres crudos del TMS se conservan por decisión. |
| 4 | Mayor | **RESUELTO** (D34) | `superRefine` en `variante_id` (`tariffs.test.ts` l.168), `cobertura_qx` (`postalRouter.test.ts` l.32) y los tres `_norm` de `pedidos`. |
| 5 | Mayor | **RESUELTO** (D30) | `localidad_destino` obligatoria (`tariffs.ts` l.44). |
| 6 | Menor | **ACEPTADO POR FRANCO** | La arquitectura actualizada incluye `provincia_origen`/`localidad_origen` (§2.4), el máximo de 20 alternativas (§2.4), `referencias` (§2.5) y los campos de `usuarios` (§2.5). |
| 7 | Menor | **DIFERIDO a MVP-13** | `packages/motor/src/schemas/` sigue como placeholder; MVP-13 lo elimina. |
| 8 | Menor | **RESUELTO** | Tests de `0.005 → 1`, `0.0049 → 0`, `718.3743 → 71837` y `1250.50005 → 1250.5001` en `primitives.test.ts`. |
| 9 | Menor | **RESUELTO** | El CUIT del Banco Nación se reemplazó por `20001555554` (sintético, dígito verificador válido). |

**Hallazgo nuevo, fuera de esta auditoría:** D36 se agregó a la arquitectura después de este informe y no está implementado (`origen_tms` guarda 28 de las 47 columnas). Se sigue como H-01 en `docs/ola-0/informe-validacion.md` y se resuelve con un `CR` de `shared` antes de MVP-17. No reabre este veredicto.

**Veredicto final: APROBADO CON OBSERVACIONES.** `packages/shared` queda congelado (regla 11 de `AGENTS.md`); se modifica solo con `CR`.

Firmado: Franco Aranda (decisión de cierre) · Claude (verificación técnica).
