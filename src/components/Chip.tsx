import { fmt } from '../state/chips'

export const CHIP_DENOMS = [
  { value: 25, base: '#e8e4da', ring: '#b3001b', text: '#1a1a1a' },
  { value: 100, base: '#14141a', ring: '#e8e4da', text: '#f2e6c9' },
  { value: 500, base: '#5c0f6e', ring: '#e8e4da', text: '#f2e6c9' },
  { value: 1000, base: '#c9a227', ring: '#7a0018', text: '#1a1405' },
] as const

export function chipColorFor(value: number) {
  if (value >= 1000) return CHIP_DENOMS[3]
  if (value >= 500) return CHIP_DENOMS[2]
  if (value >= 100) return CHIP_DENOMS[1]
  return CHIP_DENOMS[0]
}

/** A casino chip rendered as SVG. */
export function Chip({
  value,
  size = 56,
  onClick,
  selected = false,
  disabled = false,
  label,
}: {
  value: number
  size?: number
  onClick?: () => void
  selected?: boolean
  disabled?: boolean
  label?: string
}) {
  const c = chipColorFor(value)
  const r = 50
  const dashes = 12
  const markerLen = (2 * Math.PI * r) / dashes

  const body = (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {/* edge marks */}
      <circle cx="60" cy="60" r="54" fill={c.base} stroke="rgba(0,0,0,0.5)" strokeWidth="1.5" />
      <circle
        cx="60" cy="60" r="47" fill="none"
        stroke={c.ring} strokeWidth="12"
        strokeDasharray={`${markerLen * 0.45} ${markerLen * 0.55}`}
      />
      <circle cx="60" cy="60" r="38" fill={c.base} stroke={c.ring} strokeWidth="1.5" />
      <circle cx="60" cy="60" r="33" fill="none" stroke={c.ring} strokeWidth="0.8" strokeDasharray="2 3" opacity="0.7" />
      <text
        x="60" y="61" textAnchor="middle" dominantBaseline="central"
        fill={c.text} fontSize={value >= 1000 ? 26 : 30} fontWeight="700"
        fontFamily="'Cinzel', serif"
      >
        {label ?? (value >= 1000 ? '1K' : value)}
      </text>
      {/* top light */}
      <ellipse cx="45" cy="34" rx="26" ry="12" fill="rgba(255,255,255,0.16)" transform="rotate(-24 45 34)" />
    </svg>
  )

  if (onClick) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`casino-chip rounded-full ${selected ? 'selected' : ''}`}
        aria-label={`Chip ${value}`}
      >
        {body}
      </button>
    )
  }
  return <span className="casino-chip inline-block rounded-full">{body}</span>
}

/** A small stacked chip display for placed bets. */
export function BetStack({ amount, size = 40 }: { amount: number; size?: number }) {
  const c = chipColorFor(amount)
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <span className="absolute inset-0 rounded-full border-2" style={{ background: c.base, borderColor: c.ring }} />
      <span className="relative font-display font-bold" style={{ color: c.text, fontSize: size * 0.3 }}>
        {amount >= 1000 ? `${amount / 1000}K` : amount}
      </span>
    </span>
  )
}

/** A bet shown as real stacks of chips, one stack per denomination, with a count under each. */
export function ChipPile({ amount, size = 34 }: { amount: number; size?: number }) {
  const { groups } = [...CHIP_DENOMS].reverse().reduce(
    (acc, d) => {
      const n = Math.floor(acc.rest / d.value)
      return { rest: acc.rest - n * d.value, groups: n > 0 ? [...acc.groups, { value: d.value, n }] : acc.groups }
    },
    { rest: Math.round(amount), groups: [] as { value: number; n: number }[] },
  )
  const STEP = 5
  return (
    <span className="inline-flex items-end gap-3">
      {groups.map((g) => {
        const shown = Math.min(g.n, 6)
        return (
          <span key={g.value} className="relative inline-block" style={{ width: size, height: size + (shown - 1) * STEP + 15 }}>
            {Array.from({ length: shown }).map((_, i) => (
              <span key={i} className="absolute left-0" style={{ top: (shown - 1 - i) * STEP }}>
                <Chip value={g.value} size={size} />
              </span>
            ))}
            <span className="absolute bottom-0 left-0 right-0 text-center text-[10px] tabular-nums tracking-wider text-[#f2e6c9]">×{g.n}</span>
          </span>
        )
      })}
    </span>
  )
}

/** Row of selectable chip denominations. */
export function ChipSelector({
  selected,
  onSelect,
  max,
}: {
  selected: number
  onSelect: (v: number) => void
  max: number
}) {
  return (
    <div className="flex items-end gap-3">
      {CHIP_DENOMS.map((d) => (
        <Chip
          key={d.value}
          value={d.value}
          size={selected === d.value ? 62 : 54}
          selected={selected === d.value}
          disabled={d.value > max}
          onClick={() => onSelect(d.value)}
        />
      ))}
    </div>
  )
}

export { fmt }
