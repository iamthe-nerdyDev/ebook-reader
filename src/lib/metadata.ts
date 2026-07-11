import ePub from "epubjs";
// LEGACY pdf.js build: the modern build needs Promise.withResolvers (WebKit 17.4+),
// which Tauri's WKWebView on macOS Ventura doesn't have — getDocument() throws and
// PDF imports fail in the packaged app. The legacy build polyfills it.
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
// Inline the worker (base64 → Blob): WKWebView doesn't route worker-script requests
// through Tauri's tauri:// protocol handler, so URL-based workers fail when packaged.
import PdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker&inline";
import type { Format, ParsedBook } from "./types";

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

// Reader.tsx must use this same module instance (same worker + same API version).
export { pdfjsLib };

export function formatOf(name: string): Format | null {
  const n = name.toLowerCase();
  if (n.endsWith(".epub")) return "epub";
  if (n.endsWith(".pdf")) return "pdf";
  return null;
}

function titleFromFilename(name: string): string {
  return name.replace(/\.(epub|pdf)$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
}

/** Downscale a cover image to a reasonable size and re-encode as JPEG data URL. */
async function normalizeCover(src: Blob | HTMLCanvasElement, maxW = 420): Promise<string | null> {
  try {
    let img: HTMLImageElement | HTMLCanvasElement;
    if (src instanceof HTMLCanvasElement) {
      img = src;
    } else {
      const url = URL.createObjectURL(src);
      img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error("cover decode failed"));
        i.src = url;
      });
      URL.revokeObjectURL(url);
    }
    const w = (img as HTMLImageElement).naturalWidth || img.width;
    const h = (img as HTMLImageElement).naturalHeight || img.height;
    if (!w || !h) return null;
    const scale = Math.min(1, maxW / w);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return null;
  }
}

async function parseEpub(bytes: ArrayBuffer, name: string): Promise<Partial<ParsedBook>> {
  const book: any = ePub(bytes.slice(0));
  await book.ready;
  const md = book.packaging?.metadata ?? {};
  const year = md.pubdate ? Number(String(md.pubdate).slice(0, 4)) || null : null;
  let cover: string | null = null;
  try {
    const coverUrl: string | null = await book.coverUrl();
    if (coverUrl) {
      const blob = await (await fetch(coverUrl)).blob();
      cover = await normalizeCover(blob);
    }
  } catch {
    /* no cover */
  }
  try { book.destroy?.(); } catch { /* ignore */ }
  return {
    title: (md.title || titleFromFilename(name)).trim(),
    author: (md.creator || "Unknown author").trim(),
    year,
    cover,
    pages: null,
  };
}

async function parsePdf(bytes: ArrayBuffer, name: string): Promise<Partial<ParsedBook>> {
  const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
  let title = titleFromFilename(name);
  let author = "Unknown author";
  let year: number | null = null;
  try {
    const meta: any = await doc.getMetadata();
    const info = meta?.info ?? {};
    if (info.Title && String(info.Title).trim()) title = String(info.Title).trim();
    if (info.Author && String(info.Author).trim()) author = String(info.Author).trim();
    const cd = info.CreationDate as string | undefined; // e.g. D:20200101...
    if (cd) { const m = cd.match(/D:(\d{4})/); if (m) year = Number(m[1]); }
  } catch { /* ignore */ }

  let cover: string | null = null;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 420 / base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    cover = await normalizeCover(canvas);
  } catch { /* ignore */ }

  const pages = doc.numPages;
  try { await doc.destroy(); } catch { /* ignore */ }
  return { title, author, year, cover, pages };
}

export async function parseBook(name: string, bytes: ArrayBuffer): Promise<ParsedBook | null> {
  const format = formatOf(name);
  if (!format) return null;
  const partial = format === "epub" ? await parseEpub(bytes, name) : await parsePdf(bytes, name);
  return {
    title: partial.title || titleFromFilename(name),
    author: partial.author || "Unknown author",
    year: partial.year ?? null,
    format,
    cover: partial.cover ?? null,
    pages: partial.pages ?? null,
    bytes,
    fileSize: bytes.byteLength,
  };
}
