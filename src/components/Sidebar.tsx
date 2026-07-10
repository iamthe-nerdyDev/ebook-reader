import { useState } from "react";
import { useApp } from "../store";
import {
  Logo, ILibrary, IStats, IHighlight, IBookmark, IReader, IImport, Sun, Moon, IGear, ITrash,
} from "./icons";

const NAV = [
  { id: "library", label: "Library", Icon: ILibrary },
  { id: "stats", label: "Stats", Icon: IStats },
  { id: "highlights", label: "Highlights", Icon: IHighlight },
  { id: "bookmarks", label: "Bookmarks", Icon: IBookmark },
  { id: "reader", label: "Reading now", Icon: IReader },
] as const;

export function Sidebar({ onImport }: { onImport: () => void }) {
  const { view, categories, books, activeCategoryId, theme } = useApp();
  const s = useApp.getState();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [settings, setSettings] = useState(false);
  const commit = (raw: string) => { const n = raw.trim(); if (n) s.addCategory(n); setName(""); setAdding(false); };

  const countAll = books.length;
  const countUncat = books.filter((b) => !b.categoryId).length;
  const catCount = (id: string) => books.filter((b) => b.categoryId === id).length;

  const Cat = ({ id, name, color, count }: { id: string | null | "all"; name: string; color: string; count: number }) => (
    <button
      className={"cat" + (activeCategoryId === id && view === "library" ? " on" : "")}
      onClick={() => s.setActiveCategory(id)}
    >
      <span className="dot" style={{ background: color }} />
      <span className="nm">{name}</span>
      <span className="ct">{count}</span>
    </button>
  );

  return (
    <aside className="sidebar">
      <div className="side-top">
        <div className="brand">
          <Logo className="logo" />
          <div className="wm">Book <b>Nook</b><small>Your quiet library</small></div>
        </div>
        <button className="collapse" title="Hide sidebar" onClick={() => s.toggleNav(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
      </div>

      <div className="side-scroll">
        <nav className="nav">
          {NAV.map(({ id, label, Icon }) => (
            <button key={id} className={"nav-item" + (view === id ? " on" : "")} onClick={() => (id === "reader" ? s.openReadingNow() : s.setView(id))}>
              <Icon /> {label}
            </button>
          ))}
        </nav>

        <button className="import" onClick={onImport}><IImport /> Import books</button>

        <div className="side-h">
          <span>Categories</span>
          <button title="New category" onClick={() => setAdding((a) => !a)}>＋</button>
        </div>
        {adding && (
          <div className="cat-add">
            <input
              autoFocus value={name} placeholder="Category name…"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commit(e.currentTarget.value); else if (e.key === "Escape") { setName(""); setAdding(false); } }}
              onBlur={(e) => commit(e.currentTarget.value)}
            />
          </div>
        )}
        <Cat id="all" name="All books" color="var(--brass)" count={countAll} />
        {categories.map((c) => (
          <div className="cat-row" key={c.id}>
            <button className={"cat" + (activeCategoryId === c.id && view === "library" ? " on" : "")} onClick={() => s.setActiveCategory(c.id)}>
              <span className="dot" style={{ background: c.color }} />
              <span className="nm">{c.name}</span>
              <span className="ct">{catCount(c.id)}</span>
            </button>
            <button className="cat-del" title="Delete category" onClick={() => { if (confirm(`Delete “${c.name}”?\nIts books move to Uncategorized (their stats are kept).`)) s.deleteCategory(c.id); }}>×</button>
          </div>
        ))}
        <Cat id={null} name="Uncategorized" color="var(--line-2)" count={countUncat} />
      </div>

      <div className="side-foot">
        <div className="who"><b>Reading room</b>Offline · {countAll} book{countAll === 1 ? "" : "s"}</div>
        <button className="icon-btn" title="Settings" onClick={() => setSettings((o) => !o)}><IGear /></button>
        <button className="icon-btn" title="Toggle theme" onClick={() => s.toggleTheme()}>
          {theme === "dark" ? <Moon /> : <Sun />}
        </button>
        {settings && (
          <>
            <div className="menu-catch" onClick={() => setSettings(false)} />
            <div className="settings-menu">
              <div className="sm-h">Book Nook · offline</div>
              <button className="danger" onClick={() => { setSettings(false); if (confirm("Reset Book Nook?\n\nThis permanently deletes every imported book, highlight, bookmark and all stats on this device. This can’t be undone.")) s.resetApp(); }}>
                <ITrash /> Reset app…
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
