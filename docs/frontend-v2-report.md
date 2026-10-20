# 诗境 · 前端第二轮改造报告（2026-10-20）

## 1. 第4—8节改动清单

| 节 | 状态 | 主要改动与文件 |
| --- | --- | --- |
| 4 视觉系统 | done | globals.css 按主题分节；墨绿、宣纸、朱砂、金色 tokens；ui 目录的印章、图标、卡片、分隔线；next/font/local 自托管两款 OFL 字体，总计260100字节，生僻字系统字体回退。 |
| 5 首页 | done | HomeHero 七列诗句只渲染一次；EntryVeil 原生模态入境幕；FeatureCards、DailyPoem、MoodTiles；统一 Topbar/Footer；今日诗失败隐藏，八意境按真实 tag 查询书库；视频不存在时静态山水，存在时遵守可见性、节流模式与减少动态效果。 |
| 6 声音 | done | audio-engine、sfx、AudioController、SoundControl；统一手势解锁、音乐和音效偏好、路由停止、七种合成音效、80ms节流与最多六组音效；ambient-music 原接口保留，clip 共用上下文并将旁白/音乐混到一条录制音轨。 |
| 7 地图 | done | map-explorer、map-options；视口600px内延迟加载；2D/3D能力选择和手动记忆；暖色地图、足迹路线/光晕、诗人时间线、6秒巡礼/10秒交互暂歇、文字名录、失败重试和资源清理。3D相机使用已核对的角度/距离选项，不把经纬度误当世界坐标。 |
| 8 其他页面 | done | library 纸卡/题材深链/空态；reader 横竖排和S/M/L持久化、快捷键和AI提示；video-library 按视口加载影片首帧、时长、原生删除弹窗；统一404/error页面。 |

未增加生产 UI、动画或音频依赖。Playwright仅作为开发依赖。原API、数据库、安全校验、限流、缓存及既有测试继续保留；AGENTS.md、CLAUDE.md未改。

## 2. 第3节九项发现核实

1. **confirmed**：原地图为偏青蓝科技视觉，已换墨绿、金色边界和暖色光照。
2. **confirmed**：原先没有自托管字体。现有文楷与思源宋体子集，来源及OFL许可证见 public/fonts 与 README。
3. **partly**：原首页14组诗句各重复6次、缺少叙事入口属实；原来已使用 vertical-rl，不能说原来只有旋转。现在七列一次渲染。
4. **confirmed**：原界面使用字符/表情作图标；本轮主要操作换内联SVG。
5. **confirmed**：原首页没有统一诗乐；现为默认静音、点击才创建AudioContext。
6. **confirmed**：原地图没有诗人路线，巡游只旋转；现按资料足迹顺序连接并逐人巡礼。
7. **confirmed**：原样式缺少统一 tokens，存在大量硬编码；已重组变量和共享组件。
8. **not confirmed**：第一轮已加入 prefers-reduced-motion，本轮扩展到入境幕、地图巡礼/光晕、视频与阅读滚动。
9. **confirmed**：原地图挂载即加载，缺少设备能力降级；现延迟导入并提供2D。

## 3. 运行与验证结果

- npm run lint：通过，无错误或警告；npx tsc --noEmit：通过；npm test：11/11通过；npm run build：通过。
- Next 16构建输出不再提供旧式 First Load JS 表，因此不编造该表数字。使用相同Chrome生产首页 networkidle 的已加载脚本 decodedBodySize：**2254055 → 549953字节，约减少75.6%**。这不是压缩传输体积，也不是所有路由的总bundle；滚动到地图后会继续加载地图库。
- Lighthouse 13.5 移动模拟：**Performance 87 / Accessibility 100 / Best Practices 100**，LCP 4.1秒、TBT 10ms、CLS 0.004。条件：本机production、首次访问入境幕、未安装首页视频，使用静态背景；不能据此保证含视频的公网分数。
- 生产与开发环境：四个页面各375/768/1024/1440，共各16次页面检查；无横向溢出、pageerror或console error。结果见 docs/screenshots/results.json、docs/verification/frontend-dev-pages.json。
- scripts/screenshots.mjs 可复现截图；18张页面/地图截图在 docs/screenshots。scripts/verify-frontend.mjs 验证入境、单上下文、静音记忆、路由停音、阅读配乐、排版记忆、2D/3D切换与路线；结果见 frontend-interactions.json。
- scripts/verify-recording.mjs 用合成测试旁白和本地SVG分镜实际生成WebM，验证可解码且有音频、删除模态框Escape/确认、切后台取消录制。测试拦截上传/删除，不写入真实影片库。结果见 frontend-recording.json；真实外部TTS/AI服务未调用。
- 独立审查发现并修复：后台暂停音频时钟造成成片错位（改为取消并提示重试）；空格长按重复启动朗读（忽略 repeat）。录制错误路径会清理声源、节点、帧回调和流轨道。

## 4. 音频说明

最终图：音乐局部master → music总线；音效及其混响 → sfx总线；两者 → master(0.5) → 压缩器(-14dB、4:1、attack .01、release .25) → analyser → 扬声器。首页音乐默认0.25，音效0.5；整体以约-6dB增益余量设计，已有浏览器RMS抽测，不声称所有组合经过峰值穷举。

七种音效：pluck、drop、knock、bell、chime、paper、ink；拨弦带0.3混响发送，所有音效在静音/暂停上下文下跳过。首页增加可选溪水、远钟与风铃；阅读默认音色不启用这些额外层。切换意境两秒交叉淡化，离开首页600ms淡出。

朝代映射：先秦/汉魏/魏晋/南北朝→空山禅意，唐→春风溪流，五代/宋→月夜清泉，元→大漠孤烟，明/清→秋暮长天。保留原音乐控制和 captureDest/getCaptureStream；成片从局部音乐master捕获，不把页面点击音效录进去。旁白与配乐汇入同一 MediaStreamDestination。window.__shijingAudio 提供状态/RMS检查。

## 5. 待补素材和后续验收

- 按用户要求，展示截图、演示地址、真实Vibe Coding经历、邮箱、底图来源说明由用户补充；未编造个人信息。
- 本地没有 hero-landscape.mp4。提供合法视频素材后放入 public/media，并重新构建、测试含视频的移动性能。
- 当前已经测试真实浏览器录制链路，但真实AI图片服务/Edge网络语音、真实线上上传/删除、长期缓存及生产部署仍需使用目标环境验收。
- iOS Safari、低端真实手机与实际扬声器试听未测试；webkitAudioContext、touchend、saveData和2D降级已有处理。
- 地图未补造足迹年份。按现有资料声明的生平顺序展示；若未来新增未排序资料，需先核对顺序。
- 字体子集覆盖常用界面字，诗库生僻字仍可能显示系统字体。可按实际内容补充子集，继续控制体积。
- 用户要求当前及后续任务在额度剩余5%时停止开发、先上传并报告进度。本次在仍有额度时完成本轮检查并上传进度分支；此规则继续适用。

## 6. 可见行为变化与风险

首次会话出现可用Escape静音关闭的入境幕；默认声音关闭，恢复页面不会绕过浏览器手势限制；字体、暗色视觉、首页结构和地图外观改变；低性能设备默认2D。阅读新增键盘操作，表单输入与重复按键不触发快捷键。生成短片时切后台会取消当前录制并允许重试，避免保存音画错位影片。

公网部署仍需配置 ADMIN_TOKEN 和既有访问保护；这属于部署配置，未把密钥写入仓库。此分支上传不等于公网部署完成。
