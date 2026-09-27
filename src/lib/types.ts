export type PoemSummary = {
  id: number;
  title: string;
  subtitle: string | null;
  author: string;
  dynasty: string;
  collection: string;
  firstLine: string;
  tags: string[];
};

export type Poem = PoemSummary & { lines: string[] };

export type AuthorInfo = { name: string; dynasty: string; poemCount: number };

export type PoemListResult = { items: PoemSummary[]; total: number; page: number; pageSize: number };

export type MetaInfo = {
  total: number;
  dynasties: { name: string; count: number }[];
  tags: { name: string; count: number }[];
  collections: { name: string; label: string }[];
  builtAt: string;
};

export type SceneImage = { index: number; status: "ready" | "pending" | "failed" | "idle"; url: string | null };

export type Scene = {
  index: number;
  lines: string[];
  text: string;
  imagery: { zh: string; en: string }[];
  translation: string | null;
  note: string | null;
};

export type ExperienceData = {
  poem: Poem;
  visualBible: {
    era: string;
    mood: string;
    palette: { zh: string; css: [string, string, string] };
    imagerySummary: string;
  };
  scenes: Scene[];
  images: SceneImage[];
  mode: "ai" | "fallback";
  aiProgress: { done: number; total: number };
  imagesCached: boolean;
  analysisDone: boolean;
};
