import { createRoot } from "react-dom/client";
import { App } from "./components/App";
import "./styles/app.css";

// NB: no StrictMode — the reader mounts imperative engines (epub.js / pdf.js)
// and double-invoked effects in dev cause flaky double-initialisation.
createRoot(document.getElementById("root")!).render(<App />);
