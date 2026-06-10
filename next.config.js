/** @type {import('next').NextConfig} */
const nextConfig = {
  // @imgly/background-removal-node pulls in onnxruntime-node, a native module
  // that must not be bundled by Next — keep it external to the server build.
  serverExternalPackages: ['@imgly/background-removal-node', 'onnxruntime-node'],

  // The model weights ship as content-hashed chunks inside the package's dist/
  // and are loaded at runtime via computed file paths, so Next's tracer can't
  // see them and won't copy them into the Vercel function. Force-include them.
  // scripts/prune-bg-assets.mjs runs before the build and strips the unused
  // 'medium' model and non-Linux ONNX binaries, so what's left here is just the
  // ~44MB 'small' model + the linux/x64 ONNX binary — well under Vercel's 250MB.
  outputFileTracingIncludes: {
    '/api/remove-bg': [
      './node_modules/@imgly/background-removal-node/dist/**',
      './node_modules/onnxruntime-node/bin/napi-v3/linux/x64/**',
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

module.exports = nextConfig;
