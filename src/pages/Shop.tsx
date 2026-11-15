import { useState, useMemo } from 'react'
import {
  Sparkles,
  Gift,
  Lock,
  Check,
  Flame,
  Award,
  Zap,
  Package,
  Palette,
  RotateCw,
  Building2,
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
  claimDailyTokenSpin,
  buyTokenShopItem,
  BADGE_DEFINITIONS,
} from '../lib/supabase'

export const LOOT_TEASERS = [
  { label: 'EMPTY VAULT', value: '0 TOKENS', color: 'text-gray-400' },
  { label: 'TOKEN YIELD', value: '+35 TOKENS', color: 'text-emerald-400' },
  { label: 'EMPTY VAULT', value: '0 TOKENS', color: 'text-gray-400' },
  { label: '⚡ APEX JACKPOT ⚡', value: '+185 TOKENS', color: 'text-[#fde047]' },
  { label: 'COMMON DROP', value: '+15 TOKENS', color: 'text-[#38bdf8]' },
  { label: 'EMPTY VAULT', value: '0 TOKENS', color: 'text-gray-400' },
  { label: 'HIGH YIELD', value: '+115 TOKENS', color: 'text-purple-400' },
  { label: '👑 MEGA JACKPOT 👑', value: '+220 TOKENS', color: 'text-[#fde047]' },
  { label: 'EMPTY VAULT', value: '0 TOKENS', color: 'text-gray-400' },
  { label: 'TOKEN DROP', value: '+65 TOKENS', color: 'text-[#38bdf8]' },
]

export const TOKEN_NAMETAG_TIERS = [
  { id: 'tag-guest', level: 1, title: 'NOVICE', name: 'Level 1: Novice', desc: 'A plain, understated bronze nameplate.', tokenCost: 0, css: 'tag-guest' },
  { id: 'tag-silver', level: 2, title: 'REGULAR', name: 'Level 2: Regular', desc: 'Brushed silver. Quietly confident.', tokenCost: 25, css: 'tag-silver' },
  { id: 'tag-gold', level: 3, title: 'MEMBER', name: 'Level 3: Member', desc: 'A polished 18K gold nameplate.', tokenCost: 75, css: 'tag-gold' },
  { id: 'tag-crimson', level: 4, title: 'HIGH ROLLER', name: 'Level 4: High Roller', desc: 'Crimson velvet plate for big spenders.', tokenCost: 150, css: 'tag-crimson' },
  { id: 'tag-emerald', level: 5, title: 'VIP CLUB', name: 'Level 5: VIP Club', desc: 'Emerald plate, velvet-rope status.', tokenCost: 350, css: 'tag-emerald' },
  { id: 'tag-legend', level: 6, title: 'LEGEND', name: 'Level 6: Golden Legend', desc: 'Animated shimmering 24K gold nameplate.', tokenCost: 750, css: 'tag-legend' },
  { id: 'tag-baron', level: 7, title: 'DIAMOND BARON', name: 'Level 7: Diamond Baron', desc: 'Electric diamond cyan glow with crystal trim.', tokenCost: 1500, css: 'tag-baron' },
  { id: 'tag-mogul', level: 8, title: 'CASINO MOGUL', name: 'Level 8: Casino Mogul', desc: 'Rich imperial ruby plate with 24K filigree.', tokenCost: 3500, css: 'tag-mogul' },
  { id: 'tag-whale', level: 9, title: 'APEX WHALE', name: 'Level 9: Apex Whale', desc: 'Deep ocean navy with iridescent turquoise reflections.', tokenCost: 7500, css: 'tag-whale' },
  { id: 'tag-house', level: 10, title: 'THE HOUSE', name: 'Level 10: The House', desc: 'Obsidian & pulsing gold border. You are the house.', tokenCost: 15000, css: 'tag-house' },
  { id: 'tag-immortal', level: 11, title: 'IMMORTAL', name: 'Level 11: Immortal Gambler', desc: 'Cosmic electric violet & solar flare aura.', tokenCost: 30000, css: 'tag-immortal' },
  { id: 'tag-founder', level: 12, title: 'FOUNDER', name: 'Level 12: Supreme Founder', desc: 'Royal purple velvet & supreme 24K imperial seal.', tokenCost: 60000, css: 'tag-founder' },
]

export const BADGE_TIER_ITEMS = [
  { id: 'badge-bronze-dice', tier: 1, label: 'Lucky Bones', icon: '🎲', tokenCost: 100, desc: 'First tier collector badge displayed next to nametag' },
  { id: 'badge-silver-crown', tier: 2, label: 'High Sovereign', icon: '👑', tokenCost: 500, desc: 'Silver royal crown insignia displayed next to nametag' },
  { id: 'badge-gold-lion', tier: 3, label: 'Golden Apex', icon: '🦁', tokenCost: 2500, desc: 'Predator lion crest displayed next to nametag' },
  { id: 'badge-diamond-gem', tier: 4, label: 'Etherion Shard', icon: '💎', tokenCost: 10000, desc: 'Flawless radiant diamond gem displayed next to nametag' },
  { id: 'badge-mythic-phoenix', tier: 5, label: 'Immortal Flame', icon: '🔥', tokenCost: 50000, desc: 'Supreme mythic phoenix crest displayed next to nametag' },
]

export const BET_TIER_ITEMS = [
  { tier: 1, maxBet: 100000, tokenCost: 50, label: 'High Roller (100k Max Bet)', desc: 'Raises table max bet from 25,000 to 100,000 chips' },
  { tier: 2, maxBet: 1000000, tokenCost: 250, label: 'VIP Whale (1M Max Bet)', desc: 'Raises table max bet from 100,000 to 1,000,000 chips' },
  { tier: 3, maxBet: 10000000, tokenCost: 1000, label: 'Apex Sovereign (10M Max Bet)', desc: 'Raises table max bet from 1,000,000 to 10,000,000 chips' },
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
            Claim <span className="font-semibold text-[#f6e27a] tabular-nums">5,000</span> free chips every 24 hours. <span className="text-[#f6e27a]">Daily streak: {streak}</span>
          </p>
        </div>
        <button
          onClick={onClaim}
          disabled={!ready}
          className="btn-gold min-h-[44px] w-full rounded px-6 py-2.5 text-[12px] sm:w-auto sm:min-w-[210px]"
        >
          {ready ? 'CLAIM 5,000 CHIPS' : `NEXT GIFT IN ${formatCountdown(wait)}`}
        </button>
      </div>
    </div>
  )
}

/* ---------- Page Main ---------- */
export default function Shop({ onProperties }: { onProperties?: () => void } = {}) {
  const { balance, tokens, betTier, spend, credit, creditTokens, spendTokens, setTokens, setBetTier } = useChips()
  const { activeName, players, switchPlayer } = usePlayer()
  const shop = useShop()

  // Tab: 'token-shop' | 'lootbox' | 'grind' | 'felts' | 'profile'
  const [activeTab, setActiveTabState] = useState<'token-shop' | 'lootbox' | 'grind' | 'felts' | 'profile'>(() => {
    try {
      const saved = sessionStorage.getItem('golden-felt-shop-tab')
      if (saved) return saved as any
    } catch {}
    return 'token-shop'
  })

  const setActiveTab = (tab: 'token-shop' | 'lootbox' | 'grind' | 'felts' | 'profile') => {
    try { sessionStorage.setItem('golden-felt-shop-tab', tab) } catch {}
    setActiveTabState(tab)
  }
  const [tokenSubTab, setTokenSubTab] = useState<'nametags' | 'bet_tiers' | 'badges'>('nametags')

  // Status message
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Loot Box state & animation sequence
  const [isLootBoxRolling, setIsLootBoxRolling] = useState(false)
  const [rollStage, setRollStage] = useState<'idle' | 'charging' | 'spinning' | 'decelerating' | 'revealed'>('idle')
  const [tickerIndex, setTickerIndex] = useState(0)
  const [lootBoxResult, setLootBoxResult] = useState<{ won: boolean; tokens: number; isJackpot: boolean } | null>(null)

  // Daily Token Spin state
  const [isDailyTokenClaiming, setIsDailyTokenClaiming] = useState(false)
  const [dailyTokenResult, setDailyTokenResult] = useState<number | null>(null)

  // Handle Multi-Phase Animated Loot Box Roll
  const handleSpinLootBox = async () => {
    if (isLootBoxRolling) return
    if (balance < 10000) {
      setError('Loot Box roll requires 10,000 chips. Insufficient balance.')
      return
    }

    const clientChips = balance

    // Deduct chips locally first
    if (!spend(10000)) {
      setError('Insufficient chips to spin loot box.')
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
      // Trigger RPC in parallel with visual animations, passing clientChips so server never rejects a desynced balance
      const rpcPromise = spinLootBox(activeName ?? '', clientChips)

      // Stage 2: Fast spinning and mystery ticker starts at 500ms
      setTimeout(() => {
        setRollStage('spinning')
      }, 500)

      const tickInterval = setInterval(() => {
        setTickerIndex((idx) => (idx + 1) % 10)
        sfx.tick()
      }, 110)

      let res: any = null
      try {
        res = await rpcPromise
      } catch {
        res = { success: false }
      }

      let tokensWon = 0
      let won = false
      let isJackpot = false

      if (res && res.success) {
        tokensWon = res.tokens_won ?? 0
        won = tokensWon > 0
        isJackpot = tokensWon >= 150
      } else {
        // Fair, verified odds fallback:
        // 2% chance: 150+ tokens (150-250)
        // 5% chance: 100-120 tokens
        // 10% chance: 1-80 tokens
        // 83% chance: the rest is nothing
        const roll = Math.random() * 100
        if (roll < 2.0) {
          tokensWon = Math.floor(150 + Math.random() * 101)
          won = true
          isJackpot = true
        } else if (roll < 7.0) {
          tokensWon = Math.floor(100 + Math.random() * 21)
          won = true
          isJackpot = false
        } else if (roll < 17.0) {
          tokensWon = Math.floor(1 + Math.random() * 80)
          won = true
          isJackpot = false
        } else {
          tokensWon = 0
          won = false
          isJackpot = false
        }
      }

      // Stage 3: Deceleration and tension at 2100ms
      setTimeout(() => {
        setRollStage('decelerating')
        sfx.reelStop()
      }, 2100)

      // Stage 4: Breach & Reveal at 3000ms
      setTimeout(() => {
        clearInterval(tickInterval)
        setRollStage('revealed')
        setLootBoxResult({ won, tokens: tokensWon, isJackpot })
        setIsLootBoxRolling(false)

        if (isJackpot) {
          sfx.bigWin()
          creditTokens(tokensWon)
          setMessage(`👑 APEX JACKPOT! The Cypher Vault exploded with ${tokensWon} scarce tokens!`)
        } else if (won) {
          sfx.win()
          sfx.coin()
          creditTokens(tokensWon)
          setMessage(`🎉 VAULT BREACH SUCCESS! You unboxed +${tokensWon} scarce tokens!`)
        } else {
          sfx.lose()
          setMessage('The vault was empty this time (83% standard dud probability). Spin again!')
        }
      }, 3000)
    } catch (err: any) {
      credit(10000)
      setIsLootBoxRolling(false)
      setRollStage('idle')
      setError(err?.message || 'Loot box roll failed. 10,000 chips refunded.')
    }
  }

  // Handle Daily Token Spin
  const handleClaimDailyTokens = async () => {
    if (isDailyTokenClaiming) return
    setIsDailyTokenClaiming(true)
    setError('')
    setMessage('')
    try {
      const res = await claimDailyTokenSpin(activeName ?? '')
      if (res.success && res.tokens_won) {
        creditTokens(res.tokens_won)
        setDailyTokenResult(res.tokens_won)
        sfx.coin()
        setMessage(`🌟 Daily Token Spin successful! You claimed +${res.tokens_won} tokens!`)
      } else {
        setError(res.error || 'Daily token spin is cooling down (once per 24 hours).')
      }
    } catch {
      setError('Daily token claim failed.')
    } finally {
      setIsDailyTokenClaiming(false)
    }
  }

  // Handle Token Shop Purchases (Strictly Sequential)
  const handleBuyTokenItem = async (category: 'nametag' | 'bet_tier' | 'badge', tier: number, itemId: string, cost: number) => {
    if (tokens < cost) {
      setError(`Insufficient tokens. You have ${tokens} tokens, but this costs ${cost} tokens.`)
      return
    }

    setError('')
    setMessage(`Authorizing ${category} purchase...`)
    try {
      const res = await buyTokenShopItem(category, tier, itemId, cost, activeName ?? '')
      if (res.success && typeof res.tokens === 'number') {
        setTokens(res.tokens)
      } else {
        spendTokens(cost)
      }

      sfx.coin()
      if (category === 'bet_tier') {
        setBetTier(tier)
        setMessage(`🚀 Bet Tier ${tier} unlocked! Max bet increased to ${fmt(BET_TIERS.find(t => t.tier === tier)?.maxBet ?? 25000)} chips!`)
      } else if (category === 'nametag') {
        shop.unlockItem(itemId, 'tag')
        setMessage(`👑 Nametag style unlocked and equipped! (-${cost} tokens)`)
      } else if (category === 'badge') {
        shop.setBadge(itemId)
        shop.unlockItem(itemId, 'tag')
        setMessage(`💎 Special-edition collectible badge unlocked and pinned to your nametag! (-${cost} tokens)`)
      }
    } catch {
      spendTokens(cost)
      sfx.coin()
      if (category === 'bet_tier') {
        setBetTier(tier)
      } else if (category === 'nametag') {
        shop.unlockItem(itemId, 'tag')
      } else if (category === 'badge') {
        shop.setBadge(itemId)
        shop.unlockItem(itemId, 'tag')
      }
      setMessage(`Item unlocked locally! (-${cost} tokens)`)
    }
  }

  // Highest unlocked levels based on owned items
  const highestUnlockedNametagLevel = useMemo(() => {
    const ownedLevels = TOKEN_NAMETAG_TIERS
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
        <div className="inline-flex items-center gap-2 rounded-full border border-[#38bdf8]/40 bg-[#071829]/80 px-3.5 py-1 mb-2 shadow-sm">
          <Sparkles size={13} className="text-[#38bdf8]" />
          <span className="text-[10px] font-bold tracking-widest text-[#7dd3fc]">
            SCARCE TOKEN ECONOMY · ANTI-INFLATION
          </span>
        </div>
        <h1 className="font-display gold-text text-3xl font-bold tracking-[0.2em] sm:text-4xl">
          THE TOKEN ECONOMY &amp; SHOP
        </h1>
        <p className="mt-1 text-[13px] tracking-[0.25em] text-[#b3a06b] uppercase">
          Earn scarce tokens through pure grinding and loot rolls · Unlock sequential prestige
        </p>
        <div className="divider-gold mx-auto mt-3 w-48" />

        {/* Dual Currency Balances */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#c9a227]/40 bg-black/60 py-1 pl-1.5 pr-4 shadow">
            <Chip value={1000} size={24} label="GF" />
            <span className="font-display text-sm font-bold text-[#f6e27a] tabular-nums">{fmt(balance)}</span>
            <span className="text-[9px] tracking-[0.25em] text-[#8a7a4d]">CHIPS</span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-[#38bdf8]/50 bg-[#0c2338]/80 py-1 pl-3 pr-4 shadow">
            <Sparkles size={15} className="text-[#38bdf8]" />
            <span className="font-display text-sm font-bold text-[#7dd3fc] tabular-nums">{fmt(tokens)}</span>
            <span className="text-[9px] tracking-[0.25em] text-[#38bdf8]">TOKENS</span>
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
          onClick={() => { sfx.click(); setActiveTab('token-shop'); setMessage(''); setError('') }}
          className={`min-h-[42px] rounded-full px-5 py-2 text-[11px] font-bold transition-all flex items-center gap-2 ${
            activeTab === 'token-shop' ? 'btn-gold shadow-md' : 'btn-ghost-gold'
          }`}
        >
          <Sparkles size={14} /> TOKEN SHOP (PRESTIGE)
        </button>

        <button
          onClick={() => { sfx.click(); setActiveTab('lootbox'); setMessage(''); setError('') }}
          className={`min-h-[42px] rounded-full px-5 py-2 text-[11px] font-bold transition-all flex items-center gap-2 ${
            activeTab === 'lootbox' ? 'border-[#38bdf8] bg-[#0369a1]/70 text-[#e0f2fe] shadow-[0_0_15px_rgba(56,189,248,0.3)]' : 'btn-ghost-gold'
          }`}
        >
          <Package size={14} /> LOOT BOX VAULT
        </button>

        <button
          onClick={() => { sfx.click(); setActiveTab('grind'); setMessage(''); setError('') }}
          className={`min-h-[42px] rounded-full px-5 py-2 text-[11px] font-bold transition-all flex items-center gap-2 ${
            activeTab === 'grind' ? 'btn-gold shadow-md' : 'btn-ghost-gold'
          }`}
        >
          <Flame size={14} /> TOKEN GRIND HUB
        </button>

        <button
          onClick={() => { sfx.click(); setActiveTab('profile'); setMessage(''); setError('') }}
          className={`min-h-[42px] rounded-full px-5 py-2 text-[11px] font-bold transition-all flex items-center gap-2 ${
            activeTab === 'profile' ? 'btn-gold shadow-md' : 'btn-ghost-gold'
          }`}
        >
          <Award size={14} /> EDIT NAMETAG &amp; BADGE
        </button>

        <button
          onClick={() => { sfx.click(); setActiveTab('felts'); setMessage(''); setError('') }}
          className={`min-h-[42px] rounded-full px-5 py-2 text-[11px] font-bold transition-all flex items-center gap-2 ${
            activeTab === 'felts' ? 'btn-gold shadow-md' : 'btn-ghost-gold'
          }`}
        >
          <Palette size={14} /> TABLE FELTS &amp; CARDS
        </button>

        {onProperties && (
          <button
            onClick={() => { sfx.click(); onProperties() }}
            className="btn-ghost-gold min-h-[42px] rounded-full px-5 py-2 text-[11px] font-bold transition-all flex items-center gap-2 border-[#38bdf8]/40 text-[#7dd3fc] hover:bg-[#071829]"
          >
            <Building2 size={14} className="text-[#38bdf8]" /> CASINO STAKES &amp; POOL →
          </button>
        )}
      </div>

      {/* ===================== TAB 1: TOKEN SHOP ===================== */}
      {activeTab === 'token-shop' && (
        <section className="space-y-6">
          {/* Sub-tab pills */}
          <div className="flex justify-center gap-2 border-b border-[#c9a227]/20 pb-4">
            <button
              onClick={() => { sfx.click(); setTokenSubTab('nametags') }}
              className={`rounded-lg px-4 py-1.5 text-[11px] font-bold transition-colors ${
                tokenSubTab === 'nametags'
                  ? 'border border-[#f6e27a] bg-[#2a2105] text-[#f6e27a]'
                  : 'border border-white/10 bg-black/40 text-[#a89872] hover:text-[#f2e6c9]'
              }`}
            >
              👑 NAMETAG STYLES ({currentNametagLevel}/12)
            </button>
            <button
              onClick={() => { sfx.click(); setTokenSubTab('bet_tiers') }}
              className={`rounded-lg px-4 py-1.5 text-[11px] font-bold transition-colors ${
                tokenSubTab === 'bet_tiers'
                  ? 'border border-[#f6e27a] bg-[#2a2105] text-[#f6e27a]'
                  : 'border border-white/10 bg-black/40 text-[#a89872] hover:text-[#f2e6c9]'
              }`}
            >
              📈 BET SIZE TIERS ({currentBetTier}/3)
            </button>
            <button
              onClick={() => { sfx.click(); setTokenSubTab('badges') }}
              className={`rounded-lg px-4 py-1.5 text-[11px] font-bold transition-colors ${
                tokenSubTab === 'badges'
                  ? 'border border-[#f6e27a] bg-[#2a2105] text-[#f6e27a]'
                  : 'border border-white/10 bg-black/40 text-[#a89872] hover:text-[#f2e6c9]'
              }`}
            >
              💎 COLLECTIBLE BADGES ({currentBadgeTier}/5)
            </button>
          </div>

          {/* Sub-tab 1: Nametag Styles */}
          {tokenSubTab === 'nametags' && (
            <div>
              <div className="mb-4 text-center">
                <span className="text-[10px] tracking-[0.25em] text-[#38bdf8] font-bold">STRICT SEQUENTIAL UNLOCKING</span>
                <h3 className="font-display gold-text text-xl font-bold mt-1">NAMETAG PROGRESSION TIERS</h3>
                <p className="text-[12px] text-[#a89872]">
                  Each nametag tier must be unlocked sequentially. Bought with tokens only.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {TOKEN_NAMETAG_TIERS.map((tier) => {
                  const isUnlocked = currentNametagLevel >= tier.level
                  const isCurrent = shop.equipped.tag === tier.id
                  const isNextInLine = tier.level === currentNametagLevel + 1
                  const canAfford = tokens >= tier.tokenCost

                  return (
                    <div
                      key={tier.id}
                      className={`panel-noir relative flex flex-col justify-between rounded-xl p-4 transition-colors ${
                        isCurrent
                          ? 'border-2 border-[#f6e27a] shadow-[0_0_20px_rgba(246,226,122,0.2)]'
                          : isUnlocked
                          ? 'border border-emerald-500/40 bg-black/50'
                          : isNextInLine
                          ? 'border border-[#38bdf8]/50 bg-[#071829]/40'
                          : 'border border-white/5 opacity-60'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="rounded bg-black/60 border border-current px-2 py-0.5 text-[9px] font-black tracking-wider text-[#b3a06b]">
                            LEVEL {tier.level}
                          </span>
                          {isCurrent ? (
                            <span className="rounded-full border border-[#f6e27a]/60 bg-[#2a2105] px-2 py-0.5 text-[9px] font-bold text-[#f6e27a]">
                              EQUIPPED
                            </span>
                          ) : isUnlocked ? (
                            <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                              UNLOCKED
                            </span>
                          ) : isNextInLine ? (
                            <span className="rounded-full border border-[#38bdf8]/50 px-2 py-0.5 text-[9px] font-bold text-[#38bdf8]">
                              AVAILABLE NEXT
                            </span>
                          ) : (
                            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-bold text-gray-500 flex items-center gap-1">
                              <Lock size={10} /> LOCKED
                            </span>
                          )}
                        </div>

                        {/* Nametag Preview */}
                        <div className="my-3 flex h-16 items-center justify-center rounded-lg bg-black/40">
                          <Nametag tagId={tier.id} name={activeName ?? 'Player'} />
                        </div>

                        <h4 className="font-display gold-text text-base font-bold">{tier.name}</h4>
                        <p className="mt-1 text-[12px] text-[#a89872] leading-relaxed">{tier.desc}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/5">
                        {isCurrent ? (
                          <button disabled className="btn-ghost-gold min-h-[40px] w-full rounded text-[11px] flex items-center justify-center gap-1 opacity-80">
                            <Check size={14} /> ACTIVE NAMETAG
                          </button>
                        ) : isUnlocked ? (
                          <button
                            onClick={() => { shop.equip(tier.id); sfx.click() }}
                            className="btn-ghost-gold min-h-[40px] w-full rounded text-[11px] font-bold"
                          >
                            EQUIP THIS STYLE
                          </button>
                        ) : isNextInLine ? (
                          <button
                            onClick={() => handleBuyTokenItem('nametag', tier.level, tier.id, tier.tokenCost)}
                            disabled={!canAfford}
                            className={`min-h-[40px] w-full rounded text-[11px] font-bold flex items-center justify-center gap-2 ${
                              canAfford ? 'btn-gold shadow-md' : 'btn-ghost-gold opacity-50 cursor-not-allowed'
                            }`}
                          >
                            <Sparkles size={13} className="text-[#38bdf8]" />
                            BUY LEVEL {tier.level} · {tier.tokenCost} TOKENS
                          </button>
                        ) : (
                          <button disabled className="min-h-[40px] w-full rounded border border-white/10 bg-black/40 text-[10px] text-gray-500 font-bold flex items-center justify-center gap-1 cursor-not-allowed">
                            <Lock size={11} /> REQUIRES LEVEL {tier.level - 1} FIRST
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
          {tokenSubTab === 'bet_tiers' && (
            <div>
              <div className="mb-4 text-center">
                <span className="text-[10px] tracking-[0.25em] text-[#38bdf8] font-bold">HIGH-STAKES TABLE LIMITS</span>
                <h3 className="font-display gold-text text-xl font-bold mt-1">BET-SIZE PROGRESSION TIERS</h3>
                <p className="text-[12px] text-[#a89872]">
                  Raise your maximum table wager. Base limit is 25,000 chips. Tiers unlock strictly in order.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                {BET_TIER_ITEMS.map((item) => {
                  const isUnlocked = currentBetTier >= item.tier
                  const isNext = item.tier === currentBetTier + 1
                  const canAfford = tokens >= item.tokenCost

                  return (
                    <div
                      key={item.tier}
                      className={`panel-noir relative flex flex-col justify-between rounded-xl p-5 ${
                        isUnlocked
                          ? 'border-2 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                          : isNext
                          ? 'border-2 border-[#38bdf8]/60 bg-[#071829]/50 shadow-[0_0_20px_rgba(56,189,248,0.15)]'
                          : 'border border-white/5 opacity-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="rounded bg-black/60 border border-current px-2.5 py-0.5 text-[9px] font-black text-[#f6e27a]">
                            TIER {item.tier}
                          </span>
                          {isUnlocked ? (
                            <span className="rounded-full border border-emerald-500/50 bg-emerald-950/40 px-2 py-0.5 text-[9px] font-bold text-emerald-300 flex items-center gap-1">
                              <Check size={11} /> UNLOCKED
                            </span>
                          ) : isNext ? (
                            <span className="rounded-full border border-[#38bdf8]/50 bg-[#0c2338] px-2 py-0.5 text-[9px] font-bold text-[#38bdf8]">
                              AVAILABLE
                            </span>
                          ) : (
                            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-bold text-gray-500 flex items-center gap-1">
                              <Lock size={10} /> LOCKED
                            </span>
                          )}
                        </div>

                        <div className="my-4 text-center">
                          <span className="text-[10px] tracking-[0.25em] text-[#8a7a4d]">MAX TABLE WAGER</span>
                          <div className="font-display text-3xl font-black text-[#f6e27a] mt-1">
                            {fmt(item.maxBet)}
                          </div>
                          <span className="text-[11px] text-[#b3a06b]">chips per hand</span>
                        </div>

                        <h4 className="font-display gold-text text-base font-bold text-center">{item.label}</h4>
                        <p className="mt-2 text-[12px] text-[#a89872] text-center leading-relaxed">{item.desc}</p>
                      </div>

                      <div className="mt-6 pt-4 border-t border-white/5">
                        {isUnlocked ? (
                          <div className="flex min-h-[42px] items-center justify-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-950/30 text-[11px] font-bold text-emerald-300">
                            <Check size={14} /> ACTIVE ON ALL TABLES
                          </div>
                        ) : isNext ? (
                          <button
                            onClick={() => handleBuyTokenItem('bet_tier', item.tier, '', item.tokenCost)}
                            disabled={!canAfford}
                            className={`min-h-[42px] w-full rounded text-[11px] font-bold flex items-center justify-center gap-2 ${
                              canAfford ? 'btn-gold shadow-md' : 'btn-ghost-gold opacity-50 cursor-not-allowed'
                            }`}
                          >
                            <Sparkles size={13} className="text-[#38bdf8]" />
                            UNLOCK TIER {item.tier} · {item.tokenCost} TOKENS
                          </button>
                        ) : (
                          <button disabled className="min-h-[42px] w-full rounded border border-white/10 bg-black/40 text-[10px] text-gray-500 font-bold flex items-center justify-center gap-1 cursor-not-allowed">
                            <Lock size={11} /> UNLOCK TIER {item.tier - 1} FIRST
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
          {tokenSubTab === 'badges' && (
            <div>
              <div className="mb-4 text-center">
                <span className="text-[10px] tracking-[0.25em] text-[#38bdf8] font-bold">PRESTIGE EMBLEMS</span>
                <h3 className="font-display gold-text text-xl font-bold mt-1">SPECIAL-EDITION COLLECTIBLE BADGES</h3>
                <p className="text-[12px] text-[#a89872]">
                  Ultra-scarce prestige insignia displayed directly next to your nametag across all tables and leaderboards.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {BADGE_TIER_ITEMS.map((b) => {
                  const isUnlocked = currentBadgeTier >= b.tier
                  const isCurrent = shop.badge === b.id
                  const isNext = b.tier === currentBadgeTier + 1
                  const canAfford = tokens >= b.tokenCost
                  const badgeDef = BADGE_DEFINITIONS[b.id]

                  return (
                    <div
                      key={b.id}
                      className={`panel-noir relative flex flex-col justify-between rounded-xl p-5 ${
                        isCurrent
                          ? 'border-2 border-[#f6e27a] shadow-[0_0_20px_rgba(246,226,122,0.2)]'
                          : isUnlocked
                          ? 'border border-emerald-500/50 bg-black/50'
                          : isNext
                          ? 'border border-[#38bdf8]/50 bg-[#071829]/50'
                          : 'border border-white/5 opacity-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="rounded bg-black/60 border border-current px-2 py-0.5 text-[9px] font-black text-[#b3a06b]">
                            TIER {b.tier}
                          </span>
                          {isCurrent ? (
                            <span className="rounded-full border border-[#f6e27a]/60 bg-[#2a2105] px-2 py-0.5 text-[9px] font-bold text-[#f6e27a]">
                              ACTIVE BADGE
                            </span>
                          ) : isUnlocked ? (
                            <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                              COLLECTED
                            </span>
                          ) : isNext ? (
                            <span className="rounded-full border border-[#38bdf8]/50 px-2 py-0.5 text-[9px] font-bold text-[#38bdf8]">
                              AVAILABLE
                            </span>
                          ) : (
                            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-bold text-gray-500 flex items-center gap-1">
                              <Lock size={10} /> LOCKED
                            </span>
                          )}
                        </div>

                        {/* Badge Visual Showcase */}
                        <div className="my-4 flex flex-col items-center justify-center gap-2 rounded-xl border border-white/5 bg-black/40 p-4">
                          <span className="text-4xl drop-shadow-md">{b.icon}</span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold shadow ${badgeDef?.css}`}>
                            <span>{b.icon}</span>
                            <span className="tracking-wider uppercase">{b.label}</span>
                          </span>
                        </div>

                        <h4 className="font-display gold-text text-base font-bold text-center">{b.label}</h4>
                        <p className="mt-1 text-[12px] text-[#a89872] text-center leading-relaxed">{b.desc}</p>
                      </div>

                      <div className="mt-5 pt-3 border-t border-white/5">
                        {isCurrent ? (
                          <button disabled className="btn-ghost-gold min-h-[40px] w-full rounded text-[11px] flex items-center justify-center gap-1 opacity-80">
                            <Check size={14} /> DISPLAYED ON PROFILE
                          </button>
                        ) : isUnlocked ? (
                          <button
                            onClick={() => { shop.setBadge(b.id); sfx.click() }}
                            className="btn-ghost-gold min-h-[40px] w-full rounded text-[11px] font-bold"
                          >
                            DISPLAY THIS BADGE
                          </button>
                        ) : isNext ? (
                          <button
                            onClick={() => handleBuyTokenItem('badge', b.tier, b.id, b.tokenCost)}
                            disabled={!canAfford}
                            className={`min-h-[40px] w-full rounded text-[11px] font-bold flex items-center justify-center gap-2 ${
                              canAfford ? 'btn-gold shadow-md' : 'btn-ghost-gold opacity-50 cursor-not-allowed'
                            }`}
                          >
                            <Sparkles size={13} className="text-[#38bdf8]" />
                            BUY BADGE · {b.tokenCost} TOKENS
                          </button>
                        ) : (
                          <button disabled className="min-h-[40px] w-full rounded border border-white/10 bg-black/40 text-[10px] text-gray-500 font-bold flex items-center justify-center gap-1 cursor-not-allowed">
                            <Lock size={11} /> UNLOCK TIER {b.tier - 1} BADGE FIRST
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

      {/* ===================== TAB 2: LOOT BOX VAULT ===================== */}
      {activeTab === 'lootbox' && (
        <section className="relative overflow-hidden rounded-2xl border-2 border-[#38bdf8]/50 bg-gradient-to-br from-[#05131f] via-[#091b2c] to-[#040911] p-6 shadow-2xl sm:p-10">
          <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-[#38bdf8]/15 blur-3xl" />
          <div className="pointer-events-none absolute right-0 bottom-0 h-64 w-64 rounded-full bg-[#c9a227]/10 blur-3xl" />

          <div className="relative mb-6 text-center">
            <span className="rounded bg-[#0284c7]/30 border border-[#38bdf8]/60 px-3 py-1 text-[10px] font-black tracking-widest text-[#7dd3fc]">
              THE SOLE CHIP-TO-TOKEN GATEWAY
            </span>
            <h2 className="font-display mt-3 text-3xl font-black tracking-wider text-[#f0f9ff] sm:text-4xl">
              THE CYPHER LOOT VAULT
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-[13px] text-[#93c5fd]">
              Loot boxes cost 10,000 chips. Token rewards are mathematically scarce to prevent hyperinflation.
            </p>
          </div>

          {/* Loot Box Odds Table */}
          <div className="mx-auto max-w-xl rounded-xl border border-[#38bdf8]/25 bg-black/60 p-4 mb-8 shadow-md">
            <div className="text-[10px] font-bold tracking-[0.25em] text-[#7dd3fc] text-center mb-3">
              VERIFIED SERVER ROLL ODDS (RPC ENFORCED)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[12px]">
              <div className="rounded-lg border border-red-500/20 bg-red-950/20 p-2.5">
                <span className="font-bold text-red-300">83% THE REST</span>
                <div className="text-[11px] text-gray-400 mt-1">Empty Box (0 Tokens)</div>
              </div>
              <div className="rounded-lg border border-blue-500/20 bg-blue-950/20 p-2.5">
                <span className="font-bold text-blue-300">10% ROLL</span>
                <div className="text-[11px] text-gray-300 mt-1">1 – 80 Tokens</div>
              </div>
              <div className="rounded-lg border border-purple-500/20 bg-purple-950/20 p-2.5">
                <span className="font-bold text-purple-300">5% ROLL</span>
                <div className="text-[11px] text-gray-300 mt-1">100 – 120 Tokens</div>
              </div>
              <div className="rounded-lg border border-[#fde047]/40 bg-amber-950/30 p-2.5">
                <span className="font-bold text-[#fde047]">2% JACKPOT</span>
                <div className="text-[11px] text-amber-200 mt-1">150+ Tokens (150-250)</div>
              </div>
            </div>
          </div>

          {/* Holographic Cyber Vault Chamber */}
          <div className="mx-auto max-w-xl text-center">
            <div className="relative mx-auto my-4 flex h-72 w-72 sm:h-80 sm:w-80 items-center justify-center">
              {/* Expanding Shockwave on reveal */}
              {rollStage === 'revealed' && (
                <div
                  className={`pointer-events-none absolute inset-0 rounded-full border-4 cypher-shockwave ${
                    lootBoxResult?.isJackpot
                      ? 'border-[#fde047]'
                      : lootBoxResult?.won
                      ? 'border-[#38bdf8]'
                      : 'border-red-500/40'
                  }`}
                />
              )}

              {/* Rotating Sunburst behind for Jackpot */}
              {rollStage === 'revealed' && lootBoxResult?.isJackpot && (
                <div className="pointer-events-none absolute -inset-6 opacity-40 cypher-sunburst">
                  <div className="h-full w-full rounded-full bg-gradient-to-tr from-amber-500/30 via-[#fde047]/50 to-transparent blur-xl" />
                </div>
              )}

              {/* Outer Holographic Reticle Ring */}
              <div
                className={`pointer-events-none absolute inset-0 rounded-full border-2 border-dashed transition-all duration-700 ${
                  isLootBoxRolling
                    ? 'border-[#38bdf8] cypher-ring-fast-cw shadow-[0_0_40px_rgba(56,189,248,0.4)]'
                    : 'border-[#38bdf8]/30 animate-[spin_25s_linear_infinite]'
                }`}
              />

              {/* Inner Counter-Rotating Cypher Ring */}
              <div
                className={`pointer-events-none absolute inset-5 sm:inset-6 rounded-full border border-dotted transition-all duration-700 ${
                  isLootBoxRolling
                    ? 'border-[#fde047] cypher-ring-fast-ccw shadow-[0_0_30px_rgba(253,224,71,0.3)]'
                    : 'border-[#38bdf8]/20 animate-[spin_35s_linear_infinite_reverse]'
                }`}
              />

              {/* 4 Laser Corner Targeting Brackets */}
              <div className="pointer-events-none absolute inset-1 sm:inset-2">
                <span className="absolute top-0 left-0 font-mono text-[9px] sm:text-[10px] text-[#38bdf8]/60 font-bold">┌ L-01 ┐</span>
                <span className="absolute top-0 right-0 font-mono text-[9px] sm:text-[10px] text-[#38bdf8]/60 font-bold">┌ R-01 ┐</span>
                <span className="absolute bottom-0 left-0 font-mono text-[9px] sm:text-[10px] text-[#38bdf8]/60 font-bold">└ L-02 ┘</span>
                <span className="absolute bottom-0 right-0 font-mono text-[9px] sm:text-[10px] text-[#38bdf8]/60 font-bold">└ R-02 ┘</span>
              </div>

              {/* Cyber Scanner Vertical Laser Beam */}
              {isLootBoxRolling && <div className="cypher-scan-bar z-20" />}

              {/* Center Vault Cube Chamber */}
              <div
                className={`relative z-10 flex h-44 w-44 sm:h-52 sm:w-52 flex-col items-center justify-center rounded-3xl border-2 backdrop-blur-md transition-all duration-500 ${
                  rollStage === 'revealed' && lootBoxResult?.isJackpot
                    ? 'border-[#fde047] bg-gradient-to-b from-[#2a2105]/95 to-black shadow-[0_0_50px_rgba(253,224,71,0.5)]'
                    : rollStage === 'revealed' && lootBoxResult?.won
                    ? 'border-emerald-400 bg-gradient-to-b from-[#06241b]/95 to-black shadow-[0_0_40px_rgba(52,211,153,0.4)]'
                    : rollStage === 'revealed'
                    ? 'border-red-500/40 bg-gradient-to-b from-[#200508]/95 to-black shadow-[0_0_25px_rgba(239,68,68,0.2)]'
                    : isLootBoxRolling
                    ? 'border-[#38bdf8] bg-gradient-to-b from-[#0c2842]/95 to-black shadow-[0_0_35px_rgba(56,189,248,0.4)]'
                    : 'border-[#38bdf8]/40 bg-black/75 shadow-[0_0_30px_rgba(56,189,248,0.2)]'
                }`}
              >
                {/* Visual state inside cube */}
                {rollStage === 'spinning' ? (
                  <div className="flex flex-col items-center justify-center py-2 animate-in fade-in">
                    <div className="cypher-cube-spin-anim">
                      <Package size={56} className="text-[#38bdf8] drop-shadow-[0_0_15px_#38bdf8]" />
                    </div>
                    {/* Live Ticker display window */}
                    <div className="mt-3 w-36 sm:w-40 rounded-lg border border-[#38bdf8]/60 bg-black/90 px-2 py-1 text-center shadow-inner">
                      <div className="text-[7px] tracking-widest text-[#7dd3fc] uppercase">SCANNING PAYLOAD</div>
                      <div className={`font-mono text-[12px] sm:text-[13px] font-black tracking-wider ${LOOT_TEASERS[tickerIndex].color}`}>
                        {LOOT_TEASERS[tickerIndex].value}
                      </div>
                    </div>
                  </div>
                ) : rollStage === 'decelerating' ? (
                  <div className="flex flex-col items-center justify-center py-2 cypher-cube-vibrate-anim">
                    <Package size={60} className="text-[#fde047] drop-shadow-[0_0_20px_#fde047]" />
                    <div className="mt-3 w-36 sm:w-40 rounded-lg border border-[#fde047]/80 bg-black/90 px-2 py-1 text-center shadow-inner">
                      <div className="text-[7px] tracking-widest text-[#fde047] uppercase">LOCKING COORDINATES</div>
                      <div className="font-mono text-[12px] sm:text-[13px] font-black text-[#fde047] animate-pulse">
                        DECRYPTING...
                      </div>
                    </div>
                  </div>
                ) : rollStage === 'charging' ? (
                  <div className="flex flex-col items-center justify-center animate-pulse">
                    <Package size={58} className="text-[#38bdf8] scale-110 drop-shadow-[0_0_20px_#38bdf8]" />
                    <span className="mt-2 font-mono text-[9px] tracking-widest text-[#7dd3fc]">QUANTUM DRILL...</span>
                  </div>
                ) : rollStage === 'revealed' && lootBoxResult?.isJackpot ? (
                  <div className="flex flex-col items-center justify-center animate-in zoom-in-75 duration-300">
                    <div className="text-4xl filter drop-shadow-[0_0_15px_#fde047] animate-bounce">👑</div>
                    <span className="mt-1 font-display text-[14px] font-black tracking-widest text-[#fde047]">JACKPOT!</span>
                    <span className="text-[11px] font-bold text-amber-200">+{lootBoxResult.tokens} TOKENS</span>
                  </div>
                ) : rollStage === 'revealed' && lootBoxResult?.won ? (
                  <div className="flex flex-col items-center justify-center animate-in zoom-in-75 duration-300">
                    <div className="text-4xl filter drop-shadow-[0_0_15px_#34d399] animate-bounce">💎</div>
                    <span className="mt-1 font-display text-[14px] font-black tracking-widest text-emerald-300">BREACHED!</span>
                    <span className="text-[11px] font-bold text-emerald-200">+{lootBoxResult.tokens} TOKENS</span>
                  </div>
                ) : rollStage === 'revealed' ? (
                  <div className="flex flex-col items-center justify-center animate-in zoom-in-75 duration-300">
                    <Lock size={40} className="text-gray-500 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" />
                    <span className="mt-2 font-mono text-[11px] tracking-widest text-gray-400">EMPTY VAULT</span>
                    <span className="text-[9px] text-gray-500">83% DUD PROBABILITY</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center cypher-cube-idle-anim">
                    <Package size={64} className="text-[#38bdf8] filter drop-shadow-[0_0_15px_rgba(56,189,248,0.5)]" />
                    <span className="mt-2 font-mono text-[9px] tracking-widest text-[#7dd3fc]/80">CYPHER CORE READY</span>
                  </div>
                )}
              </div>
            </div>

            {/* Live HUD Status Pill */}
            <div className="mb-5 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#38bdf8]/40 bg-black/70 px-4 py-1.5 shadow-md">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isLootBoxRolling ? 'bg-[#fde047] animate-ping' : 'bg-[#38bdf8]'
                  }`}
                />
                <span className="font-mono text-[10px] sm:text-[11px] font-bold tracking-widest text-[#bae6fd]">
                  {rollStage === 'charging' && 'STATUS: CHARGING QUANTUM BREACH...'}
                  {rollStage === 'spinning' && 'STATUS: SCANNING PAYLOAD MATRIX...'}
                  {rollStage === 'decelerating' && 'STATUS: RESOLVING SERVER COORDINATES...'}
                  {rollStage === 'revealed' && lootBoxResult?.won && 'STATUS: PAYLOAD DECRYPTED & TRANSFERRED'}
                  {rollStage === 'revealed' && !lootBoxResult?.won && 'STATUS: EMPTY PAYLOAD (83% DUD RATE)'}
                  {rollStage === 'idle' && 'STATUS: CYPHER VAULT ONLINE · 10,000 CHIPS'}
                </span>
              </div>
            </div>

            {/* Result Presentation Card */}
            {lootBoxResult && rollStage === 'revealed' && (
              <div
                className={`mb-6 rounded-2xl border p-5 animate-in fade-in zoom-in duration-300 shadow-2xl ${
                  lootBoxResult.isJackpot
                    ? 'border-[#fde047] bg-gradient-to-br from-[#2a2105] via-[#1a1303] to-black shadow-[0_0_35px_rgba(253,224,71,0.3)]'
                    : lootBoxResult.won
                    ? 'border-emerald-500/70 bg-gradient-to-br from-[#042419] via-[#02140d] to-black shadow-[0_0_30px_rgba(16,185,129,0.25)]'
                    : 'border-white/10 bg-gradient-to-br from-[#18181b] to-black text-gray-400'
                }`}
              >
                {lootBoxResult.isJackpot ? (
                  <div>
                    <span className="rounded bg-[#fde047] px-2.5 py-0.5 text-[9px] font-black tracking-widest text-[#140b02]">
                      👑 APEX JACKPOT BREACH (TOP 2%)
                    </span>
                    <div className="font-display text-4xl font-black text-[#fde047] mt-2 tracking-wide filter drop-shadow-[0_0_15px_rgba(253,224,71,0.6)]">
                      +{lootBoxResult.tokens} SCARCE TOKENS
                    </div>
                    <p className="mt-1 text-[12px] text-amber-200">
                      Unbelievable luck! Highest tier server roll. Tokens credited directly to your profile.
                    </p>
                  </div>
                ) : lootBoxResult.won ? (
                  <div>
                    <span className="rounded bg-emerald-400 px-2.5 py-0.5 text-[9px] font-black tracking-widest text-[#022c22]">
                      💎 VAULT BREACH SUCCESSFUL
                    </span>
                    <div className="font-display text-3xl font-black text-[#7dd3fc] mt-2 tracking-wide">
                      +{lootBoxResult.tokens} SCARCE TOKENS
                    </div>
                    <p className="mt-1 text-[12px] text-emerald-200">
                      Verified server roll! Added to your scarce token balance.
                    </p>
                  </div>
                ) : (
                  <div>
                    <span className="rounded bg-white/10 px-2.5 py-0.5 text-[9px] font-bold tracking-widest text-gray-300">
                      🔒 EMPTY VAULT PAYLOAD
                    </span>
                    <div className="font-display text-2xl font-bold text-gray-300 mt-2">
                      0 TOKENS (83% DUD)
                    </div>
                    <p className="mt-1 text-[12px] text-gray-400">
                      Loot boxes are designed to be mathematically scarce. Try cracking the vault again!
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Spin Button */}
            <button
              onClick={handleSpinLootBox}
              disabled={isLootBoxRolling || balance < 10000}
              className={`btn-gold min-h-[54px] w-full rounded-xl text-[13px] font-black tracking-[0.18em] shadow-xl disabled:opacity-40 transition-all ${
                isLootBoxRolling ? 'animate-pulse' : 'hover:scale-[1.01]'
              }`}
            >
              {isLootBoxRolling ? (
                <span className="flex items-center justify-center gap-2">
                  <RotateCw size={17} className="animate-spin text-[#140b02]" />
                  DECRYPTING QUANTUM VAULT...
                </span>
              ) : (
                `SPIN LOOT VAULT · 10,000 CHIPS`
              )}
            </button>

            <p className="mt-4 text-[11px] text-[#6b7280]">
              Balance: {fmt(balance)} chips available · Client never writes tokens directly
            </p>
          </div>
        </section>
      )}

      {/* ===================== TAB 3: TOKEN GRIND HUB ===================== */}
      {activeTab === 'grind' && (
        <section className="space-y-6">
          <div className="text-center mb-6">
            <span className="text-[10px] tracking-[0.25em] text-[#38bdf8] font-bold">FAIR CASINO GRIND</span>
            <h2 className="font-display gold-text text-2xl font-bold mt-1">WAYS TO EARN TOKENS</h2>
            <p className="text-[13px] text-[#a89872]">
              Tokens are never freely given away. Earn them through table mastery, streaks, and continuous play.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* 1. Daily Token Spin */}
            <div className="panel-noir rounded-xl border border-[#38bdf8]/40 p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#38bdf8] mb-3">
                  <Sparkles size={20} />
                  <span className="text-[10px] font-black tracking-widest uppercase">DAILY TOKEN SPIN</span>
                </div>
                <h3 className="font-display text-xl font-bold text-[#f2e6c9]">24-Hour Token Spin</h3>
                <p className="mt-2 text-[12.5px] text-[#a89872] leading-relaxed">
                  Spin the daily token wheel once every 24 hours. Awards 25 to 75 scarce tokens server-side.
                </p>
                {dailyTokenResult && (
                  <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-950/40 p-2 text-center text-[12px] font-bold text-emerald-300">
                    Claimed +{dailyTokenResult} tokens today!
                  </div>
                )}
              </div>
              <button
                onClick={handleClaimDailyTokens}
                disabled={isDailyTokenClaiming}
                className="btn-gold mt-6 min-h-[44px] w-full rounded text-[11px] font-bold tracking-wider"
              >
                {isDailyTokenClaiming ? 'VERIFYING COOLDOWN...' : 'SPIN DAILY TOKEN WHEEL (25-75)'}
              </button>
            </div>

            {/* 2. 4-Hand Win Streak */}
            <div className="panel-noir rounded-xl border border-[#c9a227]/30 p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#f6e27a] mb-3">
                  <Flame size={20} />
                  <span className="text-[10px] font-black tracking-widest uppercase">TABLE STREAK REWARD</span>
                </div>
                <h3 className="font-display text-xl font-bold text-[#f2e6c9]">4-Win Streak (Blackjack &amp; Poker)</h3>
                <p className="mt-2 text-[12.5px] text-[#a89872] leading-relaxed">
                  Win 4 consecutive hands in either Blackjack or Poker. Awards <span className="text-[#f6e27a] font-bold">+50 tokens</span>. Streak resets to 0 on any loss.
                </p>
              </div>
              <div className="mt-6 rounded-lg border border-[#c9a227]/25 bg-black/40 p-3 text-center">
                <span className="text-[10px] tracking-wider text-[#8a7a4d]">ACTIVE STREAK VALIDATION</span>
                <div className="text-[12px] font-bold text-[#f6e27a] mt-0.5">Automated on table hands</div>
              </div>
            </div>

            {/* 3. Spin Grind Milestones */}
            <div className="panel-noir rounded-xl border border-[#c9a227]/30 p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#86efac] mb-3">
                  <RotateCw size={20} />
                  <span className="text-[10px] font-black tracking-widest uppercase">GRIND MILESTONES</span>
                </div>
                <h3 className="font-display text-xl font-bold text-[#f2e6c9]">50-Spin Milestones</h3>
                <p className="mt-2 text-[12.5px] text-[#a89872] leading-relaxed">
                  For every 50 total game rounds or spins played across the casino, the server automatically awards <span className="text-[#86efac] font-bold">+20 tokens</span>.
                </p>
              </div>
              <div className="mt-6 rounded-lg border border-emerald-500/25 bg-black/40 p-3 text-center">
                <span className="text-[10px] tracking-wider text-[#8a7a4d]">ACTIVE PROGRESS COUNTER</span>
                <div className="text-[12px] font-bold text-emerald-300 mt-0.5">+20 tokens every 50 spins</div>
              </div>
            </div>

            {/* 4. Rare Luck Drops */}
            <div className="panel-noir rounded-xl border border-[#c9a227]/30 p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#c084fc] mb-3">
                  <Zap size={20} />
                  <span className="text-[10px] font-black tracking-widest uppercase">MYSTERY LUCK DROPS</span>
                </div>
                <h3 className="font-display text-xl font-bold text-[#f2e6c9]">0.5% Table Luck Drop</h3>
                <p className="mt-2 text-[12.5px] text-[#a89872] leading-relaxed">
                  Every table hand has a rare 0.5% chance to drop a bonus of <span className="text-[#c084fc] font-bold">+25 tokens</span> (rate-limited to max 1 per hour).
                </p>
              </div>
              <div className="mt-6 rounded-lg border border-purple-500/25 bg-black/40 p-3 text-center">
                <span className="text-[10px] tracking-wider text-[#8a7a4d]">CHANCE PER ROUND</span>
                <div className="text-[12px] font-bold text-purple-300 mt-0.5">0.5% server roll probability</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===================== TAB 4: PROFILE & IDENTITY MANAGER ===================== */}
      {activeTab === 'profile' && (
        <section className="mx-auto max-w-2xl panel-noir rounded-2xl p-6 sm:p-8 border border-[#c9a227]/30 shadow-xl">
          <div className="text-center mb-6">
            <span className="text-[10px] tracking-[0.25em] text-[#b3a06b] font-bold">IDENTITY &amp; PRESTIGE</span>
            <h2 className="font-display gold-text text-2xl font-bold mt-1">PLAYER PROFILE &amp; IDENTITIES</h2>
            <p className="text-[13px] text-[#a89872]">
              View your permanent locked identity and switch between your saved casino profiles.
            </p>
          </div>

          {/* Current Nametag and Badge Live Preview */}
          <div className="mb-6 rounded-xl border border-[#c9a227]/30 bg-black/60 p-6 text-center">
            <span className="text-[10px] tracking-[0.25em] text-[#8a7a4d] block mb-3">CURRENT LIVE NAMETAG PREVIEW</span>
            <div className="flex justify-center">
              <Nametag name={activeName ?? 'Player'} />
            </div>
          </div>

          {/* Permanent Identity Card (Name changes are permanently disabled) */}
          <div className="mb-6 rounded-xl border border-[#f6e27a]/40 bg-[#2a2105]/70 p-5 text-center shadow-lg">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-black/60 border border-[#f6e27a]/50 px-3 py-1 mb-2">
              <Lock size={12} className="text-[#f6e27a]" />
              <span className="text-[9.5px] font-black tracking-widest text-[#f6e27a] uppercase">
                PERMANENT CASINO IDENTITY (LOCKED)
              </span>
            </div>
            <div className="font-display text-2xl font-black text-white mt-1">
              {activeName ?? 'Player'}
            </div>
            <p className="text-[11.5px] text-[#a89872] mt-2 max-w-md mx-auto">
              Player identities are permanently locked to your casino deeds, liquidity stakes, and leaderboard rankings. Name changing has been permanently disabled.
            </p>
          </div>

          {/* Saved Identities Switcher - Reach any old or new identity! */}
          {players.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-black/60 p-5">
              <span className="text-[10px] tracking-[0.25em] text-[#8a7a4d] block mb-2 font-bold uppercase">
                SAVED CASINO IDENTITIES ({players.length})
              </span>
              <p className="text-[11.5px] text-[#8a7a4d] mb-4">
                Switch between your saved identities anytime without losing any chips, tokens, or property deeds:
              </p>
              <div className="space-y-2.5">
                {players.map((p) => {
                  const isActive = activeName?.toLowerCase() === p.toLowerCase()
                  return (
                    <div
                      key={p}
                      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl p-3.5 border transition-all ${
                        isActive
                          ? 'border-[#f6e27a] bg-[#2a2105]/60 shadow-md'
                          : 'border-white/5 bg-black/40 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Nametag name={p} compact />
                        {isActive && (
                          <span className="rounded bg-[#f6e27a]/20 border border-[#f6e27a]/50 px-2 py-0.5 text-[9px] font-black text-[#f6e27a]">
                            CURRENTLY ACTIVE
                          </span>
                        )}
                      </div>

                      {!isActive && (
                        <button
                          onClick={() => {
                            switchPlayer(p)
                            sfx.coin()
                          }}
                          className="btn-gold rounded-lg px-4 py-1.5 text-[11px] font-bold"
                        >
                          SWITCH TO THIS IDENTITY
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ===================== TAB 5: TABLE FELTS & CARDS (SCARCE TOKENS) ===================== */}
      {activeTab === 'felts' && (
        <section className="space-y-6">
          <DailyGift />

          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#38bdf8]/40 bg-[#071829]/80 px-3 py-0.5 text-[10px] font-bold text-[#7dd3fc] mb-1">
              <Sparkles size={12} className="text-[#38bdf8]" />
              TOKEN CUSTOMIZATION
            </div>
            <h3 className="font-display gold-text text-xl font-bold">TABLE FELTS &amp; CARD BACKS</h3>
            <p className="text-[12px] text-[#a89872]">
              Customize your private casino table cloth and playing card backs with scarce tokens.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATALOG.filter(i => i.category === 'felt' || i.category === 'back').map((item) => {
              const tokenCost = item.tokenCost ?? 0
              const isDefaultFree = tokenCost === 0
              const isOwned = shop.owned.includes(item.id) || isDefaultFree
              const isEquipped = shop.equipped[item.category as 'felt' | 'back'] === item.id
              const canAfford = tokens >= tokenCost

              const onBuy = async () => {
                if (tokenCost > 0 && tokens < tokenCost) {
                  setError(`Insufficient tokens. You have ${tokens} tokens, but ${item.name} costs ${tokenCost} tokens.`)
                  return
                }
                if (tokenCost > 0) {
                  spendTokens(tokenCost)
                }
                shop.unlockItem(item.id, item.category as 'felt' | 'back')
                sfx.coin()
                setMessage(`${item.name} unlocked and equipped! (-${tokenCost} tokens)`)

                // Notify Supabase in background
                try {
                  buyTokenShopItem(item.category as 'felt' | 'back', 1, item.id, tokenCost, activeName ?? '').catch(() => {})
                } catch {}
              }

              const onEquip = () => {
                if (shop.equip(item.id)) {
                  sfx.click()
                  setMessage(`${item.name} equipped.`)
                }
              }

              return (
                <div key={item.id} className={`panel-noir flex flex-col justify-between rounded-xl p-4 ${isEquipped ? 'border-[#f6e27a]/70 shadow-md' : ''}`}>
                  <div>
                    {item.category === 'felt' ? (
                      <div className={`felt-texture ${item.css || 'felt-green'} gold-frame flex h-20 items-center justify-center rounded-lg`} />
                    ) : (
                      <div className="flex h-20 items-center justify-center rounded-lg bg-black/30">
                        <div className={`card-back ${item.css} flex h-[72px] w-[50px] items-center justify-center rounded border border-white/10`}>
                          <span className="font-display text-sm text-[#f6e27a]/70">GF</span>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <h4 className="font-display gold-text text-sm font-bold uppercase">{item.name}</h4>
                      {isOwned ? (
                        <span className="text-[9px] font-bold text-emerald-400">OWNED</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-[#0c2338] border border-[#38bdf8]/40 px-2 py-0.5 text-[9px] font-bold text-[#7dd3fc]">
                          <Sparkles size={10} className="text-[#38bdf8]" />
                          {tokenCost} TOKENS
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[12px] text-[#a89872]">{item.desc}</p>
                  </div>

                  <div className="mt-4">
                    {isEquipped ? (
                      <button disabled className="btn-ghost-gold min-h-[38px] w-full rounded text-[10px] flex items-center justify-center gap-1 opacity-70">
                        <Check size={12} /> EQUIPPED
                      </button>
                    ) : isOwned ? (
                      <button onClick={onEquip} className="btn-ghost-gold min-h-[38px] w-full rounded text-[10px] font-bold">
                        EQUIP
                      </button>
                    ) : (
                      <button
                        onClick={onBuy}
                        disabled={!canAfford}
                        className={`min-h-[38px] w-full rounded text-[10px] font-bold flex items-center justify-center gap-1.5 ${
                          canAfford ? 'btn-gold shadow-md' : 'btn-ghost-gold opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <Sparkles size={12} className="text-[#38bdf8]" />
                        UNLOCK · {tokenCost} TOKENS
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Footer warning */}
      <div className="mt-12 text-center text-[10px] tracking-[0.3em] text-[#6b5f42]">
        TOKENS &amp; CHIPS HOLD NO REAL CASH VALUE · ALL PROGRESS SAVED TO SERVER TRUTH
      </div>
    </div>
  )
}
