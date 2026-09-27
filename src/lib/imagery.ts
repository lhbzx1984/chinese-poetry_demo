// 意象词库：从诗句中识别古典意象，映射为中文标签 + 英文视觉提示词片段。
// 顺序即优先级：先命中且更靠前的意象优先出现在分镜画面里。
export type ImageryEntry = { zh: string; en: string; kw: string[] };

export const IMAGERY: ImageryEntry[] = [
  { zh: "明月", en: "a luminous full moon over misty water, silver moonlight", kw: ["明月", "月明", "皓月", "孤月", "江月", "山月", "秋月", "月出", "月下", "婵娟", "玉盘", "月光", "桂魄", "冰轮"] },
  { zh: "夜色", en: "deep night sky, drifting nocturnal mist", kw: ["夜", "宵", "暮", "黄昏", "暮色", "夜色", "星河", "银汉", "耿耿星河"] },
  { zh: "江水", en: "a vast river flowing to the horizon, rippling reflections", kw: ["江", "江水", "江流", "大江", "江畔", "江上", "潮", "浪", "波", "烟波", "碧水", "流水", "逝水", "沧浪", "清江", "江声"] },
  { zh: "孤舟", en: "a lone wooden boat drifting in the mist", kw: ["舟", "孤帆", "扁舟", "客船", "征棹", "兰舟", "画船", "渔舟", "孤蓬", "帆影", "归舟"] },
  { zh: "远山", en: "layered mountain silhouettes wrapped in clouds", kw: ["山", "青山", "远山", "空山", "万山", "千山", "群山", "峰", "岭", "峦", "崦", "岫", "山色", "云山", "巴山", "巫山", "庐山"] },
  { zh: "云雾", en: "drifting clouds and mountain mist", kw: ["云", "雾", "烟", "岚", "霭", "烟霞", "浮云", "白云", "晴岚"] },
  { zh: "飞雪", en: "falling snow over a silent landscape, cold white world", kw: ["雪", "飞雪", "白雪", "霜雪", "瑞雪", "大雪", "雪夜", "冰雪", "千里冰封"] },
  { zh: "雨丝", en: "streaks of rain, wet stone and dripping eaves", kw: ["雨", "细雨", "烟雨", "微雨", "夜雨", "疏雨", "骤雨", "梅雨", "雨滴", "潇潇"] },
  { zh: "落花", en: "falling petals drifting on wind and water", kw: ["落花", "落红", "残红", "飞花", "花落", "流水落花", "凋零", "落英"] },
  { zh: "繁花", en: "blossoming branches, petals in soft light", kw: ["花", "繁花", "百花", "桃", "杏", "梨花", "荷", "莲", "菊", "梅", "桂", "牡丹", "芍药", "海棠", "蔷薇", "芙蓉", "花影", "花开"] },
  { zh: "杨柳", en: "weeping willows trailing over water", kw: ["柳", "杨柳", "烟柳", "折柳", "柳丝", "柳色", "章台柳"] },
  { zh: "孤雁", en: "a line of wild geese crossing the sky", kw: ["雁", "孤雁", "归雁", "雁字", "征鸿", "鸿雁", "飞鸿", "雁声"] },
  { zh: "飞鸟", en: "birds rising from the reeds into open sky", kw: ["鸟", "飞鸟", "黄鹂", "白鹭", "燕子", "莺", "鸦", "鹊", "杜鹃", "子规", "鹤", "鸥", "凤", "凰"] },
  { zh: "烽火", en: "beacon fires glowing on distant ramparts, war haze", kw: ["烽火", "烽烟", "狼烟", "烽燧", "战火"] },
  { zh: "沙场", en: "a vast desert battlefield at dusk, banners and dust", kw: ["沙场", "战场", "大漠", "黄沙", "平沙", "瀚海", "戈壁", "塞外", "关塞", "孤城", "铁马", "金戈", "旌旗", "战旗", "征尘"] },
  { zh: "刀剑", en: "a gleaming blade, cold steel in dim light", kw: ["剑", "刀", "吴钩", "干将", "莫邪", "龙泉", "弓", "箭", "雕弓", "铁衣", "甲"] },
  { zh: "金樽", en: "a bronze wine cup lifted in candlelight", kw: ["酒", "金樽", "樽", "杯", "盏", "觞", "醉", "酌", "酣", "玉壶", "清酒", "美酒", "杜康", "兰陵", "屠苏", "腊酒", "把酒", "对酒"] },
  { zh: "琴音", en: "a guqin under the moon, faint strings and incense", kw: ["琴", "瑶琴", "素琴", "弦", "琵琶", "筝", "瑟", "胡笳", "羌笛", "笛", "箫", "玉笛", "芦管", "笙", "角", "钟", "磬", "鼓"] },
  { zh: "灯火", en: "a flickering oil lamp casting warm halo in darkness", kw: ["灯", "孤灯", "残灯", "烛", "红烛", "蜡炬", "灯火", "渔火", "青灯", "寒灯", "灯花"] },
  { zh: "亭台", en: "an ancient pavilion at the water's edge", kw: ["亭", "长亭", "短亭", "驿亭", "楼", "高楼", "危楼", "阁", "台", "楼台", "画楼", "朱楼", "西楼", "谯楼", "城阙", "宫阙"] },
  { zh: "古寺", en: "a mountain temple with tiled roofs and bell tolls", kw: ["寺", "禅房", "山寺", "古刹", "僧", "钟声", "梵音", "菩提", "香台", "浮屠", "塔"] },
  { zh: "宫殿", en: "faded palace halls, carved railings and jade steps", kw: ["宫", "殿", "凤阙", "未央", "长门", "阿房", "铜雀", "金銮", "玉阶", "雕栏", "玉砌"] },
  { zh: "废墟", en: "ruined walls overgrown with weeds, lingering grandeur", kw: ["荒台", "废苑", "遗踪", "陈迹", "禾黍", "断碑", "残垣", "荒城", "故垒"] },
  { zh: "松竹", en: "pine and bamboo groves in cool green shade", kw: ["松", "竹", "修竹", "篁", "柏", "松风", "松涛", "翠竹", "幽篁", "劲松"] },
  { zh: "秋叶", en: "autumn leaves falling along a stone path", kw: ["秋", "落叶", "黄叶", "梧桐", "枫", "霜叶", "残荷", "衰草", "西风", "金风"] },
  { zh: "春晓", en: "fresh spring dawn light over budding branches", kw: ["春", "东风", "春风", "新柳", "嫩芽", "春晓", "春色", "芳草", "青青", "踏青"] },
  { zh: "晨曦", en: "first light of dawn breaking over quiet land", kw: ["晨", "晓", "曙", "朝霞", "初日", "旭日", "曦", "日出", "朝阳"] },
  { zh: "夕阳", en: "a setting sun bleeding gold across the sky", kw: ["夕阳", "落日", "斜阳", "残阳", "晚照", "日暮", "余晖", "长河落日"] },
  { zh: "霜露", en: "white frost glittering on withered grass", kw: ["霜", "露", "白露", "寒霜", "玉露", "清露", "霜天", "霜华"] },
  { zh: "星河", en: "the milky way arching over sleeping mountains", kw: ["星", "星辰", "银河", "天河", "斗牛", "北斗", "牵牛", "织女", "星汉"] },
  { zh: "陌上", en: "a country path between green fields", kw: ["陌", "阡陌", "小径", "幽径", "古道", "石径", "柴门", "篱落", "村坞"] },
  { zh: "城郭", en: "ancient city walls and gates under vast sky", kw: ["城", "都门", "京城", "长安", "洛阳", "姑苏", "金陵", "汴京", "临安", "城郭", "市桥", "朱雀桥", "乌衣巷"] },
  { zh: "归人", en: "a lone traveler in period robes on a long road", kw: ["客", "行人", "旅人", "游人", "征人", "归人", "游子", "断肠人", "行客"] },
  { zh: "佳人", en: "a graceful figure in period silk robes, seen from afar", kw: ["佳人", "美人", "伊人", "红颜", "玉人", "罗裙", "红妆", "蛾眉", "翠袖", "婵娟女", "妾", "闺中", "淑女"] },
  { zh: "思妇", en: "a solitary woman leaning at the rail in a lamplit boudoir", kw: ["思妇", "倚门", "凭栏", "望夫", "闺中", "妆楼", "罗帐", "锦衾", "孤枕", "翠楼"] },
  { zh: "泪眼", en: "glistening tears in candlelight, restrained sorrow", kw: ["泪", "泪痕", "垂泪", "沾襟", "掩泣", "泣", "涕"] },
  { zh: "梦境", en: "surreal dream haze, edges dissolving into mist", kw: ["梦", "梦回", "幽梦", "残梦", "入梦", "梦泽", "庄生梦蝶", "魂"] },
  { zh: "鹤影", en: "a white crane gliding through mountain mist", kw: ["鹤", "白鹤", "仙鹤", "黄鹤", "鹤鸣", "骑鹤"] },
  { zh: "寒潭", en: "a still cold pool reflecting bare cliffs", kw: ["潭", "寒潭", "深潭", "龙潭", "碧潭"] },
  { zh: "渔火", en: "scattered fishing lights on a dark river", kw: ["渔", "渔火", "渔翁", "渔父", "钓", "垂钓", "渔歌", "罾"] },
  { zh: "牧歌", en: "a herd boy and buffalo on a misty slope", kw: ["牧", "牧童", "牛", "短笛", "骑牛", "村笛"] },
];

// 视觉基调：按题材/意象给整首诗定调
export const MOODS: { key: string; en: string; zh: string }[] = [
  { key: "山水田园", en: "serene verdant mountains and quiet fields, contemplative pastoral mood", zh: "青山田园的宁静致远" },
  { key: "边塞征战", en: "harsh frontier grandeur, iron, dust and amber dusk light", zh: "塞外苍茫、金戈铁马" },
  { key: "送别赠答", en: "wistful farewell atmosphere, long shadows and drifting petals", zh: "依依惜别的怅惘" },
  { key: "思乡怀人", en: "moonlit melancholy and homesick stillness", zh: "月夜怀乡的清愁" },
  { key: "咏史怀古", en: "faded grandeur, ruins in golden haze, echoes of history", zh: "兴亡之叹的苍凉" },
  { key: "咏物抒怀", en: "intimate still-life attention, symbolic light on a single subject", zh: "托物言志的清雅" },
  { key: "爱情闺怨", en: "lantern-lit intimacy, silk textures and shadowed longing", zh: "灯影帘幕的幽情" },
  { key: "节令风物", en: "festive warmth, lanterns and human bustle in period detail", zh: "人间节令的烟火" },
  { key: "饮酒宴饮", en: "candlelit revelry, wine-warm amber tones", zh: "把酒言欢的酣畅" },
  { key: "哲理禅意", en: "minimal zen emptiness, mist, silence and single shafts of light", zh: "禅意空灵" },
  { key: "忧国忧民", en: "somber epic gravity, war-torn land under heavy sky", zh: "忧思沉重的家国" },
  { key: "行旅羁愁", en: "lonely road, weathered travel, wide empty distances", zh: "羁旅天涯的苍茫" },
];

export const DEFAULT_MOOD = { en: "contemplative classical Chinese lyric mood", zh: "古典诗意的凝望" };

// 色板：统一整首诗的色彩基调（视觉圣经的「色彩」部分）
export const PALETTES: { zh: string; css: [string, string, string]; hint: string; kws: string[] }[] = [
  { zh: "月夜青蓝", css: ["#0a1a2f", "#274b6d", "#cfd8e3"], hint: "moonlit blues and silver", kws: ["月", "夜", "星", "银汉", "宵", "婵娟"] },
  { zh: "秋暮金橙", css: ["#2b1a08", "#8a4a12", "#e8b45a"], hint: "amber autumn dusk gold", kws: ["秋", "夕阳", "落日", "西风", "枫", "暮", "残阳"] },
  { zh: "春晓青绿", css: ["#0d2618", "#2f6b45", "#a8d8a0"], hint: "fresh spring greens and pale jade", kws: ["春", "柳", "草", "东风", "花", "桃", "杏"] },
  { zh: "塞外苍黄", css: ["#241708", "#7a5a20", "#d9b26a"], hint: "desert ochre and dust", kws: ["塞", "沙", "漠", "烽", "戍", "胡", "关"] },
  { zh: "雪夜冷灰", css: ["#131a1e", "#3c4c57", "#dce6ec"], hint: "cold snow greys and pale steel", kws: ["雪", "冰", "霜", "寒"] },
  { zh: "水墨烟白", css: ["#1a1d20", "#4a525a", "#e6e9ea"], hint: "ink-wash monochrome with paper white", kws: ["禅", "空", "渔", "舟", "溪", "鹤"] },
  { zh: "闺阁绛红", css: ["#26090e", "#7a2033", "#e8a0a8"], hint: "crimson silk and candle warm", kws: ["闺", "妆", "红", "烛", "相思", "锦", "钗"] },
  { zh: "宫阙暗金", css: ["#1c1206", "#6b4a14", "#d4af6a"], hint: "imperial dark gold and lacquer", kws: ["宫", "殿", "阙", "銮", "阶", "史", "兴亡"] },
];

export function pickPalette(text: string): { zh: string; css: [string, string, string]; hint: string } {
  let best: { score: number; hit: (typeof PALETTES)[number] } | null = null;
  for (const p of PALETTES) {
    let score = 0;
    for (const kw of p.kws) {
      const n = Math.min(3, text.split(kw).length - 1);
      score += n;
    }
    if (!best || score > best.score) best = { score, hit: p };
  }
  const hit = best && best.score > 0 ? best.hit : PALETTES[0];
  return { zh: hit.zh, css: hit.css, hint: hit.hint };
}
