import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { AuthorInfo, MetaInfo, Poem, PoemListResult, PoemSummary } from "./types";

// 单例只读连接（node:sqlite，Node 内置，无需原生依赖）
let db: DatabaseSync | null = null;
let metaCache: MetaInfo | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  const dbPath = process.env.POETRY_DB_PATH || path.join(process.cwd(), "data", "poetry.db");
  if (!fs.existsSync(dbPath)) {
    throw new Error("诗词数据库尚未构建：请先运行 npm run build:db");
  }
  db = new DatabaseSync(dbPath, { readOnly: true });
  return db;
}

export function getMeta(): MetaInfo {
  if (metaCache) return metaCache;
  const row = getDb().prepare("SELECT value FROM meta WHERE key = 'meta'").get() as { value: string } | undefined;
  if (!row) throw new Error("诗词数据库缺少 meta 信息，请重新运行 npm run build:db");
  metaCache = JSON.parse(row.value) as MetaInfo;
  return metaCache;
}

function toSummary(row: Record<string, unknown>): PoemSummary {
  return {
    id: Number(row.id),
    title: String(row.title),
    subtitle: (row.subtitle as string | null) ?? null,
    author: String(row.author),
    dynasty: String(row.dynasty),
    collection: String(row.collection),
    firstLine: String(row.first_line),
    tags: JSON.parse(String(row.tag_json)) as string[],
  };
}

export type PoemFilters = {
  dynasty?: string;
  author?: string;
  tag?: string;
  collection?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

function likeEscape(s: string) {
  return s.replace(/[\\%_]/g, (m) => "\\" + m);
}

export function listPoems(filters: PoemFilters): PoemListResult {
  const database = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(60, Math.max(1, filters.pageSize ?? 20));
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (filters.dynasty) { where.push("p.dynasty = ?"); params.push(filters.dynasty); }
  if (filters.author) { where.push("p.author = ?"); params.push(filters.author); }
  if (filters.collection) { where.push("p.collection = ?"); params.push(filters.collection); }
  if (filters.tag) {
    where.push("p.id IN (SELECT poem_id FROM poem_tags WHERE tag = ?)");
    params.push(filters.tag);
  }
  const q = (filters.q ?? "").trim();
  if (q) {
    const esc = likeEscape(q);
    const like = `%${esc}%`;
    const clauses = ["p.title LIKE ? ESCAPE '\\'", "p.subtitle LIKE ? ESCAPE '\\'", "p.author LIKE ? ESCAPE '\\'"];
    const likeParams: (string | number)[] = [like, like, like];
    if ([...q].length >= 3) {
      clauses.push("p.id IN (SELECT rowid FROM poems_fts WHERE poems_fts MATCH ?)");
      likeParams.push('"' + q.replace(/"/g, '""') + '"');
    }
    where.push("(" + clauses.join(" OR ") + ")");
    params.push(...likeParams);
  }

  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const totalRow = database
    .prepare(`SELECT COUNT(*) n FROM poems p ${whereSql}`)
    .get(...params) as { n: number };
  const rows = database
    .prepare(
      `SELECT p.id, p.title, p.subtitle, p.author, p.dynasty, p.collection, p.first_line, p.tag_json
       FROM poems p ${whereSql}
       ORDER BY p.id LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, (page - 1) * pageSize) as unknown as Record<string, unknown>[];

  return { items: rows.map(toSummary), total: Number(totalRow.n), page, pageSize };
}

export function getPoem(id: number): Poem | null {
  const row = getDb()
    .prepare("SELECT * FROM poems WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    ...toSummary(row),
    lines: JSON.parse(String(row.lines_json)) as string[],
  };
}

export function listAuthors(opts: { dynasty?: string; q?: string; limit?: number }): AuthorInfo[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.dynasty) { where.push("dynasty = ?"); params.push(opts.dynasty); }
  const q = (opts.q ?? "").trim();
  if (q) { where.push("name LIKE ? ESCAPE '\\'"); params.push(`%${likeEscape(q)}%`); }
  const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
  const rows = getDb()
    .prepare(
      `SELECT name, dynasty, poem_count FROM authors
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY poem_count DESC LIMIT ?`
    )
    .all(...params, limit) as unknown as { name: string; dynasty: string; poem_count: number }[];
  return rows.map((r) => ({ name: r.name, dynasty: r.dynasty, poemCount: r.poem_count }));
}

export function randomPoemId(filters: { dynasty?: string; tag?: string }): number | null {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filters.dynasty) { where.push("p.dynasty = ?"); params.push(filters.dynasty); }
  if (filters.tag) {
    where.push("p.id IN (SELECT poem_id FROM poem_tags WHERE tag = ?)");
    params.push(filters.tag);
  }
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const row = getDb()
    .prepare(`SELECT p.id FROM poems p ${whereSql} ORDER BY RANDOM() LIMIT 1`)
    .get(...params) as { id: number } | undefined;
  return row ? Number(row.id) : null;
}
