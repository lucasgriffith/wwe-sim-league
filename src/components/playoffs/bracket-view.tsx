"use client";

import { Badge } from "@/components/ui/badge";

interface BracketParticipant {
  id: string;
  name: string;
  seed: number;
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

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function BracketView({ matches, tierName, isTagFinal }: Props) {
  if (isTagFinal) {
    const final = matches.find((m) => m.round === "final");
    if (!final) return null;
    return (
      <div className="flex justify-center">
        <MatchNode match={final} isFinal />
      </div>
    );
  }

  const qf1 = matches.find((m) => m.matchKey === "QF1");
  const qf2 = matches.find((m) => m.matchKey === "QF2");
  const sf1 = matches.find((m) => m.matchKey === "SF1");
  const sf2 = matches.find((m) => m.matchKey === "SF2");
  const final = matches.find((m) => m.matchKey === "Final");

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px] py-4">
        {/* Column headers */}
        <div className="grid grid-cols-4 gap-4 mb-4 px-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 text-center">
            Quarterfinals
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 text-center">
            Semifinals
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 text-center">
            {/* spacer for alignment */}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gold/50 text-center">
            Championship Final
          </div>
        </div>

        {/* Bracket grid */}
        <div className="relative grid grid-cols-4 gap-4 items-center">
          {/* Column 1: Quarterfinals */}
          <div className="flex flex-col gap-16">
            {qf1 && <MatchNode match={qf1} />}
            {qf2 && <MatchNode match={qf2} />}
          </div>

          {/* Column 2: Semifinals */}
          <div className="flex flex-col gap-16">
            {sf2 && <MatchNode match={sf2} />}
            {sf1 && <MatchNode match={sf1} />}
          </div>

          {/* Column 3: spacer with connector feel */}
          <div className="flex items-center justify-center">
            <div className="w-px h-16 bg-border/20" />
          </div>

          {/* Column 4: Final */}
          <div className="flex items-center justify-center">
            {final && <MatchNode match={final} isFinal />}
          </div>

          {/* SVG connector lines */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
          >
            {/* QF1 → SF2 */}
            <line
              x1="25%" y1="25%" x2="37.5%" y2="25%"
              stroke="currentColor" strokeOpacity="0.1" strokeWidth="1"
            />
            <line
              x1="37.5%" y1="25%" x2="37.5%" y2="30%"
              stroke="currentColor" strokeOpacity="0.1" strokeWidth="1"
            />
            {/* QF2 → SF1 */}
            <line
              x1="25%" y1="75%" x2="37.5%" y2="75%"
              stroke="currentColor" strokeOpacity="0.1" strokeWidth="1"
            />
            <line
              x1="37.5%" y1="75%" x2="37.5%" y2="70%"
              stroke="currentColor" strokeOpacity="0.1" strokeWidth="1"
            />
            {/* SF → Final */}
            <line
              x1="50%" y1="30%" x2="62.5%" y2="50%"
              stroke="currentColor" strokeOpacity="0.1" strokeWidth="1"
            />
            <line
              x1="50%" y1="70%" x2="62.5%" y2="50%"
              stroke="currentColor" strokeOpacity="0.1" strokeWidth="1"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

function MatchNode({
  match,
  isFinal,
}: {
  match: BracketMatchData;
  isFinal?: boolean;
}) {
  const borderColor = isFinal
    ? match.isPlayed
      ? "border-gold/40 bg-gold/5"
      : "border-gold/20 bg-gold/[0.02]"
    : match.isPlayed
      ? "border-emerald-500/30 bg-emerald-500/[0.03]"
      : "border-border/30";

  return (
    <div
      className={`rounded-lg border-2 ${borderColor} overflow-hidden transition-colors w-full ${
        isFinal ? "max-w-[200px] mx-auto" : ""
      }`}
    >
      {/* Stipulation */}
      {match.stipulation && (
        <div className="px-2 py-1 bg-wwe-red/10 border-b border-wwe-red/10">
          <span className="text-[9px] font-medium text-wwe-red/80">
            {match.stipulation}
          </span>
        </div>
      )}

      {/* Participant A */}
      <ParticipantRow
        participant={match.participantA}
        isWinner={match.winnerId === match.participantA?.id}
        isPlayed={match.isPlayed}
        isFinal={isFinal}
      />

      <div className="h-px bg-border/20" />

      {/* Participant B */}
      <ParticipantRow
        participant={match.participantB}
        isWinner={match.winnerId === match.participantB?.id}
        isPlayed={match.isPlayed}
        isFinal={isFinal}
      />

      {/* Match time */}
      {match.isPlayed && match.matchTime && (
        <div className="px-2 py-0.5 bg-muted/10 border-t border-border/10 text-center">
          <span className="text-[9px] tabular-nums text-muted-foreground/50">
            {formatTime(match.matchTime)}
          </span>
        </div>
      )}

      {/* Round label */}
      <div className="px-2 py-0.5 bg-muted/5 border-t border-border/10 text-center">
        <span className={`text-[8px] uppercase tracking-wider font-semibold ${isFinal ? "text-gold/40" : "text-muted-foreground/30"}`}>
          {match.matchKey}
        </span>
      </div>
    </div>
  );
}

function ParticipantRow({
  participant,
  isWinner,
  isPlayed,
  isFinal,
}: {
  participant: BracketParticipant | null;
  isWinner: boolean;
  isPlayed: boolean;
  isFinal?: boolean;
}) {
  if (!participant) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <span className="text-[10px] font-mono text-muted-foreground/30 w-4">—</span>
        <span className="text-xs text-muted-foreground/30 italic">TBD</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1.5 transition-colors ${
        isPlayed && isWinner
          ? isFinal
            ? "bg-gold/10"
            : "bg-emerald-500/5"
          : ""
      }`}
    >
      <span className="text-[10px] font-mono text-muted-foreground/40 w-4">
        {participant.seed}
      </span>
      <span
        className={`text-xs truncate flex-1 ${
          isPlayed
            ? isWinner
              ? isFinal
                ? "font-bold text-gold"
                : "font-bold text-emerald-400"
              : "text-muted-foreground/40 line-through"
            : "font-medium"
        }`}
      >
        {participant.name}
      </span>
      {isPlayed && isWinner && isFinal && (
        <span className="text-xs">🏆</span>
      )}
    </div>
  );
}
