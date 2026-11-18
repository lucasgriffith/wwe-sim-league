import Link from "next/link";
import { getAllMatches, getTagTeams, getWrestlers } from "@/lib/data/cached";
import { computeRecordBook, type RecordParticipant } from "@/lib/records/compute-records";
import { buildEloBoard } from "@/lib/elo/board";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { SmartImage } from "@/components/ui/smart-image";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default async function RecordsPage() {
  const [matches, wrestlers, tagTeams] = await Promise.all([
    getAllMatches(),
    getWrestlers(),
    getTagTeams(),
  ]);

  const participants = new Map<string, RecordParticipant>();
  for (const w of wrestlers) {
    participants.set(w.id, {
      name: w.name,
      href: `/roster/${w.slug ?? w.id}`,
      imageUrl: w.image_url,
      isTag: false,
    });
  }
  for (const t of tagTeams) {
    participants.set(t.id, {
      name: t.name,
      href: `/tag-teams/${t.id}`,
      imageUrl: null,
      isTag: true,
    });
  }
  const ovrMap = new Map<string, number>(
    wrestlers
      .filter((w) => w.overall_rating != null)
      .map((w) => [w.id, w.overall_rating as number])
  );

  const book = computeRecordBook(matches, ovrMap);
  const playedCount = matches.filter((m) => m.played_at).length;
  const p = (id: string): RecordParticipant =>
    participants.get(id) ?? { name: "?", href: null, imageUrl: null, isTag: false };

  // Elo leaders (min 5 matches so provisional ratings don't top the board)
  const eloRatings = buildEloBoard(matches, wrestlers, tagTeams).entries;
  const eloRows = [...eloRatings.entries()].filter(([, e]) => e.matches >= 5);
  const topElo = [...eloRows].sort((a, b) => b[1].rating - a[1].rating)[0];
  const topPeak = [...eloRows].sort((a, b) => b[1].peak - a[1].peak)[0];

  const leaderCards = [
    {
      label: "Highest Elo",
      emoji: "",
      record: topElo
        ? { participantId: topElo[0], value: `${Math.round(topElo[1].rating)}`, detail: "current rating (min 5 matches)" }
        : null,
    },
    {
      label: "Peak Elo",
      emoji: "",
      record: topPeak
        ? { participantId: topPeak[0], value: `${Math.round(topPeak[1].peak)}`, detail: "all-time high" }
        : null,
    },
    { label: "Most Wins", emoji: "", record: book.leaders.mostWins },
    { label: "Best Win %", emoji: "", record: book.leaders.bestWinPct },
    { label: "Most Matches", emoji: "", record: book.leaders.mostMatches },
    { label: "Most Titles", emoji: "", record: book.leaders.mostTitles },
    { label: "Quickest Worker", emoji: "", record: book.leaders.quickestAvg },
    { label: "Goes the Distance", emoji: "", record: book.leaders.longestAvg },
  ].filter((c) => c.record);

  const hasAnything =
    leaderCards.length > 0 ||
    book.fastestMatches.length > 0 ||
    book.winStreaks.length > 0 ||
    book.upsets.length > 0;

  return (
    <div className="container max-w-screen-2xl px-4 py-8 animate-fade-in">
      <PageHeader
        kicker="All-time · every season"
        title="Record Book"
        stats={[
          { label: "Matches", value: playedCount },
          { label: "Records", value: leaderCards.length },
        ]}
      />

      {!hasAnything ? (
        <EmptyState title="No records yet">
          Records appear once matches have been played.
        </EmptyState>
      ) : (
        <div className="space-y-10">
          {/* Career leaders */}
          {leaderCards.length > 0 && (
            <section>
              <SectionHeading emoji="" title="Career Leaders" />
              <div className="grid pl-px pt-px sm:grid-cols-2 lg:grid-cols-4">
                {leaderCards.map(({ label, record }) => {
                  const holder = p(record!.participantId);
                  return (
                    <div key={label} className="relative -ml-px -mt-px flex flex-col border border-border bg-card p-4">
                      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-gold/80">
                        {label}
                      </p>
                      <p className="mt-2 font-display text-5xl font-black leading-none tabular-nums text-foreground">
                        {record!.value}
                      </p>
                      <div className="mt-4 flex items-center gap-2.5 border-t border-border pt-3">
                        <Avatar participant={holder} size={44} />
                        <div className="min-w-0 flex-1">
                          <ParticipantLink
                            participant={holder}
                            className="block font-display text-lg font-extrabold leading-none hover:text-gold [overflow-wrap:anywhere]"
                          />
                          <p className="mt-1 font-mono text-[10px] text-muted-foreground">{record!.detail}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Match time records */}
          <div className="grid gap-6 lg:grid-cols-2">
            <RecordList
              emoji=""
              title="Fastest Matches"
              rows={book.fastestMatches.map((r) => ({
                key: `${r.winnerId}-${r.time}`,
                primary: (
                  <>
                    <ParticipantLink participant={p(r.winnerId)} className="font-semibold hover:text-gold transition-colors" />
                    <span className="text-muted-foreground/60"> def. </span>
                    <ParticipantLink participant={p(r.loserId)} className="text-muted-foreground hover:text-gold transition-colors" />
                  </>
                ),
                context: [r.tierName, r.seasonNumber ? `S${r.seasonNumber}` : null, r.stipulation]
                  .filter(Boolean)
                  .join(" · "),
                value: formatTime(r.time),
              }))}
            />
            <RecordList
              emoji=""
              title="Longest Matches"
              rows={book.longestMatches.map((r) => ({
                key: `${r.winnerId}-${r.time}`,
                primary: (
                  <>
                    <ParticipantLink participant={p(r.winnerId)} className="font-semibold hover:text-gold transition-colors" />
                    <span className="text-muted-foreground/60"> outlasted </span>
                    <ParticipantLink participant={p(r.loserId)} className="text-muted-foreground hover:text-gold transition-colors" />
                  </>
                ),
                context: [r.tierName, r.seasonNumber ? `S${r.seasonNumber}` : null, r.stipulation]
                  .filter(Boolean)
                  .join(" · "),
                value: formatTime(r.time),
              }))}
            />
          </div>

          {/* Streaks */}
          <div className="grid gap-6 lg:grid-cols-2">
            <RecordList
              emoji=""
              title="Longest Win Streaks"
              rows={book.winStreaks.map((r) => ({
                key: r.participantId,
                avatar: p(r.participantId),
                primary: (
                  <ParticipantLink participant={p(r.participantId)} className="font-semibold hover:text-gold transition-colors" />
                ),
                context: [r.seasonSpan, r.active ? "active " : null].filter(Boolean).join(" · "),
                value: `${r.length}W`,
              }))}
            />
            <RecordList
              emoji=""
              title="Longest Losing Streaks"
              rows={book.lossStreaks.map((r) => ({
                key: r.participantId,
                avatar: p(r.participantId),
                primary: (
                  <ParticipantLink participant={p(r.participantId)} className="font-semibold hover:text-gold transition-colors" />
                ),
                context: [r.seasonSpan, r.active ? "ongoing…" : null].filter(Boolean).join(" · "),
                value: `${r.length}L`,
              }))}
            />
          </div>

          {/* Rivalries + stipulations */}
          <div className="grid gap-6 lg:grid-cols-2">
            <RecordList
              emoji=""
              title="Rivalries"
              subtitle="Pairings that have met more than once"
              rows={book.rivalries.map((r) => ({
                key: `${r.aId}-${r.bId}`,
                primary: (
                  <>
                    <ParticipantLink participant={p(r.aId)} className="font-semibold hover:text-gold transition-colors" />
                    <span className="text-muted-foreground/60"> vs </span>
                    <ParticipantLink participant={p(r.bId)} className="font-semibold hover:text-gold transition-colors" />
                  </>
                ),
                context: `${r.meetings} meetings`,
                value: `${r.aWins}–${r.bWins}`,
              }))}
            />
            <RecordList
              emoji=""
              title="Stipulations"
              subtitle="Most-used match types and who owns them"
              rows={book.stipulations.map((st) => ({
                key: st.stipulation,
                primary: <span className="font-semibold">{st.stipulation}</span>,
                context: [
                  st.avgTime ? `avg ${formatTime(st.avgTime)}` : null,
                  st.specialistId ? `specialist: ${p(st.specialistId).name} (${st.specialistWins}W)` : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
                value: `${st.matches}`,
              }))}
            />
          </div>

          {/* Upsets */}
          {book.upsets.length > 0 && (
            <RecordList
              emoji=""
              title="Biggest Upsets"
              subtitle="Lowest-rated winners over highest-rated opponents"
              rows={book.upsets.map((r, i) => ({
                key: `${r.winnerId}-${i}`,
                avatar: p(r.winnerId),
                primary: (
                  <>
                    <ParticipantLink participant={p(r.winnerId)} className="font-semibold hover:text-gold transition-colors" />
                    <span className="text-muted-foreground/60"> ({r.winnerOvr} OVR) shocked </span>
                    <ParticipantLink participant={p(r.loserId)} className="text-muted-foreground hover:text-gold transition-colors" />
                    <span className="text-muted-foreground/60"> ({r.loserOvr} OVR)</span>
                  </>
                ),
                context: [r.tierName, r.seasonNumber ? `S${r.seasonNumber}` : null].filter(Boolean).join(" · "),
                value: `+${r.diff}`,
              }))}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Presentational helpers ─────────────────────────────────────────────── */

function SectionHeading({ emoji, title, subtitle }: { emoji: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="rule-title text-2xl">
        {title}
      </h2>
      {subtitle && <p className="mt-1.5 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function ParticipantLink({
  participant,
  className,
}: {
  participant: RecordParticipant;
  className?: string;
}) {
  if (!participant.href) return <span className={className}>{participant.name}</span>;
  return (
    <Link href={participant.href} className={className}>
      {participant.name}
    </Link>
  );
}

function Avatar({
  participant,
  size = 28,
}: {
  participant: RecordParticipant;
  size?: 28 | 44;
}) {
  const sizeClass = size === 44 ? "h-11 w-11" : "h-7 w-7";
  if (participant.imageUrl) {
    return (
      <SmartImage
        src={participant.imageUrl}
        alt=""
        width={size * 2}
        height={size * 2}
        className={`${sizeClass} object-cover object-top border border-border shrink-0`}
      />
    );
  }
  return (
    <span
      className={`${sizeClass} bg-muted/20 border border-border flex items-center justify-center text-xs font-bold text-muted-foreground/40 shrink-0`}
    >
      {participant.name.charAt(0)}
    </span>
  );
}

function RecordList({
  emoji,
  title,
  subtitle,
  rows,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  rows: Array<{
    key: string;
    avatar?: RecordParticipant;
    primary: React.ReactNode;
    context: string;
    value: string;
  }>;
}) {
  if (rows.length === 0) return null;
  return (
    <section>
      <SectionHeading emoji={emoji} title={title} subtitle={subtitle} />
      <div className="border border-border bg-card">
        {rows.map((row, i) => (
          <div
            key={row.key}
            className={`flex items-center gap-3 px-3 py-2.5 text-sm ${
              i > 0 ? "border-t border-border/60" : "border-l-[3px] border-l-gold bg-gold/[0.06]"
            }`}
          >
            <span
              className={`w-6 shrink-0 text-center font-display font-black tabular-nums ${
                i === 0 ? "text-2xl text-gold" : "text-lg text-muted-foreground/50"
              }`}
            >
              {i + 1}
            </span>
            {row.avatar && <Avatar participant={row.avatar} size={28} />}
            <div className="min-w-0 flex-1">
              <p className={i === 0 ? "font-display text-lg font-extrabold leading-tight" : "leading-snug"}>
                {row.primary}
              </p>
              {row.context && (
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  {row.context}
                </p>
              )}
            </div>
            <span
              className={`shrink-0 font-bold tabular-nums ${
                i === 0 ? "text-xl text-gold" : "text-muted-foreground"
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
