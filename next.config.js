/** @type {import('next').NextConfig} */
const nextConfig = {
  // @imgly/background-removal-node pulls in onnxruntime-node, a native module
  // that must not be bundled by Next — keep it external to the server build.
  serverExternalPackages: ['@imgly/background-removal-node', 'onnxruntime-node'],
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
