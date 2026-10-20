
# 诗境 · 中国古典诗词沉浸馆

沿诗人足迹漫游山河，把古典诗词读成由分镜、朗读与配乐组成的电影。仓库名 `chinese-poetry_demo` 与包名 `shijing-immersive` 均指本项目「诗境」。

![Node >=24](https://img.shields.io/badge/Node-%3E%3D24-green) ![MIT](https://img.shields.io/badge/License-MIT-blue) ![Next.js 16.4.2](https://img.shields.io/badge/Next.js-16.4.2-black)

## 截图与演示

演示视频或在线网址：[YOU FILL IN]。截图待维护者补入 `docs/screenshots/`：

| 首页 | 诗人地图 | 书库 | 沉浸阅读 | 影片馆 |
|---|---|---|---|---|
| [home.png](docs/screenshots/home.png) | [map.png](docs/screenshots/map.png) | [library.png](docs/screenshots/library.png) | [reader.png](docs/screenshots/reader.png) | [video.png](docs/screenshots/video.png) |

此版本仅预留目录与 `.gitkeep`，没有真实截图。

## 功能概览

- **首页 `/`**：山水视频与竖排诗句，三个主入口为诗人地图、书库、任入一境；顶部另有影片馆。视频缺失时展示程序化水墨背景，系统减少动态效果或浏览器省流模式开启时不加载视频。
- **诗人行迹 `/#map`**：echarts-gl 立体地图、朝代筛选、可关闭的自动旋转；光点与键盘可用的诗人名录均可打开作者卡，含生平、现代城市足迹、代表作入口。地图为 **96位诗人、405处足迹**；朝代人数：先秦1、汉魏2、魏晋1、南北朝1、唐46、五代2、宋35、元3、明3、清2。
- **书库 `/library`**：按数据库实际朝代（先秦、汉、唐、五代、宋、元、清）、作者和题材筛选；支持标题、作者、诗句全文搜索，以及 `/library?author=李白` 深链。建库用 opencc-js 转简体，搜索输入应使用简体，搜索框本身不做繁简转换。
- **沉浸阅读 `/read/[id]`**：绝句逐句、律诗逐联，词按输入阕段、诗经按输入章段切分。一般3–6幕；短于三段时保留实际幕数，空文本零幕，长篇最多六幕，不补写诗句。41种意象配合时代、情绪、色板生成提示；可选 Agnes 配图、白话意译和赏析，淡入与缓推镜头尊重减少动态效果设置。
- **朗读与意境配乐**：7个 Edge 中文音色（晓晓、晓伊、晓北、云希、云健、云扬、云夏）及浏览器本机语音，支持语速、音调和试听。Edge失败可回退本机语音。Web Audio以和声、五声音阶拨弦和风声生成环境音，按诗的情绪匹配，朗读时压低音量。音频只在点击后启动，偏好保存在本机。
- **生成短片与影片馆 `/video`**：全部分镜图就绪后点击「生成短片」，浏览器将标题、字幕、画面、Edge旁白和可选配乐通过 canvas / MediaRecorder 合成为 WebM，上传后跳转影片馆。时长由旁白决定，旁白失败的幕可仅有配乐。支持播放、拖动、下载、删除；删除需二次点击确认，配置令牌后还需输入管理员令牌。

本次官方快照的 `npm run stats` 输出 **344,315首诗词**：先秦370、汉26、唐57,427、五代45、宋275,276、元10,913、清258；词表与库内均为12类题材。数量随上游快照和本地建库变化，以脚本为准。`npm run check:data` 检查地图作者、朝代及每个名篇关键词；本次62位通过、34位有缺口，其中7位作者未收录。卡片分别提示未收录和请求失败。地图「汉魏」与书库「汉」作显式比较别名，保留其他历史分期，不伪造作品。

## 技术栈与架构

Next.js 16 App Router、React 19、TypeScript、Tailwind CSS；Node >=24 内置 `node:sqlite`；echarts / echarts-gl；opencc-js；msedge-tts；Web Audio、canvas、MediaRecorder。SQLite schema保持兼容。

```text
chinese-poetry JSON ──npm run build:db──▶ data/poetry.db
                                        SQLite: 诗/作者/题材/FTS5
                                              │
        ┌─────────────────────────────────────┘
        ▼
  Next.js App Router (Node runtime)
   ├─ /api/meta /api/authors /api/poems /api/poems/random   只读检索
   ├─ /api/poems/[id]                                    诗词详情
   ├─ /api/poems/[id]/experience ──▶ Agnes 配图/赏析 ──▶ data/generated/
   ├─ /api/images/[id]/[index]                            缓存配图
   ├─ /api/tts ──▶ Edge Read Aloud ──▶ data/tts-cache/     MP3
   └─ /api/videos + /api/videos/[id] ──▶ data/videos/      WebM/元数据
        ▼
   首页 + 3D地图 · 书库 · 沉浸阅读 ──浏览器合成短片──▶ 影片馆
```

地图资料在 `src/data/poet-places.ts`；分镜与意象在 `src/lib/scenes.ts`、`imagery.ts`；配图、赏析、配乐、短片分别在 `imagegen.ts`、`analysis.ts`、`ambient-music.ts`、`clip.ts`。题材由 `scripts/tag-lexicon.mjs` 关键词规则生成，FTS5 trigram用于中文短语检索。

三个底图均使用：`china3d.json` 为主地图，`world.json` 为背景，`china.json` 为南海诸岛小窗。GeoJSON缓存一天并允许陈旧重验证，Next启用压缩；反代还应启用gzip/Brotli。

## 快速开始

需要Git、Node >=24、npm。以下为Bash（Linux/macOS/Windows Git Bash）命令；Windows也可用资源管理器解压并改名。

```bash
git clone https://github.com/lhbzx1984/chinese-poetry_demo.git
cd chinese-poetry_demo
npm ci
mkdir -p data
curl -fL --retry 3 -o data/cp.zip "https://github.com/chinese-poetry/chinese-poetry/archive/refs/heads/master.zip"
unzip data/cp.zip -d data
mv data/chinese-poetry-master data/chinese-poetry
npm run build:db
cp .env.example .env.local
# 可选：编辑 .env.local 填 AGNES_API_KEY
# 可选：npm run hero:video（读取 .env.local，消耗视频生成额度）
npm run stats
npm run dev
# 打开 http://localhost:3000
```

国内网络可选代理前缀 `https://ghproxy.net/`，例如 `https://ghproxy.net/https://github.com/...`。代理为第三方服务，按需自行信任；默认使用官方源。

### FAQ

- **node:sqlite或语法错误？** `node --version` 应为24或以上；按 `.nvmrc` 使用Node24，切换后重新 `npm ci`。
- **没有数据库？** 构建和首页地图可用；书库API返回中文错误，阅读页提示书库未就绪。先下载数据集并 `npm run build:db`，自定义路径用 `POETRY_DB_PATH`。建库会重建目标库，已有部署应停服备份。
- **没有AI key？** 检索、分镜、水墨背景、本机语音、配乐可用；新配图与赏析关闭。没有已生成分镜图时不能生成短片。
- **Edge失败？** 阅读朗读提示后回退浏览器语音，中文音色取决于系统安装；短片失败旁白可静音。429应等待后重试。
- **typecheck缺RouteContext / PageProps？** 使用 `npm run typecheck`，会先 `next typegen`，不依赖数据库。
- **覆盖检查退出1？** 表格列出作者未收录、朝代不符、名篇未命中；缺库也返回1并打印提示。无库CI不运行此命令。

## 环境变量

复制 `.env.example` 到 `.env.local`，不要提交真实密钥。表格逐项对应模板。`stats`、`check:data` 会读取已存在的 `.env.local`；首页视频用 `npm run hero:video`；建库使用shell环境变量，默认目录无需配置。

| 变量 | 默认值 | 用途 |
|---|---|---|
| `AGNES_API_KEY` | 空 | AI配图、赏析、首页视频密钥 |
| `IMAGE_API_KEY` | 空 | 可选独立配图/赏析密钥，优先于AGNES_API_KEY |
| `AI_API_BASE_URL` | `https://apihub.agnes-ai.com/v1` | OpenAI兼容地址 |
| `IMAGE_MODEL` | `agnes-image-2.5-flash` | 分镜配图模型 |
| `IMAGE_SIZE` | `1344x768` | 配图尺寸 |
| `TEXT_MODEL` | `agnes-3.0-flash` | 模板值；代码未设置时为空，留空关闭赏析 |
| `VIDEO_MODEL` | `agnes-video-2.5-flash` | 首页视频脚本模型，与浏览器合成短片不同 |
| `POETRY_DATA_DIR` | `data/chinese-poetry` | 建库数据集路径 |
| `POETRY_DB_PATH` | `data/poetry.db` | 运行库/建库输出路径 |
| `VIDEOS_DIR` | `data/videos` | 影片目录，可挂载磁盘或测试隔离 |
| `ADMIN_TOKEN` | 空 | 非空时删除需Bearer令牌 |
| `MAX_VIDEO_MB` | `100` | 上传上限MiB，无Content-Length也检查实际字节 |
| `MAX_VIDEOS` | `200` | 单进程影片数量上限 |
| `REQUIRE_TOKEN_FOR_UPLOAD` | `false` | true且ADMIN_TOKEN非空时上传需令牌 |
| `RATE_LIMIT_TTS` | `30` | 每IP每60秒TTS请求（含缓存） |
| `RATE_LIMIT_AI` | `10` | 每IP每60秒新生成启动次数；缓存/运行中轮询不计数 |
| `RATE_LIMIT_UPLOAD` | `5` | 每IP每60秒上传请求 |

## API概览

错误通常为 `{error:"中文说明"}`，成功JSON为 `{data:...}`；图片、MP3、WebM返回二进制。

| 路径 | 方法 | 参数 | 响应 | 外部额度/写盘 | 限流/令牌 |
|---|---|---|---|---|---|
| `/api/meta` | GET | 无 | 总数、朝代、题材、合集 | 无/只读 | 无 |
| `/api/authors` | GET | dynasty,q,limit（最多200） | 作者列表 | 无/只读 | 无 |
| `/api/poems` | GET | dynasty,author,tag,collection,q,page,pageSize（最多60） | items,total,page,pageSize | 无/只读 | 非法分页400，q最多200字 |
| `/api/poems/random` | GET | dynasty,tag | id，可为null | 无/只读 | 无 |
| `/api/poems/[id]` | GET | 正整数id | 诗词详情 | 无/只读 | 无 |
| `/api/poems/[id]/experience` | GET | 正整数id | 分镜、生成状态、译文；顶层settled | 未命中时调用Agnes、写generated | 新任务启动限流，缓存/运行中不计数；无令牌 |
| `/api/images/[id]/[index]` | GET | id,index（0–20） | JPEG缓存 | 无/只读 | 无 |
| `/api/tts` | POST | JSON:text（最多2000字）,voice,pitch,rate | MP3，失败503 | Edge服务；缓存命中不联网 | TTS限流，无令牌 |
| `/api/videos` | GET | 无 | 影片列表 | 无/读取目录 | 无 |
| `/api/videos` | POST | WebM body；查询title,author,duration | 影片元数据 | 无AI调用/写盘 | 上传限流，可选令牌；400/401/413/429/507 |
| `/api/videos/[id]` | GET | v开头id；可选Range | WebM流200/206/416 | 无/只读 | 无 |
| `/api/videos/[id]` | DELETE | id；配置时Authorization | `{data:{ok:true}}` | 无/删除影片及元数据 | ADMIN_TOKEN非空时鉴权 |

429带 `Retry-After` 秒数。上传需 `video/webm`、EBML文件头、至少10KB；标题与作者去控制字符并截断，时长限制0–600秒。文件头校验不是完整WebM解码。IP取 `X-Forwarded-For` 首项，没有时共用回退桶；反代必须覆盖此头并阻止绕过反代。限流仅单进程，多实例需Redis/网关；AI限流限制任务启动，不等同每张图片计费上限。

## 部署

需要可持久写入磁盘的Node >=24服务，先按快速开始准备数据和配置。

```bash
npm ci
npm run build:db       # 仅初次或主动重建，先备份旧库
npm run build
npm start             # 默认3000端口
# Linux可选守护
pm2 start npm --name shijing -- start
pm2 save
```

`data/` 包含数据库、图片/赏析、TTS缓存、影片，是部署状态；迁移应整体备份，`VIDEOS_DIR` 覆盖时也要备份对应目录。Windows可用任务计划/NSSM。公网设置强随机 `ADMIN_TOKEN`，按需开启上传鉴权；额外用Nginx Basic Auth或Cloudflare Access保护整个站点与AI额度，不能只依赖影片令牌。Nginx需 `client_max_body_size 100m`，配置gzip/Brotli。参阅 [SECURITY.md](SECURITY.md)。

### 腾讯云脚本部署

适用Ubuntu / Debian / TencentOS / CentOS / RHEL（x86_64/arm64），需要root或sudo。先下载、阅读，再执行。推荐固定到已审核的tag或commit：

```bash
REPO_REF=main          # 推荐改为已审核的tag或commit
curl -fL -o deploy-tencent.sh "https://raw.githubusercontent.com/lhbzx1984/chinese-poetry_demo/${REPO_REF}/scripts/deploy-tencent.sh"
less deploy-tencent.sh
REPO_REF="$REPO_REF" bash deploy-tencent.sh
```

默认代码/数据直连GitHub；国内网络可在执行前设置 `export GH_MIRROR=https://ghproxy.net/`，自行评估第三方信任。脚本安装Node24、按锁文件安装依赖、下载数据并建库、构建、配置pm2。`APP_DIR` 默认 `/opt/shijing`，`PORT` 默认3000；仓库有本地改动时拒绝覆盖，已有数据保留；`REPO_REF` 可为分支、tag或commit，更新后使用detached HEAD。脚本使用npmmirror/Tencent的Node二进制和npm源，运行前应审核其信任范围。首次运行可能建立swap、安装软件、修改防火墙；先检查目标主机和脚本。

部署后编辑 `.env.local` 配置AI和管理员令牌，再 `pm2 restart shijing`。首次也可通过进程环境提供AGNES_API_KEY；不要将真实值写入公开命令截图。腾讯云安全组按反代方案放行相应端口；使用Access/Basic Auth时避免暴露可绕过验证的应用端口。

### Cloudflare Tunnel与托管平台

在运行项目的机器安装cloudflared，按自己的域名设置：

```bash
cloudflared tunnel login
cloudflared tunnel create shijing
cloudflared tunnel route dns shijing shijing.你的域名.com
# 配置tunnel凭据及ingress指向 http://localhost:3000 后运行
cloudflared tunnel run shijing
```

配合NSSM/pm2常驻。临时演示用 `cloudflared tunnel --url http://localhost:3000`；公网应配置Cloudflare Access。全托管Workers/Pages需要把SQLite迁D1、媒体/缓存迁R2，并改写Edge朗读代理和运行时适配；临时文件或只读文件系统的Serverless同样不能直接承载当前架构，需评估重构。

## Vibe Coding记录

以下个人经历需要维护者填写，不能从代码推断为已发生的事实。

- 使用的AI工具与分工：[YOU FILL IN: 哪个模型/工具负责需求拆解、编码、图像与视频生成]
- 工作流：需求 → 文学分镜规则 → 数据库构建 → 页面 → 沉浸效果 → 部署（请按真实顺序核对）。
- 3–5条关键提示词原文：[YOU FILL IN]
- AI表现好的地方：[YOU FILL IN]
- AI出错且需要人工修正的地方：[YOU FILL IN: 如坐标、朝代、新版Next.js API差异]
- 我的取舍与判断：[YOU FILL IN]
- 总耗时与迭代次数：[YOU FILL IN]

可验证事实：`AGENTS.md` 提醒先阅读当前Next自带文档；`CLAUDE.md` 为另一份AI协作说明。本次保留两份文件原样。近期历史提交含部署重试、pm2路径、赏析失败缓存过期等小步修复；这只能证明提交内容，不能证明使用了何种模型或花了多久。本次优化新增统计、覆盖检查、测试与CI，记录见Git提交及 [CHANGELOG.md](CHANGELOG.md)。

## 数据来源、许可与致谢

- [chinese-poetry](https://github.com/chinese-poetry/chinese-poetry)：JSON数据源；[上游LICENSE](https://github.com/chinese-poetry/chinese-poetry/blob/master/LICENSE) 为 **MIT，Copyright (c) 2016 JackeyGao**。再分发需保留许可和版权声明，不能简单称所有古诗版权归仓库作者。
- [opencc-js](https://github.com/nk2028/opencc-js)：MIT AND Apache-2.0，建库繁简转换。
- [Apache ECharts](https://github.com/apache/echarts)：Apache-2.0；[echarts-gl](https://github.com/ecomfe/echarts-gl)：MIT，2D/3D地图。
- [msedge-tts](https://github.com/Migushthe2nd/MsEdgeTTS)：MIT，Edge Read Aloud封装，并非微软官方承诺支持的API。
- 地图：原README注明Datav GeoJSON清洗版；本地包含主图、小窗图和世界底纹。精确下载URL、数据版本与再分发许可 **TBD**，需维护者补充原始出处，勿用作权威行政边界。
- AI：默认Agnes OpenAI兼容端点，模型名来自现有配置，实际可用性、费用与条款以服务商为准；诗词会发送到配置的服务地址，赏析、配图可能出错。
- 思路参考 [immersive-poetry-page](https://github.com/lhbzx1984/immersive-poetry-page) 的「文学分镜 → 统一视觉规范 → 逐场景画面 → 滚动页面」流程，以及 [chinese-poetry分支](https://github.com/lhbzx1984/chinese-poetry)。

## 已知限制与免责声明

- 繁简转换可能改变个别字形，影响声韵、异体与版本表达；当前搜索输入不自动转简体。
- 题材为关键词近似标签，不是人工考据；名篇可能因标题版本差异未命中覆盖检查。
- 诗人足迹为文学史通说简绘，坐标为现代城市位置，不等于古代地名精确位置；地图与书库覆盖范围不同。
- 译文、赏析、配图由AI生成，可能错误，仅供欣赏参考，不作为学术依据。
- Edge依赖非官方微软在线服务，可能变化或不可用，本机兜底声音质量与系统有关。
- 地图仅为文学地理示意，不用于导航、测绘或行政区划认定。
- 媒体与数据库依赖磁盘，影片数量限制不替代磁盘配额；AI/TTS缓存需运维管理。文件头校验不保证媒体完整可播放。
- 短片需可录制浏览器和就绪分镜，网页切后台可能影响实时录制，失败不能保证自动恢复。
- 开发工具链和ECharts的依赖告警见本次优化报告；发布前持续审计，通过测试不等于没有安全风险。

## 路线图

- 抽样人工复核题材与名篇别名，扩充真正收录的作者。
- 为足迹增加可追溯史料及古今地名映射。
- 持续改善手机地图性能、读屏体验及减少动态效果导出。
- 增加缓存生命周期、磁盘配额、多实例限流。
- 验证ECharts主版本迁移与echarts-gl兼容性，清理剩余依赖公告。
- 按需设计D1/R2等托管架构迁移。

## 贡献与许可

请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，PR前运行lint、typecheck、test、build。安全问题参阅 [SECURITY.md](SECURITY.md)。项目代码采用 [MIT License](LICENSE)；第三方库、数据、底图各自遵守其许可，底图出处仍待补全。

## English Summary

Shijing is a Chinese-language gallery for exploring classical Chinese poetry through geography, reading, narration, and cinematic scenes. The repository chinese-poetry_demo and the package shijing-immersive refer to the same project. A three-dimensional map presents poets and their modern-city footprints, while a searchable library supports dynasty, author, and keyword filters. The reader creates deterministic storyboards, optional AI illustrations and commentary, browser or Edge narration, and generated ambient music. Supported browsers can combine ready illustrations, captions, narration, and music into WebM clips saved in the video gallery.

To run locally, install Node.js 24 or later, clone this repository, run npm ci, download the official chinese-poetry archive into data/chinese-poetry, and run npm run build:db followed by npm run dev. Copy .env.example to .env.local for optional AI configuration. Without credentials, procedural backgrounds remain available. The application requires persistent local storage for SQLite, generated assets, and videos. Public deployments should configure an administrator token and protect the complete site through an authenticating reverse proxy.

Poetry data comes from chinese-poetry under MIT; project code is also MIT. Generated commentary and images may be inaccurate. Footprints are simplified literary geography, and exact base-map provenance remains to be documented.
