import Image from "next/image";
import type { BracketRound, BracketMatch } from "@/lib/tournament";

// Seeded (top) teams — highlighted in the bracket.
const SEEDS = new Set([
  "Brazil",
  "Pháp",
  "Hà Lan",
  "Anh",
  "Đức",
  "Argentina",
  "Tây Ban Nha",
]);

// A two-sided knockout bracket (Round of 32 → Final), converging on the trophy
// in the centre — styled in the app's dark/gold luxe look. Scrolls horizontally.
export default function Bracket({ rounds }: { rounds: BracketRound[] }) {
  const byName = (n: string) => rounds.find((r) => r.name === n)?.matches ?? [];
  const r32 = byName("Vòng 1/16");
  const r16 = byName("Vòng 1/8");
  const qf = byName("Tứ kết");
  const sf = byName("Bán kết");
  const finalM = byName("Chung kết")[0];

  if (r32.length === 0) return null;

  const half = (a: BracketMatch[], side: "l" | "r") => {
    const mid = Math.ceil(a.length / 2);
    return side === "l" ? a.slice(0, mid) : a.slice(mid);
  };

  // Left side: outer → centre. Right side: centre → outer (so R32 ends outermost).
  const leftCols = [r32, r16, qf, sf].map((r) => half(r, "l"));
  const rightCols = [sf, qf, r16, r32].map((r) => half(r, "r"));

  const Col = ({ col }: { col: BracketMatch[] }) => (
    <div className="b-col">
      {col.map((m, i) => (
        <div key={i} className="b-cell">
          <Box m={m} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="bracket-wrap">
      <div className="bracket">
        <div className="b-side b-side-l">
          {leftCols.map((col, i) => (
            <Col key={i} col={col} />
          ))}
        </div>

        <div className="b-center">
          <p className="title-lux text-center text-lg tracking-widest">FINAL</p>
          <Image
            src="/trophy.webp"
            alt="Cúp"
            width={63}
            height={141}
            className="mx-auto my-2 h-24 w-auto object-contain drop-shadow-[0_2px_14px_rgba(233,201,124,0.5)]"
          />
          {finalM && (
            <div className="w-40">
              <Box m={finalM} />
            </div>
          )}
        </div>

        <div className="b-side b-side-r">
          {rightCols.map((col, i) => (
            <Col key={i} col={col} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Box({ m }: { m: BracketMatch }) {
  const winH = m.played && (m.hs ?? 0) > (m.as ?? 0);
  const winA = m.played && (m.as ?? 0) > (m.hs ?? 0);
  const Row = ({
    name,
    score,
    win,
  }: {
    name: string;
    score: number | null;
    win: boolean;
  }) => {
    const seed = SEEDS.has(name);
    return (
      <div
        className={`b-team ${
          win ? "font-bold text-grass" : seed ? "font-semibold text-gold" : ""
        }`}
      >
        <span className="truncate">
          {seed && "⭐ "}
          {name}
        </span>
        {score != null && <span className="font-mono text-white/70">{score}</span>}
      </div>
    );
  };
  return (
    <div className="b-box">
      <Row name={m.home} score={m.played ? m.hs : null} win={winH} />
      <Row name={m.away} score={m.played ? m.as : null} win={winA} />
    </div>
  );
}
