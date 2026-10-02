// Columnas del TMS (§7.4, §2.4, D12, D28). Las 47 columnas en su orden original más tres opcionales.

export type TmsColumnKind = 'text' | 'amount' | 'integer' | 'date' | 'cp';

export interface TmsColumn {
  // Encabezado canónico, tal cual en la plantilla oficial (sin los dos puntos finales).
  header: string;
  // Encabezado normalizado: es la clave de reconocimiento.
  key: string;
  // Campo de `pedidos` al que se mapea; null si va al mapa `origen_tms`.
  field: string | null;
  // Nombre snake_case derivado del encabezado normalizado (clave en `origen_tms`).
  origenKey: string;
  kind: TmsColumnKind;
  // Obligatoria para que el archivo sea válido (§2.4); su ausencia es un error de archivo.
  required: boolean;
}

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

// Ignora el `:` final, las tildes, las mayúsculas y los espacios sobrantes (D28).
export function normalizeHeader(header: string): string {
  return header
    .split(BYTE_ORDER_MARK)
    .join('')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*:+$/, '')
    .trim();
}

interface ColumnSpec {
  header: string;
  field?: string;
  kind?: TmsColumnKind;
  required?: boolean;
}

function buildColumn(spec: ColumnSpec): TmsColumn {
  const key = normalizeHeader(spec.header);
  return {
    header: spec.header,
    key,
    field: spec.field ?? null,
    origenKey: key.replace(/ /g, '_'),
    kind: spec.kind ?? 'text',
    required: spec.required ?? false,
  };
}

// Las 47 columnas de §7.4, en orden.
const TMS_COLUMN_SPECS: readonly ColumnSpec[] = [
  { header: 'Código de Empresa' },
  { header: 'Código ERP' },
  { header: 'Tipo de Operación' },
  { header: 'Nro Pedido', field: 'nro_pedido', required: true },
  { header: 'Tipo de Servicio' },
  { header: 'Categoría' },
  { header: 'Sub Categoria' },
  { header: 'Código de Referencia' },
  { header: 'Peso Kgs', field: 'peso_kgs', kind: 'amount', required: true },
  { header: 'Volumen M3', field: 'volumen_m3', kind: 'amount', required: true },
  {
    header: 'Peso Aforado',
    field: 'peso_aforado',
    kind: 'amount',
    required: true,
  },
  {
    header: 'Cantidad de Bultos',
    field: 'cantidad_bultos',
    kind: 'integer',
    required: true,
  },
  { header: 'Valor Declarado', field: 'valor_declarado', kind: 'amount' },
  { header: 'Valor Contra Reembolso' },
  { header: 'Tipo de Vehículo' },
  { header: 'Nro de Liquidación' },
  { header: 'Fecha de Liquidación', kind: 'date' },
  { header: 'Id Tarifa' },
  { header: 'Valor Calculado Tarifa' },
  { header: 'Valor Calculado Seguro' },
  { header: 'Valor Calculado Reembolso' },
  { header: 'Total a Facturar' },
  { header: 'Status' },
  { header: 'Fecha Status', kind: 'date' },
  {
    header: 'Fecha de Interfaz',
    field: 'fecha_interfaz',
    kind: 'date',
    required: true,
  },
  { header: 'Zona Origen', field: 'zona_origen', required: true },
  { header: 'Cabecera Origen', field: 'cabecera_origen', required: true },
  { header: 'Destinatario', field: 'destinatario' },
  { header: 'Dirección', field: 'direccion' },
  { header: 'Número', field: 'numero' },
  {
    header: 'Código Postal',
    field: 'codigo_postal',
    kind: 'cp',
    required: true,
  },
  { header: 'Localidad', field: 'localidad', required: true },
  { header: 'Provincia', field: 'provincia', required: true },
  { header: 'Zona Destino', field: 'zona_destino_importada' },
  { header: 'Cabecera', field: 'cabecera_destino_importada' },
  { header: 'Fecha de Alta', kind: 'date' },
  { header: 'Representante' },
  { header: 'Código de Dock' },
  { header: 'Codigo de Expreso', field: 'expreso_manual' },
  { header: 'Nro Carta Porte' },
  { header: 'Fecha de Carta de Porte', kind: 'date' },
  { header: 'Transporte' },
  { header: 'Chofer' },
  { header: 'Patente' },
  { header: 'Usuario Liquidación' },
  { header: 'IdLiquidacion' },
  {
    header: 'Código Postal Origen',
    field: 'codigo_postal_origen',
    kind: 'cp',
    required: true,
  },
];

// D12: tres columnas opcionales al final de la plantilla.
const TMS_OPTIONAL_COLUMN_SPECS: readonly ColumnSpec[] = [
  { header: 'alto_cm', field: 'alto_cm', kind: 'amount' },
  { header: 'ancho_cm', field: 'ancho_cm', kind: 'amount' },
  { header: 'largo_cm', field: 'largo_cm', kind: 'amount' },
];

export const TMS_COLUMNS: readonly TmsColumn[] = TMS_COLUMN_SPECS.map(buildColumn);
export const TMS_OPTIONAL_COLUMNS: readonly TmsColumn[] =
  TMS_OPTIONAL_COLUMN_SPECS.map(buildColumn);
export const TMS_ALL_COLUMNS: readonly TmsColumn[] = [...TMS_COLUMNS, ...TMS_OPTIONAL_COLUMNS];

export const TMS_COLUMN_BY_KEY: ReadonlyMap<string, TmsColumn> = new Map(
  TMS_ALL_COLUMNS.map((column) => [column.key, column]),
);

export interface TmsFileError {
  campo: string;
  codigo: 'CAMPO_OBLIGATORIO' | 'FORMATO_INVALIDO';
  mensaje: string;
}

export interface TmsHeaderResolution {
  // Encabezado original del archivo → columna reconocida.
  columnas: ReadonlyMap<string, TmsColumn>;
  // Errores a nivel de archivo (columnas obligatorias ausentes, encabezados repetidos).
  errores_archivo: TmsFileError[];
  // Encabezados que no corresponden a ninguna columna conocida.
  desconocidas: string[];
}

// Resuelve los encabezados de un archivo contra las columnas conocidas. La coincidencia es exacta
// sobre el encabezado normalizado, así `Cabecera` y `Cabecera Origen` (o `Código Postal` y
// `Código Postal Origen`) nunca se confunden.
export function resolveTmsHeaders(headers: readonly string[]): TmsHeaderResolution {
  const columnas = new Map<string, TmsColumn>();
  const errores_archivo: TmsFileError[] = [];
  const desconocidas: string[] = [];
  const seen = new Set<string>();

  for (const header of headers) {
    const column = TMS_COLUMN_BY_KEY.get(normalizeHeader(header));
    if (column === undefined) {
      desconocidas.push(header);
      continue;
    }
    if (seen.has(column.key)) {
      errores_archivo.push({
        campo: column.field ?? column.origenKey,
        codigo: 'FORMATO_INVALIDO',
        mensaje: 'Encabezado repetido',
      });
      continue;
    }
    seen.add(column.key);
    columnas.set(header, column);
  }

  for (const column of TMS_ALL_COLUMNS) {
    if (column.required && !seen.has(column.key)) {
      errores_archivo.push({
        campo: column.field ?? column.origenKey,
        codigo: 'CAMPO_OBLIGATORIO',
        mensaje: 'Falta una columna obligatoria',
      });
    }
  }

  return { columnas, errores_archivo, desconocidas };
}
