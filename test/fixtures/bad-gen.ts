/**
 * Genera en `test/fixtures/bad/` Excel invalidos que el transformador debe
 * rechazar con un error de ingesta (codigo de salida 1). Los usa
 * `test/transformar.test.ts`.
 *
 *   npx tsx test/fixtures/bad-gen.ts
 *
 * Cada archivo se combina con el fixture valido del otro lado:
 *   cob.xlsx        cobertura con "Destino Provincia" vacio
 *                   (se combina con input/tarifas.xlsx)
 *   tar_precio.xlsx precio "N/D" no numerico
 *   tar_rango.xlsx  celda de rango vacia
 *   tar_inv.xlsx    rango invertido "100 a 50 kg"
 *   tar_neg.xlsx    precio negativo
 *   tar_solape.xlsx rangos solapados "0 a 10" y "5 a 20"
 *   tar_pct.xlsx    precio expresado como porcentaje
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import XLSX from 'xlsx';

const dir = resolve('test/fixtures/bad');
mkdirSync(dir, { recursive: true });

const escribir = (nombre: string, filas: unknown[][]): void => {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas), 'H');
  writeFileSync(resolve(dir, nombre), XLSX.write(libro, { type: 'buffer' }));
};

const ENC = ['Rango de kilos', 'Zona facturación 1'];

escribir('cob.xlsx', [
  ['Origen', 'Destino Provincia', 'Destino Localidad', 'Zona Facturacion'],
  ['BA', '', 'Capital', 'Zona Facturacion 1'],
]);
escribir('tar_precio.xlsx', [ENC, ['0 a 10 kg', 'N/D']]);
escribir('tar_rango.xlsx', [ENC, [null, '1000']]);
escribir('tar_inv.xlsx', [ENC, ['100 a 50 kg', '1000']]);
escribir('tar_neg.xlsx', [ENC, ['0 a 10 kg', '-500']]);
escribir('tar_solape.xlsx', [ENC, ['0 a 10 kg', '1000'], ['5 a 20 kg', '2000']]);
escribir('tar_pct.xlsx', [ENC, ['0 a 10 kg', '12%']]);

process.stdout.write(`Fixtures invalidos generados en ${dir}\n`);
