import { useMemo, useState } from "react";
import { useApp } from "../store";
import * as repo from "../lib/repo";
import { highlightCard, downloadDataUrl } from "../lib/shareImage";
import { IShare, ITrash } from "./icons";

export function HighlightsPage() {
  const { books } = useApp();
  const s = useApp.getState();
  const [version, setVersion] = useState(0);

  const items = useMemo(
    () => repo.allHighlights().map((h) => ({ h, book: books.find((b) => b.id === h.bookId) })).filter((x) => x.book),
    [books, version]
  );

  const share = async (h: (typeof items)[number]["h"], book: NonNullable<(typeof items)[number]["book"]>) => {
    try {
      downloadDataUrl(await highlightCard(h, book), `highlight-${book.title.slice(0, 24).replace(/\W+/g, "-")}.png`);
      s.showToast("Highlight image saved");
    } catch { s.showToast("Couldn’t make the image."); }
  };

  const del = (id: string) => { repo.removeHighlight(id); setVersion((v) => v + 1); s.showToast("Highlight removed"); };

  return (
    <div className="wrap">
      <span className="eyebrow">Excerpts</span>
      <h1 className="display">Highlights</h1>
      {items.length === 0 ? (
        <div className="empty">
          <h2>No highlights yet</h2>
          <p>While reading an EPUB, select any passage and pick a colour from the toolbar that appears.</p>
        </div>
      ) : (
        <div className="hl-grid">
          {items.map(({ h, book }) => (
            <div key={h.id} className="hl-card" style={{ borderLeftColor: h.color }} onClick={() => s.openBookAt(book!.id, h.locator || "")}>
              <p
                className="hl-text"
                style={h.underline
                  ? { textDecoration: `underline ${h.color}`, textUnderlineOffset: 3 }
                  : { background: `linear-gradient(transparent 62%, ${h.color}55 0)` }}
              >
                {h.text}
              </p>
              <div className="hl-foot">
                <div className="hl-src">{book!.title} · {book!.author}{h.chapter ? ` · ${h.chapter}` : ""}</div>
                <div className="hl-acts">
                  <button title="Save as image" onClick={(e) => { e.stopPropagation(); share(h, book!); }}><IShare /></button>
                  <button title="Remove highlight" className="danger" onClick={(e) => { e.stopPropagation(); del(h.id); }}><ITrash /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
