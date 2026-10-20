import { timingSafeEqual } from 'node:crypto';

export function requireAdmin(request: Request): Response | null {
  const token = process.env.ADMIN_TOKEN || '';
  if (!token) return null;
  const expected = Buffer.from(`Bearer ${token}`);
  const supplied = Buffer.from(request.headers.get('authorization') || '');
  if (expected.length === supplied.length && timingSafeEqual(expected, supplied)) return null;
  return Response.json({ error: '请输入有效的管理员令牌。' }, { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } });
}
