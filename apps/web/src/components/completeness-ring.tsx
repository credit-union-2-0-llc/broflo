"use client";

const SIZE = 40;
const STROKE = 4;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function getColor(score: number) {
  if (score < 40) return "text-destructive";
  if (score < 70) return "text-yellow-500";
  return "text-green-500";
}

function getNudge(score: number): string | null {
  if (score >= 70) return null;
  if (score < 20) return "Add hobbies and budget to improve gift suggestions";
  if (score < 40) return "Add more details for better suggestions";
  return "Almost there — fill in a few more fields";
}

interface CompletenessRingProps {
  score: number;
  size?: number;
  className?: string;
}

export function CompletenessRing({ score, size = SIZE, className = "" }: CompletenessRingProps) {
  const scaledRadius = (size - STROKE) / 2;
  const scaledCircumference = 2 * Math.PI * scaledRadius;
  const offset = scaledCircumference - (score / 100) * scaledCircumference;
  const color = getColor(score);
  const nudge = getNudge(score);

  return (
    <div className={`relative inline-flex items-center justify-center group ${className}`} title={nudge ?? `${score}% complete`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={scaledRadius}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          className="text-muted/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={scaledRadius}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeDasharray={scaledCircumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <span className={`absolute text-xs font-semibold ${color}`}>
        {score}
      </span>
    </div>
  );
}
