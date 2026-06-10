// Trims @imgly/background-removal-node's bundled assets BEFORE `next build`
// traces files into the serverless function, so /api/remove-bg stays under
// Vercel's 250MB function limit. Run from the build script.
//
// The package ships ~220MB of assets we don't all need:
//   - both a 'small' (44MB) and 'medium' (88MB) model; the route only uses 'small'
//   - onnxruntime-node native binaries for every OS/arch (~136MB total); Vercel
//     only runs one (linux/x64)
// Next's outputFileTracingExcludes doesn't reliably trim these for app-router
// routes, so we delete them outright. Pruning here (vs. a glob exclude) is
// deterministic: the files simply aren't present when tracing runs.
//
// Safe to run on any machine — it keeps the model the code uses and the ONNX
// binary matching the CURRENT platform, so local `next dev`/`next build` keep
// working. `npm install` restores everything.

import { readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const imglyDist = join(root, 'node_modules/@imgly/background-removal-node/dist');
const ortBin = join(root, 'node_modules/onnxruntime-node/bin/napi-v3');

const drop = (p) => existsSync(p) && rmSync(p, { recursive: true, force: true });

// 1. Drop model chunks that don't belong to 'small'.
try {
  const res = JSON.parse(readFileSync(join(imglyDist, 'resources.json'), 'utf8'));
  const keep = new Set(res['/models/small'].chunks.map((c) => c.hash));
  let removed = 0;
  for (const [name, model] of Object.entries(res)) {
    if (name === '/models/small') continue;
    for (const { hash } of model.chunks) {
      if (!keep.has(hash)) {
        drop(join(imglyDist, hash));
        removed++;
      }
    }
  }
  console.log(`[prune] removed ${removed} non-'small' model chunks`);
} catch (e) {
  console.warn('[prune] model prune skipped:', e.message);
}

// 2. Drop ONNX native binaries for every platform/arch except this build's.
try {
  const keepPlat = process.platform; // 'linux' on Vercel
  const keepArch = process.arch; // 'x64' on Vercel
  for (const plat of readdirSync(ortBin)) {
    if (plat !== keepPlat) {
      drop(join(ortBin, plat));
      continue;
    }
    for (const arch of readdirSync(join(ortBin, plat))) {
      if (arch !== keepArch) drop(join(ortBin, plat, arch));
    }
  }
  console.log(`[prune] kept onnxruntime-node for ${keepPlat}/${keepArch} only`);
} catch (e) {
  console.warn('[prune] onnx prune skipped:', e.message);
}
