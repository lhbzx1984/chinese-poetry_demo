"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DYNASTY_ORDER, POET_PLACES, type PoetPlace } from "@/data/poet-places";
import type { PoemSummary } from "@/lib/types";

type SpotDatum = {
  poet: string;
  dynasty: string;
  city: string;
  label: string;
  labelOn: boolean;
  value: [number, number, number];
};

type Ring = [number, number][];
type GeoFeature = { properties: { name?: string }; geometry: { type: "Polygon" | "MultiPolygon"; coordinates: Ring[][] | Ring[] } | null };

// 大屏冰蓝色系：省份面板色 + 霓虹省界
const ICE_SHADES = ["#2a6a9e", "#3579b4", "#2a5f92", "#3f83bd", "#2d6aa5", "#3a74ac", "#2f7bb4", "#2c639b"];
function provinceColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return ICE_SHADES[h % ICE_SHADES.length];
}

// 参考图背景那种暗色世界地图纹理（画一次，作为地图底图）
function drawDarkWorldUrl(world: GeoFeature[]): string {
  const W = 1400;
  const H = 700;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const px = (lng: number) => ((lng + 180) / 360) * W;
  const py = (lat: number) => ((90 - lat) / 180) * H;
  ctx.fillStyle = "#060d18";
  ctx.fillRect(0, 0, W, H);
  for (const f of world) {
    const geom = f.geometry;
    if (!geom) continue;
    const polys: Ring[][] = geom.type === "Polygon" ? [geom.coordinates as Ring[]] : (geom.coordinates as Ring[][]);
    ctx.fillStyle = "#0d1c2e";
    ctx.strokeStyle = "rgba(90,140,190,0.18)";
    ctx.lineWidth = 0.6;
    for (const poly of polys) {
      for (const ring of poly) {
        if (!ring || ring.length < 3) continue;
        ctx.beginPath();
        ring.forEach(([lng, lat], i) => {
          const x = px(lng);
          const y = py(lat);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  }
  return canvas.toDataURL("image/png");
}

// 光点标记：默认一位诗人一个主光点（籍贯），数量与诗人对应；
// 选中某位诗人时，展开他完整的足迹。
// 同城/近距坐标自动散开（如曹操曹植同为亳州），避免光点互相覆盖。
function buildSpots(poets: PoetPlace[], expand: string | null): { points: SpotDatum[]; halos: SpotDatum[] } {
  const points: SpotDatum[] = [];
  const halos: SpotDatum[] = [];
  const placed = new Map<string, number>();
  const spread = (lng: number, lat: number): [number, number] => {
    const key = `${Math.round(lng * 2)}:${Math.round(lat * 2)}`;
    const k = placed.get(key) ?? 0;
    placed.set(key, k + 1);
    if (k === 0) return [lng, lat];
    const ring = Math.ceil(k / 4);
    const angle = ((k % 4) * Math.PI) / 2 + ring * 0.6;
    const r = 1.15 * ring;
    return [lng + Math.cos(angle) * r, lat + Math.sin(angle) * r * 0.8];
  };
  for (const poet of poets) {
    const spots = poet.name === expand ? poet.spots : [poet.spots[0]];
    spots.forEach((s, i) => {
      const [lng, lat] = spread(s.lng, s.lat);
      const datum: SpotDatum = {
        poet: poet.name,
        dynasty: poet.dynasty,
        city: s.city,
        label: s.label,
        labelOn: i === 0,
        value: [lng, lat, 0.35],
      };
      points.push(datum);
      if (i === 0) halos.push({ ...datum, value: [lng, lat, 0.15] });
    });
  }
  return { points, halos };
}

export default function MapExplorer() {
  const boxRef = useRef<HTMLDivElement>(null);
  const insetRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<import("echarts").ECharts | null>(null);
  const [dynasty, setDynasty] = useState<string>("");
  const [ready, setReady] = useState(false);
  const [sel, setSel] = useState<PoetPlace | null>(null);
  const [poems, setPoems] = useState<PoemSummary[] | null>(null);
  const [autoTour, setAutoTour] = useState(true);
  const autoTourRef = useRef(true);
  autoTourRef.current = autoTour;

  const activePoets = dynasty ? POET_PLACES.filter((p) => p.dynasty === dynasty) : POET_PLACES;

  const buildSeries = useCallback((poets: PoetPlace[], expand: string | null = null) => {
    const { points, halos } = buildSpots(poets, expand);
    return {
      series: [
        {
          name: "足迹光晕",
          type: "scatter3D",
          coordinateSystem: "geo3D",
          symbolSize: 20,
          itemStyle: { color: "rgba(64,196,255,0.16)", opacity: 1, borderColor: "rgba(127,220,255,0.35)", borderWidth: 1 },
          data: halos,
          silent: true,
          zlevel: 1,
        },
        {
          name: "诗人足迹",
          type: "scatter3D",
          coordinateSystem: "geo3D",
          symbolSize: 11,
          itemStyle: { color: "#dff6ff", opacity: 1, borderColor: "#37b6ff", borderWidth: 2 },
          label: {
            show: true,
            formatter: (p: { data: SpotDatum }) => (p.data.labelOn ? p.data.poet : ""),
            position: "top",
            distance: 8,
            color: "#cfeeff",
            fontSize: 12,
            fontWeight: 600 as const,
            textBorderColor: "rgba(3,12,24,0.95)",
            textBorderWidth: 2.5,
          },
          emphasis: {
            itemStyle: { color: "#ffffff", borderColor: "#7fe0ff" },
            label: { show: true, formatter: (p: { data: SpotDatum }) => `${p.data.poet} · ${p.data.city}`, color: "#aee8ff", fontSize: 12.5 },
          },
          tooltip: {
            formatter: (p: { data: SpotDatum }) =>
              `<b style="color:#7fdcff">${p.data.poet}</b> · ${p.data.dynasty}<br/>${p.data.city}：${p.data.label}`,
          },
          data: points,
        },
      ],
    };
  }, []);

  const buildOption = useCallback(
    (poets: PoetPlace[], regions: { name: string; itemStyle: { color: string } }[]) => {
      const { series } = buildSeries(poets);
      return {
        geo3D: {
          map: "china3d",
          boxDepth: 96,
          boxHeight: 9,
          regionHeight: 3.4,
          shading: "realistic",
          realisticMaterial: { roughness: 0.42, metalness: 0.3 },
          postEffect: { enable: true, bloom: { enable: true, intensity: 0.22 }, SSAO: { enable: false } },
          groundPlane: { show: false },
          light: {
            main: { color: "#dff2ff", intensity: 1.25, alpha: 32, beta: -18 },
            ambient: { intensity: 0.55 },
          },
          viewControl: {
            alpha: 42,
            beta: 0,
            distance: 88,
            autoRotate: true,
            autoRotateSpeed: 0.45,
            minDistance: 42,
            maxDistance: 150,
            rotateSensitivity: 1.1,
          },
          itemStyle: { color: "#2f6ea6", borderColor: "rgba(95,216,255,0.9)", borderWidth: 1.3 },
          regions,
          emphasis: {
            itemStyle: { color: "#59b7ec" },
            label: { show: true, color: "#dff6ff", fontSize: 11 },
          },
          label: { show: false },
        },
        series,
      };
    },
    [buildSeries]
  );

  // 初始化（仅客户端）：地图 + 暗色世界底图 + 南海诸岛小窗
  useEffect(() => {
    let disposed = false;
    let chart: import("echarts").ECharts | null = null;
    (async () => {
      const echarts = await import("echarts");
      await import("echarts-gl");
      const chinaRes = await fetch("/geo/china3d.json");
      const chinaJson = (await chinaRes.json()) as unknown as Parameters<typeof echarts.registerMap>[1];
      if (disposed || !boxRef.current) return;
      echarts.registerMap("china3d", chinaJson);
      const features = (chinaJson as unknown as { features: GeoFeature[] }).features;
      const regions = features
        .filter((f) => f.properties?.name)
        .map((f) => ({ name: f.properties.name!, itemStyle: { color: provinceColor(f.properties.name!) } }));

      // 暗色世界底图
      try {
        const worldRes = await fetch("/geo/world.json");
        const worldJson = (await worldRes.json()) as { features: GeoFeature[] };
        if (disposed) return;
        const url = drawDarkWorldUrl(worldJson.features);
        if (!disposed) boxRef.current.style.backgroundImage = `url(${url})`;
      } catch { /* 底图缺失不影响 */ }

      chart = echarts.init(boxRef.current, undefined, { renderer: "canvas" });
      chartRef.current = chart;
      chart.setOption(buildOption(POET_PLACES, regions));
      chart.on("click", (params: import("echarts").ECElementEvent) => {
        if (params.seriesType !== "scatter3D" || !params.data) return;
        const datum = params.data as unknown as SpotDatum;
        const poet = POET_PLACES.find((p) => p.name === datum.poet);
        if (poet) setSel(poet);
      });
      setReady(true);
      if (typeof window !== "undefined") {
        (window as unknown as Record<string, unknown>).__shijingMap = chart;
      }
      // 拖动后停止自动巡游（仅巡游中才 setOption，避免干扰点击判定）
      chart.getZr().on("mousedown", () => {
        if (autoTourRef.current && chartRef.current) {
          autoTourRef.current = false;
          setAutoTour(false);
          chartRef.current.setOption({ geo3D: { viewControl: { autoRotate: false } } });
        }
      });

      // 南海诸岛小窗（2D）
      if (!disposed && insetRef.current) {
        try {
          const fullRes = await fetch("/geo/china.json");
          const fullJson = (await fullRes.json()) as unknown as Parameters<typeof echarts.registerMap>[1];
          echarts.registerMap("cn-full", fullJson);
          const mini = echarts.init(insetRef.current, undefined, { renderer: "canvas" });
          mini.setOption({
            geo: {
              map: "cn-full",
              layoutCenter: ["50%", "50%"],
              layoutSize: "240%",
              center: [112.6, 12.8],
              zoom: 1,
              silent: true,
              label: { show: false },
              itemStyle: { areaColor: "rgba(47,110,166,0.3)", borderColor: "rgba(95,216,255,0.55)", borderWidth: 0.5 },
              emphasis: { disabled: true },
            },
          });
        } catch { /* 小窗失败可忽略 */ }
      }
    })();
    const onResize = () => {
      chartRef.current?.resize();
    };
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      chart?.dispose();
      chartRef.current = null;
    };
  }, [buildOption]);

  // 朝代切换：更新光点与飞线
  useEffect(() => {
    if (!ready || !chartRef.current) return;
    chartRef.current.setOption({ series: buildSeries(activePoets, sel?.name ?? null).series }, { notMerge: false, lazyUpdate: true });
  }, [dynasty, ready, activePoets, sel, buildSeries]);

  // 支持程序化打开作者卡
  useEffect(() => {
    const open = (e: Event) => {
      const name = (e as CustomEvent<string>).detail;
      const poet = POET_PLACES.find((p) => p.name === name);
      if (poet) setSel(poet);
    };
    window.addEventListener("shijing:open-poet", open);
    return () => window.removeEventListener("shijing:open-poet", open);
  }, []);

  // 作者卡：代表作优先
  useEffect(() => {
    if (!sel) return;
    setPoems(null);
    let cancelled = false;
    (async () => {
      const found: PoemSummary[] = [];
      const seen = new Set<number>();
      const grab = async (params: string) => {
        try {
          const r = await fetch(`/api/poems?${params}`);
          if (!r.ok) return;
          const d = await r.json();
          for (const p of (d.data.items ?? []) as PoemSummary[]) {
            if (!seen.has(p.id)) {
              seen.add(p.id);
              found.push(p);
            }
          }
        } catch { /* 忽略 */ }
      };
      for (const kw of sel.famous.slice(0, 5)) {
        if (cancelled) return;
        await grab(`author=${encodeURIComponent(sel.name)}&q=${encodeURIComponent(kw)}&pageSize=1`);
      }
      if (found.length < 4 && !cancelled) {
        await grab(`author=${encodeURIComponent(sel.name)}&pageSize=8`);
      }
      if (!cancelled) setPoems(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [sel]);

  const spotCount = POET_PLACES.reduce((n, p) => n + p.spots.length, 0);

  return (
    <section className="map-section" id="map">
      <header className="map-head">
        <div>
          <h2>诗人行迹 · 千年山河</h2>
          <p>
            沿着 {POET_PLACES.length} 位诗人的一生，看他们走过的 {spotCount} 处山河。点亮一个光点，走近一个人的一生。
          </p>
        </div>
        <div className="timeline" role="tablist" aria-label="按朝代筛选">
          <button className={`chip${dynasty === "" ? " active" : ""}`} onClick={() => setDynasty("")}>
            全部
          </button>
          {DYNASTY_ORDER.map((d) => (
            <button
              key={d.key}
              className={`chip${dynasty === d.key ? " active" : ""}`}
              onClick={() => setDynasty(dynasty === d.key ? "" : d.key)}
              title={d.span}
            >
              {d.label}
            </button>
          ))}
          <button
            className={`chip${autoTour ? " active" : ""}`}
            title="自动旋转巡游；拖动或点击地图会暂停"
            onClick={() => {
              const next = !autoTour;
              setAutoTour(next);
              chartRef.current?.setOption({ geo3D: { viewControl: { autoRotate: next } } });
            }}
          >
            {autoTour ? "◉ 巡游中" : "▷ 自动巡游"}
          </button>
        </div>
      </header>

      <div className="map-wrap">
        <div className="map-box tech" ref={boxRef} aria-label="诗人行迹 3D 中国地图" />
        <div className="southsea-inset" ref={insetRef} aria-label="南海诸岛" />
        {!ready && <div className="map-loading">山河载入中…</div>}

        {sel && (
          <div className="poet-card" role="dialog" aria-label={`${sel.name}介绍`}>
            <button className="pop-close" onClick={() => setSel(null)} aria-label="关闭">
              ×
            </button>
            <div className="poet-head">
              <span className="poet-name">{sel.name}</span>
              <span className="poet-era">
                {sel.dynasty} · {sel.years}
              </span>
            </div>
            <p className="poet-intro">{sel.intro}</p>
            <div className="poet-route">
              {sel.spots.map((s, i) => (
                <span key={i} className="route-dot" title={s.label}>
                  {s.city}
                  {i < sel.spots.length - 1 && <em>→</em>}
                </span>
              ))}
            </div>
            <div className="poet-poems">
              <div className="label">书库中的作品</div>
              {poems === null ? (
                <p className="dim">检索中…</p>
              ) : poems.length ? (
                <ul>
                  {poems.slice(0, 4).map((p) => (
                    <li key={p.id}>
                      <Link href={`/read/${p.id}`}>
                        《{p.title}》 {p.subtitle && <small>{p.subtitle}</small>}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link className="more" href={`/library?author=${encodeURIComponent(sel.name)}`}>
                      全部作品 →
                    </Link>
                  </li>
                </ul>
              ) : (
                <p className="dim">
                  书库暂未收录其作品，
                  <Link href={`/library?dynasty=${encodeURIComponent(sel.dynasty)}`}>看看同时代的作品 →</Link>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      <p className="map-foot">足迹为文学史通说之简绘，供神游参照 · 点击地图光点或下方名字，走进一位诗人</p>
      <div className="poet-index" aria-label="诗人名录">
        <div className="poet-index-title">
          {dynasty
            ? `${DYNASTY_ORDER.find((d) => d.key === dynasty)?.label ?? dynasty} · ${activePoets.length} 位诗人`
            : `历代诗人 · ${POET_PLACES.length} 位（选择上方朝代可筛选）`}
        </div>
        {(dynasty
          ? [{ key: dynasty, label: "", poets: activePoets }]
          : DYNASTY_ORDER.map((d) => ({ key: d.key, label: d.label, poets: POET_PLACES.filter((p) => p.dynasty === d.key) })).filter((g) => g.poets.length > 0)
        ).map((g) => (
          <div className="poet-group" key={g.key}>
            {g.label && <span className="poet-group-label">{g.label}</span>}
            {g.poets.map((p) => (
              <button
                key={p.name}
                className={`chip small${sel?.name === p.name ? " active" : ""}`}
                onClick={() => setSel(p)}
                title={`${p.years} · ${p.spots.length} 处足迹`}
              >
                {p.name}
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
