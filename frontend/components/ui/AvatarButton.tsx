'use client';

interface AvatarUser {
  id: string;
  name: string;
  avatar: string;
  color: string;
  points?: number;
}

interface AvatarButtonProps {
  user: AvatarUser;
  onClick?: () => void;
  showPoints?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function AvatarButton({
  user,
  onClick,
  showPoints = false,
  size = 'md',
}: AvatarButtonProps) {
  const sizeClasses = {
    sm: {
      button: 'min-h-[48px] min-w-[48px] p-2 gap-2',
      emoji: 'text-2xl',
      name: 'text-sm',
      points: 'text-xs',
    },
    md: {
      button: 'min-h-[64px] min-w-[64px] p-3 gap-2',
      emoji: 'text-3xl',
      name: 'text-base',
      points: 'text-sm',
    },
    lg: {
      button: 'min-h-[80px] min-w-[80px] p-4 gap-3',
      emoji: 'text-4xl',
      name: 'text-lg',
      points: 'text-base',
    },
  };

  const classes = sizeClasses[size];

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`
        flex flex-col items-center rounded-2xl transition-all duration-200
        ${classes.button}
        ${onClick ? 'cursor-pointer active:scale-95 hover:brightness-110' : ''}
      `}
      style={{
        backgroundColor: `${user.color}22`,
        border: `2px solid ${user.color}55`,
      }}
    >
      <span className={classes.emoji}>{user.avatar}</span>
      <span
        className={`font-semibold ${classes.name}`}
        style={{ color: user.color }}
      >
        {user.name}
      </span>
      {showPoints && user.points !== undefined && (
        <span
          className={`font-bold ${classes.points}`}
          style={{ color: user.color }}
        >
          ⭐ {user.points}
        </span>
      )}
    </Component>
  );
}
