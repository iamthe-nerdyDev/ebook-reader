import { create } from "zustand";
import { initDb } from "./lib/db";
import * as repo from "./lib/repo";
import { parseBook } from "./lib/metadata";
import { sha256Hex } from "./lib/hash";
import { pickFiles, pickFolder, saveBookFile, deleteBookFile, scanFolderPaths, readPaths, isTauri, type PickedFile } from "./lib/platform";
import { CATEGORY_COLORS, type Book, type Category, type SortBy } from "./lib/types";

export type View = "library" | "stats" | "highlights" | "bookmarks" | "reader";
export type Theme = "dark" | "light";
export type { SortBy };

interface NavEntry { view: View; bookId: string | null; }

interface AppState {
  ready: boolean;
  view: View;
  categories: Category[];
  books: Book[];
  lastRead: Record<string, number>;
  activeCategoryId: string | null | "all";
  currentBookId: string | null;
  toast: string | null;
  busy: boolean;
  navHidden: boolean;
  theme: Theme;
  search: string;
  readerMode: "scroll" | "paged";
  fontScale: number;
  pendingLocator: string | null;
  sortBy: SortBy;
  history: NavEntry[];
  hi: number;
  watchedFolders: string[];
  _watchTimer?: number;

  init: () => Promise<void>;
  refresh: () => void;
  setView: (v: View) => void;
  openBook: (id: string) => void;
  openReadingNow: () => void;
  openBookAt: (id: string, locator: string) => void;
  clearPending: () => void;
  setActiveCategory: (id: string | null | "all") => void;
  navBack: () => void;
  navForward: () => void;
  importFiles: () => Promise<void>;
  importFolder: () => Promise<void>;
  importPicked: (files: PickedFile[], categoryId: string | null, silent?: boolean) => Promise<void>;
  startWatching: () => void;
  rescanWatched: () => Promise<void>;
  manualRefresh: () => Promise<void>;
  resetApp: () => Promise<void>;
  addCategory: (name: string) => void;
  deleteCategory: (id: string) => void;
  setBookCategory: (bookId: string, categoryId: string | null) => void;
  removeBook: (id: string) => Promise<void>;
  saveProgress: (id: string, progress: number, locator: string | null) => void;
  setSortBy: (s: SortBy) => void;
  toggleNav: (force?: boolean) => void;
  toggleTheme: () => void;
  showToast: (msg: string, ms?: number) => void;
  setSearch: (q: string) => void;
  setReaderMode: (m: "scroll" | "paged") => void;
  setFontScale: (n: number) => void;
  _record: (view: View, bookId: string | null) => void;
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  view: "library",
  categories: [],
  books: [],
  lastRead: {},
  activeCategoryId: "all",
  currentBookId: null,
  toast: null,
  busy: false,
  navHidden: false,
  theme: (localStorage.getItem("theme") as Theme) || "dark",
  search: "",
  readerMode: (localStorage.getItem("readerMode") as "scroll" | "paged") || "paged",
  fontScale: Number(localStorage.getItem("fontScale")) || 100,
  pendingLocator: null,
  sortBy: (localStorage.getItem("sortBy") as SortBy) || "recent",
  history: [{ view: "library", bookId: null }],
  hi: 0,
  watchedFolders: JSON.parse(localStorage.getItem("watchedFolders") || "[]"),

  async init() {
    await initDb();
    document.documentElement.setAttribute("data-theme", get().theme);
    get().refresh();
    set({ ready: true });
    if (isTauri) get().startWatching();
  },

  refresh() {
    set({ categories: repo.listCategories(), books: repo.listBooks(), lastRead: repo.lastReadMap() });
  },

  _record(view, bookId) {
    const st = get();
    const cur = st.history[st.hi];
    if (cur && cur.view === view && cur.bookId === bookId) return;
    const history = st.history.slice(0, st.hi + 1);
    history.push({ view, bookId });
    set({ history, hi: history.length - 1 });
  },

  setView(view) {
    set({ view, navHidden: view === "reader" ? true : get().navHidden });
    get()._record(view, get().currentBookId);
  },

  openBook(id) {
    set({ currentBookId: id, view: "reader", navHidden: true, pendingLocator: null });
    get()._record("reader", id);
  },

  openReadingNow() {
    const st = get();
    let id = st.currentBookId;
    if (!id) {
      const reading = st.books
        .filter((b) => b.progress > 0 && b.progress < 0.995)
        .sort((a, b) => (st.lastRead[b.id] ?? 0) - (st.lastRead[a.id] ?? 0));
      id = reading[0]?.id ?? st.books[0]?.id ?? null;
    }
    set({ currentBookId: id, view: "reader", navHidden: true, pendingLocator: null });
    get()._record("reader", id);
  },

  openBookAt(id, locator) {
    set({ currentBookId: id, view: "reader", navHidden: true, pendingLocator: locator || null });
    get()._record("reader", id);
  },

  clearPending() { set({ pendingLocator: null }); },

  setActiveCategory(activeCategoryId) {
    set({ activeCategoryId, view: "library" });
    get()._record("library", get().currentBookId);
  },

  navBack() {
    const st = get();
    if (st.hi <= 0) return;
    const hi = st.hi - 1;
    const h = st.history[hi];
    set({ hi, view: h.view, currentBookId: h.bookId ?? st.currentBookId, navHidden: h.view === "reader" });
  },

  navForward() {
    const st = get();
    if (st.hi >= st.history.length - 1) return;
    const hi = st.hi + 1;
    const h = st.history[hi];
    set({ hi, view: h.view, currentBookId: h.bookId ?? st.currentBookId, navHidden: h.view === "reader" });
  },

  async importFiles() {
    const files = await pickFiles();
    if (files.length) await get().importPicked(files, null);
  },

  async importFolder() {
    try {
      const { folder, files } = await pickFolder();
      if (folder) {
        const watched = Array.from(new Set([...get().watchedFolders, folder]));
        localStorage.setItem("watchedFolders", JSON.stringify(watched));
        set({ watchedFolders: watched });
        get().startWatching();
      }
      if (files.length) await get().importPicked(files, null);
      else get().showToast(folder ? "Folder added — it’ll auto-add new books." : "No e-books found in that folder.");
    } catch (e: any) {
      get().showToast(e?.message || "Couldn’t scan that folder.");
    }
  },

  async importPicked(files, categoryId, silent = false) {
    // skip anything already imported from the same path (folder-watch dedupe)
    const existingPaths = repo.existingSourcePaths();
    const queue = files.filter((f) => !(f.path && existingPaths.has(f.path)));
    if (queue.length === 0) { if (!silent) get().showToast("Those books are already in your library."); return; }
    if (!silent) set({ busy: true, toast: `Reading ${queue.length} book${queue.length > 1 ? "s" : ""}…` });
    const existingHashes = repo.existingHashes();
    const seen = new Set<string>();
    let added = 0, dupes = 0;
    for (const f of queue) {
      try {
        const hash = await sha256Hex(f.bytes);            // dedupe identical files by content
        if (existingHashes.has(hash) || seen.has(hash)) { dupes++; continue; }
        seen.add(hash);
        const parsed = await parseBook(f.name, f.bytes);
        if (!parsed) continue;
        const id = repo.uid();
        await saveBookFile(id, parsed.bytes);
        repo.insertBook({
          id, title: parsed.title, author: parsed.author, year: parsed.year, format: parsed.format,
          categoryId, cover: parsed.cover, addedAt: Date.now(), progress: 0, locator: null,
          finished: false, finishedAt: null, fileSize: parsed.fileSize, pages: parsed.pages,
          sourcePath: f.path ?? null, contentHash: hash,
        });
        added++;
      } catch (e) {
        console.error("Failed to import", f.name, e);
      }
    }
    get().refresh();
    if (!silent) set({ busy: false });
    const dupNote = dupes ? ` · skipped ${dupes} duplicate${dupes > 1 ? "s" : ""}` : "";
    if (added) get().showToast(`Added ${added} book${added > 1 ? "s" : ""}${silent ? " from your watched folder" : ""}${dupNote}`);
    else if (dupes && !silent) get().showToast(`Already in your library — skipped ${dupes} duplicate${dupes > 1 ? "s" : ""}.`);
    else if (!silent) get().showToast("Couldn’t read those files.");
  },

  async manualRefresh() {
    get().refresh();
    if (isTauri) { try { await get().rescanWatched(); } catch { /* ignore */ } }
    get().showToast("Refreshed");
  },

  async resetApp() {
    ["theme", "readerMode", "fontScale", "sortBy", "watchedFolders"].forEach((k) => localStorage.removeItem(k));
    await new Promise<void>((res) => {
      const req = indexedDB.deleteDatabase("book-nook");
      req.onsuccess = req.onerror = (req as any).onblocked = () => res();
    });
    location.reload();
  },

  startWatching() {
    if (!isTauri || get()._watchTimer) return;
    const tick = () => get().rescanWatched();
    tick();
    const t = window.setInterval(tick, 45000);
    set({ _watchTimer: t });
  },

  async rescanWatched() {
    if (!isTauri) return;
    const existing = repo.existingSourcePaths();
    for (const folder of get().watchedFolders) {
      try {
        const paths = (await scanFolderPaths(folder)).filter((p) => !existing.has(p));
        if (paths.length) {
          const files = await readPaths(paths);
          await get().importPicked(files, null, true);
        }
      } catch (e) { console.error("rescan failed for", folder, e); }
    }
  },

  addCategory(name) {
    const color = CATEGORY_COLORS[get().categories.length % CATEGORY_COLORS.length];
    repo.addCategory(name.trim() || "New category", color);
    get().refresh();
  },

  deleteCategory(id) {
    repo.deleteCategory(id);
    if (get().activeCategoryId === id) set({ activeCategoryId: "all" });
    get().refresh();
    get().showToast("Category removed — its books moved to Uncategorized");
  },

  setBookCategory(bookId, categoryId) {
    repo.setBookCategory(bookId, categoryId);
    get().refresh();
  },

  async removeBook(id) {
    repo.deleteBook(id);
    await deleteBookFile(id);
    get().refresh();
    if (get().currentBookId === id) set({ currentBookId: null, view: "library" });
  },

  saveProgress(id, progress, locator) {
    repo.saveProgress(id, progress, locator);
    set({ books: get().books.map((b) => (b.id === id ? { ...b, progress, locator, finished: b.finished || progress >= 0.995 } : b)) });
  },

  setSortBy(sortBy) {
    localStorage.setItem("sortBy", sortBy);
    set({ sortBy });
  },

  toggleNav(force) { set({ navHidden: force ?? !get().navHidden }); },

  toggleTheme() {
    const theme: Theme = get().theme === "dark" ? "light" : "dark";
    localStorage.setItem("theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },

  showToast(msg, ms = 2600) {
    set({ toast: msg });
    window.setTimeout(() => { if (get().toast === msg) set({ toast: null }); }, ms);
  },

  setSearch(q) { set({ search: q, view: q ? "library" : get().view }); },
  setReaderMode(m) { localStorage.setItem("readerMode", m); set({ readerMode: m }); },
  setFontScale(n) { localStorage.setItem("fontScale", String(n)); set({ fontScale: n }); },
}));

// Dev-only hook so automated tests can drive the store.
if (import.meta.env.DEV) (window as any).__useApp = useApp;
