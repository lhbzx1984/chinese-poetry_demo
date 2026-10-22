"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DYNASTY_ORDER, POET_PLACES, type PoetPlace } from "@/data/poet-places";
import type { PoemSummary } from "@/lib/types";
import { buildSpots, type SpotDatum } from "@/lib/poet-map";

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

export default function MapExplorer() {
  const boxRef = useRef<HTMLDivElement>(null);
  const poetCardRef = useRef<HTMLDivElement>(null);
  const insetRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<import("echarts").ECharts | null>(null);
  const [dynasty, setDynasty] = useState<string>("");
  const [ready, setReady] = useState(false);
  const [sel, setSel] = useState<PoetPlace | null>(null);
  const [poems, setPoems] = useState<PoemSummary[] | null>(null);
  const [autoTour, setAutoTour] = useState(false);
  const autoTourRef = useRef(false);
  useEffect(() => { autoTourRef.current = autoTour; }, [autoTour]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [poemError, setPoemError] = useState<string | null>(null);

  const openPoet = useCallback((poet: PoetPlace) => {
    setSel(poet);
    setDynasty(current => current && current !== poet.dynasty ? "" : current);
    autoTourRef.current = false;
    setAutoTour(false);
    chartRef.current?.setOption({ geo3D: { viewControl: { autoRotate: false } } });
    // 名录位于地图下方，打开卡片时把地图中的详情带回视口。
    boxRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    poetCardRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (sel) poetCardRef.current?.focus({ preventScroll: true });
  }, [sel]);

  const activePoets = useMemo(() => dynasty ? POET_PLACES.filter((p) => p.dynasty === dynasty) : POET_PLACES, [dynasty]);

  const selectDynasty = (value: string) => {
    setDynasty(value);
    setSel(null);
  };

  const buildSeries = useCallback((poets: PoetPlace[], expand: string | null = null) => {
    const { points, halos } = buildSpots(poets, expand);
    return {
      series: [
        {
          name: "足迹光晕",
          type: "scatter3D",
          coordinateSystem: "geo3D",
          geo3DIndex: 0,
          symbolSize: 20,
          itemStyle: { color: "rgba(64,196,255,0.16)", opacity: 1, borderColor: "rgba(127,220,255,0.35)", borderWidth: 1 },
          data: halos,
          silent: true,
        },
        {
          name: "诗人足迹",
          type: "scatter3D",
          coordinateSystem: "geo3D",
          geo3DIndex: 0,
          symbolSize: 11,
          itemStyle: { color: "#dff6ff", opacity: 1, borderColor: "#37b6ff", borderWidth: 2 },
          label: {
            show: true,
            formatter: (p: { data: SpotDatum }) => (p.data.labelOn ? expand ? `${p.data.poet} · ${p.data.city}` : p.data.poet : ""),
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
          boxDepth: "auto",
          // 留极小的标记高度，避免圆点被顶面裁掉，同时防止透视悬空漂移。
          boxHeight: 1,
          regionHeight: 0.8,
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
            autoRotate: false,
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
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => {
      setAutoTour(false);
      chartRef.current?.setOption({ geo3D: { viewControl: { autoRotate: false } } });
    };
    motion.addEventListener("change", updateMotion);
    let disposed = false;
    let chart: import("echarts").ECharts | null = null;
    let mini: import("echarts").ECharts | null = null;
    (async () => {
      const echarts = await import("echarts");
      await import("echarts-gl");
      const chinaRes = await fetch("/geo/china3d.json");
      if (!chinaRes.ok) throw new Error("地图底图载入失败，请稍后刷新。");
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
        if (poet) openPoet(poet);
      });
      setAutoTour(false);
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
          mini = echarts.init(insetRef.current, undefined, { renderer: "canvas" });
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
    })().catch(() => { if (!disposed) setMapError("地图载入失败，请使用下方诗人名录浏览作品。"); });
    const onResize = () => {
      chartRef.current?.resize();
    };
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      motion.removeEventListener("change", updateMotion);
      window.removeEventListener("resize", onResize);
      chart?.dispose();
      mini?.dispose();
      chartRef.current = null;
    };
  }, [buildOption, openPoet]);

  // 朝代切换：更新光点与飞线
  useEffect(() => {
    if (!ready || !chartRef.current) return;
    chartRef.current.setOption({ series: buildSeries(activePoets, sel?.name ?? null).series }, { replaceMerge: ["series"] });
  }, [dynasty, ready, activePoets, sel, buildSeries]);

  // 支持程序化打开作者卡
  useEffect(() => {
    const open = (e: Event) => {
      const name = (e as CustomEvent<string>).detail;
      const poet = POET_PLACES.find((p) => p.name === name);
      if (poet) openPoet(poet);
    };
    window.addEventListener("shijing:open-poet", open);
    return () => window.removeEventListener("shijing:open-poet", open);
  }, [openPoet]);

  // 作者卡：代表作优先
  useEffect(() => {
    if (!sel) return;
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setPoems(null);
      setPoemError(null);
      const found: PoemSummary[] = [];
      const seen = new Set<number>();
      const grab = async (params: string) => {
        try {
          const r = await fetch(`/api/poems?${params}`);
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || "书库检索失败。");
          for (const p of (d.data.items ?? []) as PoemSummary[]) {
            if (!seen.has(p.id)) {
              seen.add(p.id);
              found.push(p);
            }
          }
        } catch (e) { if (!cancelled) setPoemError(e instanceof Error ? e.message : "书库检索失败。"); }
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
        <div className="timeline" role="group" aria-label="按朝代筛选">
          <button className={`chip${dynasty === "" ? " active" : ""}`} onClick={() => selectDynasty("")}>
            全部
          </button>
          {DYNASTY_ORDER.map((d) => (
            <button
              key={d.key}
              className={`chip${dynasty === d.key ? " active" : ""}`}
              onClick={() => selectDynasty(dynasty === d.key ? "" : d.key)}
              title={d.span}
            >
              {d.label}
            </button>
          ))}
          <button
            className={`chip${autoTour ? " active" : ""}`}
            title="自动旋转巡游；拖动或点击地图会暂停"
            onClick={() => {
              const next = !autoTour && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
        {!ready && <div className="map-loading" role="status">{mapError || "山河载入中…"}</div>}

        {sel && (
          <div className="poet-card" id="poet-detail" ref={poetCardRef} tabIndex={-1} role="dialog" aria-label={`${sel.name}介绍`}>
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
              {poemError ? <p role="alert">{poemError}</p> : poems === null ? (
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
                  <Link href="/library">浏览书库已收录作品 →</Link>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      <p className="map-foot" role="status">
        当前显示：{sel ? `${sel.name} · ${sel.spots.length} 处足迹` : `${dynasty || "全部朝代"} · ${activePoets.length} 位诗人`}
        {" · "}足迹为文学史通说之简绘，供神游参照 · 点击地图光点或下方名字，走进一位诗人
      </p>
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
                onClick={() => openPoet(p)}
                aria-expanded={sel?.name === p.name}
                aria-controls="poet-detail"
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
