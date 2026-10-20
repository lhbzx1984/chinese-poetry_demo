// 阅读页的画面建议：只依据诗句意象匹配，不把文学场景当作真实地理位置。
export const SCENE_ENVIRONMENTS = [
  { id: "moon", name: "月下清辉", image: "/scenes/moon.webp", atmosphere: "银蓝月色 · 静夜", description: "月光落在远山与薄雾之间，留出静静读诗的空间。", keywords: ["明月", "月", "星河", "银河", "夜", "宵"] },
  { id: "river", name: "江上烟波", image: "/scenes/river.webp", atmosphere: "江流舟影 · 水雾", description: "远岸隐入水雾，舟影与流光随诗句缓缓展开。", keywords: ["江水", "江", "河", "溪", "湖", "潮", "浪", "波", "舟", "船", "帆", "渔"] },
  { id: "frontier", name: "塞外长风", image: "/scenes/frontier.webp", atmosphere: "大漠关山 · 风沙", description: "旷远的地平线与苍黄风沙，衬出边塞诗的辽阔。", keywords: ["大漠", "黄沙", "塞外", "边塞", "沙场", "烽火", "戍", "胡", "关", "漠", "沙"] },
  { id: "snow", name: "雪境寒林", image: "/scenes/snow.webp", atmosphere: "寒山飞雪 · 清寂", description: "冷白雪色掩住山林，天地间只留下稀疏的轮廓。", keywords: ["飞雪", "白雪", "雪", "冰", "寒霜"] },
  { id: "rain", name: "烟雨山川", image: "/scenes/rain.webp", atmosphere: "雨丝云岚 · 微凉", description: "雨丝穿过山川与远岸，让思绪落在朦胧的远处。", keywords: ["夜雨", "烟雨", "细雨", "新雨", "雨", "潇潇", "霖"] },
  { id: "garden", name: "春庭花影", image: "/scenes/garden.webp", atmosphere: "春风花枝 · 明朗", description: "新绿与花影在柔光里铺开，画面轻盈而舒展。", keywords: ["春晓", "春风", "春", "桃花", "花", "柳", "草", "莺", "燕"] },
  { id: "mountain", name: "山间云岚", image: "/scenes/mountain.webp", atmosphere: "层峦松风 · 清远", description: "层层山影从云雾中浮出，视线沿山势走向远方。", keywords: ["青山", "空山", "山", "峰", "岭", "峦", "松", "竹", "岚", "云"] },
  { id: "city", name: "城阙灯火", image: "/scenes/city.webp", atmosphere: "城楼街巷 · 人间", description: "城郭与灯火依次亮起，把诗中的人间气息带到眼前。", keywords: ["长安", "洛阳", "金陵", "宫阙", "城阙", "城", "宫", "殿", "楼", "灯", "烛"] },
  { id: "dusk", name: "长亭夕照", image: "/scenes/dusk.webp", atmosphere: "落日长风 · 暮色", description: "暖金色的夕照贴近地平线，为行旅与送别留下余晖。", keywords: ["夕阳", "落日", "斜阳", "残阳", "晚照", "日暮", "黄昏", "长亭", "暮"] },
  { id: "ink", name: "水墨留白", image: "/scenes/ink.webp", atmosphere: "淡墨远景 · 留白", description: "用淡墨与远山托住诗意，让没有明确景物的诗句自在呼吸。", keywords: [] },
] as const;

export type SceneEnvironment = (typeof SCENE_ENVIRONMENTS)[number];
export type SceneEnvironmentId = SceneEnvironment["id"];

function score(text: string, keywords: readonly string[]): number {
  return keywords.reduce((total, word) => total + (text.includes(word) ? (word.length > 1 ? 2 : 1) : 0), 0);
}

export function environmentById(id: SceneEnvironmentId): SceneEnvironment {
  return SCENE_ENVIRONMENTS.find((environment) => environment.id === id) ?? SCENE_ENVIRONMENTS[9];
}

export function matchSceneEnvironment(text: string, title = "", tags: readonly string[] = [], poemContext = ""): SceneEnvironment {
  // 优先看这一幕的诗句；本幕没有景物线索时再借用诗名、题材与全诗语境。
  for (const source of [text, `${title} ${tags.join(" ")}`, poemContext]) {
    let best: SceneEnvironment = SCENE_ENVIRONMENTS[9];
    let bestScore = 0;
    for (const environment of SCENE_ENVIRONMENTS) {
      const current = score(source, environment.keywords) +
        (environment.id === "rain" && source.includes("雨") ? 2 : 0) +
        (environment.id === "snow" && source.includes("雪") ? 2 : 0);
      if (current > bestScore) {
        best = environment;
        bestScore = current;
      }
    }
    if (bestScore > 0) return best;
  }
  return SCENE_ENVIRONMENTS[9];
}
