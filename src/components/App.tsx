import { useEffect, useState } from "react";
import { useApp } from "../store";
import { Sidebar } from "./Sidebar";
import { Library } from "./Library";
import { Reader } from "./Reader";
import { ImportModal } from "./ImportModal";
import { StatsPage } from "./StatsPage";
import { HighlightsPage } from "./HighlightsPage";
import { BookmarksPage } from "./BookmarksPage";
import { IMenu, ISearch, Logo, IChevL, IChevR, IRefresh } from "./icons";
import type { SortBy } from "../lib/types";

const SORTS: { id: SortBy; label: string }[] = [
  { id: "recent", label: "Recently added" },
  { id: "title", label: "Title (A–Z)" },
  { id: "author", label: "Author" },
  { id: "progress", label: "Progress" },
];

export function App() {
  const { ready, view, navHidden, busy, toast, search, history, hi, sortBy } = useApp();
  const s = useApp.getState();
  const [importing, setImporting] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const canBack = hi > 0;
  const canForward = hi < history.length - 1;

  useEffect(() => { s.init(); }, []);

  // Alt/⌥ + arrow = browser-style back/forward, everywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); useApp.getState().navBack(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); useApp.getState().navForward(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!ready) {
    return <div style={{ display: "grid", placeItems: "center", height: "100vh", color: "var(--ink-3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="sp" style={{ width: 16, height: 16, border: "2px solid var(--brass)", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} /> Opening your library…</div>
    </div>;
  }

  return (
    <div className={"shell" + (navHidden ? " nav-hidden" : "")}>
      <div className="backdrop" onClick={() => s.toggleNav(true)} />
      <Sidebar onImport={() => setImporting(true)} />

      <div className={"main" + (view === "reader" ? " read-mode" : "")}>
        <div className="topbar">
          <div className="tb-left">
            <button className="ham" onClick={() => s.toggleNav()} aria-label="Toggle sidebar"><IMenu /></button>
            <div className="mini-brand"><Logo className="logo" /><span className="wm">Book <b>Nook</b></span></div>
            <div className="hist">
              <button className="icon-btn" disabled={!canBack} onClick={() => s.navBack()} aria-label="Back" title="Back (⌥←)"><IChevL /></button>
              <button className="icon-btn" disabled={!canForward} onClick={() => s.navForward()} aria-label="Forward" title="Forward (⌥→)"><IChevR /></button>
              <button className="icon-btn refresh-btn" onClick={(e) => { (e.currentTarget as HTMLButtonElement).classList.add("spin"); s.manualRefresh(); setTimeout(() => document.querySelectorAll(".refresh-btn").forEach((b) => b.classList.remove("spin")), 700); }} aria-label="Refresh" title="Refresh this page"><IRefresh /></button>
            </div>
          </div>
          <div className="search">
            <ISearch />
            <input
              placeholder="Search your books and authors…"
              value={search}
              onChange={(e) => s.setSearch(e.target.value)}
            />
          </div>
          <div className="tb-right" style={{ position: "relative" }}>
            <button className="btn btn-ghost" onClick={() => setSortOpen((o) => !o)}>
              Sort: {SORTS.find((x) => x.id === sortBy)?.label.replace(" (A–Z)", "")}
            </button>
            {sortOpen && (
              <>
                <div className="menu-catch" onClick={() => setSortOpen(false)} />
                <div className="sort-menu">
                  {SORTS.map((o) => (
                    <button key={o.id} className={o.id === sortBy ? "on" : ""} onClick={() => { s.setSortBy(o.id); setSortOpen(false); }}>{o.label}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="pane">
          {view === "library" && <Library />}
          {view === "reader" && <Reader />}
          {view === "stats" && <StatsPage />}
          {view === "highlights" && <HighlightsPage />}
          {view === "bookmarks" && <BookmarksPage />}
        </div>
      </div>

      {importing && <ImportModal onClose={() => setImporting(false)} />}
      {(busy || toast) && (
        <div className="toast">{busy && <span className="sp" />}{toast}</div>
      )}
    </div>
  );
}
