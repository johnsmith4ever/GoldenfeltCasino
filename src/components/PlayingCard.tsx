import { type Card, isRedSuit } from '../lib/cards'
import { ITEMS_BY_ID, useShop } from '../state/shop'

export function PlayingCard({
  card,
  hidden = false,
  size = 'md',
  dealDelay = 0,
  held = false,
  onClick,
  dim = false,
  heldLabel = 'HELD',
}: {
  card: Card
  hidden?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  dealDelay?: number
  held?: boolean
  onClick?: () => void
  dim?: boolean
  /** Text under a raised card. Pass null to lift the card without a label. */
  heldLabel?: string | null
}) {
  const dims = {
    xs: { w: 36, h: 52, rank: 'text-[11px]', suit: 'text-[11px]', center: 'text-xl', mark: 'text-[11px]' },
    sm: { w: 52, h: 74, rank: 'text-lg', suit: 'text-xl', center: 'text-3xl', mark: 'text-base' },
    md: { w: 68, h: 96, rank: 'text-xl', suit: 'text-2xl', center: 'text-4xl', mark: 'text-xl' },
    lg: { w: 84, h: 118, rank: 'text-2xl', suit: 'text-3xl', center: 'text-5xl', mark: 'text-2xl' },
  }[size]

  const { equipped } = useShop()
  const backCss = ITEMS_BY_ID[equipped.back]?.css ?? ''
  const red = isRedSuit(card.suit)
  const color = red ? '#b3001b' : '#17151c'

  const inner = hidden ? (
    <div className={`card-back ${backCss} w-full h-full flex items-center justify-center`}>
      <span className={`card-back-mark font-display text-[#f6e27a]/70 ${dims.mark} select-none`}>GF</span>
    </div>
  ) : (
    <div
      className={`playing-card w-full h-full relative ${held ? 'ring-2 ring-[#f6e27a] shadow-[0_0_18px_rgba(246,226,122,0.5)]' : ''}`}
      style={{ opacity: dim ? 0.45 : 1 }}
    >
      <div className="absolute left-1.5 top-1.5 flex flex-col items-start leading-none" style={{ color }}>
        <span className={`${dims.rank} font-bold font-display`}>{card.rank}</span>
        <span className={`${dims.suit} -mt-0.5`}>{card.suit}</span>
      </div>
      <div className={`absolute inset-0 flex items-center justify-center ${dims.center}`} style={{ color }}>
        {card.suit}
      </div>
      <div className="absolute bottom-1.5 right-1.5 flex rotate-180 flex-col items-start leading-none" style={{ color }}>
        <span className={`${dims.rank} font-bold font-display`}>{card.rank}</span>
        <span className={`${dims.suit} -mt-0.5`}>{card.suit}</span>
      </div>
    </div>
  )

  return (
    <div
      className={`card-deal-anim shrink-0 ${onClick ? 'cursor-pointer transition-transform hover:-translate-y-2' : ''} ${held ? '-translate-y-2' : ''}`}
      style={{ width: dims.w, height: dims.h, animationDelay: `${dealDelay}ms` }}
      onClick={onClick}
    >
      {inner}
      {held && heldLabel && (
        <div className="text-center mt-1">
          <span className="font-display text-[10px] tracking-[0.25em] text-[#f6e27a] font-bold">{heldLabel}</span>
        </div>
      )}
    </div>
  )
}
