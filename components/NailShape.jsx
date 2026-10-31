import { useId } from "react";

/**
 * One almond nail, drawn — the site's stand-in for photos, since Mya would
 * rather not show her sets here.
 *
 * Used twice: the homepage's length ladder, and the length choice in the
 * booking form, so "XL" means the same picture in both places. Heights grow
 * by length so the row reads as a price ladder at a glance.
 */
export const LENGTH_STEPS = [
  { value: "Small/Xtra Small", label: "Short", h: 44 },
  { value: "Medium", label: "Medium", h: 58 },
  { value: "Large", label: "Long", h: 74 },
  { value: "XL", label: "XL", h: 92 },
  { value: "XXL", label: "XXL", h: 112 },
];

export default function NailShape({ h = 60, w = 30, muted = false, className = "" }) {
  const id = useId().replace(/:/g, "");
  // Tip at the top, cuticle curve at the bottom.
  const base = h;
  const d = [
    `M ${w / 2} 0`,
    `C ${w * 1.02} ${h * 0.22}, ${w} ${h * 0.55}, ${w} ${base}`,
    `Q ${w / 2} ${base + w * 0.42}, 0 ${base}`,
    `C 0 ${h * 0.55}, ${-w * 0.02} ${h * 0.22}, ${w / 2} 0`,
    "Z",
  ].join(" ");
  const vbH = base + w * 0.25;
  return (
    <svg
      width={w}
      height={vbH}
      viewBox={`-1 -1 ${w + 2} ${vbH + 2}`}
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id={`lacquer-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={muted ? "#e7d3cd" : "#be123c"} />
          <stop offset="1" stopColor={muted ? "#d6bdb5" : "#881337"} />
        </linearGradient>
      </defs>
      <path d={d} fill={`url(#lacquer-${id})`} />
      {/* the gloss streak */}
      <path
        d={`M ${w * 0.3} ${h * 0.18} C ${w * 0.2} ${h * 0.4}, ${w * 0.22} ${h * 0.7}, ${w * 0.26} ${h * 0.86}`}
        stroke="#fff"
        strokeOpacity={muted ? 0.5 : 0.35}
        strokeWidth={w * 0.09}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
