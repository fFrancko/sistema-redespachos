/**
 * Genera archivos de Excel de ejemplo para verificar el transformador
 * end-to-end. No forma parte de la ingesta real.
 *
 *   npx tsx test/fixtures/generar-fixtures.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as XLSX from 'xlsx';

const dir = resolve('test/fixtures/input');
mkdirSync(dir, { recursive: true });

// --- Cobertura -----------------------------------------------------------
const cobertura = [
  ['Origen', 'Destino Provincia', 'Destino Localidad', 'Codigo Postal', 'Zona Facturacion', 'Tiempo de Entrega'],
  ['Buenos Aires / Palermo', 'Cordoba', 'Cordoba Capital', '5000', 'Zona Facturacion 1', '24hs'],
  ['Buenos Aires / Palermo', 'Cordoba', 'Villa Carlos Paz', '5152', 'Zona Facturacion 2', '48hs'],
  ['Buenos Aires / Palermo', 'Cordoba', 'Rio Cuarto', '5800', 'Zona Facturacion 3', '72hs'],
  // Misma ruta repetida con otro CP: debe colapsar en el mismo documento.
  ['Buenos Aires / Palermo', 'Cordoba', 'Rio Cuarto', '5801', 'Zona Facturacion 3', '72hs'],
  ['CABA / Once', 'Santa Fe', 'Rosario', '2000', 'Zona Facturacion 1', '24hs'],
  ['CABA / Once', 'Santa Fe', 'Rosario', '2000', 'Zona Facturacion 4', '24hs'],
  // Origen solo con provincia -> localidad_origen = "*"
  ['Mendoza', 'San Juan', 'San Juan Capital', '5400', 'Zona Facturacion 2', '48hs'],
  // Zona sin precio en el tarifario -> debe avisar
  ['Mendoza', 'San Juan', 'Caucete', '5412', 'Zona Facturacion 9', '96hs'],
];

const wbCobertura = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  wbCobertura,
  XLSX.utils.aoa_to_sheet(cobertura),
  'Cobertura',
);
writeFileSync(resolve(dir, 'cobertura.xlsx'), XLSX.write(wbCobertura, { type: 'buffer' }));

// --- Tarifario -----------------------------------------------------------
const peso = [
  ['Rango de kilos', 'Zona facturación 1', 'Zona facturación 2', 'Zona facturación 3', 'Zona facturación 4'],
  ['0 a 10 kg', '$ 1.500,50', '$ 1.800,00', '$ 2.100,00', '$ 2.400,00'],
  ['10 a 25 kg', 2400, 2900.75, 3400, 3900],
  ['25 a 50 kg', '3.300,00', '3.900,00', '4.500,00', '5.100,00'],
  ['> 50 kg', '450,00', '520,50', '610,00', '700,00'],
];

const volumen = [
  ['Rango de m3', 'Zona facturación 1', 'Zona facturación 2', 'Zona facturación 3', 'Zona facturación 4'],
  ['0 a 0,5 m3', '2.100,00', '2.400,00', '2.700,00', '3.000,00'],
  ['0,5 a 1 m3', '3.200,00', '3.600,00', '4.000,00', '4.400,00'],
  ['1 a 2,5 m3', '5.500,00', '6.200,00', '6.900,00', '7.600,00'],
  ['> 2,5 m3', '1.100,00', '1.250,00', '1.400,00', '1.550,00'],
];

const wbTarifas = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbTarifas, XLSX.utils.aoa_to_sheet(peso), 'Tarifas por Peso');
XLSX.utils.book_append_sheet(wbTarifas, XLSX.utils.aoa_to_sheet(volumen), 'Tarifas por Volumen');
writeFileSync(resolve(dir, 'tarifas.xlsx'), XLSX.write(wbTarifas, { type: 'buffer' }));

process.stdout.write(`Fixtures generadas en ${dir}\n`);
