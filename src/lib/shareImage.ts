// Shareable PNG cards rendered entirely on a <canvas> — no external libraries.
import type { Book, Highlight } from "./types";

const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const SANS = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const INK = "#f2e9d8", MUTED = "#c3b291", BRASS = "#d6a64f", BRASS_HI = "#ecc77e";

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\n/)) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      let w = word;
      // hard-break words longer than the line
      while (ctx.measureText(w).width > maxW) {
        let i = 1;
        while (i < w.length && ctx.measureText(w.slice(0, i + 1)).width <= maxW) i++;
        if (line) { lines.push(line); line = ""; }
        lines.push(w.slice(0, i));
        w = w.slice(i);
      }
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
      else line = test;
    }
    lines.push(line);
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const DPR = 2;
function makeCanvas(w: number, h: number, accent = BRASS) {
  const c = document.createElement("canvas");
  c.width = w * DPR; c.height = h * DPR;
  const ctx = c.getContext("2d")!;
  ctx.scale(DPR, DPR);
  const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
  g.addColorStop(0, "#241d12"); g.addColorStop(1, "#120d07");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // soft accent glow, top-right
  const rg = ctx.createRadialGradient(w, 0, 0, w, 0, w * 0.9);
  rg.addColorStop(0, accent + "24"); rg.addColorStop(1, "#00000000");
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(214,166,79,.22)"; ctx.lineWidth = 2;
  roundRect(ctx, 1, 1, w - 2, h - 2, 28); ctx.stroke();
  return { c, ctx };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, w: number, h: number, accent: string) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 6); ctx.clip();
  if (img) {
    const s = Math.max(w / img.width, h / img.height);
    ctx.drawImage(img, x + (w - img.width * s) / 2, y + (h - img.height * s) / 2, img.width * s, img.height * s);
  } else {
    ctx.fillStyle = accent; ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

/* ---------------- highlight card ---------------- */
export async function highlightCard(hl: Highlight, book: Book): Promise<string> {
  const W = 1080, PAD = 96, maxW = W - PAD * 2;
  const text = hl.text.trim();
  // adaptive type size for long passages
  let fs = 50;
  if (text.length > 220) fs = 42;
  if (text.length > 420) fs = 36;
  if (text.length > 700) fs = 31;
  const lineH = Math.round(fs * 1.42);

  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = `500 ${fs}px ${SERIF}`;
  let lines = wrap(probe, `“${text}”`, maxW - 26);
  const MAX_LINES = 18;
  if (lines.length > MAX_LINES) {
    lines = lines.slice(0, MAX_LINES);
    lines[MAX_LINES - 1] = lines[MAX_LINES - 1].replace(/\s+\S*$/, "") + " …”";
  }
  const H = PAD + 96 + lines.length * lineH + 190;

  const { c, ctx } = makeCanvas(W, H, hl.color);
  // label
  ctx.fillStyle = hl.color;
  ctx.beginPath(); ctx.arc(PAD + 6, PAD + 4, 6, 0, Math.PI * 2); ctx.fill();
  ctx.font = `600 22px ${SANS}`;
  ctx.fillText("HIGHLIGHT", PAD + 22, PAD + 11);
  // quote mark
  ctx.fillStyle = hl.color + "3a";
  ctx.font = `700 150px ${SERIF}`;
  ctx.fillText("“", PAD - 8, PAD + 128);
  // accent rule down the left of the excerpt
  const textTop = PAD + 108;
  ctx.fillStyle = hl.color;
  ctx.fillRect(PAD, textTop - fs + 8, 5, lines.length * lineH - 6);
  // excerpt
  ctx.fillStyle = INK;
  ctx.font = `500 ${fs}px ${SERIF}`;
  let y = textTop;
  for (const ln of lines) { ctx.fillText(ln, PAD + 26, y); y += lineH; }
  // divider
  y += 34;
  ctx.strokeStyle = "rgba(214,166,79,.28)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
  // source with cover
  y += 30;
  const cover = book.cover ? await loadImage(book.cover) : null;
  drawCover(ctx, cover, PAD, y, 66, 98, hl.color);
  ctx.fillStyle = INK; ctx.font = `600 32px ${SERIF}`;
  ctx.fillText(book.title, PAD + 88, y + 34);
  ctx.fillStyle = MUTED; ctx.font = `400 23px ${SANS}`;
  ctx.fillText([book.author, hl.chapter].filter(Boolean).join("  ·  "), PAD + 88, y + 68);
  // watermark
  ctx.fillStyle = "rgba(242,233,216,.42)"; ctx.font = `600 18px ${SANS}`;
  ctx.fillText("BOOK NOOK", W - PAD - ctx.measureText("BOOK NOOK").width, H - 40);
  return c.toDataURL("image/png");
}

/* ---------------- stats card ---------------- */
export interface StatsCardData {
  periodLabel: string;         // "This week" etc.
  rangeLabel: string;          // "12–18 Jul 2026"
  hours: string;               // "6.4"
  wpm: number;
  pages: number;
  booksFinished: number;
  streak: number;
  onShelf: number;
  booksRead: number;
  week: { label: string; sec: number }[];
  topAuthor?: string;
  mostRead?: string;
}

export async function statsCard(d: StatsCardData): Promise<string> {
  const W = 1080, H = 1080, PAD = 84;
  const { c, ctx } = makeCanvas(W, H);

  // header
  ctx.fillStyle = BRASS; ctx.font = `600 24px ${SANS}`;
  ctx.fillText(d.periodLabel.toUpperCase() + "  ·  BOOK NOOK", PAD, PAD + 14);
  ctx.fillStyle = INK; ctx.font = `600 66px ${SERIF}`;
  ctx.fillText(`${d.hours} hours read`, PAD, PAD + 96);
  ctx.fillStyle = MUTED; ctx.font = `400 24px ${SANS}`;
  ctx.fillText(d.rangeLabel, PAD, PAD + 136);

  // stat grid (2 rows x 3)
  const cells: [string, string][] = [
    [`${d.booksFinished}`, "books finished"],
    [`${d.wpm}`, "words / min"],
    [`${d.streak}`, d.streak === 1 ? "day streak" : "day streak"],
    [`${d.pages}`, "pages read"],
    [`${d.onShelf}`, "on the shelf"],
    [`${d.booksRead}`, "read all-time"],
  ];
  const gx = PAD, gy = PAD + 200, cw = (W - PAD * 2) / 3, ch = 150;
  cells.forEach(([val, lab], i) => {
    const x = gx + (i % 3) * cw, yy = gy + Math.floor(i / 3) * ch;
    ctx.fillStyle = INK; ctx.font = `600 60px ${SERIF}`;
    ctx.fillText(val, x, yy + 56);
    ctx.fillStyle = MUTED; ctx.font = `400 22px ${SANS}`;
    ctx.fillText(lab, x, yy + 90);
  });

  // weekly chart
  const chartTop = gy + 2 * ch + 40, chartH = 220, chartW = W - PAD * 2;
  ctx.strokeStyle = "rgba(214,166,79,.16)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, chartTop + chartH); ctx.lineTo(W - PAD, chartTop + chartH); ctx.stroke();
  const max = Math.max(1, ...d.week.map((w) => w.sec));
  const bw = chartW / d.week.length;
  d.week.forEach((w, i) => {
    const h = Math.max(5, (w.sec / max) * chartH);
    const x = PAD + i * bw + bw * 0.26;
    const g = ctx.createLinearGradient(0, chartTop + chartH - h, 0, chartTop + chartH);
    g.addColorStop(0, BRASS_HI); g.addColorStop(1, BRASS);
    ctx.fillStyle = g;
    roundRect(ctx, x, chartTop + chartH - h, bw * 0.48, h, 7); ctx.fill();
    ctx.fillStyle = MUTED; ctx.font = `400 20px ${SANS}`;
    const lw = ctx.measureText(w.label).width;
    ctx.fillText(w.label, x + bw * 0.24 - lw / 2, chartTop + chartH + 30);
  });

  // footer highlights
  let fy = chartTop + chartH + 92;
  if (d.topAuthor) {
    ctx.fillStyle = MUTED; ctx.font = `400 22px ${SANS}`; ctx.fillText("Most-read author", PAD, fy);
    ctx.fillStyle = INK; ctx.font = `600 30px ${SERIF}`; ctx.fillText(d.topAuthor, PAD, fy + 36);
  }
  if (d.mostRead) {
    ctx.fillStyle = MUTED; ctx.font = `400 22px ${SANS}`; ctx.fillText("Most opened", W / 2, fy);
    ctx.fillStyle = INK; ctx.font = `600 30px ${SERIF}`;
    const t = d.mostRead.length > 26 ? d.mostRead.slice(0, 25) + "…" : d.mostRead;
    ctx.fillText(t, W / 2, fy + 36);
  }
  return c.toDataURL("image/png");
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}
