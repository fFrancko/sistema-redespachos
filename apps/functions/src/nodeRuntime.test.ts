import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

// Vitest no evalúa los módulos como Node: vite-node no respeta el orden de evaluación de los
// `export … from`, así que si setGlobalOptions se mueve al cuerpo de index.ts, index.test.ts sigue
// en verde aunque en el runtime real las funciones queden sin región. Este test compila con tsc a
// una carpeta temporal dentro de apps/functions (para que resuelva node_modules) y carga el JS
// emitido con Node puro, como lo hace el runtime de Functions.
const functionsDir = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(functionsDir, 'node_modules', '.cache', 'node-runtime-test');
const tscBin = createRequire(import.meta.url).resolve('typescript/bin/tsc');

describe('JS emitido de apps/functions', () => {
  it('carga con Node puro y helloWorld es de 2ª gen en southamerica-east1', () => {
    rmSync(outDir, { recursive: true, force: true });
    execFileSync(process.execPath, [tscBin, '-p', 'tsconfig.build.json', '--outDir', outDir], {
      cwd: functionsDir,
    });

    // __endpoint es API interna de firebase-functions (ver index.test.ts).
    const entry = pathToFileURL(join(outDir, 'index.js')).href;
    const script = `
      const m = await import(${JSON.stringify(entry)});
      const { platform, region } = m.helloWorld.__endpoint;
      console.log(JSON.stringify({ platform, region, exports: Object.keys(m).sort() }));
    `;
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: functionsDir,
      encoding: 'utf8',
    });

    expect(JSON.parse(output)).toEqual({
      platform: 'gcfv2',
      region: ['southamerica-east1'],
      exports: [
        'admin',
        'auth',
        'emailTemplates',
        'emails',
        'helloWorld',
        'orders',
        'postalRouter',
        'proformas',
        'purchaseOrders',
        'reports',
        'settlement',
        'suppliers',
        'tariffs',
      ],
    });
  }, 120_000);
});
