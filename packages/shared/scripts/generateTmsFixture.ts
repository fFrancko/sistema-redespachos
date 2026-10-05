// Genera el fixture sintético del TMS. Todos los datos son inventados (regla 8 de AGENTS.md).
// Uso: pnpm --filter @sistema-redespachos/shared tms:fixture
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TMS_ALL_COLUMNS } from '../src/tms/headers.js';

type Overrides = Readonly<Record<string, string>>;

const OUTPUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../test/fixtures/pedidos_tms_sintetico.csv',
);

// Encabezados: la plantilla real trae `:` final; algunos se alteran a propósito para ejercitar
// la normalización (sin dos puntos, mayúsculas, sin tildes).
const HEADER_OVERRIDES: Readonly<Record<string, string>> = {
  'Nro Pedido': 'Nro Pedido',
  'Peso Kgs': 'PESO KGS:',
  'Código Postal': 'Codigo Postal:',
};

function headerLabel(header: string): string {
  return HEADER_OVERRIDES[header] ?? `${header}:`;
}

const pad = (n: number): string => String(n).padStart(4, '0');

function baseRow(n: number): Record<string, string> {
  return {
    'Código de Empresa': 'EMP01',
    'Código ERP': `ERP-${pad(n)}`,
    'Tipo de Operación': 'SALIDA',
    'Nro Pedido': `SINT-${pad(n)}`,
    'Tipo de Servicio': 'NORMAL',
    Categoría: 'GENERAL',
    'Sub Categoria': 'VARIOS',
    'Código de Referencia': `REF-${pad(n)}`,
    'Peso Kgs': '12.50',
    'Volumen M3': '0.08',
    'Peso Aforado': '20.00',
    'Cantidad de Bultos': '2',
    'Valor Declarado': '45,000.00',
    'Valor Contra Reembolso': '0.00',
    'Tipo de Vehículo': 'UTILITARIO',
    'Nro de Liquidación': '',
    'Fecha de Liquidación': '',
    'Id Tarifa': '',
    'Valor Calculado Tarifa': '1,250.50',
    'Valor Calculado Seguro': '0.00',
    'Valor Calculado Reembolso': '0.00',
    'Total a Facturar': '1,250.50',
    Status: 'Pendiente',
    'Fecha Status': '01/10/2026 10:15:30',
    'Fecha de Interfaz': '30/09/2026',
    'Zona Origen': 'ZONA CENTRO',
    'Cabecera Origen': 'SUCURSAL NORTE',
    Destinatario: `CLIENTE SINTETICO ${pad(n)}`,
    Dirección: `CALLE INVENTADA ${100 + n}`,
    Número: String(100 + n),
    'Código Postal': '1406',
    Localidad: 'LOCALIDAD UNO',
    Provincia: 'BUENOS AIRES',
    'Zona Destino': 'ZONA UNO',
    Cabecera: 'CABECERA UNO',
    'Fecha de Alta': '29/09/2026',
    Representante: 'REPRESENTANTE SINTETICO',
    'Código de Dock': 'D1',
    'Codigo de Expreso': 'EXPRESO SINTETICO',
    'Nro Carta Porte': '',
    'Fecha de Carta de Porte': '',
    Transporte: '',
    Chofer: '',
    Patente: '',
    'Usuario Liquidación': '',
    IdLiquidacion: '',
    'Código Postal Origen': '1000',
    alto_cm: '',
    ancho_cm: '',
    largo_cm: '',
  };
}

// Una fila por código de error y por observación intrínseca, más filas válidas.
// Los resultados esperados por fila viven en src/tms/orderRow.test.ts.
const ROW_OVERRIDES: readonly Overrides[] = [
  // 1: válida completa (dimensiones coherentes, liquidación con fecha y hora)
  {
    'Valor Declarado': '349,731.72',
    alto_cm: '50',
    ancho_cm: '40',
    largo_cm: '40',
    'Nro de Liquidación': 'LIQ-0001',
    'Fecha de Liquidación': '15/10/2026 09:30:00',
  },
  // 2: válida; cabecera con otra grafía (se compara con norm)
  { 'Valor Declarado': '1,250.5', 'Cabecera Origen': 'Sucursal  Sur' },
  // 3: CAMPO_OBLIGATORIO (zona_origen)
  { 'Zona Origen': '' },
  // 4: CAMPO_OBLIGATORIO (cabecera_origen vacía)
  { 'Cabecera Origen': '' },
  // 5: FORMATO_INVALIDO (fecha inexistente)
  { 'Fecha de Interfaz': '31/02/2026' },
  // 6: FORMATO_INVALIDO (CP con decimal)
  { 'Código Postal': '1406.0' },
  // 7: FORMATO_INVALIDO (coma decimal ambigua)
  { 'Valor Declarado': '1,5' },
  // 8: PESO_INVALIDO (cero)
  { 'Peso Kgs': '0' },
  // 9: PESO_INVALIDO (vacío)
  { 'Peso Kgs': '' },
  // 10: VOLUMEN_INVALIDO (cero)
  { 'Volumen M3': '0' },
  // 11: CABECERA_NO_PERMITIDA
  { 'Cabecera Origen': 'SUCURSAL OESTE' },
  // 12: VOLUMEN_INCONSISTENTE (1 m3 de control contra 0.08 declarado)
  { alto_cm: '100', ancho_cm: '100', largo_cm: '100' },
  // 13: AFORADO_MENOR_A_PESO
  { 'Peso Aforado': '10.00' },
  // 14: AFORADO_CERO
  { 'Peso Aforado': '0.00' },
  // 15: VALOR_DECLARADO_FALTANTE
  { 'Valor Declarado': '' },
  // 16: dos errores en una fila (peso vacío y CP de origen inválido)
  { 'Peso Kgs': '', 'Código Postal Origen': '14A6' },
  // 17: FORMATO_INVALIDO (cantidad de bultos en 0)
  { 'Cantidad de Bultos': '0' },
  // 18: válida con fecha y hora en Fecha de Interfaz, solo fecha en Fecha Status y peso sin cero entero
  { 'Fecha de Interfaz': '30/09/2026 08:00:00', 'Fecha Status': '01/10/2026', 'Peso Kgs': '.5' },
  // 19: FORMATO_INVALIDO en una columna que va a origen_tms (fecha inexistente)
  { 'Fecha de Alta': '99/99/2026' },
  // 20: válida con miles en el peso, 4 decimales en el volumen y valor declarado 0
  {
    'Peso Kgs': '1,234.50',
    'Peso Aforado': '1,300.00',
    'Volumen M3': '1.2000',
    'Valor Declarado': '0.00',
  },
];

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function buildCsv(): string {
  const lines: string[] = [
    TMS_ALL_COLUMNS.map((column) => csvCell(headerLabel(column.header))).join(','),
  ];
  ROW_OVERRIDES.forEach((overrides, index) => {
    const row = { ...baseRow(index + 1), ...overrides };
    lines.push(TMS_ALL_COLUMNS.map((column) => csvCell(row[column.header] ?? '')).join(','));
  });
  return `${lines.join('\n')}\n`;
}

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, buildCsv(), 'utf8');
console.log(`Fixture escrito: ${ROW_OVERRIDES.length} filas.`);
