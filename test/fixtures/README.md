# Fixtures de prueba

Excel **sintéticos** que replican la forma de los archivos reales de los
transportes. Permiten verificar el transformador de punta a punta sin exponer
datos comerciales de ningún cliente. Los archivos generados
(`input/*.xlsx`, `bad/*.xlsx`) están versionados; los generadores también.

## Reproducir todo

```bash
npm install
npm run fixtures    # regenera input/*.xlsx y bad/*.xlsx
npm test            # unitarios + CLI contra estos fixtures
```

Por separado:

```bash
npx tsx test/fixtures/generar-fixtures.ts   # crea input/cobertura.xlsx e input/tarifas.xlsx
npx tsx test/fixtures/bad-gen.ts            # crea bad/*.xlsx (casos que deben fallar)
```

## Correr el transformador contra los fixtures

```bash
npm run transformar-tarifas -- \
  --proveedor=EXPRESO_ALFA \
  --cobertura=./test/fixtures/input/cobertura.xlsx \
  --tarifas=./test/fixtures/input/tarifas.xlsx \
  --output=./test/fixtures/output/tabla_maestra.json
```

`output/` está ignorado por git: es un resultado, no un fixture. Esperado:
48 reglas, 8 duplicados eliminados y un aviso por la zona `z9` (sin tarifa).

## Casos de `input/cobertura.xlsx`

| Caso | Qué verifica |
| --- | --- |
| `Buenos Aires / Palermo` | Partición de `Origen` en provincia + localidad |
| `Mendoza` (sin localidad) | `localidad_origen` queda como `"*"` |
| Río Cuarto con dos códigos postales | Deduplicación: el CP no es parte de `ReglaTarifa` |
| Zona Facturación 9 | Zona sin tarifa: avisa y omite; con `--estricto` falla |

## Casos de `input/tarifas.xlsx`

Los rangos se normalizan a `(min, max]`. Los precios en texto (`$ 1.500,50`,
`3.300,00`) y numéricos nativos (`2400`, `2900.75`) dan el mismo resultado.

| Fila del Excel | Resultado esperado |
| --- | --- |
| `0 a 10 kg` | `kg_min=0`, `kg_max=10`, `precio_kg_base` |
| `10 a 25 kg` | `kg_min=10`, `kg_max=25` (no solapa con el anterior) |
| `25 a 50 kg` | `kg_min=25`, `kg_max=50` |
| `> 50 kg` | `kg_min=kg_max=50`, `precio_kg_excedente` (sin base) |
| `0 a 0,5 m3` … `1 a 2,5 m3` | `m3_min`/`m3_max`; la coma decimal pasa a punto |
| `> 2,5 m3` | `m3_min=m3_max=2.5`, `precio_m3_excedente` |

Los tarifarios de topes acumulados (`Hasta KG`), las hojas en otro orden y la
zona `Buenos Aires` se cubren en `test/transformar.test.ts`, que arma esos
Excel al vuelo.

## Casos de `bad/` (deben fallar con error de ingesta, código 1)

| Archivo | Falla |
| --- | --- |
| `cob.xlsx` | `Destino Provincia` vacío |
| `tar_precio.xlsx` | precio `N/D` no numérico |
| `tar_rango.xlsx` | celda de rango vacía |
| `tar_inv.xlsx` | rango invertido `100 a 50 kg` |
| `tar_neg.xlsx` | precio negativo |
| `tar_solape.xlsx` | rangos solapados `0 a 10` y `5 a 20` |
| `tar_pct.xlsx` | precio expresado como porcentaje |

## Herramientas para trabajar con Excel reales de transportes

Los tres scripts reciben las rutas por argumento: no llevan rutas ni nombres de
clientes fijos.

`inspeccionar.ts` — vuelca un Excel tal como lo ve el script. Es el primer
paso: muestra hojas, encabezados reales, y distingue números (`#123`), texto
(`"abc"`) y celdas vacías (`∅`).

```bash
npx tsx test/fixtures/inspeccionar.ts "<ruta>/Cobertura.xlsx" 15
```

`perfilar.ts` — perfila un par cobertura + tarifario del mismo transporte:
orígenes, zonas, si el rango es de topes acumulados o de intervalos, y columnas
de zona idénticas entre sí.

```bash
npx tsx test/fixtures/perfilar.ts "<cobertura.xlsx>" "<tarifas.xlsx>"
```

`verificar.ts` — valida una tabla maestra ya generada: importes como strings
decimales, campos coherentes por tipo de regla, rangos `(min, max]` contiguos y
sin solapes, documentos no duplicados. Con `--tarifas` contrasta además los
precios contra el Excel original. Sale con código 1 si hay problemas.

```bash
npx tsx test/fixtures/verificar.ts test/fixtures/output/tabla_maestra.json
npx tsx test/fixtures/verificar.ts salida.json --tarifas="<tarifas.xlsx>" --hoja-peso="HOJA PESO"
```

`analizar.ts` — análisis de negocio sobre una tabla maestra: distribución de
precios por zona, cantidad de tramos, huecos y solapamientos entre rangos, y si
los precios crecen de forma monótona con el peso. Es la herramienta para
detectar errores en el tarifario del transporte (un precio que baja al
aumentar el peso, un tramo que no cierra).

```bash
npx tsx test/fixtures/analizar.ts ./output/tabla.json "Nombre proveedor"
```

`ver-excel.ts` — vuelca un Excel generado a la consola, para revisarlo sin
abrirlo o para comparar dos salidas.

```bash
npx tsx test/fixtures/ver-excel.ts ./output/tarifa_por_proveedor.xlsx 20
```

## Exportar a Excel

`packages/shared/scripts/exportar-excel.ts` convierte una o más tablas maestras
en un libro de Excel con filtro y anchos de columna, pensado para que
operaciones y comercial revisen precios sin escribir consultas.

```bash
npm run exportar-excel -- --tabla=./output/hacha.json --output=./output/tarifa.xlsx
```

Varias tablas en el mismo libro produce una hoja `Tarifa por proveedor` con una
columna por transporte, que es la vista de comparación entre proveedores:

```bash
npm run exportar-excel -- \
  --tabla=./output/expreso_alfa.json --tabla=./output/hacha.json \
  --output=./output/tarifa_por_proveedor.xlsx
```

Hojas generadas: `Resumen` (origen, conteos, resolución de zonas, descartadas,
avisos), `Tarifa por proveedor`, una matriz `PESO`/`VOLUMEN` por proveedor con
una columna por zona, y `Reglas` con los importes como texto decimal exacto para
auditar contra el JSON.

En las hojas de precios los importes se escriben como número para que se puedan
sumar y ordenar; en la hoja `Reglas` van como texto, igual que en el JSON.

## Formatos de tarifario soportados

El transformador maneja el formato de Hacha de Piedra y el de los fixtures
sintéticos: cobertura con origen, destino y zona; tarifario con una columna por
zona de facturación.

**No** maneja todavía el formato de Logicargo, que es distinto: su cobertura no
tiene columnas `Origen` ni `Zona Facturacion` (tiene `Provincia`, `Localidad`,
`C.P.`), y su tarifario usa `DESDE`/`HASTA` en dos columnas en vez de un tope
único, sin hoja de volumen. El script falla con un error explícito de columna no
encontrada, que es el comportamiento correcto: conviene escribir un adaptador
antes que forzar el mismo.
