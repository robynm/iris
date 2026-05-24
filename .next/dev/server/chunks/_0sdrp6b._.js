module.exports = [
"[project]/node_modules/@vercel/kv/dist/index.js [app-route] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "server/chunks/node_modules_0w208vn._.js",
  "server/chunks/[externals]_node_crypto_0xdk2m3._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[project]/node_modules/@vercel/kv/dist/index.js [app-route] (ecmascript)");
    });
});
}),
"[project]/app/api/usage/route.ts [app-route] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.resolve().then(() => {
        return parentImport("[project]/app/api/usage/route.ts [app-route] (ecmascript)");
    });
});
}),
];