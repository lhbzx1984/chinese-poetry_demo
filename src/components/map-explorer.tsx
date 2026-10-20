"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ECharts, EChartsOption } from "echarts";
import { DYNASTY_ORDER, POET_PLACES, type PoetPlace } from "@/data/poet-places";
import {
  mapSeries,
  preferredMapMode,
  provinceColor,
  type MapMode,
} from "@/lib/map-options";
import { DYNASTY_MOOD } from "@/lib/ambient-music";
import { useAudio } from "./audio-controller";
import { SoundControl } from "./sound-control";
import { Icon } from "./ui/icons";
import { Seal } from "./ui/seal";
import type { PoemSummary } from "@/lib/types";
export default function MapExplorer() {
  const section = useRef<HTMLElement>(null),
    box = useRef<HTMLDivElement>(null),
    inset = useRef<HTMLDivElement>(null),
    chart = useRef<ECharts | null>(null);
  const audio = useAudio(),
    audioRef = useRef(audio);
  useEffect(() => {
    audioRef.current = audio;
  }, [audio]);
  const [mode, setMode] = useState<MapMode | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [dynasty, setDynasty] = useState(""),
    [selected, setSelected] = useState<PoetPlace | null>(null),
    [spot, setSpot] = useState(0),
    [poems, setPoems] = useState<PoemSummary[] | null>(null),
    [poemError, setPoemError] = useState("");
  const [reduced, setReduced] = useState(false),
    [tour, setTour] = useState(false),
    [paused, setPaused] = useState(false),
    [tourIndex, setTourIndex] = useState(0);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null),
    tourCursor = useRef(0);
  const active = useMemo(
    () =>
      dynasty ? POET_PLACES.filter((p) => p.dynasty === dynasty) : POET_PLACES,
    [dynasty],
  );
  const pause = useCallback(() => {
    setPaused(true);
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => setPaused(false), 10000);
  }, []);
  const select = useCallback(
    (poet: PoetPlace, index = 0, fromTour = false) => {
      setSelected(poet);
      setSpot(index);
      if (!fromTour) {
        pause();
        audioRef.current.playSfx("bell", { volume: 0.5 });
        audioRef.current.playSfx("drop", { volume: 0.5 });
      } else audioRef.current.playSfx("pluck", { volume: 0.35 });
    },
    [pause],
  );
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion:reduce)"),
      element = section.current;
    const sync = () => {
      setReduced(motion.matches);
      if (motion.matches) setTour(false);
    };
    motion.addEventListener("change", sync);
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        const canvas = document.createElement("canvas");
        let webgl = false;
        try {
          const gl = canvas.getContext("webgl");
          webgl = Boolean(gl);
          gl?.getExtension("WEBGL_lose_context")?.loseContext();
        } catch {
          /* 二维兜底 */
        }
        const small = window.innerWidth < 768,
          saveData = Boolean(
            (navigator as Navigator & { connection?: { saveData?: boolean } })
              .connection?.saveData,
          );
        let next = preferredMapMode(
          webgl,
          small,
          navigator.hardwareConcurrency || 4,
          saveData,
        );
        try {
          const saved = localStorage.getItem("shijing:map-mode");
          if (saved === "2d" || (saved === "3d" && webgl)) next = saved;
        } catch {
          /* 使用能力判断 */
        }
        setMode(next);
        setReduced(motion.matches);
        setTour(!motion.matches);
        observer.disconnect();
      },
      { rootMargin: "600px" },
    );
    if (element) observer.observe(element);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", sync);
      if (idle.current) clearTimeout(idle.current);
    };
  }, []);
  useEffect(() => {
    if (!mode) return;
    let disposed = false,
      instance: ECharts | null = null,
      mini: ECharts | null = null,
      resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        instance?.resize();
        mini?.resize();
      }, 120);
    };
    const visibility = () => {
      if (document.hidden) pause();
    };
    void (async () => {
      await Promise.resolve();
      if (disposed) return;
      setReady(false);
      setError("");
      const ec = await import("echarts");
      if (mode === "3d") await import("echarts-gl");
      const response = await fetch("/geo/china3d.json");
      if (!response.ok) throw Error("底图暂时无法载入");
      const json = await response.json();
      if (disposed || !box.current) return;
      ec.registerMap("poetry-china", json);
      instance = ec.init(box.current, undefined, {
        renderer: "canvas",
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      });
      chart.current = instance;
      const mobile = window.innerWidth < 768;
      const regions = json.features
        .filter((f: { properties: { name?: string } }) => f.properties.name)
        .map((f: { properties: { name: string } }) => ({
          name: f.properties.name,
          itemStyle: {
            color: provinceColor(f.properties.name),
            areaColor: provinceColor(f.properties.name),
          },
        }));
      const base = {
        animation: !window.matchMedia("(prefers-reduced-motion:reduce)")
          .matches,
        animationDurationUpdate: 800,
        backgroundColor: "transparent",
        tooltip: {
          trigger: "item",
          renderMode: "richText",
          backgroundColor: "#0b1417",
          borderColor: "#b3924a",
          textStyle: { color: "#f5efdc" },
          formatter: (p: { data?: { name?: string; city?: string } }) =>
            p.data?.city
              ? `${p.data.name} · ${p.data.city}`
              : p.data?.name || "",
        },
      };
      instance.setOption(
        (mode === "3d"
          ? {
              ...base,
              geo3D: {
                map: "poetry-china",
                boxDepth: mobile ? 78 : 96,
                boxHeight: 8,
                regionHeight: 2.5,
                shading: mobile ? "lambert" : "realistic",
                postEffect: {
                  enable: !mobile,
                  bloom: { enable: !mobile, intensity: 0.08 },
                },
                light: {
                  main: {
                    color: "#fff1cf",
                    intensity: 1,
                    alpha: 38,
                    beta: -12,
                  },
                  ambient: { intensity: 0.6 },
                },
                viewControl: {
                  alpha: 42,
                  beta: 0,
                  distance: 95,
                  autoRotate: false,
                  minDistance: 40,
                  maxDistance: 160,
                  animationDurationUpdate: 800,
                },
                itemStyle: {
                  color: "#22403a",
                  borderColor: "#b3924a77",
                  borderWidth: 0.7,
                },
                regions,
                label: { show: false },
              },
            }
          : {
              ...base,
              geo: {
                map: "poetry-china",
                roam: true,
                zoom: 1.05,
                itemStyle: {
                  areaColor: "#22403a",
                  borderColor: "#b3924a77",
                  borderWidth: 0.7,
                },
                regions,
                label: { show: false },
                emphasis: {
                  label: { show: true, color: "#f5efdc" },
                  itemStyle: { areaColor: "#3e5748" },
                },
              },
            }) as EChartsOption,
      );
      instance.on("click", (p) => {
        if (!p.seriesType?.startsWith("scatter")) return;
        const data = p.data as { name?: string; city?: string };
        const poet = POET_PLACES.find((x) => x.name === data.name);
        if (poet)
          select(
            poet,
            Math.max(
              0,
              poet.spots.findIndex((s) => s.city === data.city),
            ),
          );
      });
      instance.on("mouseover", (p) => {
        if (
          !p.seriesType?.startsWith("scatter") ||
          !window.matchMedia("(hover:hover)").matches
        )
          return;
        const latitude = (p.data as { lat?: number }).lat || 32;
        const scale = [0, 2, 4, 7, 9, 12];
        audioRef.current.playSfx("pluck", {
          note: scale[
            Math.max(0, Math.min(5, Math.round(((54 - latitude) / 36) * 5)))
          ],
          volume: 0.4,
        });
      });
      instance.getZr().on("mousedown", pause);
      if (inset.current) {
        try {
          const full = await fetch("/geo/china.json");
          if (!full.ok) throw Error();
          const fullJson = await full.json();
          if (disposed) return;
          ec.registerMap("poetry-inset", fullJson);
          mini = ec.init(inset.current, undefined, {
            devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
          });
          mini.setOption({
            animation: false,
            geo: {
              map: "poetry-inset",
              layoutCenter: ["50%", "50%"],
              layoutSize: "240%",
              center: [112.6, 12.8],
              silent: true,
              itemStyle: {
                areaColor: "#22403a",
                borderColor: "#b3924a77",
                borderWidth: 0.5,
              },
              emphasis: { disabled: true },
              label: { show: false },
            },
          });
        } catch {
          /* 小窗失败不妨碍主图 */
        }
      }
      if (!disposed) {
        setReady(true);
        (window as unknown as Record<string, unknown>).__shijingMap = instance;
      }
    })().catch(() => {
      if (!disposed) {
        if (mode === "3d") {
          try {
            localStorage.setItem("shijing:map-mode", "2d");
          } catch {
            /* 忽略 */
          }
          setMode("2d");
        } else setError("山河暂未载入，请重试；也可使用下方诗人名录。");
      }
    });
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibility);
      if (resizeTimer) clearTimeout(resizeTimer);
      instance?.dispose();
      mini?.dispose();
      chart.current = null;
    };
  }, [mode, retry, pause, select]);
  useEffect(() => {
    if (!ready || !chart.current || !mode) return;
    chart.current.setOption(
      {
        series: mapSeries(
          active,
          selected?.name || null,
          mode,
          window.innerWidth < 768,
          reduced,
          Boolean(dynasty),
        ),
      } as unknown as EChartsOption,
      { replaceMerge: ["series"] },
    );
    if (selected) {
      const place = selected.spots[spot] || selected.spots[0];
      // geo3D 的 center 是世界坐标，不猜测地理坐标转换；使用已确认支持的角度与距离。
      chart.current.setOption(
        (mode === "3d"
          ? {
              geo3D: {
                viewControl: {
                  alpha: Math.max(
                    28,
                    Math.min(60, 40 + (place.lat - 32) * 0.4),
                  ),
                  beta: (place.lng - 105) * 0.45,
                  distance: 75,
                  autoRotate: false,
                  animation: !reduced,
                  animationDurationUpdate: reduced ? 0 : 800,
                },
              },
            }
          : {
              geo: { center: [place.lng, place.lat], zoom: 1.6 },
              animationDurationUpdate: reduced ? 0 : 800,
            }) as EChartsOption,
      );
    }
  }, [ready, mode, active, selected, spot, reduced, dynasty]);
  useEffect(() => {
    if (!ready || !tour || paused || reduced) return;
    const timer = setInterval(() => {
      const index = tourCursor.current % active.length;
      select(active[index], 0, true);
      setTourIndex(index);
      tourCursor.current = index + 1;
    }, 6000);
    return () => clearInterval(timer);
  }, [ready, tour, paused, reduced, active, select]);
  useEffect(() => {
    if (!selected) return;
    const ctrl = new AbortController();
    void (async () => {
      await Promise.resolve();
      if (ctrl.signal.aborted) return;
      setPoems(null);
      setPoemError("");
      try {
        const found: PoemSummary[] = [];
        const queries = [
          ...selected.famous
            .slice(0, 4)
            .map(
              (q) =>
                new URLSearchParams({
                  author: selected.name,
                  q,
                  pageSize: "1",
                }),
            ),
          new URLSearchParams({ author: selected.name, pageSize: "8" }),
        ];
        for (const params of queries) {
          const response = await fetch(`/api/poems?${params}`, {
            signal: ctrl.signal,
          });
          const d = await response.json();
          if (!response.ok) throw Error(d.error || "书库检索失败");
          for (const poem of d.data.items as PoemSummary[])
            if (!found.some((p) => p.id === poem.id)) found.push(poem);
          if (found.length >= 4) break;
        }
        if (!ctrl.signal.aborted) setPoems(found.slice(0, 4));
      } catch (e) {
        if (!ctrl.signal.aborted)
          setPoemError(e instanceof Error ? e.message : "书库暂不可用");
      }
    })();
    return () => ctrl.abort();
  }, [selected]);
  useEffect(() => {
    const open = (e: Event) => {
      const poet = POET_PLACES.find(
        (p) => p.name === (e as CustomEvent<string>).detail,
      );
      if (poet) select(poet);
    };
    window.addEventListener("shijing:open-poet", open);
    return () => window.removeEventListener("shijing:open-poet", open);
  }, [select]);
  const changeDynasty = (next: string) => {
    pause();
    setDynasty(next);
    setSelected(null);
    tourCursor.current = 0;
    setTourIndex(0);
    audio.playSfx("drop");
    if (DYNASTY_MOOD[next]) audio.setMood(DYNASTY_MOOD[next]);
  };
  return (
    <section className="map-section container" id="map" ref={section}>
      <header className="map-head">
        <span className="section-kicker">诗人行迹 · 千年山河</span>
        <h2>
          他们走过的路，
          <br />
          后来都成了诗。
        </h2>
        <p>96位诗人，405处山河足迹。从故乡到远方，从一座城到另一段人生。</p>
        <div className="timeline" role="group" aria-label="按朝代筛选">
          <button
            className={`chip${!dynasty ? " active" : ""}`}
            aria-pressed={!dynasty}
            onClick={() => changeDynasty("")}
          >
            历代
          </button>
          {DYNASTY_ORDER.map((d) => (
            <button
              key={d.key}
              className={`chip${dynasty === d.key ? " active" : ""}`}
              aria-pressed={dynasty === d.key}
              title={d.span}
              onClick={() => changeDynasty(dynasty === d.key ? "" : d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </header>
      <div className="map-tools">
        <div>
          <button
            className="ghost-btn"
            aria-pressed={tour && !paused}
            onClick={() => {
              setTour(!tour);
              setPaused(false);
              audio.playSfx("pluck");
            }}
            disabled={reduced}
          >
            <Icon name={tour && !paused ? "pause" : "play"} />
            {tour ? (paused ? "巡礼暂歇" : "诗人巡礼") : "开启巡礼"}
          </button>
          <span className="tour-progress">
            {reduced
              ? "已遵循减少动态效果"
              : `第 ${tourIndex + 1} / ${active.length} 位 · 点击或拖动后静候十秒`}
          </span>
        </div>
        <div>
          <button
            className="chip"
            aria-pressed={mode === "3d"}
            onClick={() => {
              pause();
              setMode(mode === "3d" ? "2d" : "3d");
              try {
                localStorage.setItem(
                  "shijing:map-mode",
                  mode === "3d" ? "2d" : "3d",
                );
              } catch {
                /* 忽略 */
              }
            }}
          >
            {mode === "3d" ? "立体 · 切换平面" : "平面 · 切换立体"}
          </button>
          <SoundControl />
        </div>
      </div>
      <div className="map-wrap" onPointerDown={pause}>
        <div
          className="map-box"
          ref={box}
          role="img"
          aria-label="诗人行迹地图，完整文字资料见下方名录"
        />
        <div className="southsea-inset" ref={inset} aria-hidden />
        <span className="inset-label">南海诸岛</span>
        {!ready && (
          <div className="map-loading" role="status">
            <Icon name="mountains" />
            <span>{error || "山河载入中…"}</span>
            {error && (
              <button
                className="page-btn"
                onClick={() => setRetry((n) => n + 1)}
              >
                重新载入
              </button>
            )}
          </div>
        )}
        {selected && (
          <aside
            className="poet-card"
            aria-label={`${selected.name}介绍`}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSelected(null);
            }}
          >
            <button
              className="pop-close"
              aria-label="关闭诗人卡片"
              onClick={() => {
                pause();
                audio.playSfx("paper");
                setSelected(null);
              }}
            >
              <Icon name="close" />
            </button>
            <div className="poet-head">
              <Seal>{selected.name.slice(0, 2)}</Seal>
              <div>
                <span className="poet-name">{selected.name}</span>
                <span className="poet-era">
                  {selected.dynasty} · {selected.years}
                </span>
              </div>
            </div>
            <p className="poet-intro">{selected.intro}</p>
            <ol className="poet-route">
              {selected.spots.map((s, i) => (
                <li key={i}>
                  <button
                    className={`route-dot${spot === i ? " active" : ""}`}
                    onClick={() => select(selected, i)}
                  >
                    {String(i + 1).padStart(2, "0")} · {s.city}
                    <small>{s.label}</small>
                  </button>
                </li>
              ))}
            </ol>
            <div className="poet-poems">
              <div className="label">书库中的作品</div>
              {poemError ? (
                <p role="alert">{poemError}</p>
              ) : poems === null ? (
                <p>检索中…</p>
              ) : poems.length ? (
                <ul>
                  {poems.map((p) => (
                    <li key={p.id}>
                      <Link href={`/read/${p.id}`} prefetch={false}>
                        《{p.title}》
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link
                      href={`/library?author=${encodeURIComponent(selected.name)}`}
                      prefetch={false}
                    >
                      全部作品 →
                    </Link>
                  </li>
                </ul>
              ) : (
                <p className="dim">
                  书库暂未收录其作品。
                  <Link href="/library">浏览已收录作品</Link>
                </p>
              )}
            </div>
          </aside>
        )}
      </div>
      <p className="map-foot">
        足迹按原资料生平顺序展示，坐标为现代城市；本图仅作文学地理示意。
      </p>
      <p className="sr-only" aria-live="polite">
        {selected
          ? `已选择 ${selected.name}，${selected.dynasty}`
          : "请选择诗人"}
      </p>
      <div className="poet-index" aria-label="诗人名录">
        <div className="poet-index-title">
          {dynasty || "历代诗人"} · {active.length} 位
        </div>
        {DYNASTY_ORDER.filter((d) => !dynasty || dynasty === d.key).map((d) => (
          <div className="poet-group" key={d.key}>
            <span className="poet-group-label">{d.label}</span>
            {active
              .filter((p) => p.dynasty === d.key)
              .map((p) => (
                <button
                  className={`chip small${selected?.name === p.name ? " active" : ""}`}
                  aria-pressed={selected?.name === p.name}
                  key={p.name}
                  onFocus={() => audio.playSfx("pluck", { volume: 0.4 })}
                  onClick={() => select(p)}
                >
                  {p.name}
                </button>
              ))}
          </div>
        ))}
      </div>
      <details className="sr-only">
        <summary>完整诗人城市文字列表</summary>
        <ul>
          {active.map((p) => (
            <li key={p.name}>
              {p.name}：{p.spots.map((s) => s.city).join("、")}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
