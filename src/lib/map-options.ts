import type { PoetPlace } from "@/data/poet-places";
export type MapMode = "2d" | "3d";
export function preferredMapMode(
  webgl: boolean,
  small: boolean,
  cores: number,
  saveData: boolean,
): MapMode {
  return !webgl || saveData || (small && cores <= 4) ? "2d" : "3d";
}
export function provinceColor(name: string) {
  const shades = [
    "#1d2e2c",
    "#22403a",
    "#293c34",
    "#263d37",
    "#30483d",
    "#1d3530",
  ];
  let h = 0;
  for (const char of name) h = (h * 31 + char.charCodeAt(0)) >>> 0;
  return shades[h % shades.length];
}
export function mapSeries(
  poets: PoetPlace[],
  selected: string | null,
  mode: MapMode,
  mobile: boolean,
  reduced: boolean,
  showRoutes: boolean,
) {
  const chosen = selected
    ? poets.filter((p) => p.name === selected)
    : showRoutes
      ? poets
      : [];
  // 原资料明确按生平顺序编排，地点无逐站年份，保留原序且不推测补年。
  const routes = chosen
    .filter((p) => p.spots.length > 1)
    .map((p) => ({
      name: p.name,
      coords: p.spots.map((s) =>
        mode === "3d" ? [s.lng, s.lat, 0.5] : [s.lng, s.lat],
      ),
    }));
  let labels = 0;
  const points = poets.flatMap((p) =>
    (selected === p.name ? p.spots : [p.spots[0]]).map((s) => ({
      name: p.name,
      city: s.city,
      lat: s.lat,
      value: mode === "3d" ? [s.lng, s.lat, 1] : [s.lng, s.lat],
      label: {
        show:
          (selected === p.name || (!selected && poets.length <= 24)) &&
          labels++ < 30,
      },
      itemStyle: {
        color: selected === p.name ? "#b5342a" : "#e3c76e",
        opacity: selected && selected !== p.name ? 0.4 : 1,
        borderColor: "#7a5a1c",
        borderWidth: 1,
      },
    })),
  );
  return [
    {
      name: "诗人行迹",
      type: mode === "3d" ? "lines3D" : "lines",
      coordinateSystem: mode === "3d" ? "geo3D" : "geo",
      polyline: true,
      silent: true,
      data: routes,
      lineStyle: {
        color: "#e3c76e",
        width: selected ? 2.5 : 1,
        opacity: selected ? 0.9 : 0.18,
      },
      effect: {
        show: Boolean(selected) && !reduced,
        trailLength: 0.4,
        constantSpeed: 16,
        trailWidth: 3,
        trailColor: "#e3c76e",
        spotIntensity: 1,
      },
    },
    {
      name: "诗人足迹",
      type: mode === "3d" ? "scatter3D" : "scatter",
      coordinateSystem: mode === "3d" ? "geo3D" : "geo",
      data: points,
      symbolSize: mobile ? 18 : 12,
      label: {
        formatter: "{b}",
        color: "#f5efdc",
        fontSize: 13,
        textBorderColor: "#070d0f",
        textBorderWidth: 3,
        position: "top",
        distance: 8,
      },
      emphasis: {
        label: { show: true },
        itemStyle: { opacity: 1, color: "#f4ecd8" },
      },
    },
    {
      id: "poet-halo",
      type: mode === "3d" ? "scatter3D" : reduced ? "scatter" : "effectScatter",
      coordinateSystem: mode === "3d" ? "geo3D" : "geo",
      silent: true,
      data: points
        .filter((p) => p.name === selected)
        .map((p) => ({ value: p.value })),
      symbolSize: mobile ? 28 : 24,
      itemStyle: { color: "#b5342a", opacity: 0.18 },
      rippleEffect: { period: 3, scale: 2.2, brushType: "stroke" },
      showEffectOn: reduced ? "emphasis" : "render",
      label: { show: false },
    },
  ];
}
