import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed port and no clearing of the screen during dev.
export default defineConfig({
  plugins: [react()],
  // Pre-bundle sql.js so its UMD browser build gets a proper ESM default export.
  // The wasm binary is loaded separately via a `?url` import in src/lib/db.ts.
  optimizeDeps: { include: ["sql.js"] },
  clearScreen: false,
  server: { port: 5173, strictPort: true },
});
