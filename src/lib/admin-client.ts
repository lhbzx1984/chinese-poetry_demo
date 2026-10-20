"use client";

// 令牌仅保存在当前标签页会话，首次遇到 401 时询问。
export async function adminFetch(url: string, init: RequestInit) {
  let token = '';
  try { token = sessionStorage.getItem('shijing:admin') || ''; } catch { /* 禁用存储时仍可单次使用 */ }
  const send = () => {
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  };
  let response = await send();
  if (response.status === 401) {
    token = window.prompt('此操作需要管理员令牌（仅保存在当前会话）。') || '';
    if (token) {
      response = await send();
      try {
        if (response.status !== 401) sessionStorage.setItem('shijing:admin', token);
        else sessionStorage.removeItem('shijing:admin');
      } catch { /* 忽略存储限制 */ }
    }
  }
  return response;
}
