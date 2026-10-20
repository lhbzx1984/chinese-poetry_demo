// shortcut: 仅单进程有效，多实例部署时改用 Redis；反向代理必须覆盖客户端传入的转发头。
const windows = new Map<string, { hits: number[]; expires: number }>();
let nextSweep = 0;

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (now >= nextSweep) {
    for (const [k, bucket] of windows) if (bucket.expires <= now) windows.delete(k);
    nextSweep = now + 60_000;
  }
  const hits = (windows.get(key)?.hits ?? []).filter(t => t > now - windowMs);
  if (hits.length >= limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)) };
  hits.push(now);
  windows.set(key, { hits, expires: now + windowMs });
  return { allowed: true, retryAfter: 0 };
}

export function positiveEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function limitRequest(request: Request, kind: 'TTS' | 'AI' | 'UPLOAD', fallback: number): Response | null {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const result = rateLimit(`${kind}:${ip}`, Math.max(1, Math.floor(positiveEnv(`RATE_LIMIT_${kind}`, fallback))), 60_000);
  return result.allowed ? null : Response.json({ error: '请求过于频繁，请稍后再试。' }, { status: 429, headers: { 'Retry-After': String(result.retryAfter) } });
}
