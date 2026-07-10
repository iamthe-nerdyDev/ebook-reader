import { useMemo, useState } from "react";
import { useApp } from "../store";
import * as repo from "../lib/repo";
import { BookCover } from "./BookCover";
import { statsCard, downloadDataUrl } from "../lib/shareImage";
import { IShare } from "./icons";

type Period = "week" | "month" | "year" | "custom";
const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const niceDate = (k: string) => { const [y, m, d] = k.split("-"); return `${+d} ${MON[+m - 1]} ${y}`; };

function rangeFor(period: Period, from: string, to: string): [string, string] {
  const today = new Date();
  if (period === "week") { const f = new Date(today); f.setDate(f.getDate() - 6); return [dayKey(f), dayKey(today)]; }
  if (period === "month") { const f = new Date(today); f.setDate(f.getDate() - 29); return [dayKey(f), dayKey(today)]; }
  if (period === "year") { return [dayKey(new Date(today.getFullYear(), 0, 1)), dayKey(today)]; }
  return [from, to];
}

function fmtHours(sec: number) { const h = sec / 3600; return h >= 1 ? h.toFixed(1) : String(Math.round(sec / 60)); }
function perPage(sec: number, pages: number) {
  if (!pages) return "—";
  const s = Math.round(sec / pages);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

export function StatsPage() {
  const { books, categories } = useApp();
  const [period, setPeriod] = useState<Period>("week");
  const today = dayKey(new Date());
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 13); return dayKey(d); });
  const [to, setTo] = useState(today);

  const d = useMemo(() => {
    const [lo, hi] = rangeFor(period, from, to);
    const sessions = repo.allSessions().filter((s) => s.day >= lo && s.day <= hi);

    const seconds = sessions.reduce((a, s) => a + s.seconds, 0);
    const words = sessions.reduce((a, s) => a + s.words, 0);
    const minutes = seconds / 60;
    const wpm = minutes > 1 ? Math.round(words / minutes) : 0;
    const pages = Math.round(words / 275);

    // buckets: monthly for year, daily otherwise
    type Bucket = { key: string; label: string; sec: number };
    const buckets: Bucket[] = [];
    if (period === "year") {
      for (let m = 0; m < 12; m++) buckets.push({ key: `${new Date().getFullYear()}-${String(m + 1).padStart(2, "0")}`, label: MON[m][0], sec: 0 });
      for (const s of sessions) { const b = buckets.find((x) => s.day.startsWith(x.key)); if (b) b.sec += s.seconds; }
    } else {
      const start = new Date(lo + "T00:00:00"), end = new Date(hi + "T00:00:00");
      const span = Math.round((+end - +start) / 86400000);
      let i = 0;
      for (let dd = new Date(start); dd <= end; dd.setDate(dd.getDate() + 1), i++) {
        const k = dayKey(dd);
        const label = span <= 8 ? DOW[dd.getDay()] : (i % Math.ceil(span / 8) === 0 ? String(dd.getDate()) : "");
        buckets.push({ key: k, label, sec: 0 });
      }
      for (const s of sessions) { const b = buckets.find((x) => x.key === s.day); if (b) b.sec += s.seconds; }
    }

    // per-book time in range
    const secByBook = new Map<string, number>();
    const cntByBook = new Map<string, number>();
    for (const s of sessions) {
      secByBook.set(s.bookId, (secByBook.get(s.bookId) || 0) + s.seconds);
      cntByBook.set(s.bookId, (cntByBook.get(s.bookId) || 0) + 1);
    }
    const byAuthor = new Map<string, number>();
    const byCat = new Map<string, number>();
    for (const b of books) {
      const sec = secByBook.get(b.id) || 0; if (sec <= 0) continue;
      byAuthor.set(b.author, (byAuthor.get(b.author) || 0) + sec);
      const cat = b.categoryId ? (categories.find((c) => c.id === b.categoryId)?.name ?? "—") : "Uncategorized";
      byCat.set(cat, (byCat.get(cat) || 0) + sec);
    }
    const rank = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const perBook = [...secByBook.entries()].map(([id, sec]) => ({ book: books.find((b) => b.id === id), sec }))
      .filter((x) => x.book).sort((a, b) => b.sec - a.sec).slice(0, 5);
    const mostRead = [...cntByBook.entries()].map(([id, n]) => ({ book: books.find((b) => b.id === id), n }))
      .filter((x) => x.book).sort((a, b) => b.n - a.n).slice(0, 5);

    // day streak (current, all-time)
    const withReading = new Set(repo.allSessions().filter((s) => s.seconds > 0).map((s) => s.day));
    let streak = 0; const tdy = new Date();
    for (let k = 0; ; k++) { const dd = new Date(tdy); dd.setDate(dd.getDate() - k); if (withReading.has(dayKey(dd))) streak++; else break; }

    const finishedInPeriod = books.filter((b) => b.finishedAt && dayKey(new Date(b.finishedAt)) >= lo && dayKey(new Date(b.finishedAt)) <= hi);
    const finishedAll = books.filter((b) => b.finished);

    return {
      lo, hi, seconds, words, wpm, pages, buckets,
      bucketMax: Math.max(1, ...buckets.map((b) => b.sec)),
      topAuthors: rank(byAuthor), topCats: rank(byCat),
      authorMax: Math.max(1, ...rank(byAuthor).map((a) => a[1])),
      catMax: Math.max(1, ...rank(byCat).map((a) => a[1])),
      perBook, perBookMax: Math.max(1, ...perBook.map((x) => x.sec)),
      mostRead, streak, finishedInPeriod, finishedAll,
    };
  }, [books, categories, period, from, to]);

  const label = period === "week" ? "This week" : period === "month" ? "This month" : period === "year" ? "This year" : "Custom range";
  const hasData = d.seconds > 0;

  const share = async () => {
    try {
      downloadDataUrl(await statsCard({
        periodLabel: label, rangeLabel: `${niceDate(d.lo)} – ${niceDate(d.hi)}`,
        hours: fmtHours(d.seconds), wpm: d.wpm, pages: d.pages,
        booksFinished: d.finishedInPeriod.length, streak: d.streak, onShelf: books.length,
        booksRead: d.finishedAll.length, week: d.buckets.map((b) => ({ label: b.label || "·", sec: b.sec })),
        topAuthor: d.topAuthors[0]?.[0], mostRead: d.mostRead[0]?.book?.title,
      }), `book-nook-stats-${period}.png`);
      useApp.getState().showToast("Stats image saved");
    } catch { useApp.getState().showToast("Couldn’t make the image."); }
  };

  return (
    <div className="wrap">
      <div className="stats-head">
        <div>
          <span className="eyebrow">Reading stats</span>
          <h1 className="display">Your reading life</h1>
        </div>
        {hasData && <button className="btn btn-primary" onClick={share}><IShare /> Share {period === "custom" ? "stats" : label.replace("This ", "")}</button>}
      </div>

      <div className="period-bar">
        <div className="period">
          {(["week", "month", "year", "custom"] as Period[]).map((p) => (
            <button key={p} className={period === p ? "on" : ""} onClick={() => setPeriod(p)}>
              {p === "week" ? "Weekly" : p === "month" ? "Monthly" : p === "year" ? "Yearly" : "Custom"}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <div className="range">
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            <span>→</span>
            <input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
      </div>

      <div className="kpis">
        <div className="kpi"><div className="k-lab">Reading hours</div><div className="k-val">{fmtHours(d.seconds)}<span>{d.seconds >= 3600 ? "h" : "m"}</span></div></div>
        <div className="kpi"><div className="k-lab">Words / minute</div><div className="k-val">{d.wpm || "—"}<span>{d.wpm ? "wpm" : ""}</span></div></div>
        <div className="kpi"><div className="k-lab">Pages read</div><div className="k-val">{d.pages}</div></div>
        <div className="kpi"><div className="k-lab">Time / page</div><div className="k-val" style={{ fontSize: 26 }}>{perPage(d.seconds, d.pages)}</div></div>
      </div>
      <div className="kpis" style={{ marginTop: 12 }}>
        <div className="kpi"><div className="k-lab">Books finished</div><div className="k-val">{d.finishedInPeriod.length}<span>{period === "custom" ? "" : label.replace("This ", "this ")}</span></div></div>
        <div className="kpi"><div className="k-lab">Day streak</div><div className="k-val">{d.streak}<span>{d.streak === 1 ? "day" : "days"}</span></div></div>
        <div className="kpi"><div className="k-lab">On your shelf</div><div className="k-val">{books.length}</div></div>
        <div className="kpi"><div className="k-lab">Read all-time</div><div className="k-val">{d.finishedAll.length}</div></div>
      </div>

      {!hasData && <div className="empty" style={{ paddingTop: 40 }}><h2>No reading logged in this period</h2><p>Open a book and read for a bit — hours, speed, pages and charts fill in automatically.</p></div>}

      {hasData && (
        <>
          <div className="panels">
            <div className="panel">
              <h3>Reading time per day</h3>
              <div className="p-cap">{niceDate(d.lo)} – {niceDate(d.hi)} · {fmtHours(d.seconds)}{d.seconds >= 3600 ? " hours" : " minutes"}</div>
              <div className="chart">
                {d.buckets.map((b) => (
                  <div className="col" key={b.key}>
                    <div className="stack" style={{ height: `${Math.round((b.sec / d.bucketMax) * 100)}%` }} title={`${Math.round(b.sec / 60)} min`} />
                    <div className="d">{b.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel">
              <h3>Top authors</h3>
              <div className="p-cap">By time read</div>
              <div className="toplist">
                {d.topAuthors.length ? d.topAuthors.map(([name, sec], i) => (
                  <div className="top-row" key={name}><span className="rk">{i + 1}</span><span className="nm">{name}</span><span className="mtr"><i style={{ width: `${Math.round((sec / d.authorMax) * 100)}%` }} /></span></div>
                )) : <div className="p-cap">—</div>}
              </div>
            </div>
          </div>

          <div className="panels">
            <div className="panel">
              <h3>Reading time by book</h3>
              <div className="p-cap">Hours per book, this period</div>
              <div className="toplist">
                {d.perBook.map(({ book, sec }, i) => (
                  <div className="top-row" key={book!.id} style={{ cursor: "pointer" }} onClick={() => useApp.getState().openBook(book!.id)}>
                    <span className="rk">{i + 1}</span><span className="nm">{book!.title}</span>
                    <span className="tag">{fmtHours(sec)}{sec >= 3600 ? "h" : "m"}</span>
                    <span className="mtr"><i style={{ width: `${Math.round((sec / d.perBookMax) * 100)}%` }} /></span>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel">
              <h3>Most opened</h3>
              <div className="p-cap">How many times you picked a book up</div>
              <div className="toplist">
                {d.mostRead.map(({ book, n }, i) => (
                  <div className="top-row" key={book!.id} style={{ cursor: "pointer" }} onClick={() => useApp.getState().openBook(book!.id)}>
                    <span className="rk">{i + 1}</span><span className="nm">{book!.title}</span><span className="tag">×{n}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panels">
            <div className="panel">
              <h3>Books read</h3>
              <div className="p-cap">{d.finishedAll.length} finished all-time</div>
              {d.finishedAll.length ? (
                <div className="mini-shelf">{d.finishedAll.map((b) => <div className="cover-wrap" key={b.id}><BookCover book={b} /></div>)}</div>
              ) : <div className="p-cap">Finish a book and it appears here.</div>}
            </div>
            <div className="panel">
              <h3>Top categories</h3>
              <div className="p-cap">Where your time went</div>
              <div className="toplist">
                {d.topCats.length ? d.topCats.map(([name, sec], i) => (
                  <div className="top-row" key={name}><span className="rk">{i + 1}</span><span className="nm">{name}</span><span className="tag">{Math.round(sec / 60)}m</span><span className="mtr"><i style={{ width: `${Math.round((sec / d.catMax) * 100)}%` }} /></span></div>
                )) : <div className="p-cap">—</div>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
