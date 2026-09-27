"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { AuthorInfo, MetaInfo, PoemListResult } from "@/lib/types";

const PAGE_SIZE = 24;

export default function Library() {
  const searchParams = useSearchParams();
  const [meta, setMeta] = useState<MetaInfo | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);

  const [dynasty, setDynasty] = useState(() => searchParams.get("dynasty") ?? "");
  const [tag, setTag] = useState("");
  const [author, setAuthor] = useState(() => searchParams.get("author") ?? "");
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [page, setPage] = useState(1);

  const [authors, setAuthors] = useState<AuthorInfo[]>([]);
  const [result, setResult] = useState<PoemListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [jumping, setJumping] = useState(false);

  const gridTop = useRef<HTMLDivElement>(null);

  // 元信息（年代/题材清单）
  useEffect(() => {
    fetch("/api/meta")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "加载失败");
        setMeta(d.data);
      })
      .catch((e) => setFatal(e instanceof Error ? e.message : "诗词数据不可用"));
  }, []);

  // 搜索词防抖
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  // 作者列表随年代/搜索变化
  useEffect(() => {
    const params = new URLSearchParams();
    if (dynasty) params.set("dynasty", dynasty);
    if (qInput.trim()) params.set("q", qInput.trim());
    params.set("limit", "60");
    const ctrl = new AbortController();
    fetch(`/api/authors?${params}`, { signal: ctrl.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setAuthors(d.data ?? []);
      })
      .catch(() => void 0);
    return () => ctrl.abort();
  }, [dynasty, qInput]);

  const fetchPoems = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setListError(null);
      try {
        const params = new URLSearchParams();
        if (dynasty) params.set("dynasty", dynasty);
        if (tag) params.set("tag", tag);
        if (author) params.set("author", author);
        if (q) params.set("q", q);
        params.set("page", String(page));
        params.set("pageSize", String(PAGE_SIZE));
        const r = await fetch(`/api/poems?${params}`, { signal });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "加载失败");
        setResult(d.data);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setListError(e instanceof Error ? e.message : "加载失败");
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [dynasty, tag, author, q, page]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchPoems(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchPoems]);

  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
  }

  async function randomEntry() {
    setJumping(true);
    try {
      const params = new URLSearchParams();
      if (dynasty) params.set("dynasty", dynasty);
      if (tag) params.set("tag", tag);
      const r = await fetch(`/api/poems/random?${params}`);
      const d = await r.json();
      if (d.data?.id) window.location.href = `/read/${d.data.id}`;
    } finally {
      setJumping(false);
    }
  }

  function goPage(next: number) {
    setPage(next);
    gridTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <main>
      <header className="topbar">
        <Link href="/" className="brand">
          诗境
          <small>SHI JING · IMMERSIVE</small>
        </Link>
        <button className="chip" onClick={randomEntry} disabled={jumping}>
          {jumping ? "正在入梦…" : "任入一境 · 随机"}
        </button>
      </header>

      <section className="hero">
        <h1 className="hero-title">步入一首诗的电影</h1>
        <p className="hero-sub">
          {meta ? (
            <>
              收录 <span className="hero-num">{meta.total.toLocaleString()}</span> 首古典诗词 ·{" "}
              {meta.dynasties.map((d) => d.name).join(" / ")} · 按年代、作者、题材筛选，
              每一首都被拆成电影分镜，配以画面与朗读。
            </>
          ) : (
            "按年代、作者、题材筛选古典诗词，每一首都是一场可以步入的电影。"
          )}
        </p>
      </section>

      <div className="filter-bar">
        <div className="filter-row">
          <span className="filter-label">年代</span>
          <button className={`chip${dynasty === "" ? " active" : ""}`} onClick={() => changeFilter(() => setDynasty(""))}>
            全部
          </button>
          {meta?.dynasties.map((d) => (
            <button
              key={d.name}
              className={`chip${dynasty === d.name ? " active" : ""}`}
              onClick={() => changeFilter(() => setDynasty(dynasty === d.name ? "" : d.name))}
              title={`${d.count} 首`}
            >
              {d.name}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <span className="filter-label">题材</span>
          <button className={`chip${tag === "" ? " active" : ""}`} onClick={() => changeFilter(() => setTag(""))}>
            不限
          </button>
          {meta?.tags.map((t) => (
            <button
              key={t.name}
              className={`chip${tag === t.name ? " active" : ""}`}
              onClick={() => changeFilter(() => setTag(tag === t.name ? "" : t.name))}
              title={`${t.count} 首`}
            >
              {t.name}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <span className="filter-label">作者</span>
          <select
            className="author-select"
            value={author}
            onChange={(e) => changeFilter(() => setAuthor(e.target.value))}
          >
            <option value="">全部作者</option>
            {authors.map((a) => (
              <option key={`${a.dynasty}-${a.name}`} value={a.name}>
                {a.name}（{a.dynasty} · {a.poemCount}首）
              </option>
            ))}
          </select>
          <input
            className="search-input"
            placeholder="搜标题、作者或诗句…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
          {(dynasty || tag || author || q) && (
            <button
              className="chip"
              onClick={() => {
                setDynasty("");
                setTag("");
                setAuthor("");
                setQInput("");
              }}
            >
              ✕ 清空筛选
            </button>
          )}
        </div>
      </div>

      <section className="results" ref={gridTop as React.RefObject<HTMLDivElement | null>}>
        {fatal ? (
          <div className="status-line">
            {fatal}
            <br />
            <small>请先运行 <code>npm run build:db</code> 构建本地诗词数据库</small>
          </div>
        ) : (
          <>
            <div className="results-meta">
              <span>
                {result ? `共 ${result.total.toLocaleString()} 首${author ? ` · ${author}` : ""}` : "检索中…"}
              </span>
              <span>{dynasty || "历代"}{tag ? ` · ${tag}` : ""}</span>
            </div>
            {listError ? (
              <div className="status-line">{listError}</div>
            ) : (
              <div className="poem-grid">
                {loading && !result
                  ? Array.from({ length: 12 }, (_, i) => <div className="skeleton" key={i} />)
                  : result?.items.map((p) => (
                      <Link className="poem-card" href={`/read/${p.id}`} key={p.id}>
                        {p.subtitle && <span className="rhythmic">{p.subtitle}</span>}
                        <h3>{p.title}</h3>
                        <span className="byline">
                          {p.dynasty} · {p.author}
                        </span>
                        <span className="first">{p.firstLine}</span>
                        <span className="tags">
                          {p.tags.map((t) => (
                            <span key={t}>{t}</span>
                          ))}
                        </span>
                      </Link>
                    ))}
              </div>
            )}
            {result && totalPages > 1 && (
              <div className="pager">
                <button className="page-btn" disabled={page <= 1 || loading} onClick={() => goPage(page - 1)}>
                  ‹ 上一页
                </button>
                <span className="page-info">
                  {page} / {totalPages}
                </span>
                <button className="page-btn" disabled={page >= totalPages || loading} onClick={() => goPage(page + 1)}>
                  下一页 ›
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
