import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Building2,
  RefreshCw,
  Check,
  Coins,
  Crown,
} from 'lucide-react'
import { useChips, fmt } from '../state/chips'
import { usePlayer } from '../state/profile'
import { useNow } from '../state/shop'
import { sfx } from '../lib/audio'
import {
  fetchCasinos,
  buyCasino,
  subscribeToCasinos,
  type CasinoRecord,
  subscribeToStakePool,
  playerNameToUuid,
  isCasinoOwnedBy,
} from '../lib/supabase'
import {
  getStakePool,
  investInStakePool,
  getPlayerStake,
  syncStakePoolFromSupabase,
} from '../lib/stakeAndClub'

export interface CasinoRevenueDef {
  chipsPerSec: number
  description: string
}

export function getVenueUpgradeCost(basePrice: number, currentLevel: number): number {
  return Math.round(basePrice * Math.pow(1.6, currentLevel))
}

function readVenueLevels(playerName: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(`golden-felt-venue-levels-v3:${playerName.toLowerCase()}`)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveVenueLevels(playerName: string, levels: Record<string, number>) {
  try {
    localStorage.setItem(`golden-felt-venue-levels-v3:${playerName.toLowerCase()}`, JSON.stringify(levels))
  } catch {}
}

export const CASINO_REVENUE: Record<string, CasinoRevenueDef> = {
  'casino-studio': {
    chipsPerSec: 50,
    description: 'Generates +50 chips/sec (~180K/hr) from local foot traffic and gaming tables.',
  },
  'casino-underground': {
    chipsPerSec: 150,
    description: 'Generates +150 chips/sec (~540K/hr) from late-night underground high-stakes poker pots.',
  },
  'casino-strip-bar': {
    chipsPerSec: 400,
    description: 'Generates +400 chips/sec (~1.44M/hr) from strip boulevard lounge patrons and high rollers.',
  },
  'casino-mall': {
    chipsPerSec: 1000,
    description: 'Generates +1,000 chips/sec (~3.6M/hr) from upscale luxury pavilion retail and gaming.',
  },
  'casino-marina': {
    chipsPerSec: 2500,
    description: 'Generates +2,500 chips/sec (~9M/hr) from chartered mega-yacht moorings.',
  },
  'casino-resort': {
    chipsPerSec: 6000,
    description: 'Generates +6,000 chips/sec (~21.6M/hr) from 5-star VIP hotel penthouse suites.',
  },
  'casino-high-roller': {
    chipsPerSec: 15000,
    description: 'Generates +15,000 chips/sec (~54M/hr) from private apex whale gaming salons.',
  },
  'casino-golden-felt': {
    chipsPerSec: 35000,
    description: 'Generates +35,000 chips/sec (~126M/hr) as the supreme crown jewel sovereign casino.',
  },
}

export default function Properties() {
  const { balance, credit, spend } = useChips()
  const { activeName } = usePlayer()
  const playerName = activeName ?? 'Player'
  const now = useNow(1000)

  // Tab navigation
  const [activeTab, setActiveTab] = useState<'venues' | 'pool'>('venues')

  // Venue state
  const [casinos, setCasinos] = useState<CasinoRecord[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [purchasingId, setPurchasingId] = useState<string | null>(null)
  const [venueFilter, setVenueFilter] = useState<'all' | 'owned'>('all')

  // Stake pool state
  const [stakePoolVersion, setStakePoolVersion] = useState(0)
  const [stakeAmountInput, setStakeAmountInput] = useState<string>('500000')
  const [isStaking, setIsStaking] = useState(false)

  // Venue upgrade levels tracking
  const [venueLevels, setVenueLevels] = useState<Record<string, number>>(() => readVenueLevels(playerName))

  useEffect(() => {
    setVenueLevels(readVenueLevels(playerName))
  }, [playerName])

  // Revenue timestamps tracking
  const [revenueTimestamps, setRevenueTimestamps] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(`golden-felt-revenue-timestamps-v3:${playerName.toLowerCase()}`)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })

  const saveRevenueTimestamps = useCallback(
    (ts: Record<string, number>) => {
      setRevenueTimestamps(ts)
      try {
        localStorage.setItem(`golden-felt-revenue-timestamps-v3:${playerName.toLowerCase()}`, JSON.stringify(ts))
      } catch {}
    },
    [playerName]
  )

  // Feedback banner messages
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Load casinos from Supabase
  const loadCasinos = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true)
    try {
      const data = await fetchCasinos()
      if (data && data.length > 0) {
        setCasinos(data)
      }
    } catch (err) {
      console.warn('Failed to load casinos:', err)
    } finally {
      if (showSpinner) {
        setTimeout(() => setIsRefreshing(false), 400)
      }
    }
  }, [])

  useEffect(() => {
    loadCasinos()
    const unsubscribe = subscribeToCasinos(() => {
      loadCasinos()
    })
    return () => {
      unsubscribe()
    }
  }, [loadCasinos])

  // Refresh stake pool
  const refreshStakePool = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true)
    try {
      await syncStakePoolFromSupabase()
      setStakePoolVersion((v) => v + 1)
    } finally {
      if (showSpinner) {
        setTimeout(() => setIsRefreshing(false), 400)
      }
    }
  }, [])

  useEffect(() => {
    refreshStakePool()
    const handleLocalUpdate = () => setStakePoolVersion((v) => v + 1)
    window.addEventListener('stake-pool-updated', handleLocalUpdate)
    const unsubscribe = subscribeToStakePool(() => {
      refreshStakePool()
    })
    return () => {
      window.removeEventListener('stake-pool-updated', handleLocalUpdate)
      unsubscribe()
    }
  }, [refreshStakePool])

  const stakeData = useMemo(() => {
    return getStakePool()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stakePoolVersion])

  const myStake = useMemo(() => {
    return getPlayerStake(playerName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerName, stakePoolVersion, stakeData])

  const myPid = useMemo(() => playerNameToUuid(playerName), [playerName])

  const myOwnedCasinos = useMemo(() => {
    return casinos.filter((c) => isCasinoOwnedBy(c, playerName, myPid))
  }, [casinos, myPid, playerName])

  const getVenuePending = useCallback(
    (casinoId: string, currentTime: number) => {
      const rev = CASINO_REVENUE[casinoId]
      if (!rev) return { chips: 0, elapsedSec: 0, level: 1 }
      const level = venueLevels[casinoId] ?? 1
      const lastAt = revenueTimestamps[casinoId] ?? currentTime
      const elapsedSec = Math.min(12 * 3600, Math.max(0, Math.floor((currentTime - lastAt) / 1000)))
      const chips = elapsedSec * rev.chipsPerSec * level
      return { chips, elapsedSec, level }
    },
    [revenueTimestamps, venueLevels]
  )

  const totalPendingChips = useMemo(() => {
    let chips = 0
    for (const c of myOwnedCasinos) {
      chips += getVenuePending(c.id, now).chips
    }
    return chips
  }, [myOwnedCasinos, getVenuePending, now])

  const totalRateChipsPerSec = useMemo(() => {
    let rate = 0
    for (const c of myOwnedCasinos) {
      const rev = CASINO_REVENUE[c.id]
      if (rev) {
        const level = venueLevels[c.id] ?? 1
        rate += rev.chipsPerSec * level
      }
    }
    return rate
  }, [myOwnedCasinos, venueLevels])

  // Handle Collecting Revenue
  const handleCollectVenue = (casinoId: string) => {
    const { chips } = getVenuePending(casinoId, now)
    if (chips <= 0) return
    credit(chips)
    sfx.coin()
    saveRevenueTimestamps({ ...revenueTimestamps, [casinoId]: now })
    setMessage(`💰 Collected +${fmt(chips)} CHIPS from venue revenue!`)
    setError('')
  }

  const handleCollectAll = () => {
    if (totalPendingChips <= 0) return
    credit(totalPendingChips)
    sfx.coin()
    const nextTimestamps = { ...revenueTimestamps }
    for (const c of myOwnedCasinos) {
      nextTimestamps[c.id] = now
    }
    saveRevenueTimestamps(nextTimestamps)
    setMessage(`💰 Collected +${fmt(totalPendingChips)} CHIPS from all owned venues!`)
    setError('')
  }

  // Handle Venue Upgrade
  const handleUpgradeVenue = (casino: CasinoRecord) => {
    const currentLevel = venueLevels[casino.id] ?? 1
    const cost = getVenueUpgradeCost(casino.price, currentLevel)

    if (balance < cost) {
      setError(`Insufficient chips. Upgrading to Level ${currentLevel + 1} costs ${fmt(cost)} chips.`)
      return
    }

    if (!spend(cost)) {
      setError('Insufficient chips to upgrade venue.')
      return
    }

    const { chips } = getVenuePending(casino.id, now)
    if (chips > 0) {
      credit(chips)
    }

    sfx.coin()
    const nextLevels = { ...venueLevels, [casino.id]: currentLevel + 1 }
    setVenueLevels(nextLevels)
    saveVenueLevels(playerName, nextLevels)
    saveRevenueTimestamps({ ...revenueTimestamps, [casino.id]: now })

    setMessage(
      `⭐ UPGRADED: ${casino.name} upgraded to Level ${currentLevel + 1}! Revenue increased by +60%! (-${fmt(cost)} chips)`
    )
    setError('')
  }

  // Handle Staking Chips into Central Liquidity Pool
  const handleStakeChips = async () => {
    const amt = parseInt(stakeAmountInput, 10)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Please enter a valid positive chip amount to stake.')
      return
    }
    if (balance < amt) {
      setError(`Insufficient chips. You have ${fmt(balance)} chips available, but tried to stake ${fmt(amt)}.`)
      return
    }

    setIsStaking(true)
    setError('')
    setMessage('')
    sfx.click()

    try {
      if (!spend(amt)) {
        setError('Chip deduction failed.')
        setIsStaking(false)
        return
      }

      sfx.coin()
      investInStakePool(playerName, amt)
      setStakePoolVersion((v) => v + 1)
      setMessage(`🏛️ STAKE LOCKED: Successfully staked ${fmt(amt)} chips into Golden Felt Casino liquidity reserve!`)
    } catch {
      setError('Error while processing chip stake transaction.')
    } finally {
      setIsStaking(false)
    }
  }

  // Handle Venue Deed Acquisition
  const handleBuyVenue = async (casino: CasinoRecord) => {
    if (balance < casino.price) {
      setError(`Insufficient chips. ${casino.name} costs ${fmt(casino.price)} chips, but you only have ${fmt(balance)}.`)
      return
    }

    setPurchasingId(casino.id)
    setError('')
    setMessage('')
    sfx.click()

    try {
      if (!spend(casino.price)) {
        setError('Insufficient chips to buy deed.')
        setPurchasingId(null)
        return
      }

      await buyCasino(casino.id, playerName)
      sfx.coin()
      const nextLevels = { ...venueLevels, [casino.id]: 1 }
      setVenueLevels(nextLevels)
      saveVenueLevels(playerName, nextLevels)
      saveRevenueTimestamps({ ...revenueTimestamps, [casino.id]: Date.now() })

      setMessage(`🏛️ DEED ACQUIRED! You are now the official owner of ${casino.name}! (-${fmt(casino.price)} chips)`)
      await loadCasinos()
    } catch {
      sfx.coin()
      const nextLevels = { ...venueLevels, [casino.id]: 1 }
      setVenueLevels(nextLevels)
      saveVenueLevels(playerName, nextLevels)
      saveRevenueTimestamps({ ...revenueTimestamps, [casino.id]: Date.now() })
      setMessage(`🏛️ Casino deed acquired! (-${fmt(casino.price)} chips)`)
    } finally {
      setPurchasingId(null)
    }
  }

  const displayedCasinos = useMemo(() => {
    return casinos.filter((c) => {
      const isMe =
        (c.owner_id && c.owner_id === myPid) ||
        (c.owner_name && c.owner_name.toLowerCase() === playerName.toLowerCase())

      if (venueFilter === 'owned') return isMe
      return true
    })
  }, [casinos, venueFilter, myPid, playerName])

  const parsedStakeInput = parseInt(stakeAmountInput, 10) || 0

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6">
      {/* Header Banner */}
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#c9a227]/40 bg-black/60 px-3.5 py-1 mb-2 shadow-sm">
          <Crown size={13} className="text-[#f6e27a]" />
          <span className="text-[10px] font-bold tracking-widest text-[#f6e27a]">
            SOVEREIGN REAL ESTATE &amp; CASINO EQUITY
          </span>
          <button
            onClick={() => { loadCasinos(true); refreshStakePool(true) }}
            disabled={isRefreshing}
            title="Refresh Venues & Stakes"
            className="ml-1 text-[#f6e27a] hover:text-white transition-opacity disabled:opacity-50"
          >
            <RefreshCw size={11} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
        <h1 className="font-display gold-text-bright text-3xl font-black tracking-[0.18em] sm:text-4xl">
          PROPERTIES &amp; CASINO STAKES
        </h1>
        <p className="mt-1 text-[13px] text-[#a89872]">
          Acquire sovereign casino properties across the strip or stake chips into the central house liquidity reserve
        </p>
        <div className="divider-gold mx-auto mt-3 w-48" />

        {/* Currency Display */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#c9a227]/50 bg-black/80 py-1.5 pl-2 pr-5 shadow-lg">
            <Coins size={16} className="text-[#f6e27a]" />
            <span className="font-display text-base font-black text-[#f6e27a] tabular-nums">{fmt(balance)}</span>
            <span className="text-[10px] tracking-[0.25em] text-[#8a7a4d] font-bold">CHIPS AVAILABLE</span>
          </div>
        </div>
      </div>

      {/* Casino Empire Ownership & Stats Panel */}
      <div className="panel-noir mb-6 rounded-2xl border-2 border-[#c9a227]/40 bg-gradient-to-b from-[#1a1403] via-black to-black p-5 sm:p-6 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#c9a227]/30 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#f6e27a]/50 bg-[#2a2105] shadow-[0_0_20px_rgba(246,226,122,0.3)]">
              <Building2 size={24} className="text-[#f6e27a]" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-widest text-[#8a7a4d]">
                SOVEREIGN CASINO CONTROL
              </div>
              <h2 className="font-display gold-text-bright text-xl sm:text-2xl font-black tracking-wider">
                YOUR CASINO EMPIRE OWNERSHIP
              </h2>
            </div>
          </div>

          {/* Quick Collect Button if Pending Revenue */}
          {totalPendingChips > 0 && (
            <button
              onClick={handleCollectAll}
              className="btn-gold flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black shadow-lg animate-pulse"
            >
              <span>💰 COLLECT ALL (+{fmt(totalPendingChips)} CHIPS)</span>
            </button>
          )}
        </div>

        {/* 4-Stat Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
          <div className="panel-noir rounded-xl border border-white/10 p-3.5 bg-black/60">
            <span className="text-[10px] tracking-wider text-[#8a7a4d] uppercase font-bold block mb-1">
              CASINO STRIP OWNED
            </span>
            <div className="font-display text-2xl font-black text-[#f6e27a]">
              {myOwnedCasinos.length} / 8 <span className="text-sm font-semibold text-gray-400">Venues</span>
            </div>
            <div className="text-[11px] font-bold text-emerald-400 mt-1">
              {((myOwnedCasinos.length / 8) * 100).toFixed(0)}% of Entire Strip
            </div>
          </div>

          <div className="panel-noir rounded-xl border border-white/10 p-3.5 bg-black/60">
            <span className="text-[10px] tracking-wider text-[#8a7a4d] uppercase font-bold block mb-1">
              CENTRAL HOUSE EQUITY
            </span>
            <div className="font-display text-2xl font-black text-[#f6e27a]">
              {myStake.percent.toFixed(1)}% <span className="text-sm font-semibold text-gray-400">Equity</span>
            </div>
            <div className="text-[11px] font-bold text-[#cbb98a] mt-1">
              {fmt(myStake.contribution)} Chips Staked
            </div>
          </div>

          <div className="panel-noir rounded-xl border border-white/10 p-3.5 bg-black/60">
            <span className="text-[10px] tracking-wider text-[#8a7a4d] uppercase font-bold block mb-1">
              PASSIVE REVENUE RATE
            </span>
            <div className="font-display text-2xl font-black text-[#f6e27a]">
              +{fmt(totalRateChipsPerSec * 3600)} <span className="text-xs font-semibold text-gray-400">/hr</span>
            </div>
            <div className="text-[11px] font-bold text-[#cbb98a] mt-1">
              +{fmt(totalRateChipsPerSec)} chips / sec
            </div>
          </div>

          <div className="panel-noir rounded-xl border border-white/10 p-3.5 bg-black/60">
            <span className="text-[10px] tracking-wider text-[#8a7a4d] uppercase font-bold block mb-1">
              UNCLAIMED REVENUE
            </span>
            <div className="font-display text-2xl font-black text-emerald-400">
              +{fmt(totalPendingChips)} <span className="text-xs font-semibold text-emerald-600">Chips</span>
            </div>
            <div className="text-[11px] font-bold text-[#8a7a4d] mt-1">
              {totalPendingChips > 0 ? 'Ready to collect' : 'Accumulating live...'}
            </div>
          </div>
        </div>

        {/* Strip Dominance Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold text-[#cbb98a] mb-1.5">
            <span>Strip Dominance: {myOwnedCasinos.length} of 8 Casino Properties Owned</span>
            <span className="text-[#f6e27a] font-mono">{((myOwnedCasinos.length / 8) * 100).toFixed(0)}% Dominance</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/80 border border-[#c9a227]/30">
            <div
              className="h-full bg-gradient-to-r from-[#c9a227] via-[#f6e27a] to-[#ffd700] transition-all duration-500 shadow-[0_0_10px_rgba(246,226,122,0.5)]"
              style={{ width: `${Math.max(5, (myOwnedCasinos.length / 8) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Status Alerts */}
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
      <div className="mb-6 flex justify-center gap-2">
        <button
          onClick={() => { sfx.click(); setActiveTab('venues'); setMessage(''); setError('') }}
          className={`min-h-[42px] rounded-full px-6 py-2 text-[11px] font-bold transition-all flex items-center gap-2 ${
            activeTab === 'venues' ? 'btn-gold shadow-md' : 'btn-ghost-gold'
          }`}
        >
          <Building2 size={14} /> CASINO PROPERTIES (SLOTS 1–8)
        </button>

        <button
          onClick={() => { sfx.click(); setActiveTab('pool'); setMessage(''); setError('') }}
          className={`min-h-[42px] rounded-full px-6 py-2 text-[11px] font-bold transition-all flex items-center gap-2 ${
            activeTab === 'pool' ? 'btn-gold shadow-md' : 'btn-ghost-gold'
          }`}
        >
          <Crown size={14} /> CENTRAL CASINO STAKE POOL
        </button>
      </div>

      {/* ===================== TAB 1: CASINO VENUES (SLOTS 1-8) ===================== */}
      {activeTab === 'venues' && (
        <section className="space-y-6">
          {/* Revenue Portfolio Banner */}
          <div className="panel-noir gold-frame rounded-2xl p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="text-[10px] tracking-[0.25em] text-[#8a7a4d] uppercase font-bold">
                  YOUR REAL ESTATE EMPIRE
                </span>
                <h3 className="font-display gold-text text-xl font-bold mt-0.5">
                  {myOwnedCasinos.length} VENUE{myOwnedCasinos.length !== 1 ? 'S' : ''} ACQUIRED
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-[#a89872]">
                  <span>Total Hourly Revenue: <b className="text-[#f6e27a]">+{fmt(totalRateChipsPerSec * 3600)} chips/hr</b></span>
                  <span>Pending Revenue: <b className="text-[#34d399]">+{fmt(totalPendingChips)} chips</b></span>
                </div>
              </div>

              {myOwnedCasinos.length > 0 && totalPendingChips > 0 && (
                <button
                  onClick={handleCollectAll}
                  className="btn-gold rounded-xl px-5 py-2.5 text-xs font-bold shadow-lg flex items-center gap-2 whitespace-nowrap"
                >
                  <Coins size={14} />
                  COLLECT ALL ({fmt(totalPendingChips)} CHIPS)
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex justify-center gap-2 border-b border-[#c9a227]/20 pb-3">
            <button
              onClick={() => { sfx.click(); setVenueFilter('all') }}
              className={`rounded-lg px-4 py-1.5 text-[11px] font-bold transition-colors ${
                venueFilter === 'all'
                  ? 'border border-[#f6e27a] bg-[#2a2105] text-[#f6e27a]'
                  : 'border border-white/10 bg-black/40 text-[#a89872] hover:text-[#f2e6c9]'
              }`}
            >
              ALL PROPERTIES (8)
            </button>
            <button
              onClick={() => { sfx.click(); setVenueFilter('owned') }}
              className={`rounded-lg px-4 py-1.5 text-[11px] font-bold transition-colors ${
                venueFilter === 'owned'
                  ? 'border border-[#f6e27a] bg-[#2a2105] text-[#f6e27a]'
                  : 'border border-white/10 bg-black/40 text-[#a89872] hover:text-[#f2e6c9]'
              }`}
            >
              MY PROPERTIES ({myOwnedCasinos.length})
            </button>
          </div>

          {/* Venues Grid */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {displayedCasinos.map((c) => {
              const revDef = CASINO_REVENUE[c.id] || { chipsPerSec: 50, description: '' }
              const isMe = isCasinoOwnedBy(c, playerName, myPid)
              const currentLevel = isMe ? (venueLevels[c.id] ?? 1) : 1
              const nextCost = getVenueUpgradeCost(c.price, currentLevel)
              const venuePending = getVenuePending(c.id, now)
              const canAffordBuy = balance >= c.price
              const canAffordUpgrade = balance >= nextCost

              return (
                <div
                  key={c.id}
                  className={`panel-noir relative flex flex-col justify-between rounded-2xl p-5 transition-all ${
                    isMe
                      ? 'border-2 border-[#f6e27a] shadow-[0_0_20px_rgba(246,226,122,0.15)] bg-gradient-to-b from-[#1c1505] to-black/90'
                      : 'border border-[#c9a227]/30 bg-black/60 hover:border-[#c9a227]/60'
                  }`}
                >
                  <div>
                    {/* Slot badge & Ownership badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="rounded bg-black/80 border border-[#c9a227]/40 px-2 py-0.5 text-[9px] font-black text-[#f6e27a]">
                        SLOT #{c.slot_num}
                      </span>
                      {isMe ? (
                        <span className="rounded bg-[#10b981]/20 border border-[#10b981]/50 px-2 py-0.5 text-[9px] font-bold text-[#34d399] flex items-center gap-1">
                          <Check size={11} /> LVL {currentLevel} DEED
                        </span>
                      ) : c.owner_name ? (
                        <span className="text-[10px] text-gray-400 font-bold">
                          OWNER: {c.owner_name}
                        </span>
                      ) : (
                        <span className="rounded bg-[#f59e0b]/20 border border-[#f59e0b]/40 px-2 py-0.5 text-[9px] font-bold text-[#fde047]">
                          FOR SALE
                        </span>
                      )}
                    </div>

                    <div className="text-3xl mb-2">{c.icon}</div>
                    <h4 className="font-display gold-text text-base font-bold leading-tight">{c.name}</h4>
                    <p className="mt-1 text-[11px] text-[#a89872] line-clamp-2">{c.tagline}</p>

                    <div className="my-3 rounded-xl border border-white/5 bg-black/40 p-2.5 text-[11px] text-[#cbb98a]">
                      <div className="font-bold text-[#f6e27a]">
                        +{fmt(revDef.chipsPerSec * (isMe ? currentLevel : 1))} chips/sec
                      </div>
                      <div className="text-[10px] text-gray-400">
                        (~{fmt(revDef.chipsPerSec * 3600 * (isMe ? currentLevel : 1))} / hour)
                      </div>
                    </div>

                    {isMe && venuePending.chips > 0 && (
                      <div className="mb-3 rounded-lg border border-[#10b981]/40 bg-[#064e3b]/40 p-2 text-center">
                        <div className="text-[9px] text-[#a7f3d0] font-bold">ACCUMULATED REVENUE</div>
                        <div className="font-display text-sm font-black text-[#34d399]">
                          +{fmt(venuePending.chips)} CHIPS
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#8a7a4d]">PRICE:</span>
                      <span className="font-display font-bold text-[#f6e27a]">
                        {fmt(c.price)} CHIPS
                      </span>
                    </div>

                    {isMe ? (
                      <div className="space-y-1.5">
                        {venuePending.chips > 0 && (
                          <button
                            onClick={() => handleCollectVenue(c.id)}
                            className="btn-gold w-full rounded-lg py-2 text-[11px] font-bold shadow"
                          >
                            COLLECT REVENUE (+{fmt(venuePending.chips)})
                          </button>
                        )}
                        <button
                          onClick={() => handleUpgradeVenue(c)}
                          disabled={!canAffordUpgrade}
                          className={`w-full rounded-lg py-1.5 text-[10px] font-bold border transition-all ${
                            canAffordUpgrade
                              ? 'border-[#c9a227]/60 bg-[#2a2105] text-[#f6e27a] hover:bg-[#3d3007]'
                              : 'border-white/5 bg-black/40 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          UPGRADE TO LVL {currentLevel + 1} ({fmt(nextCost)} CHIPS)
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleBuyVenue(c)}
                        disabled={purchasingId === c.id || !canAffordBuy}
                        className={`w-full rounded-xl py-2.5 text-xs font-black tracking-wider transition-all shadow-md ${
                          canAffordBuy
                            ? 'btn-gold'
                            : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/10'
                        }`}
                      >
                        {purchasingId === c.id ? (
                          <span className="flex items-center justify-center gap-1.5">
                            <RefreshCw size={12} className="animate-spin" /> ACQUIRING...
                          </span>
                        ) : (
                          `BUY DEED (${fmt(c.price)} CHIPS)`
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ===================== TAB 2: CENTRAL CASINO STAKE POOL ===================== */}
      {activeTab === 'pool' && (
        <section className="space-y-6">
          <div className="panel-noir gold-frame rounded-2xl p-6 sm:p-8">
            <div className="text-center mb-6">
              <span className="text-[10px] tracking-[0.25em] text-[#f6e27a] font-bold uppercase">
                CASINO CAPITAL RESERVE &amp; EQUITY TERMINAL
              </span>
              <h2 className="font-display gold-text-bright text-2xl sm:text-3xl font-black tracking-wider mt-1">
                GOLDEN FELT CENTRAL CAPITAL RESERVE
              </h2>
              <p className="text-[13px] text-[#a89872] mt-1 max-w-xl mx-auto">
                Deposit chips into the casino's core capital reserve to secure permanent equity in Golden Felt. Equity grants cap table prestige and ranks prominently on the global leaderboard.
              </p>
            </div>

            {/* Metrics cards */}
            <div className="grid gap-4 sm:grid-cols-3 max-w-3xl mx-auto mb-8">
              <div className="rounded-xl border border-[#c9a227]/40 bg-black/60 p-4 text-center">
                <div className="text-[10px] text-[#8a7a4d] uppercase font-bold">TOTAL CAPITAL POOL</div>
                <div className="font-display text-2xl font-black text-[#f6e27a] mt-1">
                  {fmt(stakeData.totalPool)}
                </div>
                <div className="text-[10px] text-gray-400">CHIPS COMMITTED</div>
              </div>

              <div className="rounded-xl border border-[#c9a227]/40 bg-black/60 p-4 text-center">
                <div className="text-[10px] text-[#8a7a4d] uppercase font-bold">YOUR STAKE</div>
                <div className="font-display text-2xl font-black text-[#f6e27a] mt-1">
                  {fmt(myStake.contribution)}
                </div>
                <div className="text-[10px] text-gray-400">CHIPS DEPOSITED</div>
              </div>

              <div className="rounded-xl border border-[#c9a227]/40 bg-black/60 p-4 text-center">
                <div className="text-[10px] text-[#8a7a4d] uppercase font-bold">YOUR EQUITY SHARE</div>
                <div className="font-display text-2xl font-black text-[#34d399] mt-1">
                  {myStake.percent.toFixed(1)}%
                </div>
                <div className="text-[10px] text-gray-400">CASINO OWNERSHIP</div>
              </div>
            </div>

            {/* Staking Action Panel */}
            <div className="rounded-xl border border-[#c9a227]/30 bg-black/80 p-5 max-w-xl mx-auto">
              <label className="block text-[11px] font-bold text-[#f2e6c9] mb-2">
                CHIPS TO DEPOSIT INTO CASINO CAPITAL:
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="10000"
                  max={balance}
                  value={stakeAmountInput}
                  onChange={(e) => setStakeAmountInput(e.target.value)}
                  className="w-full rounded-xl border border-[#c9a227]/40 bg-black/90 px-4 py-2.5 font-display text-base font-bold text-[#f6e27a] focus:border-[#f6e27a] focus:outline-none"
                />
                <button
                  onClick={handleStakeChips}
                  disabled={isStaking || balance < parsedStakeInput || parsedStakeInput <= 0}
                  className="btn-gold rounded-xl px-6 py-2.5 text-xs font-black whitespace-nowrap"
                >
                  {isStaking ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    `STAKE ${parsedStakeInput > 0 ? fmt(parsedStakeInput) : ''} CHIPS`
                  )}
                </button>
              </div>

              {/* Quick Select Buttons */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-[10px] text-[#8a7a4d] font-bold">QUICK PRESETS:</span>
                {[100000, 500000, 2500000, 10000000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      sfx.tick()
                      setStakeAmountInput(amt.toString())
                    }}
                    className="rounded-lg border border-[#c9a227]/30 bg-black/50 px-2.5 py-1 text-[10px] font-bold text-[#f6e27a] hover:bg-[#c9a227]/20"
                  >
                    +{fmt(amt)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    sfx.tick()
                    setStakeAmountInput(balance.toString())
                  }}
                  className="rounded-lg border border-[#f6e27a]/60 bg-[#2a2105] px-2.5 py-1 text-[10px] font-black text-[#f6e27a]"
                >
                  MAX ({fmt(balance)})
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
