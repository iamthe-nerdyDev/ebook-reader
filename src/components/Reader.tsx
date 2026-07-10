import { useEffect, useMemo, useRef, useState } from "react";
import ePub from "epubjs";
import * as pdfjsLib from "pdfjs-dist";
import { useApp } from "../store";
import * as repo from "../lib/repo";
import { loadBookFile } from "../lib/platform";
import { idbGet, idbSet } from "../lib/idb";
import type { Book, Bookmark } from "../lib/types";
import {
  IMenu, IScroll, IPaged, IBookmark, IChevL, IChevR, IClose, ICheck, Logo,
} from "./icons";

type Mode = "scroll" | "paged";

interface TocItem { label: string; href: string; }

interface SavedHl { locator: string | null; color: string; underline: boolean; }
interface SelectionInfo { cfi: string; text: string; x: number; y: number; }

interface Engine {
  next(): void;
  prev(): void;
  goTo(pct: number): void;
  gotoLocator(loc: string): void;
  setFontPct(pct: number): void;
  setTheme(dark: boolean): void;
  highlight?(cfi: string, color: string, underline: boolean): void;
  removeHighlight?(cfi: string): void;
  applySaved?(list: SavedHl[]): void;
  toc: TocItem[];
  destroy(): void;
}

const THEME_DARK = { bg: "#16130e", ink: "#e9e0cf" };
const THEME_LIGHT = { bg: "#f3eede", ink: "#221b10" };

// concrete hex (CSS vars don't resolve inside the epub iframe / SVG annotations)
const HL_COLORS = ["#d6a64f", "#5e9a6e", "#b25647", "#8c6690", "#4e8e90"];

/* ---------------- EPUB engine ---------------- */
async function makeEpub(
  bytes: ArrayBuffer, host: HTMLElement, mode: Mode, initial: string | null, dark: boolean,
  onProgress: (pct: number, label: string, locator: string) => void,
  onSelect: (info: SelectionInfo) => void,
  cachedLocations: string | null,
  onLocations: (json: string, count: number) => void
): Promise<Engine> {
  const book: any = ePub(bytes.slice(0));
  const rendition: any = book.renderTo(host, {
    width: "100%", height: "100%", spread: "none",
    flow: mode === "paged" ? "paginated" : "scrolled-doc",
    allowScriptedContent: true,
  });
  const th = dark ? THEME_DARK : THEME_LIGHT;
  rendition.themes.override("color", th.ink);
  rendition.themes.override("background", th.bg);
  rendition.themes.override("line-height", "1.7");

  // text selection -> floating highlight toolbar
  rendition.on("selected", (cfiRange: string, contents: any) => {
    try {
      const sel = contents.window.getSelection();
      const text = sel ? sel.toString() : "";
      if (!text.trim()) return;
      const r = sel.getRangeAt(0).getBoundingClientRect();
      const iframe: HTMLIFrameElement | null = host.querySelector("iframe");
      const off = iframe?.getBoundingClientRect();
      const x = off ? off.left + r.left + r.width / 2 : r.left + r.width / 2;
      const y = off ? off.top + r.top : r.top;
      onSelect({ cfi: cfiRange, text, x, y });
    } catch { /* ignore */ }
  });

  await rendition.display(initial || undefined);
  await book.ready;

  let toc: TocItem[] = [];
  try {
    const nav = await book.loaded.navigation;
    toc = (nav.toc || []).map((t: any) => ({ label: t.label.trim(), href: t.href }));
  } catch { /* ignore */ }

  const spineTotal = book.spine?.length || book.spine?.items?.length || 0;
  const hasLocations = () => book.locations?.length && book.locations.length() > 0;

  const emitProgress = (loc: any) => {
    const cfi = loc?.start?.cfi;
    let pct = 0;
    if (hasLocations() && cfi) {
      try { pct = book.locations.percentageFromCfi(cfi); } catch { /* ignore */ }
    } else {
      // instant approximation from spine index + page-within-chapter (no wait)
      const idx = loc?.start?.index ?? 0;
      const disp = loc?.start?.displayed;
      const within = disp && disp.total ? (disp.page - 1) / disp.total : 0;
      pct = spineTotal ? (idx + within) / spineTotal : (loc?.start?.percentage ?? 0);
    }
    onProgress(pct || 0, tocLabelFor(loc?.start?.href, toc), cfi || "");
  };
  rendition.on("relocated", emitProgress);

  // precise progress needs "locations" — reuse a cached index if we have one, else
  // build it in the background and cache it for next time.
  if (cachedLocations) {
    try { book.locations.load(cachedLocations); emitProgress(rendition.currentLocation()); } catch { /* ignore */ }
  } else {
    book.locations.generate(1200).then(() => {
      try {
        onLocations(book.locations.save(), book.locations.length());
        emitProgress(rendition.currentLocation());
      } catch { /* ignore */ }
    }).catch(() => {});
  }

  const addHl = (cfi: string, color: string, underline: boolean) => {
    try {
      if (underline) rendition.annotations.add("underline", cfi, {}, undefined, "hl-u", { stroke: color, "stroke-opacity": "0.95", "stroke-width": "2px" });
      else rendition.annotations.add("highlight", cfi, {}, undefined, "hl-h", { fill: color, "fill-opacity": "0.32" });
    } catch { /* ignore */ }
  };

  return {
    next: () => rendition.next(),
    prev: () => rendition.prev(),
    goTo: (pct) => { try { const cfi = book.locations.cfiFromPercentage(pct); rendition.display(cfi); } catch { /* ignore */ } },
    gotoLocator: (loc) => rendition.display(loc),
    setFontPct: (pct) => rendition.themes.fontSize(`${pct}%`),
    setTheme: (d) => { const t = d ? THEME_DARK : THEME_LIGHT; rendition.themes.override("color", t.ink); rendition.themes.override("background", t.bg); },
    highlight: addHl,
    removeHighlight: (cfi) => { try { rendition.annotations.remove(cfi, "highlight"); } catch { /* ignore */ } try { rendition.annotations.remove(cfi, "underline"); } catch { /* ignore */ } },
    applySaved: (list) => list.forEach((h) => h.locator && addHl(h.locator, h.color, h.underline)),
    toc,
    destroy: () => { try { rendition.destroy(); book.destroy(); } catch { /* ignore */ } },
  };
}

function tocLabelFor(href: string | undefined, toc: TocItem[]): string {
  if (!href) return "";
  const base = href.split("#")[0];
  const hit = toc.find((t) => t.href.split("#")[0] === base);
  return hit?.label ?? "";
}

/* ---------------- PDF engine ---------------- */
async function makePdf(
  bytes: ArrayBuffer, host: HTMLElement, initial: string | null, dark: boolean,
  onProgress: (pct: number, label: string, locator: string) => void
): Promise<Engine> {
  const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
  const total = doc.numPages;
  let page = initial ? Math.min(total, Math.max(1, parseInt(initial, 10) || 1)) : 1;
  let renderTask: any = null;
  host.innerHTML = "";
  const canvas = document.createElement("canvas");
  host.appendChild(canvas);

  async function render() {
    if (renderTask) { try { renderTask.cancel(); } catch { /* ignore */ } }
    const p = await doc.getPage(page);
    const hostW = host.clientWidth || 800;
    const base = p.getViewport({ scale: 1 });
    const scale = Math.min(2.2, ((hostW - 48) / base.width) * (window.devicePixelRatio || 1));
    const viewport = p.getViewport({ scale });
    const ctx = canvas.getContext("2d")!;
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    canvas.style.width = Math.ceil(viewport.width / (window.devicePixelRatio || 1)) + "px";
    renderTask = p.render({ canvasContext: ctx, viewport });
    await renderTask.promise.catch(() => {});
    host.scrollTop = 0;
    onProgress(total > 1 ? (page - 1) / (total - 1) : 1, `Page ${page} of ${total}`, String(page));
  }
  await render();

  const setPage = (n: number) => { page = Math.min(total, Math.max(1, n)); render(); };
  return {
    next: () => setPage(page + 1),
    prev: () => setPage(page - 1),
    goTo: (pct) => setPage(Math.round(pct * (total - 1)) + 1),
    gotoLocator: (loc) => setPage(parseInt(loc, 10) || 1),
    setFontPct: () => {},
    setTheme: () => {},
    toc: [],
    destroy: () => { try { doc.destroy(); } catch { /* ignore */ } },
  };
}

/* ---------------- component ---------------- */
export function Reader() {
  const { currentBookId, theme, readerMode, fontScale, history, hi } = useApp();
  const s = useApp.getState();
  const book = useMemo<Book | null>(() => (currentBookId ? repo.getBook(currentBookId) : null), [currentBookId]);
  const isPdf = book?.format === "pdf";
  const pctRef = useRef(book?.progress ?? 0);

  const viewRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const locatorRef = useRef<string | null>(book?.locator ?? null);

  const [mode, setMode] = useState<Mode>(isPdf ? "paged" : readerMode);
  const [loading, setLoading] = useState(true);
  const [pct, setPct] = useState(book?.progress ?? 0);
  const [label, setLabel] = useState("");
  const [toc, setToc] = useState<TocItem[]>([]);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [tocTab, setTocTab] = useState<"contents" | "marks">("contents");
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [fontPct, setFontPct] = useState(fontScale);
  const [sel, setSel] = useState<SelectionInfo | null>(null);
  const [hlUnderline, setHlUnderline] = useState(false);

  const chooseMode = (m: Mode) => { setMode(m); s.setReaderMode(m); };

  /* build / rebuild engine */
  useEffect(() => {
    if (!book || !hostRef.current) return;
    let alive = true;
    setLoading(true);
    const host = hostRef.current;
    host.innerHTML = "";

    const onProgress = (p: number, lab: string, locator: string) => {
      if (!alive) return;
      setPct(p); pctRef.current = p; if (lab) setLabel(lab);
      locatorRef.current = locator;
      setSel(null); // dismiss any open highlight toolbar when the page moves
      scheduleSave(book.id, p, locator);
    };

    (async () => {
      try {
        const bytes = await loadBookFile(book.id);
        if (!bytes || !alive) return;
        const dark = document.documentElement.getAttribute("data-theme") !== "light";
        const pending = useApp.getState().pendingLocator;
        const initLoc = pending ?? locatorRef.current;
        if (pending) useApp.getState().clearPending();
        const cachedLoc = isPdf ? null : ((await idbGet<string>("kv", "loc:" + book.id)) ?? null);
        const engine = isPdf
          ? await makePdf(bytes, host, initLoc, dark, onProgress)
          : await makeEpub(bytes, host, mode, initLoc, dark, onProgress, (info) => { if (alive) setSel(info); },
              cachedLoc, (json, count) => { idbSet("kv", "loc:" + book.id, json); repo.setBookPages(book.id, count); });
        if (!alive) { engine.destroy(); return; }
        engineRef.current = engine;
        engine.setFontPct(fontPct);
        engine.applySaved?.(repo.listHighlights(book.id).map((h) => ({ locator: h.locator, color: h.color, underline: h.underline })));
        setToc(engine.toc);
        setLoading(false);
      } catch (e) {
        console.error("reader load failed", e);
        if (alive) { setLoading(false); s.showToast("Couldn’t open this book."); }
      }
    })();

    return () => { alive = false; engineRef.current?.destroy(); engineRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id, mode]);

  /* refresh bookmarks when book changes */
  useEffect(() => { if (book) setBookmarks(repo.listBookmarks(book.id)); }, [book?.id]);

  /* react to theme changes */
  useEffect(() => { engineRef.current?.setTheme(theme === "dark"); }, [theme]);

  /* reading-session timer for stats (records estimated words read for WPM) */
  useEffect(() => {
    if (!book) return;
    const start = Date.now();
    const startProgress = book.progress;
    return () => {
      const secs = (Date.now() - start) / 1000;
      const delta = Math.max(0, pctRef.current - startProgress);
      const totalPages = book.pages || (book.format === "pdf" ? 300 : 320);
      const words = Math.round(delta * totalPages * 275); // ~275 words/page
      repo.logSession(book.id, secs, words);
    };
  }, [book?.id]);

  /* immersive auto-hide */
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    let timer: number;
    const panelOpen = () => prefsOpenRef.current || tocOpenRef.current;
    const poke = () => {
      el.classList.remove("immersive");
      clearTimeout(timer);
      timer = window.setTimeout(() => { if (!panelOpen()) el.classList.add("immersive"); }, 2800);
    };
    poke();
    el.addEventListener("mousemove", poke);
    el.addEventListener("touchstart", poke);
    return () => { clearTimeout(timer); el.removeEventListener("mousemove", poke); el.removeEventListener("touchstart", poke); };
  }, [book?.id]);

  // keep refs of panel-open for the immersive closure
  const prefsOpenRef = useRef(false); prefsOpenRef.current = prefsOpen;
  const tocOpenRef = useRef(false); tocOpenRef.current = tocOpen;

  /* keyboard */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); engineRef.current?.next(); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); engineRef.current?.prev(); }
      else if (e.key === "Escape") { setPrefsOpen(false); setTocOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const applyFont = (delta: number) => {
    const next = Math.min(180, Math.max(70, fontPct + delta));
    setFontPct(next); engineRef.current?.setFontPct(next); s.setFontScale(next);
  };

  const applyHl = (color: string) => {
    if (!sel || !book) return;
    engineRef.current?.highlight?.(sel.cfi, color, hlUnderline);
    repo.addHighlight({ bookId: book.id, text: sel.text, color, underline: hlUnderline, chapter: label || null, locator: sel.cfi });
    setSel(null);
    s.showToast("Highlight saved");
    try { (hostRef.current?.querySelector("iframe") as HTMLIFrameElement)?.contentWindow?.getSelection()?.removeAllRanges(); } catch { /* ignore */ }
  };

  const addBookmark = () => {
    if (!book) return;
    const bm = repo.addBookmark(book.id, label || `${Math.round(pct * 100)}%`, locatorRef.current || "");
    setBookmarks((b) => [bm, ...b]);
    s.showToast("Bookmark saved");
  };

  if (!book) {
    return <div className="placeholder"><h2>No book open</h2><p>Pick a book from your library to start reading.</p></div>;
  }

  const chapter = label || (isPdf ? "" : "");

  return (
    <div id="reader-view" ref={viewRef}>
      <div className="imm-hint">Move to show controls</div>

      <div className="r-bar">
        <div className="r-left">
          <button className="ham" onClick={() => s.toggleNav()} aria-label="Toggle sidebar"><IMenu /></button>
          <div className="hist">
            <button className="icon-btn" disabled={hi <= 0} onClick={() => s.navBack()} title="Back (⌥←)" aria-label="Back"><IChevL /></button>
            <button className="icon-btn" disabled={hi >= history.length - 1} onClick={() => s.navForward()} title="Forward (⌥→)" aria-label="Forward"><IChevR /></button>
          </div>
          <div className="mini-brand"><Logo className="logo" /><span className="wm">Book <b>Nook</b></span></div>
        </div>
        <div className="r-title">
          <span className="bk">{book.title}</span>
          {chapter && <span className="ch">{chapter}</span>}
        </div>
        <div className="r-tools">
          {!isPdf && (
            <div className="seg">
              <button className={mode === "scroll" ? "on" : ""} onClick={() => chooseMode("scroll")}><IScroll />Scroll</button>
              <button className={mode === "paged" ? "on" : ""} onClick={() => chooseMode("paged")}><IPaged />Paged</button>
            </div>
          )}
          <button className="icon-btn" title="Contents & bookmarks" onClick={() => { setTocOpen((o) => !o); setPrefsOpen(false); }}><IBookmark /></button>
          <button className="btn btn-ghost" onClick={() => { setPrefsOpen((o) => !o); setTocOpen(false); }}>
            <span style={{ fontFamily: "var(--serif)", fontWeight: 600 }}>Aa</span> Type
          </button>
        </div>
      </div>

      <div className="r-stage">
        <div ref={hostRef} className={isPdf ? "pdf-host" : "epub-host"} />
        {loading && <div className="r-loading">Opening “{book.title}”…</div>}
        <button className="pg-nav prev" onClick={() => engineRef.current?.prev()} aria-label="Previous"><IChevL /></button>
        <button className="pg-nav next" onClick={() => engineRef.current?.next()} aria-label="Next"><IChevR /></button>
      </div>

      <div className="r-foot">
        <span className="pg">{label || `${Math.round(pct * 100)}%`}</span>
        <input type="range" min={0} max={1000} value={Math.round(pct * 1000)}
          style={{ background: `linear-gradient(90deg, var(--brass) 0 ${pct * 100}%, var(--surface-2) ${pct * 100}%)` }}
          onChange={(e) => { const p = +e.target.value / 1000; setPct(p); pctRef.current = p; engineRef.current?.goTo(p); }}
          aria-label="Reading progress" />
        <span className="pg">{Math.round(pct * 100)}%</span>
      </div>

      {prefsOpen && (
        <div className="prefs" onMouseDown={(e) => e.stopPropagation()}>
          <h4>Reading</h4>
          <div className="p-sub">{isPdf ? "PDF display options." : "Applies to this book."}</div>
          {!isPdf && (
            <div className="p-row">
              <div className="lbl">Text size</div>
              <div className="stepper">
                <button onClick={() => applyFont(-10)} aria-label="smaller">−</button>
                <span className="val">{fontPct}%</span>
                <button onClick={() => applyFont(10)} aria-label="larger">＋</button>
              </div>
            </div>
          )}
          <div className="p-row">
            <div className="lbl">Theme</div>
            <div className="chips">
              <span className={"chip" + (theme === "dark" ? " on" : "")} onClick={() => theme !== "dark" && s.toggleTheme()}>Dark</span>
              <span className={"chip" + (theme === "light" ? " on" : "")} onClick={() => theme !== "light" && s.toggleTheme()}>Light</span>
            </div>
          </div>
          {isPdf && <div className="p-sub" style={{ marginTop: 8 }}>More epub-style options (font, spacing, margins) apply to reflowable books.</div>}
        </div>
      )}

      <div className={"toc-scrim" + (tocOpen ? " open" : "")} onClick={() => setTocOpen(false)} />
      <div className={"toc" + (tocOpen ? " open" : "")}>
        <div className="toc-h"><h4>{book.title}</h4><button className="icon-btn" onClick={() => setTocOpen(false)} aria-label="Close"><IClose /></button></div>
        <div className="toc-tabs">
          <button className={"toc-tab" + (tocTab === "contents" ? " on" : "")} onClick={() => setTocTab("contents")}>Contents</button>
          <button className={"toc-tab" + (tocTab === "marks" ? " on" : "")} onClick={() => setTocTab("marks")}>Bookmarks</button>
        </div>
        <div className="toc-list">
          {tocTab === "contents" ? (
            toc.length ? toc.map((t, i) => (
              <div key={i} className="toc-item" onClick={() => { engineRef.current?.gotoLocator(t.href); setTocOpen(false); }}>
                <span className="ci-t">{t.label}</span>
              </div>
            )) : <div className="toc-empty">{isPdf ? "This PDF has no embedded contents. Use the slider or arrows to move around." : "No contents found for this book."}</div>
          ) : (
            <>
              <div className="toc-item" style={{ color: "var(--brass)" }} onClick={addBookmark}>
                <IBookmark style={{ width: 15, height: 15 }} /><span className="ci-t">Bookmark this spot</span>
              </div>
              {bookmarks.length ? bookmarks.map((bm) => (
                <div key={bm.id} className="toc-item" onClick={() => { engineRef.current?.gotoLocator(bm.locator); setTocOpen(false); }}>
                  <span className="bm on"><IBookmark /></span>
                  <span className="ci-t">{bm.label}</span>
                  <button className="bm" onClick={(e) => { e.stopPropagation(); repo.removeBookmark(bm.id); setBookmarks((b) => b.filter((x) => x.id !== bm.id)); }} title="Remove"><IClose /></button>
                </div>
              )) : <div className="toc-empty">No bookmarks yet.</div>}
            </>
          )}
        </div>
      </div>

      {sel && (
        <div className="sel-bar" style={{ left: sel.x, top: sel.y }} onMouseDown={(e) => e.preventDefault()}>
          {HL_COLORS.map((c) => (
            <span key={c} className="sc" style={{ background: c }} title="Highlight" onMouseDown={(e) => { e.preventDefault(); applyHl(c); }} />
          ))}
          <span className="vr" />
          <button className={"sb-btn" + (!hlUnderline ? " on" : "")} onMouseDown={(e) => { e.preventDefault(); setHlUnderline(false); }} title="Highlight">Aa</button>
          <button className={"sb-btn" + (hlUnderline ? " on" : "")} onMouseDown={(e) => { e.preventDefault(); setHlUnderline(true); }} title="Underline"><u>Aa</u></button>
        </div>
      )}
    </div>
  );
}

/* debounced progress save */
let saveTimer: number | null = null;
function scheduleSave(id: string, pct: number, locator: string) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => useApp.getState().saveProgress(id, pct, locator), 400);
}
