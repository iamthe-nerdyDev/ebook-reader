import { idbGet, idbSet, idbDel } from "./idb";

export interface PickedFile {
  name: string;
  bytes: ArrayBuffer;
  path?: string; // native path when available (Tauri) — used for folder-watch dedupe
}

const ACCEPT = [".epub", ".pdf"];
const isBook = (name: string) => ACCEPT.some((e) => name.toLowerCase().endsWith(e));
const baseName = (p: string) => p.split(/[\\/]/).pop() || p;

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/* ---------- Tauri (native) file access ---------- */
async function tauriPickFiles(): Promise<PickedFile[]> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const sel = await open({ multiple: true, filters: [{ name: "E-books", extensions: ["epub", "pdf"] }] });
  if (!sel) return [];
  return tauriReadPaths(Array.isArray(sel) ? sel : [sel]);
}

async function tauriReadPaths(paths: string[]): Promise<PickedFile[]> {
  const { invoke } = await import("@tauri-apps/api/core");
  return Promise.all(paths.map(async (p) => ({ name: baseName(p), path: p, bytes: (await invoke("read_file", { path: p })) as ArrayBuffer })));
}

/** Tauri: list the e-book paths inside a folder (no reading yet). */
export async function scanFolderPaths(folder: string): Promise<string[]> {
  const { invoke } = await import("@tauri-apps/api/core");
  return (await invoke("scan_dir", { path: folder })) as string[];
}

/** Read specific native paths into PickedFiles (Tauri, used by folder-watch). */
export async function readPaths(paths: string[]): Promise<PickedFile[]> {
  return isTauri ? tauriReadPaths(paths) : [];
}

/* ---------- file picking ---------- */

async function pickWithInput(): Promise<PickedFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ACCEPT.join(",");
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      resolve(await Promise.all(files.map(async (f) => ({ name: f.name, bytes: await f.arrayBuffer() }))));
    };
    input.oncancel = () => resolve([]);
    input.click();
  });
}

export async function pickFiles(): Promise<PickedFile[]> {
  if (isTauri) return tauriPickFiles();
  if (window.showOpenFilePicker) {
    try {
      const handles = await window.showOpenFilePicker({
        multiple: true,
        types: [{ description: "E-books", accept: { "application/epub+zip": [".epub"], "application/pdf": [".pdf"] } }],
      });
      const out: PickedFile[] = [];
      for (const h of handles) {
        const f = await h.getFile();
        out.push({ name: f.name, bytes: await f.arrayBuffer() });
      }
      return out;
    } catch (e: any) {
      if (e?.name === "AbortError") return [];
      // fall through to input
    }
  }
  return pickWithInput();
}

export interface FolderPick { folder: string | null; files: PickedFile[]; }

/** Choose a folder and return its books. `folder` is the native path (Tauri only) so it can be watched. */
export async function pickFolder(): Promise<FolderPick> {
  if (isTauri) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const dir = await open({ directory: true });
    if (!dir || Array.isArray(dir)) return { folder: null, files: [] };
    const paths = await scanFolderPaths(dir);
    return { folder: dir, files: await tauriReadPaths(paths) };
  }
  if (!window.showDirectoryPicker) {
    throw new Error("Folder scanning needs a Chromium-based browser (or the desktop app). Use “Add files” instead.");
  }
  let dir: FileSystemDirectoryHandle;
  try {
    dir = await window.showDirectoryPicker();
  } catch (e: any) {
    if (e?.name === "AbortError") return { folder: null, files: [] };
    throw e;
  }
  const out: PickedFile[] = [];
  async function walk(handle: FileSystemDirectoryHandle) {
    // @ts-expect-error - async iterator present in Chromium
    for await (const entry of handle.values()) {
      if (entry.kind === "file" && isBook(entry.name)) {
        const f = await entry.getFile();
        out.push({ name: f.name, bytes: await f.arrayBuffer() });
      } else if (entry.kind === "directory") {
        await walk(entry as FileSystemDirectoryHandle);
      }
    }
  }
  await walk(dir);
  return { folder: null, files: out };
}

/* ---------- book file storage ---------- */
export const saveBookFile = (id: string, bytes: ArrayBuffer) => idbSet("files", id, bytes);
export const loadBookFile = (id: string) => idbGet<ArrayBuffer>("files", id);
export const deleteBookFile = (id: string) => idbDel("files", id);
