import type { ReactNode } from "react";

export interface HeaderStat {
  label: string;
  value: ReactNode;
}

/**
 * Broadcast masthead used at the top of every page: a mono kicker, a heavy
 * condensed title on a gold rule, and an optional strip of headline numbers.
 */
export function PageHeader({
  kicker,
  title,
  description,
  stats,
  actions,
  admin = false,
}: {
  kicker?: string;
  title: string;
  description?: ReactNode;
  stats?: HeaderStat[];
  actions?: ReactNode;
  admin?: boolean;
}) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b-[3px] border-gold pb-3">
        <div className="min-w-0 flex-[1_1_16rem]">
          <div className="mb-1.5 flex items-center gap-2">
            {admin && (
              <span className="bg-gold px-1.5 py-px font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-black">
                Admin
              </span>
            )}
            {kicker && (
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold/80">
                {kicker}
              </span>
            )}
          </div>
          <h1 className="text-4xl sm:text-5xl [overflow-wrap:anywhere]">{title}</h1>
        </div>
        {stats && stats.length > 0 && (
          <dl className="flex flex-wrap gap-x-7 gap-y-2">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                  {s.label}
                </dt>
                <dd className="font-display text-3xl font-extrabold leading-none tabular-nums">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {description && (
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{description}</p>
      )}
    </header>
  );
}

export function SectionTitle({
  children,
  aside,
  className = "",
}: {
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rule-title mb-4 flex items-baseline justify-between gap-4 ${className}`}>
      <h2 className="text-2xl">{children}</h2>
      {aside && (
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {aside}
        </span>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="halftone border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <h3 className="text-2xl">{title}</h3>
      {children && <p className="mt-2 text-sm text-muted-foreground">{children}</p>}
    </div>
  );
}
