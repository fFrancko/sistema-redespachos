// MVP-15: actualización explícita de un caso dorado.
//   pnpm --filter @sistema-redespachos/motor golden:update -- --caso <id> --motivo "<texto>"
// Recalcula la `salida` de ese caso con el motor compilado, la reescribe y deja el motivo y la
// nueva huella en test/golden/CHANGELOG.md. Sin este paso, el runner falla en CI.
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  CHANGELOG,
  GoldenError,
  cargarMotor,
  comoJson,
  diferencias,
  ejecutar,
  escribirCaso,
  formatear,
  leerCaso,
  registrarEnChangelog,
  rutaCaso,
} from './golden-lib.js';

await ejecutar(async (argv) => {
  let opciones;
  try {
    opciones = parseArgs({
      args: argv,
      options: { caso: { type: 'string' }, motivo: { type: 'string' } },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (e) {
    throw new GoldenError(`${e.message}. Uso: golden:update -- --caso <id> --motivo "<texto>"`);
  }

  const id = opciones.caso?.trim();
  const motivo = opciones.motivo?.trim();
  if (!id) throw new GoldenError('falta --caso <id>');
  if (!motivo) throw new GoldenError('falta --motivo "<texto>": toda actualización lleva motivo');
  if (!existsSync(rutaCaso(id))) throw new GoldenError(`no existe el caso ${id}`);

  const { cotizar } = await cargarMotor();
  const caso = leerCaso(id);
  if (caso.id !== id) throw new GoldenError(`el archivo ${id}.json tiene id ${caso.id}`);

  const salida = comoJson(cotizar(caso.entrada.pedido, caso.entrada.contexto));
  const cambios = diferencias(caso.salida, salida);
  const actualizado = { ...caso, salida };

  escribirCaso(actualizado);
  registrarEnChangelog(id, actualizado, motivo);
  formatear([rutaCaso(id), CHANGELOG]);

  console.log(`golden: caso ${id} actualizado (${cambios.length} campos de la salida cambiaron)`);
  for (const c of cambios) console.log(`  ${c}`);
});
