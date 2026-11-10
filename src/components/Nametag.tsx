import { Crown, Flame, Gem, ShieldCheck, Star, User, Landmark, Sparkles, Zap, Award } from 'lucide-react'
import { ITEMS_BY_ID, useShop } from '../state/shop'

const ICONS: Record<string, typeof User> = {
  'tag-guest': User,
  'tag-silver': ShieldCheck,
  'tag-gold': Star,
  'tag-crimson': Flame,
  'tag-emerald': Gem,
  'tag-legend': Crown,
  'tag-house': Landmark,
  'tag-baron': Gem,
  'tag-mogul': Crown,
  'tag-whale': Sparkles,
  'tag-immortal': Zap,
  'tag-founder': Award,
}

export function Nametag({
  name,
  tagId,
  compact = false,
}: {
  name?: string
  tagId?: string
  compact?: boolean
}) {
  const shop = useShop()
  const item = ITEMS_BY_ID[tagId ?? shop.equipped.tag] ?? ITEMS_BY_ID['tag-guest']
  const shown = (name ?? shop.name).trim() || 'Guest'
  const Icon = ICONS[item.id] ?? User

  return (
    <span className={`nametag font-display ${item.css} ${compact ? 'nametag-compact' : ''}`}>
      <Icon size={compact ? 13 : 18} strokeWidth={1.8} className="shrink-0" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="flex items-center gap-1.5 text-[12px] font-bold tracking-[0.1em] uppercase whitespace-nowrap">
          <span className="truncate max-w-[120px] sm:max-w-[160px]">{shown}</span>
          {item.level && (
            <span className="shrink-0 rounded bg-black/60 border border-current px-1 py-0 text-[8px] font-black tracking-normal opacity-90">
              LVL {item.level}
            </span>
          )}
        </span>
        {!compact && <span className="text-[9px] tracking-[0.3em] opacity-80">{item.title}</span>}
      </span>
    </span>
  )
}
