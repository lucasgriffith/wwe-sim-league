import Link from "next/link";
import type { TierColor } from "@/lib/tiers/colors";

export type Rarity = "champion" | "main-event" | "ranked" | "roster";

export const RARITY_LABEL: Record<Rarity, string> = {
  champion: "Champion",
  "main-event": "Main Event",
  ranked: "Ranked",
  roster: "Roster",
};

export interface TradingCardData {
  id: string;
  href: string;
  /** Position in the set, alphabetical */
  number: number;
  setSize: number;
  name: string;
  imageUrl: string | null;
  ovr: number | null;
  elo: number | null;
  rank: number | null;
  poolLabel: string;
  wins: number;
  losses: number;
  titles: number;
  tierNumber: number | null;
  tierName: string | null;
  color: TierColor;
  rarity: Rarity;
  seasonNumber: number | null;
}

const FRAME: Record<Rarity, string> = {
  champion: "card-foil card-foil-holo",
  "main-event": "card-foil card-foil-gold",
  ranked: "card-foil-silver",
  roster: "bg-[#2a2a32]",
};

/**
 * A wrestler's trading card. Frame and foil come from rarity (champions are
 * holographic, the top 5 by Elo gold, the rest of the top 25 silver); the
 * name plate takes the colour of the championship tier they compete in.
 */
export function TradingCard({ card, link = true }: { card: TradingCardData; link?: boolean }) {
  const played = card.wins + card.losses;
  const body = (
    <div className={`trading-card group relative aspect-[5/7] w-full p-[5px] ${FRAME[card.rarity]}`}>
      <div className="relative flex h-full flex-col overflow-hidden bg-[#0a0a0c]">
        {/* Set line */}
        <div className="flex items-center justify-between px-2 pt-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>
            #{String(card.number).padStart(3, "0")}
            <span className="text-muted-foreground/50"> / {card.setSize}</span>
          </span>
          <span className={card.rarity === "roster" ? "" : "font-bold text-gold"}>
            {RARITY_LABEL[card.rarity]}
          </span>
        </div>

        {/* Portrait */}
        <div className="halftone relative mx-2 mt-1.5 min-h-0 flex-1 overflow-hidden bg-[#131318]">
          {card.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={card.imageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.05]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-display text-8xl font-black text-muted-foreground/15">
              {card.name.charAt(0)}
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-[#0a0a0c] to-transparent" />
          {card.rank != null && (
            <div className="absolute left-0 top-0 bg-[#0a0a0c]/90 px-1.5 pb-1 pt-0.5 text-center">
              <div className="font-display text-3xl font-black leading-none text-gold tabular-nums">
                {card.rank}
              </div>
              <div className="font-mono text-[7px] uppercase tracking-[0.14em] text-muted-foreground">
                {card.poolLabel}
              </div>
            </div>
          )}
          {card.ovr != null && (
            <div className="absolute right-0 top-0 bg-[#0a0a0c]/90 px-1.5 py-1 font-mono text-[10px] font-bold leading-none">
              {card.ovr}
              <span className="ml-0.5 text-[7px] text-muted-foreground">OVR</span>
            </div>
          )}
          {card.titles > 0 && (
            <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 bg-gold px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider text-black">
              <span className="inline-block h-1.5 w-1.5 rotate-45 bg-black" />
              {card.titles}× champ
            </div>
          )}
        </div>

        {/* Name plate */}
        <div
          className="cut-plate relative -mt-3 ml-2 mr-6 px-2 pb-1.5 pt-1.5"
          style={{ background: card.color.bg, color: card.color.fg }}
        >
          <div className="font-display text-xl font-black leading-[0.95] [overflow-wrap:anywhere] pr-6">
            {card.name}
          </div>
        </div>

        {/* Stat line */}
        <dl className="mx-2 mt-2 grid grid-cols-3 border border-[#2a2a32] text-center">
          <div className="py-1">
            <dt className="font-mono text-[7px] uppercase tracking-[0.16em] text-muted-foreground">Elo</dt>
            <dd className="font-mono text-sm font-bold leading-tight text-gold">{card.elo ?? "–"}</dd>
          </div>
          <div className="border-x border-[#2a2a32] py-1">
            <dt className="font-mono text-[7px] uppercase tracking-[0.16em] text-muted-foreground">Record</dt>
            <dd className="font-mono text-sm font-bold leading-tight">
              {played > 0 ? `${card.wins}-${card.losses}` : "–"}
            </dd>
          </div>
          <div className="py-1">
            <dt className="font-mono text-[7px] uppercase tracking-[0.16em] text-muted-foreground">Win %</dt>
            <dd className="font-mono text-sm font-bold leading-tight">
              {played > 0 ? Math.round((card.wins / played) * 100) : "–"}
            </dd>
          </div>
        </dl>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-2 pb-1.5 pt-1.5 font-mono text-[7px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="truncate">
            {card.tierName ? `T${card.tierNumber} · ${card.tierName}` : "Unassigned"}
          </span>
          <span className="shrink-0">
            2K26 Sim League{card.seasonNumber ? ` · S${card.seasonNumber}` : ""}
          </span>
        </div>
      </div>
    </div>
  );

  if (!link) return body;
  return (
    <Link href={card.href} className="block focus-visible:outline-2 focus-visible:outline-gold" aria-label={`${card.name} card`}>
      {body}
    </Link>
  );
}
