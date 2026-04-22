'use client';

const AVATAR_COLORS = ['#5C6BC0', '#EC407A', '#26A69A', '#FFA726', '#7E57C2', '#42A5F5', '#EF5350', '#66BB6A'];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface AvatarProps {
  username: string;
  size?: number;
  className?: string;
}

export function Avatar({ username, size = 32, className = '' }: AvatarProps) {
  const color = AVATAR_COLORS[hashCode(username) % AVATAR_COLORS.length];
  const fontSize = Math.round(size * 0.38);
  const initial = username.charAt(0).toUpperCase();

  return (
    <div
      className={`flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white ${className}`}
      style={{ width: size, height: size, background: color, fontSize }}
    >
      {initial}
    </div>
  );
}
