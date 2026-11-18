import type { StandingZone } from "@/lib/standings/zones";

/**
 * One visual language for where a row stands, shared by the standings page
 * and tier pages:
 *   gold  = in the title hunt (pool top 2 or wild card)
 *   green = on course for promotion
 *   amber = Steel Cage playoff
 *   red   = drop zone
 * Rows themselves stay neutral; a labelled cut line marks each boundary.
 */

type Band = "contender" | "safe" | "cage" | "drop";

export type Promotion = "auto" | "cage" | null;

export function zoneBand(zone: StandingZone): Band {
  if (zone === "playoff" || zone === "wildcard") return "contender";
  if (zone === "relplayoff") return "cage";
  if (zone === "autorel") return "drop";
  return "safe";
}

export const ZONE_RANK_COLOR: Record<Band, string> = {
  contender: "text-gold",
  safe: "text-muted-foreground/60",
  cage: "text-amber-500",
  drop: "text-red-400",
};

export const ZONE_STRIPE: Record<Band, string> = {
  contender: "border-l-[3px] border-l-gold",
  safe: "border-l-[3px] border-l-transparent",
  cage: "border-l-[3px] border-l-amber-500",
  drop: "border-l-[3px] border-l-red-500",
};

const LINE: Record<Exclude<Band, "contender">, { label: string; text: string; rule: string }> = {
  safe: { label: "Playoff line", text: "text-gold", rule: "bg-gold/70" },
  cage: { label: "Steel cage playoff", text: "text-amber-500", rule: "bg-amber-500/70" },
  drop: { label: "Drop zone", text: "text-red-400", rule: "bg-red-500/70" },
};

/** The cut line to draw above a row, if its band differs from the row before */
export function CutLine({
  prev,
  zone,
  colSpan,
}: {
  prev: StandingZone | null;
  zone: StandingZone;
  colSpan: number;
}) {
  if (!prev) return null;
  const band = zoneBand(zone);
  if (band === zoneBand(prev) || band === "contender") return null;
  const line = LINE[band];
  return (
    <tr aria-hidden>
      <td colSpan={colSpan} className="p-0">
        <div className="flex items-center gap-2 pl-1 sm:pl-3">
          <span className={`shrink-0 font-mono text-[9px] font-bold uppercase leading-none tracking-[0.2em] ${line.text}`}>
            {line.label}
          </span>
          <span className={`h-0.5 flex-1 ${line.rule}`} />
        </div>
      </td>
    </tr>
  );
}

const TAG = "px-1 py-px font-mono text-[9px] font-bold uppercase leading-none tracking-wider";

export function ZoneTags({
  zone,
  clinched = false,
  promotion = null,
}: {
  zone: StandingZone;
  clinched?: boolean;
  promotion?: Promotion;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {clinched && (
        <span className={`${TAG} bg-gold text-black`} title="Clinched a playoff spot">x</span>
      )}
      {zone === "wildcard" && (
        <span className={`${TAG} border border-gold/60 text-gold`} title="Holding a wild card spot">w</span>
      )}
      {promotion === "auto" && (
        <span className={`${TAG} bg-emerald-500 text-black`} title="On course for automatic promotion">↑</span>
      )}
      {promotion === "cage" && (
        <span className={`${TAG} border border-emerald-500/60 text-emerald-400`} title="On course to challenge for promotion in a Steel Cage match">↑ cage</span>
      )}
      {zone === "relplayoff" && (
        <span className={`${TAG} border border-amber-500/60 text-amber-500`} title="Would defend their spot in a Steel Cage match">cage</span>
      )}
      {zone === "autorel" && (
        <span className={`${TAG} bg-red-500 text-white`} title="In the drop zone">↓</span>
      )}
    </span>
  );
}

export function ZoneLegend() {
  const item = "flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground";
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-y border-border px-1 py-2">
      <span className={item}><span className="h-3 w-[3px] bg-gold" /> Title hunt</span>
      <span className={item}><span className={`${TAG} bg-gold text-black`}>x</span> Clinched</span>
      <span className={item}><span className={`${TAG} border border-gold/60 text-gold`}>w</span> Wild card</span>
      <span className={item}><span className={`${TAG} bg-emerald-500 text-black`}>↑</span> Promotion</span>
      <span className={item}><span className={`${TAG} border border-amber-500/60 text-amber-500`}>cage</span> Steel Cage playoff</span>
      <span className={item}><span className={`${TAG} bg-red-500 text-white`}>↓</span> Drop zone</span>
    </div>
  );
}
