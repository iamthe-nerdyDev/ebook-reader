/// <reference types="vite/client" />

// Vite ?url imports
declare module "*?url" {
  const src: string;
  export default src;
}

// File System Access API (Chromium) — minimal typings we use
interface Window {
  showOpenFilePicker?: (opts?: any) => Promise<FileSystemFileHandle[]>;
  showDirectoryPicker?: (opts?: any) => Promise<FileSystemDirectoryHandle>;
}
