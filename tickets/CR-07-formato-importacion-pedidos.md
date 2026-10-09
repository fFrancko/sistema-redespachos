# CR-07 — `packages/shared`: formato de importación de pedidos (D37)

- **Estado:** **BORRADOR, pendiente de aprobación de Franco.** No se implementa nada hasta que Franco responda las PREGUNTAS y dé el OK. Es un `CR: shared`.
- **Carril:** Compartido (`CR: shared`; puede requerir además un `CR: deps`, ver P-11).
- **Agente / Auditor:** a definir por Franco.
- **Rama sugerida:** `cr-07-formato-pedidos`
- **Depende de:** respuestas de Franco a las PREGUNTAS. Tiene que estar mergeado **antes de MVP-17** (parser e importación). Condiciona el desempate de origen de MVP-13 (D-1) y los tickets que usan las 47 columnas (ver "Impacto").
- **Origen:** `tickets/MVP-13-AUDITORIA.md` §9, D-1 y D-7. Franco confirmó el 06/10/2026 que el archivo `Pedidos sin cobertura 6-10.xlsx` es el formato con el que se van a importar los pedidos y que hay que adaptar el importador.
- **Redactó:** Claude Code (auditor de MVP-13), a pedido de Franco.

## Contexto a leer

- `AGENTS.md` completo.
- `docs/arquitectura-v3.md`: §2.4 (tabla de columnas y `origen_tms`), §3.2 (plantilla), §3.5 (columnas del reporte de liquidación), D12, D15, D26, D28, D33, D36 y D37.
- `tickets/MVP-04.md` (criterio 3: `pedidos_tms.csv`, 538 filas), `tickets/CR-02-shared-d36.md`, `tickets/MVP-26.md`.
- Código: `packages/shared/src/tms/headers.ts`, `src/tms/orderRow.ts`, `src/tms/amounts.ts`, `src/tms/dates.ts`, `src/schemas/orders.ts`, `src/errors.ts`, `scripts/checkTmsFile.ts`, `scripts/generateTmsFixture.ts`.

## Problema

D37 fija como fuente de verdad las **47 columnas** de `headers.ts`, que se derivaron en MVP-04 de un CSV real del TMS (`pedidos_tms.csv`, 538 filas, montos `349,731.72`, fechas `dd/MM/yyyy`). El archivo que se va a usar es otro export: un **xlsx de 58 columnas**, con otros nombres de columna y con celdas numéricas y de fecha nativas de Excel.

Al pasar sus 58 encabezados por `resolveTmsHeaders` (código actual de `shared`):

```
Reconocidas (17): Nro Pedido -> nro_pedido | Código de Referencia -> origen_tms | Categoría -> origen_tms |
  Sub Categoría -> origen_tms | Dirección -> direccion | Localidad -> localidad | Provincia -> provincia |
  Peso Kgs -> peso_kgs | Volumen M3 -> volumen_m3 | Valor Declarado -> valor_declarado |
  Valor Contra Reembolso, Nro Carta Porte, Chofer, Patente, Transporte, Representante -> origen_tms |
  Destinatario -> destinatario
Errores de archivo (7): peso_aforado, cantidad_bultos, fecha_interfaz, zona_origen, cabecera_origen,
  codigo_postal, codigo_postal_origen: CAMPO_OBLIGATORIO
Desconocidas (41)   ← hoy se descartan: no van ni a un campo ni a `origen_tms`
```

Resultado: **el importador actual rechaza el archivo completo**. Aunque se agreguen equivalencias, 41 columnas se perderían: hoy una columna desconocida no se guarda.

**Cómo se obtuvo la evidencia.** Scripts del auditor fuera del repo, que imprimen solo encabezados y conteos, nunca valores (AGENTS.md §4.8, Ley 25.326). La muestra es chica: 24 pedidos, más una hoja `Canalizador` de 3.469 registros. Las conclusiones de formato hay que confirmarlas con un archivo más grande (ver criterio 2).

**Hallazgos sobre el archivo:**

- **`COBERTURA` no viene del sistema de origen:** es una fórmula agregada a mano, `VLOOKUP(Cod Postal Destinatario, Canalizador!A:H, 8)` (la `ZONA TARIFARIO` del canalizador), en las 24 filas. La hoja `Canalizador` también es un agregado.
- **El destino viene dos veces:** `Cod Postal`/`Localidad`/`Provincia`/`Dirección`/`Destino` y `Cod Postal Destinatario`/`Localidad Destinatario`/`Provincia Destinatario`/`Dirección Destinatario`/`Destinatario`. Los dos bloques coinciden en **24 de 24** filas. `Cod Postal` es texto y `Cod Postal Destinatario` es número.
- **`Localidad Remitente` y `Provincia Rtte`** coinciden con la localidad y la provincia del canalizador para el `Cod Postal Remitente` en **24 de 24** filas. Sirven para el desempate de origen que pidió Franco (D-1).
- **`Zona Remitente`** no coincide con la `ZONA` ni con la `CABECERA` del canalizador del CP remitente (0 de 24). `Deposito de Tránsito` viene en 5 de 24. No hay ninguna columna que sea, a simple vista, la sucursal de origen (`cabecera_origen`).
- **Fechas:**
  - `Fecha de recepcion` es texto `dd/MM/yyyy` en 23 de 24 filas; una viene vacía.
  - `Fecha Estado`, `Fecha Carta Porte` y `Fecha Alta` son fechas nativas de Excel (número de serie), no texto.
- **Números nativos de Excel (no texto D28):**
  - `Nro Pedido`, `Bultos`, `Peso Kgs`, `Volumen M3`, `Valor Declarado` y `Nro Carta Porte` son celdas numéricas.
  - En el XML, 7 de 24 volúmenes tienen más de 4 decimales, por el ruido de punto flotante de Excel, y 2 están en notación científica.
  - 3 de 24 valores declarados tienen más de 2 decimales.
  - Ningún volumen redondea a 0 con 4 decimales.
- **El libro tiene dos hojas** (`SIN COBERTURA`, `Canalizador`); los pedidos están en la primera.

## Comparación columna por columna (propuesta)

`origenKey` = encabezado normalizado con `_` (regla actual de `headers.ts`). "Propuesta" es una recomendación del redactor: lo que tiene `P-n` depende de la respuesta a esa pregunta.

| #   | Encabezado real          | Hoy               | Propuesta                      | Nota (conteos sobre 24 filas)                                    |
| --- | ------------------------ | ----------------- | ------------------------------ | ---------------------------------------------------------------- |
| 0   | Empresa:                 | desconocida       | `origen_tms.empresa`           | 6 distintos. ¿Fuente de la sucursal? (P-4)                       |
| 1   | Nro Pedido:              | `nro_pedido`      | `nro_pedido`                   | Número de Excel → string entero (P-9). 24 distintos              |
| 2   | Fecha de recepcion:      | desconocida       | `fecha_interfaz` (P-6)         | Texto `dd/MM/yyyy`; 23/24                                        |
| 3   | Código de Referencia:    | `origen_tms`      | `origen_tms`                   |                                                                  |
| 4   | Nro Remito:              | desconocida       | `origen_tms.nro_remito`        |                                                                  |
| 5   | Estado Entrega:          | desconocida       | `origen_tms`                   | (P-12)                                                           |
| 6   | Estado General:          | desconocida       | `origen_tms`                   | (P-12)                                                           |
| 7   | Estado del Pedido:       | desconocida       | `origen_tms`                   | 4 distintos (P-12)                                               |
| 8   | Fecha Estado:            | desconocida       | `origen_tms`, fecha            | Serie de Excel (P-9)                                             |
| 9   | Tipo Servicio:           | desconocida       | `origen_tms`                   | Antes "Tipo de Servicio"                                         |
| 10  | Categoría:               | `origen_tms`      | `origen_tms`                   |                                                                  |
| 11  | Sub Categoría:           | `origen_tms`      | `origen_tms`                   | Vacía                                                            |
| 12  | Fecha Programado:        | desconocida       | `origen_tms`, fecha            | Vacía                                                            |
| 13  | Hora Incial:             | desconocida       | `origen_tms`                   | Vacía (el encabezado real trae la errata "Incial")               |
| 14  | Hora Final:              | desconocida       | `origen_tms`                   | Vacía                                                            |
| 15  | Destino:                 | desconocida       | `origen_tms`                   | = `Destinatario:` en 24/24 (P-3)                                 |
| 16  | Dirección:               | `direccion`       | `direccion` (P-3)              | = `Dirección Destinatario:` en 24/24                             |
| 17  | Cod Postal:              | desconocida       | `codigo_postal` (P-3)          | Texto, 4 dígitos 24/24; = `Cod Postal Destinatario:` 24/24       |
| 18  | Localidad:               | `localidad`       | `localidad` (P-3)              | = `Localidad Destinatario:` 24/24                                |
| 19  | Provincia:               | `provincia`       | `provincia` (P-3)              | = `Provincia Destinatario:` 24/24                                |
| 20  | Bultos:                  | desconocida       | `cantidad_bultos`              | Número entero 24/24                                              |
| 21  | Peso Kgs:                | `peso_kgs`        | `peso_kgs`                     | Número; todos > 0                                                |
| 22  | Volumen M3:              | `volumen_m3`      | `volumen_m3`                   | Número; 7 con más de 4 decimales, 2 en notación científica (P-9) |
| 23  | Valor Declarado:         | `valor_declarado` | `valor_declarado`              | Número; 3 con más de 2 decimales (P-9)                           |
| 24  | Valor Contra Reembolso:  | `origen_tms`      | `origen_tms`                   |                                                                  |
| 25  | Deposito de Tránsito:    | desconocida       | `origen_tms`                   | 5/24 (P-4)                                                       |
| 26  | Nro Carta Porte:         | `origen_tms`      | `origen_tms`                   | Número                                                           |
| 27  | Tipo Carta Porte         | desconocida       | `origen_tms`                   |                                                                  |
| 28  | Fecha Carta Porte:       | desconocida       | `origen_tms`, fecha            | Serie de Excel. Antes "Fecha de Carta de Porte"                  |
| 29  | Tipo Operación CP:       | desconocida       | `origen_tms`                   | Distinta de `Tipo Operacion` en 6/24                             |
| 30  | Chofer:                  | `origen_tms`      | `origen_tms`                   |                                                                  |
| 31  | Patente:                 | `origen_tms`      | `origen_tms`                   |                                                                  |
| 32  | Transporte:              | `origen_tms`      | `origen_tms`                   |                                                                  |
| 33  | Tipo Vehículo:           | desconocida       | `origen_tms`                   | Antes "Tipo de Vehículo"                                         |
| 34  | Observación Interna:     | desconocida       | `origen_tms`                   | Texto libre, 5/24 (P-13)                                         |
| 35  | Observación Cliente:     | desconocida       | `origen_tms`                   | Texto libre, 1/24 (P-13)                                         |
| 36  | Expreso:                 | desconocida       | `expreso_manual` (P-10)        | 9/24. Antes "Codigo de Expreso" (D26)                            |
| 37  | Representante:           | `origen_tms`      | `origen_tms`                   |                                                                  |
| 38  | Fecha Alta               | desconocida       | `origen_tms`, fecha            | Serie de Excel. Antes "Fecha de Alta"                            |
| 39  | Liquidado                | desconocida       | `origen_tms`                   |                                                                  |
| 40  | Nro Liquidacion          | desconocida       | `origen_tms`                   | Vacía. Antes "Nro de Liquidación"                                |
| 41  | Fecha Liquidado          | desconocida       | `origen_tms`, fecha            | Vacía                                                            |
| 42  | Tipo Operacion           | desconocida       | `origen_tms`                   | Antes "Tipo de Operación"                                        |
| 43  | Orden de Retiro:         | desconocida       | `origen_tms`                   | Vacía                                                            |
| 44  | Remitente:               | desconocida       | `origen_tms`                   | 9 distintos                                                      |
| 45  | Dirección Remitente:     | desconocida       | `origen_tms`                   |                                                                  |
| 46  | Cod Postal Remitente:    | desconocida       | `codigo_postal_origen`         | Texto, 4 dígitos 24/24                                           |
| 47  | Localidad Remitente:     | desconocida       | **campo nuevo** (P-8)          | = localidad del canalizador del CP remitente 24/24               |
| 48  | Provincia Rtte:          | desconocida       | **campo nuevo** (P-8)          | = provincia del canalizador del CP remitente 24/24               |
| 49  | Zona Remitente:          | desconocida       | `zona_origen` (P-5)            | 4 distintos; no coincide con ZONA ni CABECERA del canalizador    |
| 50  | Destinatario:            | `destinatario`    | `destinatario`                 |                                                                  |
| 51  | Dirección Destinatario:  | desconocida       | `origen_tms` (P-3)             |                                                                  |
| 52  | Cod Postal Destinatario: | desconocida       | `origen_tms` (P-3)             | Número                                                           |
| 53  | COBERTURA                | desconocida       | **ignorar** (P-2)              | Fórmula manual sobre la hoja `Canalizador`                       |
| 54  | Localidad Destinatario:  | desconocida       | `origen_tms` (P-3)             |                                                                  |
| 55  | Provincia Destinatario:  | desconocida       | `origen_tms` (P-3)             |                                                                  |
| 56  | Zona Destinatario:       | desconocida       | `zona_destino_importada` (D15) | 7 distintos                                                      |
| 57  | Tag:                     | desconocida       | `origen_tms`                   | Vacía                                                            |

**De las 47 columnas actuales, 30 no vienen en el archivo nuevo**, ni siquiera con otro nombre exacto: Código de Empresa, Código ERP, Tipo de Operación, Tipo de Servicio, **Peso Aforado**, **Cantidad de Bultos**, Tipo de Vehículo, Nro de Liquidación, Fecha de Liquidación, Id Tarifa, Valor Calculado Tarifa, Valor Calculado Seguro, Valor Calculado Reembolso, Total a Facturar, Status, Fecha Status, **Fecha de Interfaz**, **Zona Origen**, **Cabecera Origen**, Número, **Código Postal**, Zona Destino, Cabecera, Fecha de Alta, Código de Dock, Codigo de Expreso, Fecha de Carta de Porte, Usuario Liquidación, IdLiquidacion y **Código Postal Origen**. En negrita, las obligatorias. Las opcionales `alto_cm`, `ancho_cm` y `largo_cm` (D12) tampoco vienen.

## PREGUNTAS

Franco responde antes de dar el OK. Las recomendaciones son del redactor.

1. **¿Reemplaza o convive?** ¿El formato de 58 columnas **reemplaza** al de 47 (`pedidos_tms.csv`, MVP-04) o **se suman** los dos? Las 47 columnas son también las del **reporte de liquidación** (§3.5, MVP-26: "las 47 de §7.4 en su orden original") y de la plantilla oficial (§3.2, D12), y figuran en la documentación funcional §7.4.
   - **Recomendación:** que reemplace, con una sola lista canónica en `headers.ts` (el espíritu de D37). Definir aparte qué columnas lleva el reporte de liquidación: las del archivo nuevo, o una lista propia del reporte.
2. **`COBERTURA` y la hoja `Canalizador`.** ¿El archivo que se importa es el export crudo, sin esos agregados manuales?
   - **Recomendación:** el sistema calcula la cobertura con su canalizador (§3.3 paso 1), así que `COBERTURA` se **ignora** y no se guarda. Se lee solo la **primera hoja**, o la que tenga los encabezados reconocidos.
3. **¿Cuál es el destino de entrega?** Hay dos bloques idénticos en la muestra (`Cod Postal`/`Localidad`/`Provincia`/`Dirección`/`Destino` y los `… Destinatario`).
   - **Recomendación:** el primero alimenta `codigo_postal`, `localidad`, `provincia` y `direccion` (es texto y conserva los CP como string), y el segundo va a `origen_tms`.
   - **Opcional:** si en un pedido los dos bloques difieren, agregar una observación. Eso implica un código nuevo en `OBSERVATION_CODES`; sin código nuevo, no se compara.
4. **`cabecera_origen` (sucursal del pedido, obligatoria).** No hay ninguna columna equivalente. Opciones:
   - (a) la sucursal elegida al importar el lote. El lote ya lleva `sucursal_id`, y §2.4 exige que `cabecera_origen` esté entre las sucursales del usuario.
   - (b) derivarla de `Empresa:` o de `Deposito de Tránsito:` con una tabla de equivalencias.
   - (c) derivarla del canalizador del CP remitente (`CABECERA`).
   - **Recomendación:** (a). Es lo único que no depende de datos que hoy no coinciden.
5. **`zona_origen`.** ¿`Zona Remitente` es la zona de origen? No coincide con la `ZONA` del canalizador (0 de 24).
   - **Recomendación:** mapearla igual a `zona_origen`, que es informativa, y dejar de exigirla si puede venir vacía.
6. **`fecha_interfaz`.** ¿`Fecha de recepcion` es la fecha de interfaz? Una de 24 viene vacía: hoy eso es `CAMPO_OBLIGATORIO` y el pedido queda `CON_ERROR`.
   - **Recomendación:** mapearla. Que sea obligatoria lo decide Franco: §2.4 la marca como informativa.
7. **`peso_aforado`.** No viene en el archivo. §2.4 dice que no interviene en el cálculo; solo genera las observaciones `AFORADO_CERO` y `AFORADO_MENOR_A_PESO`.
   - **Recomendación:** que pase a **opcional** en `orderImportSchema` y en `headers.ts`. Sin el dato, esas observaciones no se generan.
8. **Remitente (D-1).** Nombres de los campos nuevos para `Localidad Remitente` y `Provincia Rtte`, y su normalización.
   - **Propuesta:** campos crudos `localidad_remitente` y `provincia_remitente` en `orderImportSchema`, más `localidad_remitente_norm` (`norm`) y `provincia_remitente_norm` (`normProvincia(..., { contraCanalizador: true })`), validados en `orderSchema` como D33/D34. El motor resuelve el origen así: CP → localidad → provincia contra el canalizador.
   - **Aviso:** ¿con qué **código** va el aviso "revisar el canalizador" cuando no coinciden? `OBSERVATION_CODES` es cerrado. Hay que elegir entre un código nuevo (por ejemplo `ORIGEN_DIFIERE_CANALIZADOR`) o reusar uno existente.
   - Los `provincia_origen` y `localidad_origen` actuales de `orderSchema` siguen siendo los resueltos.
9. **Celdas nativas de Excel (amplía D28).** Regla de conversión cuando la celda es número o fecha de Excel y no texto:
   - **Montos y magnitudes:** número → `dec` con half-up a 4 decimales; `valor_declarado` → `cents` con half-up. Absorbe el ruido de punto flotante y la notación científica.
   - **Enteros** (`Nro Pedido`, `Bultos`): número → string entero, rechazando si tiene decimales.
   - **Fechas:** número de serie → `yyyy-MM-dd` (sistema 1900, sin huso).
   - **Dónde se convierte:** en el lector (MVP-17, que entrega strings al parser) o en `shared` (el parser acepta los dos tipos).
   - **Recomendación:** convertir en `shared`, con una función pura y testeada, para que `checkTmsFile` y MVP-17 usen la misma.
10. **`Expreso:` → `expreso_manual`** (D26). ¿Es el mismo dato que el viejo "Codigo de Expreso"? En la muestra viene en 9 de 24.
11. **`checkTmsFile` con xlsx.** Hoy lee solo CSV (`csv-parse`). Opciones:
    - Franco exporta el xlsx a CSV para chequear.
    - Se agrega lectura de xlsx (SheetJS, la librería que ya prevé MVP-17). Es una dependencia nueva: `CR: deps` aparte.
12. **Estados del pedido.** El archivo trae `Estado Entrega`, `Estado General` y `Estado del Pedido` (4 valores distintos en la muestra). ¿Se importan todas las filas, o hay estados que no se valorizan, por ejemplo entregados o anulados?
    - **Recomendación:** importar todas en este CR y definir el filtro en MVP-17 si hace falta.
13. **Texto libre con posibles datos personales.** `Observación Interna`, `Observación Cliente`, `Remitente`, `Dirección Remitente` y los `Destinatario` quedan en `origen_tms`, como ya pasa con destinatario y dirección: mismo tratamiento de Ley 25.326. ¿Alguna de esas columnas **no** se debería guardar?

## Alcance tentativo (se ajusta con las respuestas)

1. **`headers.ts`:** nueva lista canónica de columnas, en el orden del archivo real, con su `field`, `kind` y `required` según las respuestas. Equivalencias de nombre solo si se decide convivir (P-1). Las columnas ignoradas (P-2) se declaran explícitamente para que no cuenten como desconocidas.
2. **`orderRow.ts`:** mapeo de los campos nuevos y de los renombrados; regla de P-3 para el destino; `peso_aforado` opcional (P-7); conversión de celdas nativas (P-9); `cabecera_origen` según P-4.
3. **`schemas/orders.ts`:** campos del remitente y su `_norm` (P-8); `peso_aforado` opcional; validaciones de derivación como D34.
4. **`errors.ts`:** el código del aviso de D-1 y el de P-3, solo si Franco los aprueba.
5. **Fixture sintético y `generateTmsFixture.ts`:** con el layout nuevo, sin datos reales y con CUIT inventados. Tests de: encabezados, cada equivalencia, celdas nativas (incluidos el ruido de punto flotante, la notación científica y las fechas de serie), duplicado de destino y remitente.
6. **`checkTmsFile.ts`:** según P-11.
7. **Documentación** (archivos compartidos, en el mismo CR):
   - `docs/arquitectura-v3.md`: §2.4 (tabla), §3.2 (plantilla), §3.5 (columnas del reporte, según P-1), D12, D28 (celdas nativas), D36 ("las 47 columnas") y D37 (nueva lista).
   - `docs/ola-0/estado-y-decisiones.md`: supuestos.
   - La documentación funcional §7.4 la actualiza Franco.

## Impacto en otros tickets

| Ticket           | Impacto                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| MVP-04 (cerrado) | El criterio "lee `pedidos_tms.csv` (538 filas) sin errores de formato" queda obsoleto si se reemplaza el formato (P-1).                          |
| CR-02 (D36)      | "`origen_tms` guarda las 47 columnas en los pedidos con error" pasa a "todas las columnas del formato vigente".                                  |
| MVP-13           | El motor recibe los campos del remitente para el desempate de D-1 (`MotorOrderInput`). Mientras tanto, se resuelve solo por CP.                  |
| MVP-17           | Parser e importación: el criterio que menciona `pedidos_tms.csv` se reescribe con el archivo nuevo. Lectura de xlsx y de la hoja correcta (P-2). |
| MVP-19           | La exportación de filas con error sale de `origen_tms` con el layout nuevo.                                                                      |
| MVP-26           | Las columnas del reporte de liquidación (hoy "las 47 + 8 técnicas"), según P-1.                                                                  |

## Criterio de aceptación (propuesto)

1. `resolveTmsHeaders` sobre los 58 encabezados del archivo real da **0 errores de archivo** y **0 desconocidas**, salvo las declaradas como ignoradas. Test con los encabezados, que no son datos personales.
2. `checkTmsFile` sobre el archivo real (lo corre Franco; el archivo no entra al repo) imprime solo conteos y da **0 errores `FORMATO_INVALIDO`** atribuibles al formato. Los errores de dato (por ejemplo, la `Fecha de recepcion` vacía si sigue siendo obligatoria) se reportan con su código y no cuentan como fallo. Conviene correrlo también sobre un archivo de más de 24 filas.
3. Celdas nativas: tests con números con ruido de punto flotante (`0.30000000000000004` → `"0.3"`), notación científica, valores que redondean a 0 (→ error de dato, no de formato) y fechas de serie de Excel en los bordes de mes y año.
4. Si se decide convivir (P-1), `pedidos_tms.csv` sigue dando 538 filas sin errores de formato.
5. Ningún esquema ni tipo duplicado fuera de `shared`. Ningún dato real en el repo.
6. Secuencia de `AGENTS.md` §5.5 en verde, con la salida pegada, y prueba de consumo: el `dist` de `shared` se importa con Node y `parseTmsRow` procesa una fila sintética del layout nuevo.

## Plan

<lo completa el agente asignado, después de las respuestas de Franco y antes de codear; Franco da el OK>

---

## Nota de entrega (la completa el agente al terminar)

Usar la plantilla de `tickets/_TEMPLATE.md`.
