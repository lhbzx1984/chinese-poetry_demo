# 诗境 · 中国古典诗词沉浸馆

按**年代、作者、题材**遨游三十四万余首古典诗词；每一首诗都被拆成电影分镜，逐幕生成画面与白话译文，做成可以**滚动步入**的沉浸式网页。首页是一座「诗人行迹」3D 地图——按朝代点亮 44 位诗人一生走过的山河。

项目思路取自两个开源项目：

- [chinese-poetry](https://github.com/chinese-poetry/chinese-poetry)（[lhbzx1984/chinese-poetry](https://github.com/lhbzx1984/chinese-poetry)）—— 最全的中华古诗词 JSON 数据库，本项目将其落地为本地 SQLite 数据源；
- [immersive-poetry-page](https://github.com/lhbzx1984/immersive-poetry-page) —— "把一首诗变成电影感网页"的技能，本项目的沉浸阅读页遵循其「文学分镜 → 统一视觉规范 → 逐场景画面 → 滚动页面」流程。

## 功能

- **史诗感首页 `/`**：
  - 山水诗意视频背景（`scripts/fetch-hero-video.mjs` 用 Agnes 视频模型生成一次、永久使用；未生成时自动使用程序化水墨背景），名句竖排诗篇缓缓漂浮其上；
  - 首页不再罗列诗篇，只保留三个入口：诗人地图 / 书库 / 任入一境（随机进入一首诗）。
- **诗人行迹 3D 地图**：
  - echarts-gl 立体中国地图，海洋蓝 + 经纬网格 + 政治地图色系省份；
  - 44 位先秦至清代诗人、236 处人生足迹：屈原的汨罗、李白的十站江湖、杜甫的漂泊线、苏轼的十四城、岑参的西域……金色光点与行迹线按生平顺序相连；
  - 顶部朝代时间轴（先秦 → 清）筛选，自动巡游可开关（拖动地图即暂停）；
  - 点击地图光点或下方诗人名录，打开作者卡：生平简介 + 行迹链 + 书库代表作（按名篇排序）+ 一键进入沉浸页；
- **书库 `/library`**：年代（先秦/汉/唐/五代/宋/元/清）、题材（山水田园、边塞征战、思乡怀人等 12 类）、作者（随年代联动）、全文搜索（标题/作者/诗句，繁体自动转简体），支持 URL 深链（如 `/library?author=李白`）。
- **沉浸阅读页 `/read/[id]`**：
  - 自动切分 3-6 个电影场景（绝句一句一景、律诗一联一景、词一阕一景、诗经一章一景），40 余种古典意象生成统一视觉规范下的画面提示词；
  - 逐场景 AI 绘图（交叉淡入 + 缓推镜头），可选大模型逐幕白话译文与点评；
  - **朗读设置**：系统全部中文语音可选（沉静/平和/明快风格、语速、音调，本机记忆），用 Edge 打开可用「晓晓」等自然在线语音；
  - **意境背景音乐**：Web Audio 实时生成的古琴风环境音（和声铺底 + 五声音阶拨弦 + 风声），随诗的色板/情绪自动匹配，朗读时温和压低、可单独试听；
  - 配图永久缓存（`data/generated/{id}_{内容哈希}/`），同一首诗只有首次访问消耗生成额度，页面明示「配图取自本地图库」；
  - 无 API key 时自动降级为程序化水墨背景，全功能可用。

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 下载 chinese-poetry 数据集（约 95MB，走加速镜像）
curl -L -o data/cp.zip "https://ghproxy.net/https://github.com/chinese-poetry/chinese-poetry/archive/refs/heads/master.zip"
unzip data/cp.zip -d data
mv data/chinese-poetry-master data/chinese-poetry

# 3. 构建本地诗词数据库（data/poetry.db，约 1-2 分钟）
npm run build:db

# 4. （可选）生成首页背景视频 + 配置 AI
cp .env.example .env.local      # 填入 AGNES_API_KEY
node scripts/fetch-hero-video.mjs

# 5. 启动
npm run dev   # 打开 http://localhost:3000
```

## 架构

```
chinese-poetry JSON ──npm run build:db──▶ data/poetry.db (SQLite: 诗/作者/题材标签/FTS全文索引)
                                              │
        ┌─────────────────────────────────────┘
        ▼
  Next.js App Router (Node runtime, node:sqlite 零原生依赖)
   ├─ /api/meta /api/authors /api/poems /api/poems/random   筛选·搜索·随机
   ├─ /api/poems/[id]/experience   分镜方案 + 配图状态 + 译文赏析
   └─ /api/images/[id]/[index]      场景配图（内容寻址磁盘缓存）
        ▼
   首页（电影 hero + 3D 诗人地图） · 书库 /library · 沉浸阅读 /read/[id]
```

- 诗人足迹数据：`src/data/poet-places.ts`（手工编纂，坐标为现代城市经纬度）；地图底图：`public/geo/china3d.json`（Datav GeoJSON 清洗版，`scripts` 内联逻辑去除南海微岛屿）。
- 题材标签由 `scripts/tag-lexicon.mjs` 关键词词表建库时打标；FTS5 trigram 支持中文短语搜索。
- 分镜与视觉规范：`src/lib/scenes.ts` + `src/lib/imagery.ts`（确定性）；配图 `src/lib/imagegen.ts`；译文赏析 `src/lib/analysis.ts`；意境配乐 `src/lib/ambient-music.ts`。

## 朗读语音（Edge 神经语音，免配置）

朗读音色分两档，随时切换：

- **Edge 在线神经语音**（推荐）：基于开源项目 msedge-tts 免费调用 Edge Read Aloud 服务，无需任何 key。
  内置 7 个中文音色：女声（晓晓·温暖 / 晓伊·清亮 / 晓北·东北）、男声（云希·阳光 / 云健·浑厚 / 云扬·播音 / 云夏·少年），
  音调（±Hz）与语速（倍率）即时生效；合成结果缓存在 `data/tts-cache/`，重复朗读零消耗。
- **浏览器本地语音**（离线兜底）：系统 speechSynthesis，本机语音包越多可选越多。

网络异常时自动回退浏览器语音，设置面板有明确提示。

## 环境变量（.env.local）

| 变量 | 说明 | 默认 |
|---|---|---|
| `AGNES_API_KEY` | AI 图像/文本/视频 API key（留空则纯本地体验） | 空 |
| `AI_API_BASE_URL` | OpenAI 兼容端点 | `https://apihub.agnes-ai.com/v1` |
| `IMAGE_MODEL` / `IMAGE_SIZE` | 分镜配图模型与尺寸 | `agnes-image-2.5-flash` / `1344x768` |
| `TEXT_MODEL` | 译文/赏析文本模型（留空关闭） | `agnes-3.0-flash` |
| `VIDEO_MODEL` | 首页背景视频模型 | `agnes-video-2.5-flash` |
| `POETRY_DATA_DIR` / `POETRY_DB_PATH` | 数据集与数据库路径 | `data/…` |

## 部署

要求 Node.js ≥ 24（内置 node:sqlite）。生产模式：

```bash
npm ci
npm run build:db     # 需先有 data/chinese-poetry 数据集（或整个拷贝已建好的 data/ 目录）
npm run build
npm start            # 局域网访问加 -H 0.0.0.0
```

- **数据即状态**：`data/` 目录含诗词库、配图缓存、影片存储，迁移时整体拷贝
- **守护进程**：Linux 用 pm2（`pm2 start npm --name shijing -- start`），Windows 用任务计划/NSSM
- **公网部署**：项目无登录鉴权，公网开放请在 Nginx 加 Basic Auth，避免 AI 额度被滥用；Nginx 需 `client_max_body_size 100m`（影片上传）
- Serverless 平台（Vercel 等）不适用：依赖本地 SQLite 大文件与磁盘写入

### 腾讯云一键部署

在腾讯云服务器（Ubuntu/Debian/TencentOS/CentOS，root 或 sudo）上执行：

```bash
curl -fsSL -o deploy.sh "https://ghproxy.net/https://raw.githubusercontent.com/lhbzx1984/chinese-poetry_demo/main/scripts/deploy-tencent.sh" && bash deploy.sh
```

脚本自动完成：Node 24 安装（npmmirror 二进制）→ 代码获取（GitHub 失败自动走国内镜像）→ 数据集下载与数据库构建 → 依赖安装与生产构建 → pm2 守护与开机自启。可先 `export AGNES_API_KEY=sk-xxx` 启用 AI 能力，或部署后编辑 `/opt/shijing/.env.local` 再 `pm2 restart shijing`。完成后需在腾讯云控制台【安全组】放行 3000 端口。

### 部署到 Cloudflare

**方式 A：Cloudflare Tunnel（推荐，代码零改动）**——在跑项目的机器上安装 `cloudflared`，把 localhost:3000 发布为你的域名：

```bash
cloudflared tunnel login
cloudflared tunnel create shijing
cloudflared tunnel route dns shijing shijing.你的域名.com
cloudflared tunnel run shijing   # 配合 NSSM/pm2 常驻
```

临时演示可直接 `cloudflared tunnel --url http://localhost:3000` 获得临时网址。公网开放后建议用 Cloudflare Access（Zero Trust）加一层验证，保护 AI 额度。

**方式 B：全托管 Workers/Pages（需重构）**——`node:sqlite` 与本地文件在 Worker 运行时不可用，需：诗词库迁 D1、配图/影片/缓存迁 R2、msedge-tts 代理改写为 Workers WebSocket、Next.js 走 @opennextjs/cloudflare。属于一次中型重构，按需评估。

## 数据说明

- 数据版权归 [chinese-poetry](https://github.com/chinese-poetry/chinese-poetry) 所有；唐诗宋词原文繁体，建库时经 opencc-js 转简体；
- 题材为关键词近似标注；诗人足迹为文学史通说简绘，仅供导航与神游。
