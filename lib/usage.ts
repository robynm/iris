// Tracks usage in Vercel KV if env vars are set; otherwise no-ops.
// This keeps the app working locally without any KV setup.

const TOTAL_KEY = 'nb:usage:total';
const todayKey = () => {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `nb:usage:day:${yyyy}-${mm}-${dd}`;
};

const kvEnabled = () =>
  Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

export async function incrementUsage(): Promise<{
  total: number;
  today: number;
} | null> {
  if (!kvEnabled()) return null;
  try {
    const { kv } = await import('@vercel/kv');
    const [total, today] = await Promise.all([
      kv.incr(TOTAL_KEY),
      kv.incr(todayKey()),
    ]);
    // Expire daily counter after 48h so old keys don't pile up
    await kv.expire(todayKey(), 60 * 60 * 48);
    return { total, today };
  } catch (err) {
    console.error('KV increment failed:', err);
    return null;
  }
}

export async function getUsage(): Promise<{
  total: number;
  today: number;
} | null> {
  if (!kvEnabled()) return null;
  try {
    const { kv } = await import('@vercel/kv');
    const [total, today] = await Promise.all([
      kv.get<number>(TOTAL_KEY),
      kv.get<number>(todayKey()),
    ]);
    return { total: total ?? 0, today: today ?? 0 };
  } catch (err) {
    console.error('KV read failed:', err);
    return null;
  }
}
