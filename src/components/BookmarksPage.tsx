import { useMemo } from "react";
import { useApp } from "../store";
import * as repo from "../lib/repo";
import type { Bookmark } from "../lib/types";
import { BookCover } from "./BookCover";
import { IBookmark, IChevR } from "./icons";

export function BookmarksPage() {
  const { books } = useApp();
  const s = useApp.getState();

  const groups = useMemo(() => {
    const byBook = new Map<string, Bookmark[]>();
    for (const m of repo.allBookmarks()) {
      if (!byBook.has(m.bookId)) byBook.set(m.bookId, []);
      byBook.get(m.bookId)!.push(m);
    }
    return [...byBook.entries()]
      .map(([bid, list]) => ({ book: books.find((b) => b.id === bid), list }))
      .filter((g) => g.book);
  }, [books]);

  return (
    <div className="wrap">
      <span className="eyebrow">Saved places</span>
      <h1 className="display">Bookmarks</h1>
      {groups.length === 0 ? (
        <div className="empty"><h2>No bookmarks yet</h2><p>Open a book, tap the ribbon in the reader, then “Bookmark this spot”.</p></div>
      ) : (
        <div style={{ marginTop: 22 }}>
          {groups.map((g) => (
            <div className="bm-group" key={g.book!.id}>
              <div className="bm-group-h">
                <div className="cover-wrap bm-cov"><BookCover book={g.book!} /></div>
                <div><div className="t">{g.book!.title}</div><div className="a">{g.book!.author}</div></div>
                <div className="n">{g.list.length} bookmark{g.list.length > 1 ? "s" : ""}</div>
              </div>
              {g.list.map((m) => (
                <div className="bm-row" key={m.id} onClick={() => s.openBookAt(g.book!.id, m.locator)}>
                  <span className="rib"><IBookmark /></span>
                  <div className="bm-ch">
                    <div className="c1">{m.label}</div>
                    <div className="c2">{new Date(m.createdAt).toLocaleDateString()}</div>
                  </div>
                  <span className="go">Open <IChevR /></span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
