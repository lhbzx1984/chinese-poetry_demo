# 诗境前端 v2 实施计划

依据用户确认的 codex-prompt-v2-frontend.md 全部执行。保留第一轮API、SQLite、安全、缓存及测试。视觉采用暗墨青瓷、宣纸细纹、金箔细线与朱砂印章；不引入UI/动画/音频库。音频必须由真实点击解锁，首页与阅读共用一个播放引擎，录制捕获不受首页音效污染。

## 文件与接口

- 4：globals.css重组token及响应式样式，ui/{icons,seal,paper-card,ink-divider}、use-reveal；本地字体有合法来源且能控制体积才加入。
- 5：首页重写为七列诗句、入境幕、三入口、今日一诗、八意境、延迟加载地图、统一页脚；Topbar提供共享导航及声音按钮。
- 6：audio-engine拥有一个AudioContext、music/sfx/master/压缩器；sfx节流及声部上限；ambient-music保留start/stop/setVolume/setDuck/getCaptureStream/captureDest/context/level等接口。AudioController管理偏好、路由和可见性，录制复用引擎并混入单条音轨。
- 7：map-options纯数据配置+测试；地图视口附近才import/fetch，按能力选择2D/3D；真实顺序路线、选点定位、6秒巡礼/10秒空闲恢复、失败重试与可读名录。
- 8：书库卡片/URL题材、阅读竖排与字号/快捷键、影片缩略图/确认弹窗、404与错误边界。

## 验证

- 基线lint、tsc、build和生产页实际JS加载字节，原9项源码发现逐项核对；第8项“无减少动态效果”已被第一轮修复，不能重复认定。
- 新非平凡逻辑先写node:test再实现：地图路线/标签数/2D降级、SFX限流、共享引擎录制连接及任务取消。
- Playwright仅devDependency，用本机Chrome离线运行；记录375/768/1024/1440溢出、焦点、声音手势/静音/路由、阅读录制；生产及开发浏览器日志。
- 六节各提交一次；最终lint、tsc、test、build、独立评审与要求格式报告。字体/Lighthouse若环境不能完成明确标记，不编造数值。

## 额度与交付约定
用户要求当前及后续任务在小时额度剩余5%时停止继续改造；先保存并上传当前进度分支，再汇报已完成与待办。不得把未完成进度合并为稳定版本。当前API实际提供5小时窗口，以该窗口剩余比例执行。

## 第3节核查
1地图蓝色冲突确认；2无自托管字体确认；3首页缺叙事且14列各重复6次确认（原诗句本身已有vertical-rl，不能称纯旋转）；4字形图标确认；5首页无声音确认；6无lines3D且只旋转确认；7token缺失/硬编码确认；8无减少动态效果不确认（第一轮已加入）；9挂载立即加载、无能力降级确认。

基线：lint/tsc/build通过；生产首页networkidle脚本解码后总字节2254055，详见verification/frontend-baseline.json。该数为实际加载量，含立即加载的地图库，不是Next16未提供的First Load JS表。
