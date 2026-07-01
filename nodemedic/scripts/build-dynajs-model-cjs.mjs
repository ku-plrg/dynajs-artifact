import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const esbuild = require(path.join(repoRoot, 'lib/dynajs/node_modules/esbuild'));

const outfile = path.join(repoRoot, 'src/vendor/dynajs-model.cjs');

await mkdir(path.dirname(outfile), { recursive: true });

await esbuild.build({
    entryPoints: [path.join(repoRoot, 'lib/dynajs/src/model/string.ts')],
    outfile,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
});
