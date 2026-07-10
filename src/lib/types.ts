export type Format = "epub" | "pdf";
export type SortBy = "recent" | "title" | "author" | "progress";

export interface Category {
  id: string;
  name: string;
  color: string;
  sort: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  year: number | null;
  format: Format;
  categoryId: string | null;
  cover: string | null; // data URL
  addedAt: number;
  progress: number; // 0..1
  locator: string | null; // epubcfi or page number as string
  finished: boolean;
  finishedAt: number | null;
  fileSize: number;
  pages: number | null;
  sourcePath: string | null;
  contentHash: string | null;
}

export interface Bookmark {
  id: string;
  bookId: string;
  label: string;
  locator: string;
  createdAt: number;
}

export interface Highlight {
  id: string;
  bookId: string;
  text: string;
  color: string;
  underline: boolean;
  chapter: string | null;
  locator: string | null;
  createdAt: number;
}

/** A parsed book ready to be stored. */
export interface ParsedBook {
  title: string;
  author: string;
  year: number | null;
  format: Format;
  cover: string | null;
  pages: number | null;
  bytes: ArrayBuffer;
  fileSize: number;
}

export const CATEGORY_COLORS = [
  "var(--emerald)",
  "var(--indigo)",
  "var(--oxblood)",
  "var(--teal)",
  "var(--plum)",
  "var(--brass)",
];
