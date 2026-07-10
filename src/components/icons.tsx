import type { SVGProps } from "react";

const S = (p: SVGProps<SVGSVGElement>) => ({
  viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, ...p,
});

export const Logo = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" fill="none" {...p}>
    <path d="M16 10 L28 14 v11 l-12 -3 -12 3 V14 Z" fill="var(--surface)" stroke="var(--brass)" strokeWidth={1.8} strokeLinejoin="round" />
    <path d="M16 10 V22" stroke="var(--brass)" strokeWidth={1.8} />
    <path d="M5 12.5 L16 5 L27 12.5" fill="none" stroke="var(--brass-hi)" strokeWidth={1.9} strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);

export const ILibrary = (p: SVGProps<SVGSVGElement>) => (<svg {...S(p)}><path d="M4 5h6v14H4zM14 5h6v14h-6z" /></svg>);
export const IStats = (p: SVGProps<SVGSVGElement>) => (<svg {...S(p)}><path d="M5 19V10M12 19V5M19 19v-6" /></svg>);
export const IHighlight = (p: SVGProps<SVGSVGElement>) => (<svg {...S(p)}><path d="M15 4 20 9 9 20l-5 1 1-5Z" /><path d="m13 6 5 5" /></svg>);
export const IBookmark = (p: SVGProps<SVGSVGElement>) => (<svg {...S(p)}><path d="M6 4h12v16l-6-4-6 4z" /></svg>);
export const IReader = (p: SVGProps<SVGSVGElement>) => (<svg {...S(p)}><path d="M12 6c-2-1.4-5-1.4-7-.7v12c2-.7 5-.7 7 .7 2-1.4 5-1.4 7-.7v-12c-2-.7-5-.7-7 .7Z" /><path d="M12 6v13" /></svg>);
export const IImport = (p: SVGProps<SVGSVGElement>) => (<svg {...S({ strokeWidth: 1.9, ...p })}><path d="M12 5v10m0 0 4-4m-4 4-4-4M5 19h14" /></svg>);
export const ISearch = (p: SVGProps<SVGSVGElement>) => (<svg {...S({ strokeWidth: 1.9, ...p })}><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>);
export const IMenu = (p: SVGProps<SVGSVGElement>) => (<svg {...S({ strokeWidth: 1.9, ...p })}><path d="M4 6h16M4 12h16M4 18h16" /></svg>);
export const IChevL = (p: SVGProps<SVGSVGElement>) => (<svg {...S({ strokeWidth: 2, ...p })}><path d="M15 6l-6 6 6 6" /></svg>);
export const IChevR = (p: SVGProps<SVGSVGElement>) => (<svg {...S({ strokeWidth: 2, ...p })}><path d="M9 6l6 6-6 6" /></svg>);
export const IClose = (p: SVGProps<SVGSVGElement>) => (<svg {...S({ strokeWidth: 1.9, ...p })}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const ICheck = (p: SVGProps<SVGSVGElement>) => (<svg {...S({ strokeWidth: 2.6, ...p })}><path d="m5 12 4 4 10-10" /></svg>);
export const IPlay = (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M8 5v14l11-7z" /></svg>);
export const IScroll = (p: SVGProps<SVGSVGElement>) => (<svg {...S({ strokeWidth: 1.8, ...p })}><path d="M5 4h14M5 12h14M5 20h14" /></svg>);
export const IPaged = (p: SVGProps<SVGSVGElement>) => (<svg {...S({ strokeWidth: 1.8, ...p })}><path d="M4 5h7v14H4zM13 5h7v14h-7z" /></svg>);
export const IFile = (p: SVGProps<SVGSVGElement>) => (<svg {...S(p)}><path d="M13 3H6v18h12V8z" /><path d="M13 3v5h5" /></svg>);
export const IFolder = (p: SVGProps<SVGSVGElement>) => (<svg {...S(p)}><path d="M3 7h6l2 2h10v10H3z" /></svg>);
export const IInfo = (p: SVGProps<SVGSVGElement>) => (<svg {...S(p)}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>);
export const ITrash = (p: SVGProps<SVGSVGElement>) => (<svg {...S(p)}><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></svg>);
export const IShare = (p: SVGProps<SVGSVGElement>) => (<svg {...S({ strokeWidth: 1.8, ...p })}><path d="M4 12v7h16v-7M12 3v12m0 0 4-4m-4 4-4-4" /></svg>);
export const IRefresh = (p: SVGProps<SVGSVGElement>) => (<svg {...S({ strokeWidth: 1.8, ...p })}><path d="M20 11a8 8 0 0 0-14-4.9L4 8m0-4v4h4" /><path d="M4 13a8 8 0 0 0 14 4.9L20 16m0 4v-4h-4" /></svg>);
export const IGear = (p: SVGProps<SVGSVGElement>) => (<svg {...S(p)}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 1h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 23h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6A7 7 0 0 0 19 12Z" /></svg>);

export const Sun = (p: SVGProps<SVGSVGElement>) => (<svg {...S({ strokeWidth: 1.8, ...p })}><path d="M12 4V2M12 22v-2M4 12H2M22 12h-2M6 6 4.5 4.5M19.5 19.5 18 18M18 6l1.5-1.5M4.5 19.5 6 18" /><circle cx="12" cy="12" r="4" /></svg>);
export const Moon = (p: SVGProps<SVGSVGElement>) => (<svg {...S({ strokeWidth: 1.8, ...p })}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>);
