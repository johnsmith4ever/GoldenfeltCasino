const PIPS: Record<number, [number, number][]> = {
  1: [[32, 32]],
  2: [[20, 20], [44, 44]],
  3: [[18, 18], [32, 32], [46, 46]],
  4: [[20, 20], [44, 20], [20, 44], [44, 44]],
  5: [[20, 20], [44, 20], [32, 32], [20, 44], [44, 44]],
  6: [[20, 18], [44, 18], [20, 32], [44, 32], [20, 46], [44, 46]],
}

export function Die({ value, size = 84, rolling, delay = 0 }: { value: number; size?: number; rolling: boolean; delay?: number }) {
  return (
    <div className={rolling ? 'dice-tumble-anim' : ''} style={{ animationDelay: `${delay}ms` }} data-die={value}>
      <svg width={size} height={size} viewBox="0 0 64 64" style={{ filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.6))' }}>
        <rect x="2" y="2" width="60" height="60" rx="10" fill="#f4f1e8" stroke="#b9b2a0" strokeWidth="1.5" />
        <rect x="2" y="2" width="60" height="60" rx="10" fill="url(#diegloss)" opacity="0.35" />
        <defs>
          <linearGradient id="diegloss" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#8a8474" />
          </linearGradient>
        </defs>
        {PIPS[value].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="5" fill="#b3001b" />
        ))}
      </svg>
    </div>
  )
}


