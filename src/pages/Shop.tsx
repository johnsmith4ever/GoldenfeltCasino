import { useState, useMemo } from 'react'
import {
  Sparkles,
  Gift,
  Lock,
  Check,
  Award,
  Package,
  Palette,
  RotateCw,
  Building2,
  Crown,
} from 'lucide-react'
import { Chip } from '../components/Chip'
import { Nametag } from '../components/Nametag'
import { useChips, fmt, BET_TIERS } from '../state/chips'
import { usePlayer } from '../state/profile'
import {
  CATALOG,
  formatCountdown,
  msUntilClaim,
  useNow,
  useShop,
} from '../state/shop'
import { sfx } from '../lib/audio'
import {
  spinLootBox,
  buyTokenShopItem,
} from '../lib/supabase'

export const LOOT_TEASERS = [
  { label: 'EMPTY VAULT', value: '0 CHIPS', color: 'text-gray-400' },
  { label: 'CHIP YIELD', value: '+150,000 CHIPS', color: 'text-emerald-400' },
  { label: 'EMPTY VAULT', value: '0 CHIPS', color: 'text-gray-400' },
  { label: '⚡ APEX JACKPOT ⚡', value: '+25,000,000 CHIPS', color: 'text-[#fde047]' },
  { label: 'COMMON DROP', value: '+75,000 CHIPS', color: 'text-[#38bdf8]' },
  { label: 'EMPTY VAULT', value: '0 CHIPS', color: 'text-gray-400' },
  { label: 'HIGH YIELD', value: '+1,000,000 CHIPS', color: 'text-purple-400' },
  { label: '👑 MEGA JACKPOT 👑', value: '+10,000,000 CHIPS', color: 'text-[#fde047]' },
  { label: 'EMPTY VAULT', value: '0 CHIPS', color: 'text-gray-400' },
  { label: 'CHIP DROP', value: '+250,000 CHIPS', color: 'text-[#38bdf8]' },
]

export const NAMETAG_TIERS = [
  { id: 'tag-guest', level: 1, title: 'NOVICE', name: 'Level 1: Novice', desc: 'A plain, understated bronze nameplate.', chipsCost: 0, css: 'tag-guest' },
  { id: 'tag-silver', level: 2, title: 'REGULAR', name: 'Level 2: Regular', desc: 'Brushed silver. Quietly confident.', chipsCost: 100000, css: 'tag-silver' },
  { id: 'tag-gold', level: 3, title: 'MEMBER', name: 'Level 3: Member', desc: 'A polished 18K gold nameplate.', chipsCost: 350000, css: 'tag-gold' },
  { id: 'tag-crimson', level: 4, title: 'HIGH ROLLER', name: 'Level 4: High Roller', desc: 'Crimson velvet plate for big spenders.', chipsCost: 1000000, css: 'tag-crimson' },
  { id: 'tag-emerald', level: 5, title: 'VIP CLUB', name: 'Level 5: VIP Club', desc: 'Emerald plate, velvet-rope status.', chipsCost: 2500000, css: 'tag-emerald' },
  { id: 'tag-legend', level: 6, title: 'LEGEND', name: 'Level 6: Golden Legend', desc: 'Animated shimmering 24K gold nameplate.', chipsCost: 6000000, css: 'tag-legend' },
  { id: 'tag-baron', level: 7, title: 'DIAMOND BARON', name: 'Level 7: Diamond Baron', desc: 'Electric diamond cyan glow with crystal trim.', chipsCost: 15000000, css: 'tag-baron' },
  { id: 'tag-mogul', level: 8, title: 'CASINO MOGUL', name: 'Level 8: Casino Mogul', desc: 'Rich imperial ruby plate with 24K filigree.', chipsCost: 35000000, css: 'tag-mogul' },
  { id: 'tag-whale', level: 9, title: 'APEX WHALE', name: 'Level 9: Apex Whale', desc: 'Deep ocean navy with iridescent turquoise reflections.', chipsCost: 75000000, css: 'tag-whale' },
  { id: 'tag-house', level: 10, title: 'THE HOUSE', name: 'Level 10: The House', desc: 'Obsidian & pulsing gold border. You are the house.', chipsCost: 150000000, css: 'tag-house' },
  { id: 'tag-immortal', level: 11, title: 'IMMORTAL', name: 'Level 11: Immortal Gambler', desc: 'Cosmic electric violet & solar flare aura.', chipsCost: 300000000, css: 'tag-immortal' },
  { id: 'tag-founder', level: 12, title: 'FOUNDER', name: 'Level 12: Supreme Founder', desc: 'Royal purple velvet & supreme 24K imperial seal.', chipsCost: 600000000, css: 'tag-founder' },
]

export const BADGE_TIER_ITEMS = [
  { id: 'badge-bronze-dice', tier: 1, label: 'Lucky Bones', icon: '🎲', chipsCost: 500000, desc: 'First tier collector badge displayed next to nametag' },
  { id: 'badge-silver-crown', tier: 2, label: 'High Sovereign', icon: '👑', chipsCost: 2500000, desc: 'Silver royal crown insignia displayed next to nametag' },
  { id: 'badge-gold-lion', tier: 3, label: 'Golden Apex', icon: '🦁', chipsCost: 10000000, desc: 'Predator lion crest displayed next to nametag' },
  { id: 'badge-diamond-gem', tier: 4, label: 'Etherion Shard', icon: '💎', chipsCost: 50000000, desc: 'Flawless radiant diamond gem displayed next to nametag' },
  { id: 'badge-mythic-phoenix', tier: 5, label: 'Immortal Flame', icon: '🔥', chipsCost: 200000000, desc: 'Supreme mythic phoenix crest displayed next to nametag' },
]

export const BET_TIER_ITEMS = [
  { tier: 1, maxBet: 100000, chipsCost: 500000, label: 'High Roller (100k Max Bet)', desc: 'Raises table max bet from 25,000 to 100,000 chips' },
  { tier: 2, maxBet: 1000000, chipsCost: 5000000, label: 'VIP Whale (1M Max Bet)', desc: 'Raises table max bet from 100,000 to 1,000,000 chips' },
  { tier: 3, maxBet: 10000000, chipsCost: 50000000, label: 'Apex Sovereign (10M Max Bet)', desc: 'Raises table max bet from 1,000,000 to 10,000,000 chips' },
]

/* ---------- Daily Chips Gift ---------- */
export function DailyGift({ compact = false }: { compact?: boolean }) {
  const { lastClaim, claim, streak } = useShop()
  const now = useNow(1000)
  const wait = msUntilClaim(lastClaim, now)
  const ready = wait === 0

  const onClaim = () => {
    if (claim()) sfx.coin()
  }

  return (
    <div className={`panel-noir gold-frame relative overflow-hidden rounded-xl ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
      <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-[#d4af37] opacity-10 blur-3xl" />
      <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#c9a227]/50 bg-black/40 ${ready ? 'pulse-soft' : ''}`}>
          <Gift size={26} strokeWidth={1.5} className="text-[#f6e27a]" />
        </div>
        <div className="flex-1">
          <div className="font-display gold-text text-lg font-bold tracking-[0.2em]">DAILY CHIP GIFT</div>
          <p className="mt-0.5 text-[13px] font-light text-[#b3a06b]">
            Claim <span className="font-semibold text-[#f6e27a] tabular-nums">10,000</span> free chips every 24 hours. <span className="text-[#f6e27a]">Daily streak: {streak}</span>
          </p>
        </div>
        <button
          onClick={onClaim}
          disabled={!ready}
          className="btn-gold min-h-[44px] w-full rounded px-6 py-2.5 text-[12px] sm:w-auto sm:min-w-[210px]"
        >
          {ready ? 'CLAIM 10,000 CHIPS' : `NEXT GIFT IN ${formatCountdown(wait)}`}
        </button>
      </div>
    </div>
  )
}

/* ---------- Page Main ---------- */
export default function Shop({ onProperties }: { onProperties?: () => void } = {}) {
  const { balance, betTier, spend, credit, setBetTier } = useChips()
  const { activeName } = usePlayer()
  const shop = useShop()

  // Tab: 'prestige' | 'lootbox' | 'felts' | 'profile'
  const [activeTab, setActiveTabState] = useState<'prestige' | 'lootbox' | 'felts' | 'profile'>(() => {
    try {
      const saved = sessionStorage.getItem('golden-felt-shop-tab')
      if (saved && ['prestige', 'lootbox', 'felts', 'profile'].includes(saved)) return saved as any
    } catch {}
    return 'prestige'
  })

  const setActiveTab = (tab: 'prestige' | 'lootbox' | 'felts' | 'profile') => {
    try { sessionStorage.setItem('golden-felt-shop-tab', tab) } catch {}
    setActiveTabState(tab)
  }
  const [prestigeSubTab, setPrestigeSubTab] = useState<'nametags' | 'bet_tiers' | 'badges'>('nametags')

  // Status message
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Loot Box state & animation sequence
  const [isLootBoxRolling, setIsLootBoxRolling] = useState(false)
  const [rollStage, setRollStage] = useState<'idle' | 'charging' | 'spinning' | 'decelerating' | 'revealed'>('idle')
  const [tickerIndex, setTickerIndex] = useState(0)
  const [lootBoxResult, setLootBoxResult] = useState<{ won: boolean; chips: number; isJackpot: boolean } | null>(null)

  const LOOT_COST = 50000

  // Handle Multi-Phase Animated Loot Box Roll
  const handleSpinLootBox = async () => {
    if (isLootBoxRolling) return
    if (balance < LOOT_COST) {
      setError(`High Roller Vault roll requires ${fmt(LOOT_COST)} chips. Insufficient balance.`)
      return
    }

    if (!spend(LOOT_COST)) {
      setError('Insufficient chips to unlock vault.')
      return
    }

    setIsLootBoxRolling(true)
    setRollStage('charging')
    setError('')
    setMessage('')
    setLootBoxResult(null)
    sfx.chip()
    sfx.riser()

    try {
      const rpcPromise = spinLootBox(activeName ?? '', balance)

      setTimeout(() => {
        setRollStage('spinning')
      }, 500)

      const tickInterval = setInterval(() => {
        setTickerIndex((idx) => (idx + 1) % 10)
        sfx.tick()
      }, 110)

      const res = await rpcPromise

      let chipsWon = res.chips_won ?? 0
      let won = chipsWon > 0
      let isJackpot = Boolean(res.isJackpot)

      setTimeout(() => {
        setRollStage('decelerating')
        sfx.reelStop()
      }, 2100)

      setTimeout(() => {
        clearInterval(tickInterval)
        setRollStage('revealed')
        setLootBoxResult({ won, chips: chipsWon, isJackpot })
        setIsLootBoxRolling(false)

        if (isJackpot) {
          sfx.bigWin()
          credit(chipsWon)
          setMessage(`👑 APEX JACKPOT! The High Roller Vault exploded with ${fmt(chipsWon)} CHIPS!`)
        } else if (won) {
          sfx.win()
          sfx.coin()
          credit(chipsWon)
          setMessage(`🎉 VAULT BREACH SUCCESS! You unboxed +${fmt(chipsWon)} CHIPS!`)
        } else {
          sfx.lose()
          setMessage('The vault was empty this time. Try again for the 25M Apex Jackpot!')
        }
      }, 3000)
    } catch (err: any) {
      credit(LOOT_COST)
      setIsLootBoxRolling(false)
      setRollStage('idle')
      setError(err?.message || 'Vault unlock failed. 50,000 chips refunded.')
    }
  }

  // Handle Prestige Shop Purchases
  const handleBuyPrestigeItem = async (category: 'nametag' | 'bet_tier' | 'badge', tier: number, itemId: string, cost: number) => {
    if (balance < cost) {
      setError(`Insufficient chips. You have ${fmt(balance)} chips, but this costs ${fmt(cost)} chips.`)
      return
    }

    if (!spend(cost)) {
      setError('Transaction cancelled: insufficient balance.')
      return
    }

    setError('')
    setMessage(`Authorizing ${category} purchase...`)
    try {
      await buyTokenShopItem(category, tier, itemId, cost, activeName ?? '')

      sfx.coin()
      if (category === 'bet_tier') {
        setBetTier(tier)
        setMessage(`🚀 Bet Tier ${tier} unlocked! Max bet increased to ${fmt(BET_TIERS.find(t => t.tier === tier)?.maxBet ?? 25000)} chips!`)
      } else if (category === 'nametag') {
        shop.unlockItem(itemId, 'tag')
        setMessage(`👑 Nametag style unlocked and equipped! (-${fmt(cost)} chips)`)
      } else if (category === 'badge') {
        shop.setBadge(itemId)
        shop.unlockItem(itemId, 'tag')
        setMessage(`💎 Special-edition collectible badge unlocked and pinned to your nametag! (-${fmt(cost)} chips)`)
      }
    } catch {
      sfx.coin()
      if (category === 'bet_tier') {
        setBetTier(tier)
      } else if (category === 'nametag') {
        shop.unlockItem(itemId, 'tag')
      } else if (category === 'badge') {
        shop.setBadge(itemId)
        shop.unlockItem(itemId, 'tag')
      }
      setMessage(`Item unlocked! (-${fmt(cost)} chips)`)
    }
  }

  const highestUnlockedNametagLevel = useMemo(() => {
    const ownedLevels = NAMETAG_TIERS
      .filter((t) => shop.owned.includes(t.id) || t.id === 'tag-guest')
      .map((t) => t.level)
    return Math.max(1, ...ownedLevels)
  }, [shop.owned])

  const currentNametagLevel = highestUnlockedNametagLevel

  const highestUnlockedBadgeTier = useMemo(() => {
    const ownedTiers = BADGE_TIER_ITEMS
      .filter((b) => shop.owned.includes(b.id) || shop.badge === b.id)
      .map((b) => b.tier)
    return Math.max(0, ...ownedTiers)
  }, [shop.owned, shop.badge])

  const currentBetTier = betTier ?? 0
  const currentBadgeTier = highestUnlockedBadgeTier

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6">
      {/* Header Banner */}
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#c9a227]/40 bg-black/60 px-3.5 py-1 mb-2 shadow-sm">
          <Crown size={13} className="text-[#f6e27a]" />
          <span className="text-[10px] font-bold tracking-widest text-[#f6e27a]">
            PREMIUM HIGH ROLLER SALON &amp; CASINO BOUTIQUE
          </span>
        </div>
        <h1 className="font-display gold-text-bright text-3xl font-black tracking-[0.2em] sm:text-4xl">
          THE GOLDEN FELT BOUTIQUE
        </h1>
        <p className="mt-1 text-[13px] tracking-[0.25em] text-[#b3a06b] uppercase">
          Spend chips on elite status nametags, table baizes, card decks &amp; high-limit wagering
        </p>
        <div className="divider-gold mx-auto mt-3 w-48" />

        {/* Currency Balance */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#c9a227]/50 bg-black/80 py-1.5 pl-2 pr-5 shadow-lg">
            <Chip value={1000} size={26} label="GF" />
            <span className="font-display text-base font-black text-[#f6e27a] tabular-nums">{fmt(balance)}</span>
            <span className="text-[10px] tracking-[0.25em] text-[#8a7a4d] font-bold">CHIPS</span>
          </div>
        </div>
      </div>

      {/* Status alerts */}
      {message && (
        <div role="status" className="mb-5 rounded-xl border border-[#10b981]/60 bg-[#064e3b]/80 p-3.5 text-center text-[12px] font-semibold text-[#a7f3d0]">
          {message}
        </div>
      )}
      {error && (
        <div role="alert" className="mb-5 rounded-xl border border-[#ef4444]/60 bg-[#450a0a]/80 p-3.5 text-center text-[12px] font-semibold text-[#fca5a5]">
          {error}
        </div>
      )}

      {/* Main Tabs */}
      <div role="tablist" className="mb-6 flex flex-wrap justify-center gap-2">
        <button
          onClick={() => { sfx.click(); setActiveTab('prestige'); setMessage(''); setError('') }}
          className={`min-h-[42px] rounded-full px-5 py-2 text-[11px] font-bold transition-all flex items-center gap-2 ${
            activeTab === 'prestige' ? 'btn-gold shadow-md' : 'btn-ghost-gold'
          }`}
        >
          <Crown size={14} /> VIP PRESTIGE SHOP
        </button>

        <button
          onClick={() => { sfx.click(); setActiveTab('lootbox'); setMessage(''); setError('') }}
          className={`min-h-[42px] rounded-full px-5 py-2 text-[11px] font-bold transition-all flex items-center gap-2 ${
            activeTab === 'lootbox' ? 'border-[#f6e27a] bg-[#2a2105] text-[#f6e27a] shadow-[0_0_15px_rgba(246,226,122,0.3)]' : 'btn-ghost-gold'
          }`}
        >
          <Package size={14} /> HIGH ROLLER VAULT
        </button>

        <button
          onClick={() => { sfx.click(); setActiveTab('felts'); setMessage(''); setError('') }}
          className={`min-h-[42px] rounded-full px-5 py-2 text-[11px] font-bold transition-all flex items-center gap-2 ${
            activeTab === 'felts' ? 'btn-gold shadow-md' : 'btn-ghost-gold'
          }`}
        >
          <Palette size={14} /> TABLE FELTS, DECKS &amp; LUXURIES
        </button>

        <button
          onClick={() => { sfx.click(); setActiveTab('profile'); setMessage(''); setError('') }}
          className={`min-h-[42px] rounded-full px-5 py-2 text-[11px] font-bold transition-all flex items-center gap-2 ${
            activeTab === 'profile' ? 'btn-gold shadow-md' : 'btn-ghost-gold'
          }`}
        >
          <Award size={14} /> MY COSMETICS &amp; DECK
        </button>

        {onProperties && (
          <button
            onClick={() => { sfx.click(); onProperties() }}
            className="btn-ghost-gold min-h-[42px] rounded-full px-5 py-2 text-[11px] font-bold transition-all flex items-center gap-2 border-[#c9a227]/40 text-[#f6e27a] hover:bg-[#1a1403]"
          >
            <Building2 size={14} className="text-[#f6e27a]" /> CASINO STAKES &amp; VENUES →
          </button>
        )}
      </div>

      {/* ===================== TAB 1: PRESTIGE SHOP ===================== */}
      {activeTab === 'prestige' && (
        <section className="space-y-6">
          <div className="flex justify-center gap-2 border-b border-[#c9a227]/20 pb-4">
            <button
              onClick={() => { sfx.click(); setPrestigeSubTab('nametags') }}
              className={`rounded-lg px-4 py-1.5 text-[11px] font-bold transition-colors ${
                prestigeSubTab === 'nametags'
                  ? 'border border-[#f6e27a] bg-[#2a2105] text-[#f6e27a]'
                  : 'border border-white/10 bg-black/40 text-[#a89872] hover:text-[#f2e6c9]'
              }`}
            >
              👑 NAMETAG STYLES ({currentNametagLevel}/12)
            </button>
            <button
              onClick={() => { sfx.click(); setPrestigeSubTab('bet_tiers') }}
              className={`rounded-lg px-4 py-1.5 text-[11px] font-bold transition-colors ${
                prestigeSubTab === 'bet_tiers'
                  ? 'border border-[#f6e27a] bg-[#2a2105] text-[#f6e27a]'
                  : 'border border-white/10 bg-black/40 text-[#a89872] hover:text-[#f2e6c9]'
              }`}
            >
              📈 BET SIZE TIERS ({currentBetTier}/3)
            </button>
            <button
              onClick={() => { sfx.click(); setPrestigeSubTab('badges') }}
              className={`rounded-lg px-4 py-1.5 text-[11px] font-bold transition-colors ${
                prestigeSubTab === 'badges'
                  ? 'border border-[#f6e27a] bg-[#2a2105] text-[#f6e27a]'
                  : 'border border-white/10 bg-black/40 text-[#a89872] hover:text-[#f2e6c9]'
              }`}
            >
              💎 COLLECTIBLE BADGES ({currentBadgeTier}/5)
            </button>
          </div>

          {/* Sub-tab 1: Nametag Styles */}
          {prestigeSubTab === 'nametags' && (
            <div>
              <div className="mb-4 text-center">
                <span className="text-[10px] tracking-[0.25em] text-[#f6e27a] font-bold">SEQUENTIAL VIP PRESTIGE</span>
                <h3 className="font-display gold-text text-xl font-bold mt-1">NAMETAG PROGRESSION TIERS</h3>
                <p className="text-[12px] text-[#a89872]">
                  Each nametag tier must be unlocked sequentially with chips.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {NAMETAG_TIERS.map((tier) => {
                  const isOwned = shop.owned.includes(tier.id) || tier.id === 'tag-guest'
                  const isEquipped = shop.equipped.tag === tier.id
                  const isNext = tier.level === currentNametagLevel + 1
                  const isLocked = !isOwned && !isNext
                  const canAfford = balance >= tier.chipsCost

                  return (
                    <div
                      key={tier.id}
                      className={`panel-noir relative flex flex-col justify-between rounded-xl p-4 transition-all ${
                        isEquipped
                          ? 'border-2 border-[#f6e27a] shadow-[0_0_15px_rgba(246,226,122,0.2)] bg-[#1a1403]/80'
                          : isOwned
                          ? 'border border-[#10b981]/40 bg-black/40'
                          : isNext
                          ? 'border border-[#f6e27a]/60 bg-gradient-to-b from-[#1c1505] to-black/80'
                          : 'border border-white/5 bg-black/20 opacity-60'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold tracking-widest text-[#8a7a4d]">
                            TIER {tier.level} OF 12
                          </span>
                          {isEquipped && (
                            <span className="rounded bg-[#f6e27a]/20 border border-[#f6e27a]/40 px-2 py-0.5 text-[9px] font-bold text-[#f6e27a]">
                              EQUIPPED
                            </span>
                          )}
                          {isOwned && !isEquipped && (
                            <span className="rounded bg-[#10b981]/20 border border-[#10b981]/40 px-2 py-0.5 text-[9px] font-bold text-[#34d399]">
                              OWNED
                            </span>
                          )}
                          {isLocked && (
                            <span className="flex items-center gap-1 text-[9px] text-gray-500 font-bold">
                              <Lock size={11} /> LOCKED
                            </span>
                          )}
                        </div>

                        <div className="my-3 flex justify-center">
                          <Nametag name={activeName ?? 'High Roller'} tagId={tier.id} badge={shop.badge} />
                        </div>

                        <h4 className="font-display gold-text text-sm font-bold text-center">{tier.name}</h4>
                        <p className="mt-1 text-[11px] text-[#a89872] text-center">{tier.desc}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                        <div>
                          <div className="text-[9px] text-[#8a7a4d]">PRICE</div>
                          <div className="font-display text-sm font-bold text-[#f6e27a]">
                            {tier.chipsCost === 0 ? 'FREE' : `${fmt(tier.chipsCost)} CHIPS`}
                          </div>
                        </div>

                        {isEquipped ? (
                          <button disabled className="rounded px-3 py-1.5 text-[10px] font-bold text-gray-500 bg-white/5">
                            EQUIPPED
                          </button>
                        ) : isOwned ? (
                          <button
                            onClick={() => {
                              sfx.click()
                              shop.equip(tier.id)
                              setMessage(`Equipped ${tier.name}!`)
                            }}
                            className="btn-gold rounded px-3 py-1.5 text-[10px] font-bold"
                          >
                            EQUIP
                          </button>
                        ) : isNext ? (
                          <button
                            onClick={() => handleBuyPrestigeItem('nametag', tier.level, tier.id, tier.chipsCost)}
                            disabled={!canAfford}
                            className={`rounded px-3.5 py-1.5 text-[10px] font-bold transition-all ${
                              canAfford ? 'btn-gold shadow-md' : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/10'
                            }`}
                          >
                            UNLOCK ({fmt(tier.chipsCost)})
                          </button>
                        ) : (
                          <button disabled className="rounded px-3 py-1.5 text-[10px] font-bold text-gray-600 bg-black/40 border border-white/5 cursor-not-allowed">
                            LOCKED (REQ LVL {tier.level - 1})
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Sub-tab 2: Bet Size Tiers */}
          {prestigeSubTab === 'bet_tiers' && (
            <div>
              <div className="mb-4 text-center">
                <span className="text-[10px] tracking-[0.25em] text-[#f6e27a] font-bold">HIGH-STAKES WAGERING LIMITS</span>
                <h3 className="font-display gold-text text-xl font-bold mt-1">RAISE MAXIMUM BET LIMITS</h3>
                <p className="text-[12px] text-[#a89872]">
                  Unlocks higher maximum wagers across Blackjack, Roulette, Craps, Poker, and all games.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {BET_TIER_ITEMS.map((tier) => {
                  const isUnlocked = currentBetTier >= tier.tier
                  const isNext = tier.tier === currentBetTier + 1
                  const canAfford = balance >= tier.chipsCost

                  return (
                    <div
                      key={tier.tier}
                      className={`panel-noir relative flex flex-col justify-between rounded-xl p-5 transition-all ${
                        isUnlocked
                          ? 'border border-[#10b981]/50 bg-black/40'
                          : isNext
                          ? 'border border-[#f6e27a]/60 bg-gradient-to-b from-[#1c1505] to-black/80'
                          : 'border border-white/5 bg-black/20 opacity-60'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-bold tracking-widest text-[#8a7a4d]">
                            TIER {tier.tier}
                          </span>
                          {isUnlocked ? (
                            <span className="rounded bg-[#10b981]/20 border border-[#10b981]/40 px-2 py-0.5 text-[9px] font-bold text-[#34d399]">
                              ACTIVE
                            </span>
                          ) : isNext ? (
                            <span className="rounded bg-[#f6e27a]/20 border border-[#f6e27a]/40 px-2 py-0.5 text-[9px] font-bold text-[#f6e27a]">
                              AVAILABLE
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[9px] text-gray-500 font-bold">
                              <Lock size={11} /> LOCKED
                            </span>
                          )}
                        </div>

                        <div className="font-display gold-text text-lg font-bold mb-1">{tier.label}</div>
                        <div className="font-display text-2xl font-black text-white mb-2">
                          {fmt(tier.maxBet)} <span className="text-xs font-normal text-gray-400">CHIPS MAX BET</span>
                        </div>
                        <p className="text-[12px] text-[#a89872]">{tier.desc}</p>
                      </div>

                      <div className="mt-6 pt-3 border-t border-white/5 flex items-center justify-between">
                        <div>
                          <div className="text-[9px] text-[#8a7a4d]">UNLOCK COST</div>
                          <div className="font-display text-sm font-bold text-[#f6e27a]">
                            {fmt(tier.chipsCost)} CHIPS
                          </div>
                        </div>

                        {isUnlocked ? (
                          <button disabled className="rounded px-3 py-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-1">
                            <Check size={12} /> UNLOCKED
                          </button>
                        ) : isNext ? (
                          <button
                            onClick={() => handleBuyPrestigeItem('bet_tier', tier.tier, `bet-tier-${tier.tier}`, tier.chipsCost)}
                            disabled={!canAfford}
                            className={`rounded px-4 py-2 text-[10px] font-bold transition-all ${
                              canAfford ? 'btn-gold shadow-md' : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/10'
                            }`}
                          >
                            UPGRADE ({fmt(tier.chipsCost)})
                          </button>
                        ) : (
                          <button disabled className="rounded px-3 py-1.5 text-[10px] font-bold text-gray-600 bg-black/40 border border-white/5 cursor-not-allowed">
                            LOCKED
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Sub-tab 3: Collectible Badges */}
          {prestigeSubTab === 'badges' && (
            <div>
              <div className="mb-4 text-center">
                <span className="text-[10px] tracking-[0.25em] text-[#f6e27a] font-bold">NAMETAG INSIGNIAS</span>
                <h3 className="font-display gold-text text-xl font-bold mt-1">SPECIAL COLLECTIBLE BADGES</h3>
                <p className="text-[12px] text-[#a89872]">
                  Prestige badges pinned proudly alongside your nametag in the lobby and on the global leaderboard.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {BADGE_TIER_ITEMS.map((badge) => {
                  const isOwned = shop.owned.includes(badge.id) || shop.badge === badge.id
                  const isEquipped = shop.badge === badge.id
                  const isNext = badge.tier === currentBadgeTier + 1
                  const canAfford = balance >= badge.chipsCost

                  return (
                    <div
                      key={badge.id}
                      className={`panel-noir relative flex flex-col justify-between rounded-xl p-4 transition-all ${
                        isEquipped
                          ? 'border-2 border-[#f6e27a] shadow-[0_0_15px_rgba(246,226,122,0.2)] bg-[#1a1403]/80'
                          : isOwned
                          ? 'border border-[#10b981]/40 bg-black/40'
                          : isNext
                          ? 'border border-[#f6e27a]/60 bg-gradient-to-b from-[#1c1505] to-black/80'
                          : 'border border-white/5 bg-black/20 opacity-60'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold tracking-widest text-[#8a7a4d]">
                            TIER {badge.tier} OF 5
                          </span>
                          {isEquipped && (
                            <span className="rounded bg-[#f6e27a]/20 border border-[#f6e27a]/40 px-2 py-0.5 text-[9px] font-bold text-[#f6e27a]">
                              PINNED
                            </span>
                          )}
                          {isOwned && !isEquipped && (
                            <span className="rounded bg-[#10b981]/20 border border-[#10b981]/40 px-2 py-0.5 text-[9px] font-bold text-[#34d399]">
                              OWNED
                            </span>
                          )}
                        </div>

                        <div className="my-3 flex items-center justify-center gap-3">
                          <span className="text-3xl">{badge.icon}</span>
                          <div>
                            <h4 className="font-display gold-text text-base font-bold">{badge.label}</h4>
                            <p className="text-[11px] text-[#a89872]">{badge.desc}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                        <div>
                          <div className="text-[9px] text-[#8a7a4d]">PRICE</div>
                          <div className="font-display text-sm font-bold text-[#f6e27a]">
                            {fmt(badge.chipsCost)} CHIPS
                          </div>
                        </div>

                        {isEquipped ? (
                          <button
                            onClick={() => {
                              sfx.click()
                              shop.setBadge(null)
                              setMessage('Badge unpinned.')
                            }}
                            className="rounded px-3 py-1.5 text-[10px] font-bold text-gray-400 bg-white/5 hover:bg-white/10"
                          >
                            UNPIN
                          </button>
                        ) : isOwned ? (
                          <button
                            onClick={() => {
                              sfx.click()
                              shop.setBadge(badge.id)
                              setMessage(`Pinned ${badge.label} badge!`)
                            }}
                            className="btn-gold rounded px-3 py-1.5 text-[10px] font-bold"
                          >
                            PIN BADGE
                          </button>
                        ) : isNext ? (
                          <button
                            onClick={() => handleBuyPrestigeItem('badge', badge.tier, badge.id, badge.chipsCost)}
                            disabled={!canAfford}
                            className={`rounded px-3.5 py-1.5 text-[10px] font-bold transition-all ${
                              canAfford ? 'btn-gold shadow-md' : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/10'
                            }`}
                          >
                            UNLOCK ({fmt(badge.chipsCost)})
                          </button>
                        ) : (
                          <button disabled className="rounded px-3 py-1.5 text-[10px] font-bold text-gray-600 bg-black/40 border border-white/5 cursor-not-allowed">
                            LOCKED
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ===================== TAB 2: HIGH ROLLER VAULT ===================== */}
      {activeTab === 'lootbox' && (
        <section className="space-y-6">
          <div className="rounded-2xl border-2 border-[#f6e27a]/40 bg-gradient-to-b from-[#1c1505] via-black to-[#0d0901] p-6 shadow-2xl sm:p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#f6e27a]/40 bg-[#2a2105]/60 px-3 py-1 text-[10px] font-bold tracking-widest text-[#f6e27a] uppercase mb-2">
                <Sparkles size={12} /> HIGH ROLLER CIPHER VAULT
              </div>
              <h2 className="font-display gold-text-bright text-2xl font-black tracking-wider sm:text-3xl">
                HIGH ROLLER CIPHER VAULT
              </h2>
              <p className="mt-1 text-[13px] text-[#a89872]">
                Deploy {fmt(LOOT_COST)} chips to crack the armored lock mechanism · Chance for 25,000,000 Chips Apex Jackpot!
              </p>
            </div>

            {/* Visual Vault Reel Display */}
            <div className="relative mx-auto my-6 max-w-md overflow-hidden rounded-2xl border-2 border-[#c9a227]/50 bg-black/90 p-6 text-center shadow-inner">
              <div className="text-[10px] font-bold tracking-[0.25em] text-[#8a7a4d] uppercase mb-3">
                {rollStage === 'idle' && 'READY TO UNLOCK'}
                {rollStage === 'charging' && 'ENGAGING DECRYPTOR...'}
                {rollStage === 'spinning' && 'DECIPHERING ENCRYPTION KEYS...'}
                {rollStage === 'decelerating' && 'ALIGNING CYLINDERS...'}
                {rollStage === 'revealed' && (lootBoxResult?.won ? 'VAULT BREACHED!' : 'ACCESS DENIED')}
              </div>

              <div className="py-6">
                {rollStage === 'revealed' && lootBoxResult ? (
                  lootBoxResult.won ? (
                    <div className="space-y-2">
                      <div className="text-4xl animate-bounce">{lootBoxResult.isJackpot ? '👑' : '🎉'}</div>
                      <div className="font-display text-3xl font-black text-[#f6e27a] tracking-wider">
                        +{fmt(lootBoxResult.chips)} CHIPS
                      </div>
                      <p className="text-xs text-[#a89872]">Credited directly to your balance!</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-4xl">🔒</div>
                      <div className="font-display text-xl font-bold text-gray-400">EMPTY VAULT</div>
                      <p className="text-xs text-gray-500">The locking pins did not align. Spin again!</p>
                    </div>
                  )
                ) : (
                  <div className="font-display text-2xl font-black tracking-wider transition-all">
                    <span className={LOOT_TEASERS[tickerIndex].color}>
                      {LOOT_TEASERS[tickerIndex].label} · {LOOT_TEASERS[tickerIndex].value}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-1 mt-2">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-6 rounded-full transition-all ${
                      i === tickerIndex ? 'bg-[#f6e27a]' : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <button
                onClick={handleSpinLootBox}
                disabled={isLootBoxRolling || balance < LOOT_COST}
                className={`btn-gold min-h-[50px] w-full max-w-sm rounded-xl px-8 text-sm font-black tracking-wider shadow-lg flex items-center justify-center gap-2 ${
                  isLootBoxRolling ? 'opacity-75 cursor-wait' : ''
                }`}
              >
                {isLootBoxRolling ? (
                  <>
                    <RotateCw size={16} className="animate-spin" />
                    DECRYPTING VAULT...
                  </>
                ) : (
                  <>
                    <Package size={16} />
                    UNLOCK VAULT ({fmt(LOOT_COST)} CHIPS)
                  </>
                )}
              </button>
              <div className="text-[11px] text-[#8a7a4d]">
                Odds: 3% Apex Jackpot (up to 25M chips) · 12% High Yield (up to 1.5M) · 35% Modest Drop (up to 250K)
              </div>
            </div>
          </div>

          <DailyGift />
        </section>
      )}

      {/* ===================== TAB 3: TABLE FELTS & CARDS ===================== */}
      {activeTab === 'felts' && (
        <section className="space-y-6">
          <div className="text-center mb-4">
            <span className="text-[10px] tracking-[0.25em] text-[#f6e27a] font-bold">CUSTOMIZE YOUR GAMING TABLES</span>
            <h3 className="font-display gold-text text-xl font-bold mt-1">LUXURY TABLE FELTS &amp; CARD BACKS</h3>
            <p className="text-[12px] text-[#a89872]">
              All items purchased in Chips are permanently owned and can be equipped at any time.
            </p>
          </div>

          {/* Table Felts */}
          <div>
            <h4 className="font-display gold-text text-base font-bold mb-3 border-b border-[#c9a227]/20 pb-2 flex items-center gap-2">
              <Palette size={16} /> TABLE FELTS
            </h4>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CATALOG.filter((i) => i.category === 'felt').map((felt) => {
                const isOwned = shop.owned.includes(felt.id) || felt.price === 0
                const isEquipped = shop.equipped.felt === felt.id
                const canAfford = balance >= felt.price

                return (
                  <div
                    key={felt.id}
                    className={`panel-noir relative flex flex-col justify-between rounded-xl p-4 transition-all ${
                      isEquipped
                        ? 'border-2 border-[#f6e27a] shadow-[0_0_15px_rgba(246,226,122,0.2)] bg-[#1a1403]/80'
                        : isOwned
                        ? 'border border-[#10b981]/40 bg-black/40'
                        : 'border border-white/10 bg-black/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-display gold-text text-sm font-bold">{felt.name}</span>
                        {isEquipped && (
                          <span className="rounded bg-[#f6e27a]/20 border border-[#f6e27a]/40 px-2 py-0.5 text-[9px] font-bold text-[#f6e27a]">
                            EQUIPPED
                          </span>
                        )}
                        {isOwned && !isEquipped && (
                          <span className="rounded bg-[#10b981]/20 border border-[#10b981]/40 px-2 py-0.5 text-[9px] font-bold text-[#34d399]">
                            OWNED
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#a89872]">{felt.desc}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                      <div className="font-display text-sm font-bold text-[#f6e27a]">
                        {felt.price === 0 ? 'FREE' : `${fmt(felt.price)} CHIPS`}
                      </div>

                      {isEquipped ? (
                        <button disabled className="rounded px-3 py-1.5 text-[10px] font-bold text-gray-500 bg-white/5">
                          ACTIVE
                        </button>
                      ) : isOwned ? (
                        <button
                          onClick={() => {
                            sfx.click()
                            shop.equip(felt.id)
                            setMessage(`Table felt updated to ${felt.name}!`)
                          }}
                          className="btn-gold rounded px-3 py-1.5 text-[10px] font-bold"
                        >
                          EQUIP
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const res = shop.buy(felt.id)
                            if (res === 'bought') {
                              sfx.coin()
                              setMessage(`Purchased and equipped ${felt.name}!`)
                            } else if (res === 'poor') {
                              setError('Insufficient chips to purchase this table felt.')
                            }
                          }}
                          disabled={!canAfford}
                          className={`rounded px-3.5 py-1.5 text-[10px] font-bold transition-all ${
                            canAfford ? 'btn-gold shadow-md' : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/10'
                          }`}
                        >
                          BUY ({fmt(felt.price)})
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Card Backs */}
          <div className="pt-4">
            <h4 className="font-display gold-text text-base font-bold mb-3 border-b border-[#c9a227]/20 pb-2 flex items-center gap-2">
              <Palette size={16} /> PLAYING CARD BACKS
            </h4>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CATALOG.filter((i) => i.category === 'back').map((back) => {
                const isOwned = shop.owned.includes(back.id) || back.price === 0
                const isEquipped = shop.equipped.back === back.id
                const canAfford = balance >= back.price

                return (
                  <div
                    key={back.id}
                    className={`panel-noir relative flex flex-col justify-between rounded-xl p-4 transition-all ${
                      isEquipped
                        ? 'border-2 border-[#f6e27a] shadow-[0_0_15px_rgba(246,226,122,0.2)] bg-[#1a1403]/80'
                        : isOwned
                        ? 'border border-[#10b981]/40 bg-black/40'
                        : 'border border-white/10 bg-black/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-display gold-text text-sm font-bold">{back.name}</span>
                        {isEquipped && (
                          <span className="rounded bg-[#f6e27a]/20 border border-[#f6e27a]/40 px-2 py-0.5 text-[9px] font-bold text-[#f6e27a]">
                            EQUIPPED
                          </span>
                        )}
                        {isOwned && !isEquipped && (
                          <span className="rounded bg-[#10b981]/20 border border-[#10b981]/40 px-2 py-0.5 text-[9px] font-bold text-[#34d399]">
                            OWNED
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#a89872]">{back.desc}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                      <div className="font-display text-sm font-bold text-[#f6e27a]">
                        {back.price === 0 ? 'FREE' : `${fmt(back.price)} CHIPS`}
                      </div>

                      {isEquipped ? (
                        <button disabled className="rounded px-3 py-1.5 text-[10px] font-bold text-gray-500 bg-white/5">
                          ACTIVE
                        </button>
                      ) : isOwned ? (
                        <button
                          onClick={() => {
                            sfx.click()
                            shop.equip(back.id)
                            setMessage(`Card deck back updated to ${back.name}!`)
                          }}
                          className="btn-gold rounded px-3 py-1.5 text-[10px] font-bold"
                        >
                          EQUIP
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const res = shop.buy(back.id)
                            if (res === 'bought') {
                              sfx.coin()
                              setMessage(`Purchased and equipped ${back.name}!`)
                            } else if (res === 'poor') {
                              setError('Insufficient chips to purchase this card back.')
                            }
                          }}
                          disabled={!canAfford}
                          className={`rounded px-3.5 py-1.5 text-[10px] font-bold transition-all ${
                            canAfford ? 'btn-gold shadow-md' : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/10'
                          }`}
                        >
                          BUY ({fmt(back.price)})
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Luxuries & Trophies */}
          <div className="pt-4">
            <h4 className="font-display gold-text text-base font-bold mb-3 border-b border-[#c9a227]/20 pb-2 flex items-center gap-2">
              <Crown size={16} /> HIGH ROLLER LUXURIES &amp; TROPHIES
            </h4>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {CATALOG.filter((i) => i.category === 'luxury').map((lux) => {
                const isOwned = shop.owned.includes(lux.id)
                const canAfford = balance >= lux.price

                return (
                  <div
                    key={lux.id}
                    className={`panel-noir relative flex flex-col justify-between rounded-xl p-4 transition-all ${
                      isOwned ? 'border border-[#10b981]/40 bg-black/40' : 'border border-white/10 bg-black/20'
                    }`}
                  >
                    <div>
                      <div className="text-3xl mb-2">{lux.icon}</div>
                      <div className="font-display gold-text text-sm font-bold mb-1">{lux.name}</div>
                      <p className="text-[11px] text-[#a89872]">{lux.desc}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                      <div className="font-display text-xs font-bold text-[#f6e27a]">
                        {fmt(lux.price)} CHIPS
                      </div>

                      {isOwned ? (
                        <span className="rounded bg-[#10b981]/20 border border-[#10b981]/40 px-2 py-0.5 text-[9px] font-bold text-[#34d399] flex items-center gap-1">
                          <Check size={11} /> OWNED
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            const res = shop.buy(lux.id)
                            if (res === 'bought') {
                              sfx.coin()
                              setMessage(`Acquired luxury collectible: ${lux.name}!`)
                            } else if (res === 'poor') {
                              setError('Insufficient chips to acquire this luxury.')
                            }
                          }}
                          disabled={!canAfford}
                          className={`rounded px-3 py-1.5 text-[10px] font-bold transition-all ${
                            canAfford ? 'btn-gold shadow-md' : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/10'
                          }`}
                        >
                          BUY
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===================== TAB 4: PROFILE & COSMETICS ===================== */}
      {activeTab === 'profile' && (
        <section className="space-y-6">
          <div className="panel-noir gold-frame rounded-2xl p-6 sm:p-8 text-center max-w-xl mx-auto">
            <h3 className="font-display gold-text text-xl font-bold mb-2">ACTIVE PLAYER IDENTITY</h3>
            <p className="text-[12px] text-[#a89872] mb-6">
              Your nametag, badge, and active deck styling across Golden Felt.
            </p>

            <div className="my-6 flex justify-center scale-110">
              <Nametag name={activeName ?? 'Player'} tagId={shop.equipped.tag} badge={shop.badge} />
            </div>

            <div className="grid grid-cols-2 gap-4 text-left border-t border-white/10 pt-4 mt-6">
              <div>
                <div className="text-[10px] text-[#8a7a4d] uppercase font-bold">ACTIVE TABLE FELT</div>
                <div className="font-display text-sm font-bold text-[#f6e27a]">
                  {CATALOG.find((c) => c.id === shop.equipped.felt)?.name ?? 'House Felt'}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-[#8a7a4d] uppercase font-bold">ACTIVE CARD BACK</div>
                <div className="font-display text-sm font-bold text-[#f6e27a]">
                  {CATALOG.find((c) => c.id === shop.equipped.back)?.name ?? 'Crimson Lattice'}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
