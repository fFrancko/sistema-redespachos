// Agregado 8 de MVP-14 y criterio de §4: sin km ni paradas (D1) y sin `number` para dinero.
// Vive fuera de `src` para que la búsqueda sobre `src` no se encuentre a sí misma.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

const archivos = listFiles(SRC).filter((f) => f.endsWith('.ts'));
const fuentes = archivos.filter((f) => !f.endsWith('.test.ts'));

// Literal del ticket, sobre todo `src` (tests incluidos).
const PROHIBIDOS: Array<[string, RegExp]> = [
  ['km', /km/i],
  ['parada', /parada/i],
  ['Number(', /Number\(/],
  ['parseFloat', /parseFloat/],
];

// En el código (no en los tests), además, ninguna conversión de Decimal a number.
const CONVERSIONES = /parseInt|Math\.|\.toNumber\(|\bNumber\b/;

// Montos del motor: campos de §2.3, §2.4 y §3.3 y sus alias en el código.
const MONTO =
  '(?:costo_\\w+|precio_\\w+|flete|colecta|seguro|neto|iva|total|valor_declarado|valorDeclarado|porcentaje\\w*|excedente)';
// Operador aritmético binario (o compuesto) pegado a un monto, de cualquiera de los dos lados.
const ARITMETICA = new RegExp(
  `(?:\\b${MONTO}\\b\\s*[-+*/%]=?\\s*[\\w(.])|(?:[\\w)\\]]\\s*[-+*/%]=?\\s*(?:\\w+\\.)*${MONTO}\\b)`,
);

// Quita comentarios y literales de texto para no marcar la documentación ni el detalle_tarifa.
function codeOnly(fuente: string): string {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

function aritmeticaSobreMontos(fuente: string): string[] {
  return codeOnly(fuente)
    .split('\n')
    .filter((linea) => ARITMETICA.test(linea));
}

describe('Guardas del motor (MVP-14, agregado 8)', () => {
  it('la búsqueda recorre los archivos de src', () => {
    const nombres = fuentes.map((f) => relative(SRC, f).replace(/\\/g, '/'));
    expect(nombres).toEqual(expect.arrayContaining(['calculo.ts', 'cotizar.ts', 'tramos.ts']));
  });

  it.each(PROHIBIDOS)('ningún archivo de src contiene %s', (_, patron) => {
    const conCoincidencias = archivos.filter((f) => patron.test(readFileSync(f, 'utf-8')));
    expect(conCoincidencias).toEqual([]);
  });

  it('el código no convierte montos a number', () => {
    const conCoincidencias = fuentes.filter((f) =>
      CONVERSIONES.test(codeOnly(readFileSync(f, 'utf-8'))),
    );
    expect(conCoincidencias).toEqual([]);
  });

  it('el código no hace aritmética sobre montos fuera de Decimal', () => {
    const hallazgos = fuentes.flatMap((f) =>
      aritmeticaSobreMontos(readFileSync(f, 'utf-8')).map(
        (l) => `${relative(SRC, f)}: ${l.trim()}`,
      ),
    );
    expect(hallazgos).toEqual([]);
  });

  it('el detector marca la aritmética con number y acepta la de Decimal', () => {
    const malos = [
      'const total = neto + iva;',
      'const neto = costo.flete + colecta;',
      'total += 1;',
      'const iva = neto * 21 / 100;',
      'const x = a.total - b.total;',
      'const exc = (kg - tope) * precio_kg_excedente;',
      'return seguro * 2;',
    ];
    for (const linea of malos) expect(aritmeticaSobreMontos(linea)).toEqual([linea]);

    const buenos = [
      'const total = neto.plus(iva);',
      'const iva = roundToCent(neto.times(decToDecimal(proveedor.iva_porcentaje)).div(100));',
      'a.total.comparedTo(b.total) ||',
      'const texto = `${criterio}: tramo ${formatMoney(precio)}`;',
      'excedente: valor.minus(tope),',
      '// neto = flete + colecta + seguro',
    ];
    for (const linea of buenos) expect(aritmeticaSobreMontos(linea)).toEqual([]);
  });
});
