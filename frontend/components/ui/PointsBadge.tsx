'use client';

interface PointsBadgeProps {
  points: number;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function PointsBadge({ points, color = '#6366f1', size = 'md' }: PointsBadgeProps) {
  const sizeClasses = {
    sm: 'text-sm px-2 py-0.5 gap-1',
    md: 'text-base px-3 py-1 gap-1.5',
    lg: 'text-xl px-4 py-2 gap-2',
  };

  const iconSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold ${sizeClasses[size]}`}
      style={{
        backgroundColor: `${color}22`,
        border: `1.5px solid ${color}66`,
        color,
      }}
    >
      <span className={iconSizes[size]}>⭐</span>
      <span>{points.toLocaleString()}</span>
    </span>
  );
}
