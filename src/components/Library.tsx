import { useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useApp } from "../store";
import type { Book, Category, SortBy } from "../lib/types";
import { BookCover } from "./BookCover";
import { IChevR, ICheck, IPlay, ITrash } from "./icons";

interface Shelf { key: string; name: string; color: string; books: Book[]; badge?: string; }

function BookCard({ book }: { book: Book }) {
  const s = useApp.getState();
  const { categories } = useApp();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const inProgress = book.progress > 0 && book.progress < 0.995;

  const toggleMenu = (e: ReactMouseEvent) => {
    e.stopPropagation();
    if (pos) { setPos(null); return; }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // right-aligned popover under the button, kept on-screen
    const W = 214;
    setPos({ top: r.bottom + 6, left: Math.max(10, Math.min(r.right - W, window.innerWidth - W - 10)) });
  };

  return (
    <div className="book">
      <div className="cover-wrap" onClick={() => s.openBook(book.id)}>
        {book.finished && <div className="badge-read"><ICheck /></div>}
        <BookCover book={book} />
      </div>
      <button className="book-menu-btn" onClick={toggleMenu} title="Options">⋯</button>
      {pos && (
        <>
          <div className="menu-catch" onClick={() => setPos(null)} />
          <div className="book-menu" style={{ top: pos.top, left: pos.left }} onClick={(e) => e.stopPropagation()}>
            <div className="bm-h">Move to</div>
            <button onClick={() => { s.setBookCategory(book.id, null); setPos(null); }}>
              Uncategorized {!book.categoryId && <ICheck />}
            </button>
            {categories.map((c: Category) => (
              <button key={c.id} onClick={() => { s.setBookCategory(book.id, c.id); setPos(null); }}>
                <span className="mdot" style={{ background: c.color }} />{c.name} {book.categoryId === c.id && <ICheck />}
              </button>
            ))}
            <div className="bm-sep" />
            <button className="danger" onClick={() => { setPos(null); if (confirm(`Remove “${book.title}” from your library?`)) s.removeBook(book.id); }}>
              <ITrash /> Remove book
            </button>
          </div>
        </>
      )}
      <p className="b-title" onClick={() => s.openBook(book.id)}>{book.title}</p>
      <p className="b-auth">{book.author}</p>
      {inProgress && <div className="b-prog"><i style={{ width: `${Math.round(book.progress * 100)}%` }} /></div>}
    </div>
  );
}

function Accordion({ shelf }: { shelf: Shelf }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={"acc" + (open ? " open" : "")}>
      <button className="acc-h" onClick={() => setOpen((o) => !o)}>
        <IChevR className="chev" />
        <span className="cdot" style={{ background: shelf.color }} />
        <span className="nm">{shelf.name}</span>
        {shelf.badge && <span className="g-tag">{shelf.badge}</span>}
        <span className="count">{shelf.books.length} book{shelf.books.length === 1 ? "" : "s"}</span>
      </button>
      <div className="acc-body"><div className="acc-inner">
        <div className="grid">{shelf.books.map((b) => <BookCard key={b.id} book={b} />)}</div>
      </div></div>
    </div>
  );
}

function sortBooks(list: Book[], by: SortBy): Book[] {
  const arr = [...list];
  switch (by) {
    case "title": return arr.sort((a, b) => a.title.localeCompare(b.title));
    case "author": return arr.sort((a, b) => a.author.localeCompare(b.author));
    case "progress": return arr.sort((a, b) => b.progress - a.progress);
    default: return arr.sort((a, b) => b.addedAt - a.addedAt);
  }
}

export function Library() {
  const { books: allBooks, categories, activeCategoryId, search, sortBy, lastRead } = useApp();
  const s = useApp.getState();

  const q = search.trim().toLowerCase();
  const books = useMemo(
    () => (q ? allBooks.filter((b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)) : allBooks),
    [allBooks, q]
  );

  const readingSorted = (list: Book[]) =>
    [...list].sort((a, b) => (lastRead[b.id] ?? 0) - (lastRead[a.id] ?? 0));

  const shelves = useMemo<Shelf[]>(() => {
    if (q) return [{ key: "results", name: `Results for “${search.trim()}”`, color: "var(--brass)", books: sortBooks(books, sortBy) }];
    if (activeCategoryId === "all") {
      const list: Shelf[] = [];
      const reading = readingSorted(books.filter((b) => b.progress > 0 && b.progress < 0.995));
      if (reading.length) list.push({ key: "reading", name: "Currently reading", color: "var(--emerald)", books: reading });
      for (const c of categories) {
        const bs = sortBooks(books.filter((b) => b.categoryId === c.id), sortBy);
        if (bs.length) list.push({ key: c.id, name: c.name, color: c.color, books: bs });
      }
      const uncat = sortBooks(books.filter((b) => !b.categoryId), sortBy);
      if (uncat.length) list.push({ key: "uncat", name: "Uncategorized", color: "var(--line-2)", books: uncat });
      return list;
    }
    if (activeCategoryId === null) {
      return [{ key: "uncat", name: "Uncategorized", color: "var(--line-2)", books: sortBooks(books.filter((b) => !b.categoryId), sortBy) }];
    }
    const c = categories.find((x) => x.id === activeCategoryId);
    return [{ key: activeCategoryId, name: c?.name ?? "Category", color: c?.color ?? "var(--brass)", books: sortBooks(books.filter((b) => b.categoryId === activeCategoryId), sortBy) }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books, categories, activeCategoryId, q, search, sortBy, lastRead]);

  const resume = useMemo(() => {
    const reading = readingSorted(allBooks.filter((b) => b.progress > 0 && b.progress < 0.995));
    return reading[0] ?? [...allBooks].sort((a, b) => b.addedAt - a.addedAt)[0] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBooks, lastRead]);

  if (allBooks.length === 0) {
    return (
      <div className="wrap">
        <span className="eyebrow">Your shelves</span>
        <h1 className="display">Welcome to the Nook</h1>
        <div className="empty">
          <svg className="big-logo" viewBox="0 0 32 32" fill="none"><path d="M16 10 L28 14 v11 l-12 -3 -12 3 V14 Z" fill="var(--surface)" stroke="var(--brass)" strokeWidth={1.6} strokeLinejoin="round" /><path d="M5 12.5 L16 5 L27 12.5" fill="none" stroke="var(--brass-hi)" strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" /></svg>
          <h2>Your library is empty</h2>
          <p>Import a few .epub or .pdf books to get started. They stay entirely on this device.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <span className="eyebrow">Your shelves</span>
      <h1 className="display">Welcome back to the Nook</h1>

      {!q && resume && (
        <div className="continue">
          <div className="cover-wrap mini-cover" onClick={() => s.openBook(resume.id)}><BookCover book={resume} /></div>
          <div>
            <div className="kicker">{resume.progress > 0 ? "Continue reading" : "Start reading"}</div>
            <h3>{resume.title}</h3>
            <div className="auth">{resume.author}{resume.year ? ` · ${resume.year}` : ""}</div>
            <div className="prog">
              <div className="bar"><i style={{ width: `${Math.max(3, Math.round(resume.progress * 100))}%` }} /></div>
              <div className="pct">{Math.round(resume.progress * 100)}%</div>
            </div>
            <div className="c-foot">
              <button className="btn btn-primary" onClick={() => s.openBook(resume.id)}><IPlay /> {resume.progress > 0 ? "Resume" : "Read"}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        {shelves.map((sh) => <Accordion key={sh.key} shelf={sh} />)}
      </div>
    </div>
  );
}
