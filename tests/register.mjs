import { registerHooks } from 'node:module';
import fs from 'node:fs';
// 仅测试使用：让 Node 原生类型剥离解析 Next 的别名和无扩展名导入。
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'next/server') return nextResolve('next/server.js', context);
  if (specifier.startsWith('@/')) specifier = new URL('../src/' + specifier.slice(2) + '.ts', import.meta.url).href;
  if (specifier.startsWith('./') && !/\.[a-z]+$/.test(specifier) && context.parentURL) {
    const url = new URL(specifier + '.ts', context.parentURL);
    if (fs.existsSync(url)) specifier = url.href;
  }
  return nextResolve(specifier, context);
} });
