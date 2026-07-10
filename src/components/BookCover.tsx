import type { Book } from "../lib/types";

const GRADIENTS = [
  "linear-gradient(160deg,#2c5b5b,#123c3c)",
  "linear-gradient(180deg,#1e2530,#0c0f14)",
  "linear-gradient(160deg,#7a2f27,#4a1712)",
  "linear-gradient(160deg,#6a4a6e,#3c2740)",
  "linear-gradient(160deg,#3a4790,#20264f)",
  "linear-gradient(165deg,#3c5a34,#1e2f1a)",
  "linear-gradient(160deg,#8a7638,#4f4118)",
  "linear-gradient(180deg,#3b4653,#181d24)",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function BookCover({ book }: { book: Book }) {
  if (book.cover) return <img src={book.cover} alt={book.title} loading="lazy" />;
  const bg = GRADIENTS[hash(book.title) % GRADIENTS.length];
  return (
    <div className="cover" style={{ background: bg }}>
      <div className="c-top">{book.format.toUpperCase()}</div>
      <div>
        <div className="rule-c" />
        <div className="c-mid">{book.title}</div>
        <div className="c-auth">{book.author}</div>
      </div>
    </div>
  );
}
