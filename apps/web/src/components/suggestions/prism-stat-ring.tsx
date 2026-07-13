const RADIUS = 14;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface PrismStatRingProps {
  value: number; // 0..1
  color: string;
  label: string;
}

export function PrismStatRing({ value, color, label }: PrismStatRingProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const offset = CIRCUMFERENCE * (1 - clamped);

  return (
    <div className="flex items-center gap-2">
      <svg width="34" height="34" viewBox="0 0 34 34" className="shrink-0">
        <circle cx="17" cy="17" r={RADIUS} fill="none" stroke="rgba(238,242,250,0.12)" strokeWidth="3" />
        <circle
          cx="17"
          cy="17"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 17 17)"
        />
      </svg>
      <span className="text-[10.5px] text-[#7c85a0]">
        {label}
        <b className="block text-[13px] text-[#eef2fa] tabular-nums font-semibold">
          {Math.round(clamped * 100)}%
        </b>
      </span>
    </div>
  );
}
