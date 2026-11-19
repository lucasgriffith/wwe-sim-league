/* eslint-disable @next/next/no-img-element */

interface BracketParticipant {
  id: string;
  name: string;
  seed: number;
  image?: string | null;
}

interface BracketMatchData {
  id: string | null;
  matchKey: string;
  round: string;
  participantA: BracketParticipant | null;
  participantB: BracketParticipant | null;
  winnerId: string | null;
  stipulation: string | null;
  matchTime: number | null;
  isPlayed: boolean;
  isBye: boolean;
}

interface Props {
  matches: BracketMatchData[];
  tierName: string;
  isTagFinal?: boolean;
}

const ROUND_LABEL: Record<string, string> = {
  QF1: "Quarterfinal 1",
  QF2: "Quarterfinal 2",
  SF1: "Semifinal 1",
  SF2: "Semifinal 2",
  Final: "Championship Final",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Single-elimination bracket, read left to right. The top seeds sit in the
 * semifinals with a bye; each empty slot names the match that fills it.
 * Below the md breakpoint the rounds stack instead of scrolling sideways.
 */
export function BracketView({ matches, isTagFinal }: Props) {
  const byKey = new Map(matches.map((m) => [m.matchKey, m]));
  const final = byKey.get("Final") ?? matches.find((m) => m.round === "final");
  if (!final) return null;

  if (isTagFinal) {
    return (
      <div className="mx-auto max-w-sm">
        <MatchNode match={final} isFinal />
      </div>
    );
  }

  const qf1 = byKey.get("QF1");
  const qf2 = byKey.get("QF2");
  const sf1 = byKey.get("SF1");
  const sf2 = byKey.get("SF2");

  // Six qualifiers: QF2 feeds SF1 and QF1 feeds SF2. Five: QF1 feeds SF1.
  const feedSf1 = qf2 ?? (qf1 && !qf2 ? qf1 : undefined);
  const feedSf2 = qf2 ? qf1 : undefined;
  const hasQf = !!(qf1 || qf2);
  const waiting = {
    sf1: feedSf1 ? `Winner ${feedSf1.matchKey}` : "To be decided",
    sf2: feedSf2 ? `Winner ${feedSf2.matchKey}` : "To be decided",
  };

  const rows = [
    { sf: sf1, feeder: feedSf1, wait: waiting.sf1 },
    { sf: sf2, feeder: feedSf2, wait: waiting.sf2 },
  ];

  return (
    <>
      {/* Tree, md and up */}
      <div className="hidden md:flex">
        <div className="flex min-w-0 flex-[2] flex-col">
          <div className="flex gap-6 pb-2">
            {hasQf && <ColumnLabel>Quarterfinals</ColumnLabel>}
            <ColumnLabel>Semifinals</ColumnLabel>
          </div>
          {rows.map((row, i) => (
            <div key={i} className="flex flex-1 items-center py-2">
              {hasQf && (
                <>
                  <div className="min-w-0 flex-1">
                    {row.feeder && <MatchNode match={row.feeder} />}
                  </div>
                  <div className={`h-px w-6 shrink-0 ${row.feeder ? "bg-gold/50" : ""}`} />
                </>
              )}
              <div className="min-w-0 flex-1">
                {row.sf && <MatchNode match={row.sf} waitB={row.wait} bye={!!row.feeder} />}
              </div>
            </div>
          ))}
        </div>

        {/* Semifinals join into the final */}
        <div className="flex w-10 shrink-0 flex-col pt-[26px]">
          <div className="relative flex-1">
            <div className="absolute inset-y-1/4 left-0 w-1/2 border-y border-r border-gold/50" />
            <div className="absolute left-1/2 top-1/2 h-px w-1/2 bg-gold/50" />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="pb-2">
            <ColumnLabel gold>Final</ColumnLabel>
          </div>
          <div className="flex flex-1 items-center">
            <div className="min-w-0 flex-1">
              <MatchNode match={final} isFinal waitA="Winner SF1" waitB="Winner SF2" />
            </div>
          </div>
        </div>
      </div>

      {/* Stacked rounds, phones */}
      <div className="space-y-4 md:hidden">
        {hasQf && (
          <div className="space-y-2">
            <ColumnLabel>Quarterfinals</ColumnLabel>
            {qf1 && <MatchNode match={qf1} />}
            {qf2 && <MatchNode match={qf2} />}
          </div>
        )}
        <div className="space-y-2">
          <ColumnLabel>Semifinals</ColumnLabel>
          {sf1 && <MatchNode match={sf1} waitB={waiting.sf1} bye={!!feedSf1} />}
          {sf2 && <MatchNode match={sf2} waitB={waiting.sf2} bye={!!feedSf2} />}
        </div>
        <div className="space-y-2">
          <ColumnLabel gold>Final</ColumnLabel>
          <MatchNode match={final} isFinal waitA="Winner SF1" waitB="Winner SF2" />
        </div>
      </div>
    </>
  );
}

function ColumnLabel({ children, gold }: { children: React.ReactNode; gold?: boolean }) {
  return (
    <div
      className={`min-w-0 flex-1 font-mono text-[10px] uppercase tracking-[0.2em] ${
        gold ? "text-gold" : "text-muted-foreground"
      }`}
    >
      {children}
    </div>
  );
}

function MatchNode({
  match,
  isFinal,
  waitA = "To be decided",
  waitB = "To be decided",
  bye,
}: {
  match: BracketMatchData;
  isFinal?: boolean;
  waitA?: string;
  waitB?: string;
  /** The seeded side skipped the quarterfinals */
  bye?: boolean;
}) {
  const decided = match.isPlayed && !!match.winnerId;
  return (
    <div
      className={`border bg-background ${
        isFinal ? "border-gold/70 shadow-[0_0_0_1px_rgba(212,175,55,0.12)]" : "border-border"
      }`}
    >
      <div
        className={`flex items-center justify-between gap-2 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] ${
          isFinal ? "bg-gold text-black" : "border-b border-border text-muted-foreground"
        }`}
      >
        <span className="truncate font-bold">
          {isFinal ? "Championship" : (ROUND_LABEL[match.matchKey] ?? match.matchKey)}
        </span>
        <span className="shrink-0 truncate">
          {match.stipulation ?? ""}
        </span>
      </div>

      <ParticipantRow
        participant={match.participantA}
        wait={waitA}
        won={decided && match.winnerId === match.participantA?.id}
        lost={decided && match.winnerId !== match.participantA?.id}
        time={match.matchTime}
        bye={bye && !decided}
        isFinal={isFinal}
      />
      <div className="h-px bg-border" />
      <ParticipantRow
        participant={match.participantB}
        wait={waitB}
        won={decided && match.winnerId === match.participantB?.id}
        lost={decided && match.winnerId !== match.participantB?.id}
        time={match.matchTime}
        isFinal={isFinal}
      />
    </div>
  );
}

function ParticipantRow({
  participant,
  wait,
  won,
  lost,
  time,
  bye,
  isFinal,
}: {
  participant: BracketParticipant | null;
  wait: string;
  won: boolean;
  lost: boolean;
  time: number | null;
  bye?: boolean;
  isFinal?: boolean;
}) {
  if (!participant) {
    return (
      <div className="flex h-9 items-center gap-2 px-2">
        <span className="w-5 shrink-0" />
        <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
          {wait}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative flex h-9 items-center gap-2 px-2 ${
        won ? (isFinal ? "bg-gold/15" : "bg-foreground/[0.06]") : ""
      }`}
    >
      {won && <span className="absolute inset-y-0 left-0 w-[3px] bg-gold" />}
      <span
        className={`w-5 shrink-0 text-center font-display text-base font-black leading-none ${
          lost ? "text-muted-foreground/40" : "text-gold"
        }`}
      >
        {participant.seed > 0 ? participant.seed : ""}
      </span>
      {participant.image && (
        <img
          src={participant.image}
          alt=""
          loading="lazy"
          className={`h-6 w-6 shrink-0 bg-muted object-cover object-top ${lost ? "opacity-40 grayscale" : ""}`}
        />
      )}
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          won ? "font-bold text-foreground" : lost ? "text-muted-foreground/50" : "font-medium"
        }`}
      >
        {participant.name}
      </span>
      {won && time ? (
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{formatTime(time)}</span>
      ) : won && isFinal ? null : bye ? (
        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground/70">
          Bye
        </span>
      ) : null}
      {won && isFinal && (
        <span className="shrink-0 bg-gold px-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-black">
          Champion
        </span>
      )}
    </div>
  );
}
