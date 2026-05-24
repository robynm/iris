module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/lib/usage.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getUsage",
    ()=>getUsage,
    "incrementUsage",
    ()=>incrementUsage
]);
// Tracks usage in Vercel KV if env vars are set; otherwise no-ops.
// This keeps the app working locally without any KV setup.
const TOTAL_KEY = 'nb:usage:total';
const todayKey = ()=>{
    const d = new Date();
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `nb:usage:day:${yyyy}-${mm}-${dd}`;
};
const kvEnabled = ()=>Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
async function incrementUsage() {
    if (!kvEnabled()) return null;
    try {
        const { kv } = await __turbopack_context__.A("[project]/node_modules/@vercel/kv/dist/index.js [app-route] (ecmascript, async loader)");
        const [total, today] = await Promise.all([
            kv.incr(TOTAL_KEY),
            kv.incr(todayKey())
        ]);
        // Expire daily counter after 48h so old keys don't pile up
        await kv.expire(todayKey(), 60 * 60 * 48);
        return {
            total,
            today
        };
    } catch (err) {
        console.error('KV increment failed:', err);
        return null;
    }
}
async function getUsage() {
    if (!kvEnabled()) return null;
    try {
        const { kv } = await __turbopack_context__.A("[project]/node_modules/@vercel/kv/dist/index.js [app-route] (ecmascript, async loader)");
        const [total, today] = await Promise.all([
            kv.get(TOTAL_KEY),
            kv.get(todayKey())
        ]);
        return {
            total: total ?? 0,
            today: today ?? 0
        };
    } catch (err) {
        console.error('KV read failed:', err);
        return null;
    }
}
}),
"[project]/app/api/usage/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "runtime",
    ()=>runtime
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$usage$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/usage.ts [app-route] (ecmascript)");
;
;
const runtime = 'nodejs';
async function GET() {
    const usage = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$usage$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getUsage"])();
    if (!usage) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            enabled: false
        });
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        enabled: true,
        ...usage
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1096-n9._.js.map