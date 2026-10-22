import type { PoetPlace } from "../data/poet-places";

export type SpotDatum = {
  poet: string;
  dynasty: string;
  city: string;
  label: string;
  labelOn: boolean;
  value: [number, number, number];
};

// 光点标记：默认一位诗人一个主光点（籍贯），数量与诗人对应；
// 选中某位诗人时，展开他完整的足迹。
// 同城足迹保留真实坐标；不能通过挪动经纬度来避让标签。
export function buildSpots(poets: PoetPlace[], expand: string | null): { points: SpotDatum[]; halos: SpotDatum[] } {
  const points: SpotDatum[] = [];
  const halos: SpotDatum[] = [];
  for (const poet of expand ? poets.filter(p => p.name === expand) : poets) {
    const spots = poet.name === expand ? poet.spots : [poet.spots[0]];
    spots.forEach((s, i) => {
      const datum: SpotDatum = {
        poet: poet.name,
        dynasty: poet.dynasty,
        city: s.city,
        label: s.label,
        labelOn: poet.name === expand || i === 0,
        value: [s.lng, s.lat, 0],
      };
      points.push(datum);
      if (i === 0) halos.push({ ...datum, value: [s.lng, s.lat, 0] });
    });
  }
  return { points, halos };
}

