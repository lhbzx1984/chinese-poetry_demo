# 诗境 0.2.0 优化验收报告

日期：2026-10-20（Asia/Shanghai）。仓库基线：`923b225`；本地分支：`chore/shijing-0.2.0`。改动在本地完成，未推送、合并或部署公网。AGENTS.md、CLAUDE.md 与 SQLite schema 保持原样，无新增依赖种类。

## 1. 变更清单（A–H）

| 项目 | 状态 | 实现与说明 |
|---|---|---|
| A1 统计 | done | `scripts/stats.mjs`、package.json、README：96位/405足迹、12题材/41意象/7音色；真实库344315首 |
| A2 朝代/覆盖 | done | `scripts/check-poet-coverage.mjs`；汉魏→汉显式比较；选方案1，保留历史资料并明确提示未收录，区分API失败 |
| A3 环境模板 | done | `.env.example` 17项含额外现有IMAGE_API_KEY及测试VIDEOS_DIR；gitignore例外，check-ignore无输出且已提交 |
| A4 快速开始 | done | README从clone到启动，官方数据地址，下载前mkdir；部署data写入前建目录，FAQ；hero脚本增加自动读env的npm命令 |
| A5 当前态描述 | done | README重写，移除“不再/已改为/原来/之前”的历史变化措辞 |
| B1 上传 | done | Content-Length预检和逐块上限、WebM MIME/EBML、元数据清理、时长0–600、默认200影片；保留至少10KB限制 |
| B2 令牌 | done | `admin.ts`恒时比较；删除及可选上传；`instrumentation.ts`空令牌启动警告；`admin-client.ts`401提示且仅sessionStorage |
| B3 限流 | done | `rate-limit.ts`单进程滑动窗口；TTS/上传/新AI任务；缓存和运行中轮询不计AI限额；429/Retry-After及中文提示 |
| B4 播放 | done | Range及完整响应均用createReadStream/toWeb；后缀范围、206/416测试 |
| B5 部署 | done | `deploy-tencent.sh`默认直连、GH_MIRROR可选、REPO_REF固定版本、拒绝覆盖本地改动；移除rm-rf与删锁文件重试，cd前校验；README分步下载审核执行 |
| C README | done | 按要求13节与190词English Summary；API表取自路由；补影片馆/朗读/架构；截图仅.gitkeep及约定路径，个人经历保留占位符 |
| D1 package | done | engines>=24、typecheck/stats/check:data/test；pretypecheck先next typegen，description/license/repository |
| D2 .nvmrc | done | Node24 |
| D3 .editorconfig | done | UTF-8/LF/2空格 |
| D4 CI | done | Node24，npm ci→lint→typecheck→test→build；无data目录构建实测通过，未远端触发Actions |
| D5 检查问题 | done | 原7个lint错误及4个警告消除；data排除lint/tsconfig；运行时媒体不参与Turbopack打包 |
| E1 scenes | done | 绝句逐句、律诗逐联、词逐阕、诗经逐章、长篇上限、空输入；短文本不人为补足三幕 |
| E2 tags | done | 思乡/边塞/无匹配 |
| E3 rate-limit | done | 同窗超限、过窗恢复；AI缓存不计限流的端点回归 |
| E4 videos | done | 真实POST端点，超长声明/实际超长/类型/魔数/成功/令牌/容量/元数据；临时VIDEOS_DIR，无真实data污染 |
| E5 poet data | done | 姓名唯一、有足迹、经纬度73–136/18–54、朝代合法；没有超界坐标 |
| F1 元信息 | done | zh-CN、title/description、OG、独立viewport主题色 |
| F2 动态/音频 | done | CSS减少动画/淡入，地图监听系统偏好停止旋转，首页省流/减少动态效果不加载视频；音频均由交互启动；短片减少缓推/交叉淡化 |
| F3 无障碍 | done | 表单/场景导航命名、可见键盘焦点、原有有意义img alt、对比度调整，地图有按钮名录替代 |
| F4 错误/降级 | done | 缺库详情API与阅读页中文提示；地图/首页/书库/影片/体验错误可见，停止静默加载；图片失败有水墨说明 |
| F5 声明/署名 | done | 阅读页AI声明与chinese-poetry链接；首页署名纠正 |
| F6 375px | partly done | CSS窄屏换行、控件44px、限制长文本；尝试375×812浏览器覆盖，但返回innerWidth750/clientWidth720，截图超时，不能证明375px实测通过 |
| G1 GeoJSON | done | 三个均被使用，保留；缓存一天+陈旧重验证，Next compress:true；HTTP压缩/缓存另做验证 |
| G2 scaffold | done | 全文检索确认无引用后删除5个SVG |
| G3 检索 | done | page/pageSize正整数，最多60条，搜索词200字；库层有限值保护；原FTS转义保留并测特殊字符 |
| G4 数据库 | done | 保留readOnly:true及缺库中文报错，增加详情路由错误处理；测试验证写入被拒 |
| H1 SECURITY | done | 当前无账号体系、令牌范围、代理鉴权/IP信任/限流/磁盘/上传限制及私密报告建议；邮箱按要求留占位 |
| H2 CONTRIBUTING | done | 依赖、命令、提交规范、PR前检查 |
| H3 0.2.0 | done | package/lock版本与CHANGELOG，安全升级Next16.4.2及匹配ESLint配置 |
| H4 协作文件 | done | 两份文件未改；README只解释用途 |

补充修复：独立评审发现分镜改变会错配旧图片/译文。已为图片与赏析共用目录增加`scenes2`版本及实际场景内容哈希，读图按当前诗定位，URL带版本参数。旧文件保留，新版首次访问重新生成。回归测试先复现旧译文错配，再验证不复用旧缓存、当前路由读到新图。独立复核通过，无剩余重要发现。

依赖：Next.js与eslint-config-next从16.3.5升级并固定16.4.2，兼容更新sharp/source-map-js传递依赖。没有增加大型库或测试框架。ECharts及工具链剩余告警见第3节。

## 2. 运行结果

### 基线

- Node v24.15.0；原`npm ci`成功，初次audit为9项（1 moderate、7 high、1 critical）。
- `npm run lint`：失败，7 errors/4 warnings，涉及effect内同步setState、render更新ref、未使用导入与变量、依赖声明及内部导航。
- 首次`npx tsc --noEmit`：缺8处自动生成RouteContext/LayoutProps/PageProps；原因是干净克隆尚未next typegen。现在npm typecheck自动先生成。
- `npm run build`：成功，无数据库可构建；1条动态文件跟踪警告。

### 最终验收

- `npm run lint`：通过，0错误/0警告。
- `npm run typecheck`：通过（先next typegen）。
- `npm test`：9/9通过、0失败。使用Node内置test、类型剥离及仅测试侧解析钩子，不增加测试框架。
- `npm run build`：Next16.4.2通过、0警告。验证时将整个data目录安全临时移出，构建后恢复，证明不是依赖本机数据的偶然通过。
- `bash -n scripts/deploy-tencent.sh`：通过；未执行会修改服务器的部署步骤。
- `git diff --check`：通过；AGENTS.md/CLAUDE.md与基线无差异。
- 环境模板与README变量名集合一致：17项；英文摘要190词。
- HTTP实测：`/api/poems?pageSize=9999`为200、返回60条，总数344315；缺库时meta/experience返回500+中文说明，详情返回503+中文说明，阅读页200+“书库暂不可用”提示。
- 浏览器实测：主页展示344315、96/405；打开于谦卡片可见“书库暂未收录其作品”；书库表单可用，未捕获console error。375px精确验证未通过工具层确认，详见F6。

### stats

```text
地图：96 位诗人，405 处足迹
各朝代诗人：先秦1 汉魏2 魏晋1 南北朝1 唐46 五代2 宋35 元3 明3 清2
词表：12 类题材，41 种意象，7 个 Edge 中文音色
书库：344315 首诗词
先秦370 汉26 唐57427 五代45 宋275276 元10913 清258
数据库题材：12 类
```

完整原始输出：[stats.txt](verification/stats.txt)。

### check:data

```text
共 96 位诗人，通过 62，失败 34。
未收录作者在地图卡片显示明确提示；不伪造数据。
退出码 1（真实数据覆盖缺口，不伪装为全通过）。
```

未收录作者：曹植、陶渊明、谢灵运、于谦、唐寅、龚自珍、杨慎。其他未通过者多为名篇关键词与上游标题/分段版本差异，需要人工考据。曹操经汉魏→汉别名匹配；屈原作者存在。完整逐作者表：[poet-coverage.txt](verification/poet-coverage.txt)。

## 3. 发现但未处理的问题

- 34位作者的名篇/数据覆盖问题保留实况；没有改动文学史资料去迎合有限书库。
- 底图精确来源、版本、再分发许可无法从仓库核实，README标TBD，需维护者提供原始来源。
- `npm audit`剩余6项：ECharts moderate，以及braces/micromatch/fast-glob/@next/eslint-plugin-next/eslint-config-next关联high项；0 critical。工具建议的ESLint链“修复”为跨代降级，未贸然执行；ECharts修复建议为6.1.0，涉及echarts-gl兼容性，未做无验证的主版本升级。
- Next升级针对已公开安全公告；代码未使用公告中的攻击者可控SVG ImageResponse，但仍更新底层。参考：[Next公告](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j)、[ECharts公告](https://github.com/advisories/GHSA-fgmj-fm8m-jvvx)。原始audit报告：[npm-audit.json](verification/npm-audit.json)。
- 375px、减少动态效果/省流的浏览器级模拟未完整验证；相关代码已检查。真实WebM合成音画、Edge网络服务、Agnes生成以及多实例/公网负载未实际调用验证。
- Linux服务器部署、Cloudflare、pm2和远端GitHub Actions未实际运行；Bash仅语法检查，不能等同生产部署通过。

## 4. 需要维护者手动完成

1. 补入home/map/library/reader/video五张真实截图、演示网址或视频。
2. 填写真实Vibe Coding工具分工、提示词原文、成功/失败经验、取舍、耗时和迭代次数。
3. 补SECURITY中的联系邮箱；确认私密漏洞报告渠道可用。
4. 公网设置强随机ADMIN_TOKEN，按需启用REQUIRE_TOKEN_FOR_UPLOAD，并配置全站Basic Auth/Cloudflare Access、可信代理头和磁盘备份。
5. 补底图出处与许可，人工复核34位覆盖问题；chinese-poetry的MIT许可已通过上游LICENSE核实，无需凭记忆确认。
6. 在真实375px设备/浏览器、Chrome/Edge音画合成和目标Linux环境做最终验收；评估剩余依赖告警。
7. 审核本地分支后决定是否推送/提交PR/部署；本次没有向GitHub写入仓库状态。

## 5. 行为变化与风险

- 新增400/401/413/429/507，旧调用方不能再任意上传；DELETE在配置ADMIN_TOKEN后需要Bearer。
- 限流是单进程、按IP共享；反代必须覆盖转发头，NAT用户可能共用额度，重启会清空，多实例要网关/Redis。
- 单次WebM仍会在最多100MiB的内存限额内缓冲；流式读取限制总量，不能取代代理并发/磁盘配额。头部检查不能验证完整媒体。
- 分镜缓存升级会重新消耗AI额度；旧目录保留，需运维决定何时归档，避免磁盘持续增长。
- 短于三段的输入保留真实幕数，避免补写诗句；这对“至少三幕”的要求作了有据边界处理。
- 部署按REPO_REF检出detached HEAD，拒绝覆盖本地更改；默认改为官方GitHub直连，网络受限时需主动配置镜像。

