import { useState } from "react";
import { useApp } from "../store";
import { isTauri } from "../lib/platform";
import { IClose, IFile, IFolder, IInfo } from "./icons";

export function ImportModal({ onClose }: { onClose: () => void }) {
  const s = useApp.getState();
  const [mode, setMode] = useState<"files" | "folder">("files");

  const go = async () => {
    onClose();
    if (mode === "files") await s.importFiles();
    else await s.importFolder();
  };

  const folderSupported = isTauri || typeof window.showDirectoryPicker === "function";

  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-h">
          <h3>Add books</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><IClose /></button>
        </div>
        <div className="modal-b">
          <div className={"imp-opt" + (mode === "files" ? " sel" : "")} onClick={() => setMode("files")}>
            <div className="ico"><IFile /></div>
            <div>
              <h5>Add files</h5>
              <p>Pick individual .epub or .pdf files from your computer.</p>
            </div>
          </div>

          <div className={"imp-opt" + (mode === "folder" ? " sel" : "")} onClick={() => setMode("folder")}>
            <div className="ico"><IFolder /></div>
            <div style={{ flex: 1 }}>
              <h5>Scan a folder</h5>
              <p>Point Book Nook at a folder — every e-book inside is added automatically.</p>
              {mode === "folder" && (
                <div className="uncat-note">
                  <IInfo style={{ width: 16, height: 16, flex: "none", color: "var(--brass)" }} />
                  <span>
                    Found books land in <b>Uncategorized</b> with their title, author and cover read automatically.
                    Sort them into categories anytime — a book keeps its stats when moved.
                    {!folderSupported && <><br /><b style={{ color: "var(--oxblood)" }}>Folder scanning needs the desktop app or a Chromium browser.</b></>}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={go} disabled={mode === "folder" && !folderSupported}>
            {mode === "files" ? "Choose files" : "Choose folder"}
          </button>
        </div>
      </div>
    </div>
  );
}
