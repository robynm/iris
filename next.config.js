/** @type {import('next').NextConfig} */
const nextConfig = {
  // @imgly/background-removal-node pulls in onnxruntime-node, a native module
  // that must not be bundled by Next — keep it external to the server build.
  serverExternalPackages: ['@imgly/background-removal-node', 'onnxruntime-node'],

  // The model weights ship as content-hashed chunks inside the package's dist/
  // and are loaded at runtime via computed file paths, so Next's tracer can't
  // see them and won't copy them into the Vercel function. Force-include the
  // whole dist/ plus the Linux ONNX binary (the only platform Vercel runs).
  outputFileTracingIncludes: {
    '/api/remove-bg': [
      './node_modules/@imgly/background-removal-node/dist/**',
      './node_modules/onnxruntime-node/bin/napi-v3/linux/x64/**',
    ],
  },
  // The local node_modules also carries macOS/Windows ONNX binaries (~117MB)
  // that are dead weight on Lambda and would push the function past Vercel's
  // 250MB unzipped limit. Drop them.
  outputFileTracingExcludes: {
    '/api/remove-bg': [
      './node_modules/onnxruntime-node/bin/napi-v3/darwin/**',
      './node_modules/onnxruntime-node/bin/napi-v3/win32/**',
      './node_modules/onnxruntime-node/bin/napi-v3/linux/arm64/**',
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  turbopack: {
    // onnxruntime-web@1.21.0 declares ort.webgpu.bundle.min.mjs in its exports
    // but only ships the CJS version. Alias to the file that actually exists.
    resolveAlias: {
      'onnxruntime-web': './node_modules/onnxruntime-web/dist/ort.min.js',
      'onnxruntime-web/webgpu': './node_modules/onnxruntime-web/dist/ort.webgpu.min.js',
    },
  },
};

module.exports = nextConfig;
