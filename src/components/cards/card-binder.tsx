"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { RARITY_LABEL, TradingCard, type Rarity, type TradingCardData } from "./trading-card";

const RARITY_ORDER: Rarity[] = ["champion", "main-event", "ranked", "roster"];

export function CardBinder({ cards }: { cards: TradingCardData[] }) {
  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [sort, setSort] = useState<"rarity" | "number" | "elo">("rarity");

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = cards.filter(
      (c) => (rarity === "all" || c.rarity === rarity) && (!q || c.name.toLowerCase().includes(q))
    );
    if (sort === "number") return list;
    if (sort === "elo") return [...list].sort((a, b) => (b.elo ?? 0) - (a.elo ?? 0));
    return [...list].sort(
      (a, b) =>
        RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) ||
        (b.elo ?? 0) - (a.elo ?? 0) ||
        a.number - b.number
    );
  }, [cards, search, rarity, sort]);

  const pill = (active: boolean) =>
    `h-8 px-3 font-mono text-[10px] uppercase tracking-[0.16em] border -ml-px first:ml-0 transition-colors ${
      active
        ? "border-gold bg-gold text-black font-bold"
        : "border-border text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Input
          placeholder="Search the set"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-background/50 lg:w-72"
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex">
            <button type="button" className={pill(rarity === "all")} onClick={() => setRarity("all")}>
              All
            </button>
            {RARITY_ORDER.map((r) => (
              <button key={r} type="button" className={pill(rarity === r)} onClick={() => setRarity(r)}>
                {RARITY_LABEL[r]}
              </button>
            ))}
          </div>
          <div className="flex items-center">
            <span className="mr-2 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70">Sort</span>
            {(["rarity", "elo", "number"] as const).map((k) => (
              <button key={k} type="button" className={pill(sort === k)} onClick={() => setSort(k)}>
                {k === "number" ? "Card #" : k}
              </button>
            ))}
          </div>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="halftone border border-dashed border-border bg-card/40 px-6 py-16 text-center">
          <h3 className="text-2xl">No cards match</h3>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {shown.map((c) => (
            <TradingCard key={c.id} card={c} />
          ))}
        </div>
      )}
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60">
        Showing {shown.length} of {cards.length}
      </p>
    </div>
  );
}
