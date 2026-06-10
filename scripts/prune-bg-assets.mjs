// Trims @imgly/background-removal-node's bundled assets BEFORE `next build`
// traces files into the serverless function, so /api/remove-bg stays under
// Vercel's 250MB function limit. Runs from the `build` script.
//
// The package ships ~260MB of assets we don't all need:
//   - both a 'small' (44MB) and 'medium' (88MB) model; the route only uses 'small'
//   - onnxruntime-node native binaries for every OS/arch (~136MB total); Vercel
//     only runs one (linux/x64)
// Next's outputFileTracingExcludes doesn't reliably trim these for app-router
// routes, so we delete them outright. Deleting here (vs. a glob exclude) is
// deterministic — the files simply aren't present when tracing runs.
//
// We locate the packages by walking UP from cwd (npm may hoist them to a
// workspace-root node_modules on Vercel, not ./node_modules), and FAIL LOUDLY
// if they can't be found — a silent no-op here is what previously let the full,
// unpruned tree blow the size limit on Vercel.
//
// Safe on any machine: it keeps the model the code uses and the ONNX binary for
// the CURRENT platform, so local `next dev`/`next build` keep working.

import { readFileSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';

// Find `node_modules/<rel>` starting at cwd and walking up to the filesystem root.
const findUp = (rel) => {
  let dir = process.cwd();
  for (;;) {
    const candidate = join(dir, 'node_modules', rel);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
};

const dirSizeMB = (p) => {
  let total = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const f = join(d, e.name);
      if (e.isDirectory()) walk(f);
      else
        try {
          total += statSync(f).size;
        } catch {}
    }
  };
  if (existsSync(p)) walk(p);
  return (total / 1048576).toFixed(1);
};

const drop = (p) => existsSync(p) && rmSync(p, { recursive: true, force: true });

const imglyDist = findUp('@imgly/background-removal-node/dist');
const ortBin = findUp('onnxruntime-node/bin/napi-v3');

if (!imglyDist) {
  throw new Error(
    '[prune] @imgly/background-removal-node/dist not found in any node_modules up from ' +
      process.cwd()
  );
}
if (!ortBin) {
  throw new Error(
    '[prune] onnxruntime-node/bin/napi-v3 not found in any node_modules up from ' +
      process.cwd()
  );
}

console.log(`[prune] dist:     ${imglyDist} (${dirSizeMB(imglyDist)}MB)`);
console.log(`[prune] onnx bin: ${ortBin} (${dirSizeMB(ortBin)}MB)`);

// 1. Drop model chunks that don't belong to 'small'.
const res = JSON.parse(readFileSync(join(imglyDist, 'resources.json'), 'utf8'));
const keep = new Set(res['/models/small'].chunks.map((c) => c.hash));
let removed = 0;
for (const [name, model] of Object.entries(res)) {
  if (name === '/models/small') continue;
  for (const { hash } of model.chunks ?? []) {
    if (!keep.has(hash)) {
      drop(join(imglyDist, hash));
      removed++;
    }
  }
}
console.log(`[prune] removed ${removed} non-'small' model chunks`);

// 2. Drop ONNX native binaries for every platform/arch except this build's.
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
console.log(
  `[prune] done — dist ${dirSizeMB(imglyDist)}MB, onnx ${dirSizeMB(ortBin)}MB`
);
