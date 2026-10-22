// 朗读音色目录（纯数据，客户端服务端共用）
export type EdgeVoice = { id: string; name: string; gender: "女" | "男"; style: string };

export const DOUBAO_VOICES: EdgeVoice[] = [
  { id: "zh_female_vv_uranus_bigtts", name: "豆包 Vivi", gender: "女", style: "自然清晰" },
  { id: "zh_male_wenrouxiaoge_uranus_bigtts", name: "豆包温柔小哥", gender: "男", style: "温和舒缓" },
];
export const DEFAULT_ONLINE_VOICE = DOUBAO_VOICES[0].id;

// Edge 神经语音（msedge-tts，免费无需 key，需联网）
export const EDGE_VOICES: EdgeVoice[] = [
  { id: "zh-CN-XiaoxiaoNeural", name: "晓晓", gender: "女", style: "温暖柔美" },
  { id: "zh-CN-XiaoyiNeural", name: "晓伊", gender: "女", style: "清亮甜美" },
  { id: "zh-CN-liaoning-XiaobeiNeural", name: "晓北", gender: "女", style: "东北幽默" },
  { id: "zh-CN-YunxiNeural", name: "云希", gender: "男", style: "阳光少年" },
  { id: "zh-CN-YunjianNeural", name: "云健", gender: "男", style: "浑厚磁性" },
  { id: "zh-CN-YunyangNeural", name: "云扬", gender: "男", style: "沉稳播音" },
  { id: "zh-CN-YunxiaNeural", name: "云夏", gender: "男", style: "清朗少年" },
];
