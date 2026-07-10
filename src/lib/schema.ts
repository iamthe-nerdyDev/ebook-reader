// Each entry is one migration, applied in order. Append new ones; never edit past entries.
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE categories (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    year INTEGER,
    format TEXT NOT NULL,
    category_id TEXT,
    cover TEXT,
    added_at INTEGER NOT NULL,
    progress REAL NOT NULL DEFAULT 0,
    locator TEXT,
    finished INTEGER NOT NULL DEFAULT 0,
    file_size INTEGER NOT NULL DEFAULT 0,
    pages INTEGER
  );
  CREATE TABLE bookmarks (
    id TEXT PRIMARY KEY, book_id TEXT NOT NULL, label TEXT NOT NULL, locator TEXT NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE TABLE highlights (
    id TEXT PRIMARY KEY, book_id TEXT NOT NULL, text TEXT NOT NULL, color TEXT NOT NULL,
    underline INTEGER NOT NULL DEFAULT 0, chapter TEXT, locator TEXT, created_at INTEGER NOT NULL
  );
  CREATE TABLE sessions (
    id TEXT PRIMARY KEY, book_id TEXT NOT NULL, started_at INTEGER NOT NULL,
    seconds INTEGER NOT NULL DEFAULT 0, words INTEGER NOT NULL DEFAULT 0, day TEXT NOT NULL
  );
  `,
  // v2: track where a book came from (for folder-watch dedupe) and pages/finish time
  `
  ALTER TABLE books ADD COLUMN source_path TEXT;
  ALTER TABLE books ADD COLUMN finished_at INTEGER;
  `,
  // v3: content hash to detect the same book imported twice
  `
  ALTER TABLE books ADD COLUMN content_hash TEXT;
  `,
];
