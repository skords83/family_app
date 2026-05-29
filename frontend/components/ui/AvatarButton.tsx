'use client';

interface AvatarUser {
  id: string;
  name: string;
  avatar: string;
  photo?: string;        // base64 or URL – takes priority over avatar emoji
  color: string;
  points?: number;
  tasks_total?: number;
  tasks_done?: number;
}

interface AvatarButtonProps {
  user: AvatarUser;
  onClick?: () => void;
  showPoints?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'topbar';
}

// SVG progress ring around avatar
function ProgressRing({
  pct,
  color,
  size,
}: {
  pct: number;
  color: string;
  size: number;
}) {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const cx = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="absolute top-0 left-0 pointer-events-none"
      style={{ transform: 'rotate(-90deg)' }}
    >
      <circle
        cx={cx} cy={cx} r={r}
        fill="none"
        stroke="rgba(0,0,0,0.08)"
        strokeWidth={stroke}
      />
      <circle
        cx={cx} cy={cx} r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

const SIZES = {
  topbar: { outer: 58, photo: 48, ring: 58, text: false },
  sm:     { outer: 64, photo: 52, ring: 64, text: true  },
  md:     { outer: 76, photo: 62, ring: 76, text: true  },
  lg:     { outer: 88, photo: 72, ring: 88, text: true  },
} as const;

export default function AvatarButton({
  user,
  onClick,
  showPoints = false,
  size = 'md',
}: AvatarButtonProps) {
  const cfg = SIZES[size];
  const pct =
    user.tasks_total && user.tasks_total > 0
      ? Math.round(((user.tasks_done ?? 0) / user.tasks_total) * 100)
      : 0;

  const Wrap = onClick ? 'button' : 'div';

  return (
    <Wrap
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 ${onClick ? 'cursor-pointer' : ''}`}
      title={`${user.name} · ⭐${user.points ?? 0} · ${pct}% erledigt`}
    >
      {/* Ring + photo */}
      <div
        className="relative flex-shrink-0"
        style={{ width: cfg.outer, height: cfg.outer }}
      >
        {/* Photo or emoji fallback */}
        {user.photo ? (
          <img
            src={user.photo}
            alt={user.name}
            className="rounded-full object-cover block transition-transform duration-150"
            style={{
              width: cfg.photo,
              height: cfg.photo,
              position: 'absolute',
              top: (cfg.outer - cfg.photo) / 2,
              left: (cfg.outer - cfg.photo) / 2,
            }}
          />
        ) : (
          <div
            className="rounded-full flex items-center justify-center text-2xl absolute"
            style={{
              width: cfg.photo,
              height: cfg.photo,
              top: (cfg.outer - cfg.photo) / 2,
              left: (cfg.outer - cfg.photo) / 2,
              background: `${user.color}22`,
            }}
          >
            {user.avatar}
          </div>
        )}

        {/* Progress ring */}
        <ProgressRing pct={pct} color={user.color} size={cfg.ring} />

        {/* Admin star badge */}
        {(user as any).role === 'parent' && (
          <div
            className="absolute bottom-0 right-0 w-[15px] h-[15px] rounded-full flex items-center justify-center text-[8px] font-bold text-white border-2 border-white"
            style={{ background: '#e85d3a' }}
          >
            ★
          </div>
        )}
      </div>

      {/* Name + points (not shown in topbar) */}
      {cfg.text && (
        <div className="text-center">
          <div
            className="text-xs font-semibold font-sans leading-tight"
            style={{ color: user.color }}
          >
            {user.name}
          </div>
          {showPoints && user.points !== undefined && (
            <div className="text-[11px] font-sans" style={{ color: user.color, opacity: 0.75 }}>
              ⭐ {user.points}
            </div>
          )}
        </div>
      )}
    </Wrap>
  );
}