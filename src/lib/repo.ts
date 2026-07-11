import { query, run } from "./db";
import type { Book, Bookmark, Category, Highlight } from "./types";

export const uid = () => crypto.randomUUID();
const today = () => new Date().toISOString().slice(0, 10);

/* ---------- categories ---------- */
export function listCategories(): Category[] {
  return query<any>("SELECT * FROM categories ORDER BY sort, name").map((r) => ({
    id: r.id, name: r.name, color: r.color, sort: r.sort,
  }));
}
export function addCategory(name: string, color: string): Category {
  const sort = (query<any>("SELECT COALESCE(MAX(sort),0)+1 AS s FROM categories")[0]?.s as number) || 1;
  const c: Category = { id: uid(), name, color, sort };
  run("INSERT INTO categories (id,name,color,sort) VALUES (?,?,?,?)", [c.id, c.name, c.color, c.sort]);
  return c;
}
export function renameCategory(id: string, name: string) {
  run("UPDATE categories SET name=? WHERE id=?", [name, id]);
}
export function deleteCategory(id: string) {
  run("UPDATE books SET category_id=NULL WHERE category_id=?", [id]);
  run("DELETE FROM categories WHERE id=?", [id]);
}

/* ---------- books ---------- */
function mapBook(r: any): Book {
  return {
    id: r.id, title: r.title, author: r.author, year: r.year ?? null, format: r.format,
    categoryId: r.category_id ?? null, cover: r.cover ?? null, addedAt: r.added_at,
    progress: r.progress ?? 0, locator: r.locator ?? null, finished: !!r.finished,
    finishedAt: r.finished_at ?? null,
    fileSize: r.file_size ?? 0, pages: r.pages ?? null, sourcePath: r.source_path ?? null,
    contentHash: r.content_hash ?? null,
  };
}
export function listBooks(): Book[] {
  return query<any>("SELECT * FROM books ORDER BY added_at DESC").map(mapBook);
}
export function getBook(id: string): Book | null {
  const r = query<any>("SELECT * FROM books WHERE id=?", [id])[0];
  return r ? mapBook(r) : null;
}
export function insertBook(b: Book) {
  run(
    `INSERT INTO books (id,title,author,year,format,category_id,cover,added_at,progress,locator,finished,file_size,pages,source_path,content_hash)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [b.id, b.title, b.author, b.year, b.format, b.categoryId, b.cover, b.addedAt,
     b.progress, b.locator, b.finished ? 1 : 0, b.fileSize, b.pages, b.sourcePath, b.contentHash]
  );
}
export function existingHashes(): Set<string> {
  const set = new Set<string>();
  for (const r of query<any>("SELECT content_hash AS h FROM books WHERE content_hash IS NOT NULL")) set.add(r.h);
  return set;
}
export function setContentHash(id: string, hash: string) {
  run("UPDATE books SET content_hash=? WHERE id=?", [hash, id]);
}
/** Move a duplicate copy's stats/bookmarks/highlights onto the copy we keep. */
export function mergeBookData(fromId: string, toId: string) {
  run("UPDATE sessions SET book_id=? WHERE book_id=?", [toId, fromId]);
  run("UPDATE bookmarks SET book_id=? WHERE book_id=?", [toId, fromId]);
  run("UPDATE highlights SET book_id=? WHERE book_id=?", [toId, fromId]);
}
export function setBookCategory(id: string, categoryId: string | null) {
  run("UPDATE books SET category_id=? WHERE id=?", [categoryId, id]);
}
export function setBookPages(id: string, pages: number) {
  run("UPDATE books SET pages=? WHERE id=? AND (pages IS NULL OR pages<=0)", [pages, id]);
}
export function saveProgress(id: string, progress: number, locator: string | null) {
  run(`UPDATE books SET progress=?, locator=?,
        finished=(CASE WHEN ?>=0.995 THEN 1 ELSE finished END),
        finished_at=(CASE WHEN ?>=0.995 AND finished_at IS NULL THEN ? ELSE finished_at END)
       WHERE id=?`,
    [progress, locator, progress, progress, Date.now(), id]);
}
/** native source paths already imported (for folder-watch dedupe). */
export function existingSourcePaths(): Set<string> {
  const set = new Set<string>();
  for (const r of query<any>("SELECT source_path AS p FROM books WHERE source_path IS NOT NULL")) set.add(r.p);
  return set;
}
export function deleteBook(id: string) {
  run("DELETE FROM books WHERE id=?", [id]);
  run("DELETE FROM bookmarks WHERE book_id=?", [id]);
  run("DELETE FROM highlights WHERE book_id=?", [id]);
}

/* ---------- bookmarks ---------- */
export function listBookmarks(bookId: string): Bookmark[] {
  return query<any>("SELECT * FROM bookmarks WHERE book_id=? ORDER BY created_at DESC", [bookId]).map((r) => ({
    id: r.id, bookId: r.book_id, label: r.label, locator: r.locator, createdAt: r.created_at,
  }));
}
export function addBookmark(bookId: string, label: string, locator: string): Bookmark {
  const bm: Bookmark = { id: uid(), bookId, label, locator, createdAt: Date.now() };
  run("INSERT INTO bookmarks (id,book_id,label,locator,created_at) VALUES (?,?,?,?,?)",
    [bm.id, bm.bookId, bm.label, bm.locator, bm.createdAt]);
  return bm;
}
export function removeBookmark(id: string) {
  run("DELETE FROM bookmarks WHERE id=?", [id]);
}
export function allBookmarks(): Bookmark[] {
  return query<any>("SELECT * FROM bookmarks ORDER BY created_at DESC").map((r) => ({
    id: r.id, bookId: r.book_id, label: r.label, locator: r.locator, createdAt: r.created_at,
  }));
}

/* ---------- highlights ---------- */
export function listHighlights(bookId: string): Highlight[] {
  return query<any>("SELECT * FROM highlights WHERE book_id=? ORDER BY created_at DESC", [bookId]).map((r) => ({
    id: r.id, bookId: r.book_id, text: r.text, color: r.color, underline: !!r.underline,
    chapter: r.chapter ?? null, locator: r.locator ?? null, createdAt: r.created_at,
  }));
}
export function addHighlight(h: Omit<Highlight, "id" | "createdAt">): Highlight {
  const full: Highlight = { ...h, id: uid(), createdAt: Date.now() };
  run("INSERT INTO highlights (id,book_id,text,color,underline,chapter,locator,created_at) VALUES (?,?,?,?,?,?,?,?)",
    [full.id, full.bookId, full.text, full.color, full.underline ? 1 : 0, full.chapter, full.locator, full.createdAt]);
  return full;
}

/* ---------- reading sessions (stats) ---------- */
export function logSession(bookId: string, seconds: number, words: number) {
  if (seconds < 3) return;
  run("INSERT INTO sessions (id,book_id,started_at,seconds,words,day) VALUES (?,?,?,?,?,?)",
    [uid(), bookId, Date.now(), Math.round(seconds), words, today()]);
}
export function bookSeconds(bookId: string): number {
  return (query<any>("SELECT COALESCE(SUM(seconds),0) AS s FROM sessions WHERE book_id=?", [bookId])[0]?.s as number) || 0;
}

export interface SessionRow { bookId: string; seconds: number; words: number; day: string; startedAt: number; }
export function allSessions(): SessionRow[] {
  return query<any>("SELECT book_id AS bookId, seconds, words, day, started_at AS startedAt FROM sessions").map((r) => ({
    bookId: r.bookId, seconds: r.seconds, words: r.words, day: r.day, startedAt: r.startedAt,
  }));
}

export function allHighlights(): Highlight[] {
  return query<any>("SELECT * FROM highlights ORDER BY created_at DESC").map((r) => ({
    id: r.id, bookId: r.book_id, text: r.text, color: r.color, underline: !!r.underline,
    chapter: r.chapter ?? null, locator: r.locator ?? null, createdAt: r.created_at,
  }));
}

export function removeHighlight(id: string) {
  run("DELETE FROM highlights WHERE id=?", [id]);
}

/** bookId -> most recent session start time (for "currently reading" ordering). */
export function lastReadMap(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of query<any>("SELECT book_id AS bookId, MAX(started_at) AS t FROM sessions GROUP BY book_id")) {
    out[r.bookId] = r.t;
  }
  return out;
}

/** bookId -> number of reading sessions (how many times a book was picked up). */
export function sessionCountMap(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of query<any>("SELECT book_id AS bookId, COUNT(*) AS c FROM sessions GROUP BY book_id")) {
    out[r.bookId] = r.c;
  }
  return out;
}
