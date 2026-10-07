// Arma apps/functions/dist/, la carpeta que firebase.json usa como `source` de Functions (MVP-31).
//
// Cloud Build instala las dependencias con npm a partir del package.json subido, y npm no entiende
// el protocolo `workspace:` de pnpm. Por eso dist/ lleva:
//   - lib/: el JS compilado (requiere `pnpm --filter @sistema-redespachos/functions build`);
//   - vendor/: @sistema-redespachos/shared empaquetado con `pnpm pack` (requiere shared construido);
//   - package.json generado: shared como `file:vendor/<tgz>` y el resto de las dependencias de
//     producción fijadas a la versión instalada, que sale de `pnpm list --prod --json` (o sea, del
//     lockfile). Las dependencias de shared van en `overrides` con la misma versión.
// Las transitivas más profundas (las de firebase-admin, etc.) no quedan fijadas: Cloud Build no
// recibe un lockfile y npm las resuelve por rango en cada deploy.
//
// En local, dist/ no tiene node_modules: Node y el CLI de Firebase resuelven las dependencias
// subiendo a apps/functions/node_modules, así que el emulador funciona sin instalar nada.
import { execSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHARED = '@sistema-redespachos/shared';

const functionsDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const sharedDir = join(functionsDir, '..', '..', 'packages', 'shared');
const libDir = join(functionsDir, 'lib');
const distDir = join(functionsDir, 'dist');
const vendorDir = join(distDir, 'vendor');

function fail(message) {
  console.error(`prepareDeploy: ${message}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(functionsDir, 'package.json'), 'utf8'));

if (!existsSync(join(functionsDir, manifest.main))) {
  fail(
    `no existe ${manifest.main}; corré antes \`pnpm --filter @sistema-redespachos/functions build\`.`,
  );
}
if (!existsSync(join(sharedDir, 'dist', 'index.js'))) {
  fail(`no existe packages/shared/dist; corré antes \`pnpm --filter ${SHARED} build\`.`);
}

rmSync(distDir, { recursive: true, force: true });
mkdirSync(vendorDir, { recursive: true });
cpSync(libDir, join(distDir, 'lib'), { recursive: true });

// Ruta relativa y sin espacios: execSync pasa el comando por la shell.
const packDestination = relative(sharedDir, vendorDir).split('\\').join('/');
execSync(`pnpm pack --pack-destination ${packDestination}`, { cwd: sharedDir, stdio: 'ignore' });
const tarballs = readdirSync(vendorDir).filter((file) => file.endsWith('.tgz'));
if (tarballs.length !== 1) {
  fail(`se esperaba un .tgz de shared en ${vendorDir} y hay ${tarballs.length}.`);
}

const [installed] = JSON.parse(
  execSync('pnpm list --prod --json --depth 1', { cwd: functionsDir, encoding: 'utf8' }),
);

const dependencies = {};
for (const name of Object.keys(manifest.dependencies)) {
  if (name === SHARED) {
    dependencies[name] = `file:vendor/${tarballs[0]}`;
    continue;
  }
  const version = installed.dependencies?.[name]?.version;
  if (!version) {
    fail(`\`pnpm list\` no informa la versión instalada de ${name}; corré \`pnpm install\`.`);
  }
  dependencies[name] = version;
}

const overrides = {};
for (const [name, info] of Object.entries(installed.dependencies[SHARED].dependencies ?? {})) {
  overrides[name] = info.version;
}

const deployManifest = {
  name: manifest.name,
  version: manifest.version,
  private: true,
  type: manifest.type,
  main: manifest.main,
  engines: manifest.engines,
  dependencies,
  overrides,
};
writeFileSync(join(distDir, 'package.json'), `${JSON.stringify(deployManifest, null, 2)}\n`);

console.log(`prepareDeploy: ${relative(process.cwd(), distDir) || '.'} listo`);
console.log(JSON.stringify({ dependencies, overrides }, null, 2));
