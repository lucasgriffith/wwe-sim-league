/**
 * Rating trajectory sparkline — one series, accent-colored 2px line with an
 * emphasized endpoint and a faint dashed reference at the 1200 baseline.
 * Native SVG <title> tooltips give per-point hover without client JS.
 */

interface Point {
  rating: number;
  label: string; // tooltip text, e.g. "1234 — def. Mosh (S1)"
}

export function RatingSparkline({
  points,
  height = 48,
}: {
  points: Point[];
  height?: number;
}) {
  if (points.length < 2) return null;

  const width = 280;
  const pad = 6;
  const ratings = points.map((p) => p.rating);
  const min = Math.min(...ratings, 1200);
  const max = Math.max(...ratings, 1200);
  const span = Math.max(max - min, 20);

  const x = (i: number) => pad + (i / (points.length - 1)) * (width - pad * 2);
  const y = (r: number) => pad + (1 - (r - min) / span) * (height - pad * 2);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.rating).toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];
  const baselineY = y(1200);
  const hitWidth = (width - pad * 2) / (points.length - 1);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      role="img"
      aria-label={`Rating trajectory, currently ${last.rating}`}
    >
      {/* 1200 baseline reference */}
      <line
        x1={pad}
        y1={baselineY}
        x2={width - pad}
        y2={baselineY}
        stroke="currentColor"
        strokeOpacity={0.12}
        strokeWidth={1}
        strokeDasharray="3 4"
      />
      <path
        d={path}
        fill="none"
        stroke="rgb(var(--accent-color))"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Emphasized endpoint */}
      <circle
        cx={x(points.length - 1)}
        cy={y(last.rating)}
        r={3}
        fill="rgb(var(--accent-color))"
      />
      {/* Hover targets with native tooltips */}
      {points.map((p, i) => (
        <rect
          key={i}
          x={x(i) - hitWidth / 2}
          y={0}
          width={hitWidth}
          height={height}
          fill="transparent"
        >
          <title>{p.label}</title>
        </rect>
      ))}
    </svg>
  );
}
