# 参与贡献

需要 Node.js >=24、npm 和 Git。先阅读 README、AGENTS.md；Next.js 相关修改先读当前依赖自带的 `node_modules/next/dist/docs/`。保留中文 UI，保持 SQLite schema 兼容，不提交密钥、`.env.local`、`data/` 或构建产物。

```bash
npm ci
npm run dev
npm run build:db    # 需要先下载数据集
npm run stats
npm run check:data  # 需数据库；当前源数据的覆盖缺口会返回非零
npm run lint
npm run typecheck   # 自动先执行 next typegen
npm test
npm run build
```

从独立分支提交最小完整改动，添加能复现问题的 node:test 测试。提交采用 `type: summary`，如 `fix: validate upload headers`；PR 写明问题、行为变化、验证结果和已知限制。提交 PR 前 lint、typecheck、test 和 build 必须通过。数据缺口应如实记录，不添加伪造诗作或虚构 AI 协作经历。
