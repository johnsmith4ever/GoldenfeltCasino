import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Building2,
  RefreshCw,
  Check,
  Sparkles,
  Trophy,
  Coins,
  ShieldCheck,
  Crown,
  Zap,
} from 'lucide-react'
import { useChips, fmt } from '../state/chips'
import { usePlayer } from '../state/profile'
import { useNow } from '../state/shop'
import { Nametag } from '../components/Nametag'
import { sfx } from '../lib/audio'
import {
  fetchCasinos,
  buyCasino,
  subscribeToCasinos,
  ensureAnonymousSession,
  isChipCasino,
  getCasinoSlotNum,
  type CasinoRecord,
  subscribeToStakePool,
} from '../lib/supabase'
import {
  getStakePool,
  investInStakePool,
  getPlayerStake,
  syncStakePoolFromSupabase,
} from '../lib/stakeAndClub'

export interface CasinoRevenueDef {
  chipsPerSec: number
  tokensPerHour: number
  description: string
}

export function getVenueUpgradeCost(basePrice: number, currentLevel: number): number {
  return Math.round(basePrice * Math.pow(1.6, currentLevel))
}

function readVenueLevels(playerName: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(`golden-felt-venue-levels-v2:${playerName.toLowerCase()}`)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveVenueLevels(playerName: string, levels: Record<string, number>) {
  try {
    localStorage.setItem(`golden-felt-venue-levels-v2:${playerName.toLowerCase()}`, JSON.stringify(levels))
  } catch {}
}

export const CASINO_REVENUE: Record<string, CasinoRevenueDef> = {
  // Slots 1-4 (Chips Venues)
  'casino-studio': {
    chipsPerSec: 50,
    tokensPerHour: 0,
    description: 'Generates +50 chips/sec (~180K/hr) from local foot traffic and gaming tables.',
  },
  'casino-underground': {
    chipsPerSec: 150,
    tokensPerHour: 0,
    description: 'Generates +150 chips/sec (~540K/hr) from late-night underground high-stakes poker pots.',
  },
  'casino-strip-bar': {
    chipsPerSec: 400,
    tokensPerHour: 0,
    description: 'Generates +400 chips/sec (~1.44M/hr) from strip boulevard lounge patrons and high rollers.',
  },
  'casino-mall': {
    chipsPerSec: 1000,
    tokensPerHour: 0,
    description: 'Generates +1,000 chips/sec (~3.6M/hr) from upscale luxury pavilion retail and gaming.',
  },
  // Slots 5-8 (Tokens Venues)
  'casino-marina': {
    chipsPerSec: 2500,
    tokensPerHour: 5,
    description: 'Generates +2,500 chips/sec and +5 scarce tokens/hr from chartered mega-yacht moorings.',
  },
  'casino-resort': {
    chipsPerSec: 6000,
    tokensPerHour: 12,
    description: 'Generates +6,000 chips/sec and +12 scarce tokens/hr from 5-star VIP hotel penthouse suites.',
  },
  'casino-high-roller': {
    chipsPerSec: 15000,
    tokensPerHour: 30,
    description: 'Generates +15,000 chips/sec and +30 scarce tokens/hr from private apex whale gaming salons.',
  },
  'casino-golden-felt': {
    chipsPerSec: 35000,
    tokensPerHour: 75,
    description: 'Generates +35,000 chips/sec and +75 scarce tokens/hr as the supreme crown jewel sovereign casino.',
  },
}

export default function Properties() {
  const { balance, tokens, credit, creditTokens, spend, spendTokens } = useChips()
  const { activeName } = usePlayer()
  const playerName = activeName ?? 'Player'
  const now = useNow(1000)

  // Tab navigation
  const [activeTab, setActiveTab] = useState<'pool' | 'venues'>('pool')

  // Venue state
  const [casinos, setCasinos] = useState<CasinoRecord[]>([])
  const [currentUid, setCurrentUid] = useState<string | null>(null)
  const [isLoadingCasinos, setIsLoadingCasinos] = useState(true)
  const [isRefreshingCasinos, setIsRefreshingCasinos] = useState(false)
  const [purchasingId, setPurchasingId] = useState<string | null>(null)
  const [venueFilter, setVenueFilter] = useState<'all' | 'chips' | 'tokens' | 'owned'>('all')

  // Stake pool state
  const [stakePoolVersion, setStakePoolVersion] = useState(0)
  const [stakeAmountInput, setStakeAmountInput] = useState<string>('100')
  const [isStaking, setIsStaking] = useState(false)
  const [isRefreshingPool, setIsRefreshingPool] = useState(false)

  // Venue upgrade levels tracking
  const [venueLevels, setVenueLevels] = useState<Record<string, number>>(() => readVenueLevels(playerName))

  useEffect(() => {
    setVenueLevels(readVenueLevels(playerName))
  }, [playerName])

  // Revenue timestamps tracking
  const [revenueTimestamps, setRevenueTimestamps] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(`golden-felt-revenue-timestamps-v2:${playerName.toLowerCase()}`)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })

  const saveRevenueTimestamps = useCallback((next: Record<string, number>) => {
    setRevenueTimestamps(next)
    try {
      localStorage.setItem(`golden-felt-revenue-timestamps-v2:${playerName.toLowerCase()}`, JSON.stringify(next))
    } catch {}
  }, [playerName])

  // Status banners
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Load stable user auth id
  useEffect(() => {
    ensureAnonymousSession().then((uid) => {
      if (uid) setCurrentUid(uid)
    })
  }, [])

  // Load casinos from Supabase
  const loadCasinos = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshingCasinos(true)
    try {
      const data = await fetchCasinos()
      if (data && data.length > 0) {
        setCasinos(data)
      }
    } catch (err) {
      console.warn('Failed to load casinos:', err)
    } finally {
      setIsLoadingCasinos(false)
      if (showSpinner) {
        setTimeout(() => setIsRefreshingCasinos(false), 400)
      }
    }
  }, [])

  // Initial fetch and Realtime subscription for casinos
  useEffect(() => {
    loadCasinos()
    const unsubscribe = subscribeToCasinos(() => {
      loadCasinos()
    })
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadCasinos()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loadCasinos])

  // Sync stake pool from Supabase and listen for updates
  const refreshStakePool = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshingPool(true)
    try {
      await syncStakePoolFromSupabase()
      setStakePoolVersion((v) => v + 1)
    } finally {
      if (showSpinner) {
        setTimeout(() => setIsRefreshingPool(false), 400)
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

  // Current stake pool metrics
  const stakeData = useMemo(() => {
    return getStakePool()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stakePoolVersion])

  const myStake = useMemo(() => {
    return getPlayerStake(playerName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerName, stakePoolVersion, stakeData])

  const investorsList = useMemo(() => {
    const total = stakeData.totalPool > 0 ? stakeData.totalPool : 1
    return Object.entries(stakeData.contributions || {})
      .filter(([_, tokens]) => tokens > 0)
      .map(([name, tokens]) => {
        const percent = Math.round((tokens / total) * 10000) / 100
        return {
          name,
          tokens,
          percent,
          isMe: name.toLowerCase().trim() === playerName.toLowerCase().trim(),
        }
      })
      .sort((a, b) => b.tokens - a.tokens)
  }, [stakeData, playerName])

  // Investor role title calculation
  const myInvestorTier = useMemo(() => {
    if (myStake.contribution <= 0) return { title: 'Observer', rank: 'Non-Shareholder (0 Tokens Staked)', color: 'text-gray-400' }
    if (myStake.percent >= 99.9) return { title: 'Sole Sovereign Owner', rank: '100% Equity Monopoly', color: 'text-[#fde047]' }
    if (myStake.percent >= 50) return { title: 'Majority Stakeholder', rank: `${myStake.percent.toFixed(1)}% Majority Equity`, color: 'text-[#fde047]' }
    return { title: 'Casino Stakeholder', rank: `${myStake.percent.toFixed(1)}% Equity Stake`, color: 'text-[#38bdf8]' }
  }, [myStake])

  // Owned venues calculations
  const myOwnedCasinos = useMemo(() => {
    return casinos.filter((c) => {
      if (currentUid && c.owner_id === currentUid) return true
      if (c.owner_name && c.owner_name.toLowerCase() === playerName.toLowerCase()) return true
      return false
    })
  }, [casinos, currentUid, playerName])

  // Venue pending revenue calculation (scaled by upgrade level)
  const getVenuePending = useCallback((casinoId: string, currentTime: number) => {
    const rev = CASINO_REVENUE[casinoId]
    if (!rev) return { chips: 0, tokens: 0, elapsedSec: 0, level: 1 }
    const level = venueLevels[casinoId] ?? 1
    const lastAt = revenueTimestamps[casinoId] ?? currentTime
    const elapsedSec = Math.min(12 * 3600, Math.max(0, Math.floor((currentTime - lastAt) / 1000)))
    const chips = elapsedSec * rev.chipsPerSec * level
    const tokens = Math.floor((elapsedSec / 3600) * rev.tokensPerHour * level)
    return { chips, tokens, elapsedSec, level }
  }, [revenueTimestamps, venueLevels])

  // Total pending revenue (from owned venues)
  const totalPending = useMemo(() => {
    let chips = 0
    let tokens = 0
    for (const c of myOwnedCasinos) {
      const p = getVenuePending(c.id, now)
      chips += p.chips
      tokens += p.tokens
    }
    return { chips, tokens }
  }, [myOwnedCasinos, getVenuePending, now])

  // Total generation rate (from owned venues scaled by level)
  const totalRates = useMemo(() => {
    let chipsPerSec = 0
    let tokensPerHour = 0
    for (const c of myOwnedCasinos) {
      const rev = CASINO_REVENUE[c.id]
      if (rev) {
        const level = venueLevels[c.id] ?? 1
        chipsPerSec += rev.chipsPerSec * level
        tokensPerHour += rev.tokensPerHour * level
      }
    }
    return { chipsPerSec, tokensPerHour }
  }, [myOwnedCasinos, venueLevels])

  // Handle Venue Level Upgrade
  const handleUpgradeVenue = useCallback((casino: CasinoRecord) => {
    const currentLevel = venueLevels[casino.id] ?? 1
    const nextLevel = currentLevel + 1
    const upgradeCost = getVenueUpgradeCost(casino.price, currentLevel)
    const isChip = isChipCasino(casino.id)

    if (isChip && balance < upgradeCost) {
      setError(`Insufficient chips. Upgrading ${casino.name} to Level ${nextLevel} costs ${fmt(upgradeCost)} chips, but you have ${fmt(balance)}.`)
      return
    }
    if (!isChip && tokens < upgradeCost) {
      setError(`Insufficient tokens. Upgrading ${casino.name} to Level ${nextLevel} costs ${fmt(upgradeCost)} tokens, but you have ${fmt(tokens)}.`)
      return
    }

    // Collect any uncollected revenue before upgrading so no pending cash flow is lost
    const pending = getVenuePending(casino.id, now)
    if (pending.chips > 0) credit(pending.chips)
    if (pending.tokens > 0) creditTokens(pending.tokens)

    // Spend upgrade cost
    if (isChip) {
      if (!spend(upgradeCost)) {
        setError('Chip deduction failed.')
        return
      }
    } else {
      if (!spendTokens(upgradeCost)) {
        setError('Token deduction failed.')
        return
      }
    }

    const nextLevels = { ...venueLevels, [casino.id]: nextLevel }
    setVenueLevels(nextLevels)
    saveVenueLevels(playerName, nextLevels)

    saveRevenueTimestamps({
      ...revenueTimestamps,
      [casino.id]: Date.now(),
    })

    const revDef = CASINO_REVENUE[casino.id]
    sfx.coin()
    setMessage(
      `🎉 UPGRADE SUCCESS: ${casino.name} upgraded to Level ${nextLevel}! Revenue generation boosted to +${fmt((revDef?.chipsPerSec ?? 0) * nextLevel)} chips/s${(revDef?.tokensPerHour ?? 0) > 0 ? ` & +${(revDef?.tokensPerHour ?? 0) * nextLevel} tokens/h` : ''}!`
    )
    setError('')
  }, [venueLevels, balance, tokens, getVenuePending, now, credit, creditTokens, spend, spendTokens, playerName, revenueTimestamps, saveRevenueTimestamps])

  // Collect All Revenue
  const handleCollectAll = useCallback(() => {
    if (totalPending.chips <= 0 && totalPending.tokens <= 0) {
      setError('No revenue to collect yet. Your casino properties earn revenue continuously every second!')
      return
    }

    const collectedChips = totalPending.chips
    const collectedTokens = totalPending.tokens

    if (collectedChips > 0) {
      credit(collectedChips)
    }
    if (collectedTokens > 0) {
      creditTokens(collectedTokens)
    }

    const nextTimestamps = { ...revenueTimestamps }
    for (const c of myOwnedCasinos) {
      nextTimestamps[c.id] = Date.now()
    }
    saveRevenueTimestamps(nextTimestamps)

    sfx.coin()
    setMessage(`🎉 Successfully collected ${fmt(collectedChips)} chips${collectedTokens > 0 ? ` and ${collectedTokens} tokens` : ''} from your casino venues!`)
    setError('')
  }, [totalPending, credit, creditTokens, revenueTimestamps, myOwnedCasinos, saveRevenueTimestamps])

  // Collect single venue revenue
  const handleCollectSingleVenue = useCallback((casinoId: string) => {
    const pending = getVenuePending(casinoId, now)
    if (pending.chips <= 0 && pending.tokens <= 0) return
    if (pending.chips > 0) credit(pending.chips)
    if (pending.tokens > 0) creditTokens(pending.tokens)
    saveRevenueTimestamps({
      ...revenueTimestamps,
      [casinoId]: Date.now(),
    })
    const casino = casinos.find((c) => c.id === casinoId)
    sfx.coin()
    setMessage(`🎉 Collected ${fmt(pending.chips)} chips${pending.tokens > 0 ? ` and ${pending.tokens} tokens` : ''} from ${casino?.name || 'venue'}!`)
    setError('')
  }, [getVenuePending, now, credit, creditTokens, saveRevenueTimestamps, revenueTimestamps, casinos])

  // Handle Staking Tokens into Central Pool
  const handleStakeTokens = async () => {
    const amt = parseInt(stakeAmountInput, 10)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Please enter a valid positive token amount.')
      return
    }
    if (tokens < amt) {
      setError(`Insufficient tokens. You have ${tokens} tokens available, but tried to stake ${amt}.`)
      return
    }

    setIsStaking(true)
    setError('')
    setMessage('')
    sfx.click()

    try {
      if (!spendTokens(amt)) {
        setError('Token balance deduction failed.')
        setIsStaking(false)
        return
      }

      sfx.coin()
      investInStakePool(playerName, amt)
      setStakePoolVersion((v) => v + 1)
      setMessage(`🏛️ STAKE LOCKED: Successfully staked ${fmt(amt)} tokens into Golden Felt Casino liquidity pool!`)
    } catch {
      setError('Error while processing token stake transaction.')
    } finally {
      setIsStaking(false)
    }
  }

  // Handle Venue Deed Acquisition
  const handleBuyVenue = async (casino: CasinoRecord) => {
    const isChip = isChipCasino(casino.id)
    if (isChip && balance < casino.price) {
      setError(`Insufficient chips. ${casino.name} costs ${fmt(casino.price)} chips, but you only have ${fmt(balance)}.`)
      return
    }
    if (!isChip && tokens < casino.price) {
      setError(`Insufficient tokens. ${casino.name} costs ${fmt(casino.price)} tokens, but you only have ${fmt(tokens)}.`)
      return
    }

    setPurchasingId(casino.id)
    setError('')
    setMessage('')
    sfx.click()

    try {
      const res = await buyCasino(casino.id, playerName)
      if (res.success) {
        if (isChip) {
          spend(casino.price)
        } else {
          spendTokens(casino.price)
        }
        sfx.coin()
        const nextLevels = { ...venueLevels, [casino.id]: 1 }
        setVenueLevels(nextLevels)
        saveVenueLevels(playerName, nextLevels)
        saveRevenueTimestamps({ ...revenueTimestamps, [casino.id]: Date.now() })
        setMessage(
          `🏛️ DEED ACQUIRED! You are now the official sovereign owner of ${casino.name}! (-${fmt(casino.price)} ${isChip ? 'chips' : 'tokens'})`
        )
        await loadCasinos()
      } else {
        // Fallback local acquisition if offline
        if (isChip) {
          spend(casino.price)
        } else {
          spendTokens(casino.price)
        }
        sfx.coin()
        const nextLevels = { ...venueLevels, [casino.id]: 1 }
        setVenueLevels(nextLevels)
        saveVenueLevels(playerName, nextLevels)
        saveRevenueTimestamps({ ...revenueTimestamps, [casino.id]: Date.now() })
        setMessage(
          `🏛️ DEED ACQUIRED LOCALLY! You are now the official owner of ${casino.name}! (-${fmt(casino.price)} ${isChip ? 'chips' : 'tokens'})`
        )
        await loadCasinos()
      }
    } catch {
      if (isChip) {
        spend(casino.price)
      } else {
        spendTokens(casino.price)
      }
      sfx.coin()
      const nextLevels = { ...venueLevels, [casino.id]: 1 }
      setVenueLevels(nextLevels)
      saveVenueLevels(playerName, nextLevels)
      saveRevenueTimestamps({ ...revenueTimestamps, [casino.id]: Date.now() })
      setMessage(`🏛️ Casino deed acquired locally! (-${fmt(casino.price)} ${isChip ? 'chips' : 'tokens'})`)
    } finally {
      setPurchasingId(null)
    }
  }

  const myChipPortfolioValue = useMemo(() => {
    return myOwnedCasinos.filter((c) => isChipCasino(c.id)).reduce((sum, c) => sum + c.price, 0)
  }, [myOwnedCasinos])

  const myTokenPortfolioValue = useMemo(() => {
    return myOwnedCasinos.filter((c) => !isChipCasino(c.id)).reduce((sum, c) => sum + c.price, 0)
  }, [myOwnedCasinos])

  // Filtered venues for display
  const displayedCasinos = useMemo(() => {
    return casinos.filter((c) => {
      const isChip = isChipCasino(c.id)
      const isMe =
        (currentUid && c.owner_id === currentUid) ||
        (c.owner_name && c.owner_name.toLowerCase() === playerName.toLowerCase())

      if (venueFilter === 'chips') return isChip
      if (venueFilter === 'tokens') return !isChip
      if (venueFilter === 'owned') return isMe
      return true
    })
  }, [casinos, venueFilter, currentUid, playerName])

  // Live equity preview calculation when staking
  const parsedStakeInput = parseInt(stakeAmountInput, 10) || 0
  const projectedPool = myStake.contribution + parsedStakeInput
  const projectedPercent = projectedPool > 0 ? 100 : 0
  const equityGain = projectedPercent - myStake.percent

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6">
      {/* Header Banner */}
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#c9a227]/40 bg-black/60 px-3.5 py-1 mb-2 shadow-sm">
          <Crown size={13} className="text-[#f6e27a]" />
          <span className="text-[10px] font-bold tracking-widest text-[#f6e27a]">
            SOVEREIGN REAL ESTATE &amp; DECENTRALIZED EQUITY
          </span>
        </div>
        <h1 className="font-display gold-text-bright text-3xl font-black tracking-[0.18em] sm:text-4xl">
          GOLDEN FELT PROPERTIES &amp; STAKE
        </h1>
        <p className="mt-1 text-[13px] text-[#a89872]">
          Invest scarce tokens into the central house liquidity pool or acquire sovereign casino deeds
        </p>
        <div className="divider-gold mx-auto mt-3 w-48" />
      </div>

      {/* ================================================================= */}
      {/* ONE-TIME PROPERTY RECLAMATION COMPENSATION ACCORD (75M CHIPS)     */}
      {/* ================================================================= */}
      <div className="mb-6 rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-r from-[#022c22] via-black to-[#063018] p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 shadow-sm">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                  SOVEREIGN PROPERTY RECLAMATION ACCORD
                </span>
                <span className="rounded bg-emerald-400/20 px-2 py-0.5 text-[8.5px] font-bold text-emerald-300 border border-emerald-400/30">
                  NON-RECURRING SETTLEMENT
                </span>
              </div>
              <p className="text-[12px] text-[#a7f3d0] font-medium mt-0.5">
                Every player who had legacy properties seized has been credited with a one-time <span className="text-[#fde047] font-black">75,000,000 chips</span> compensation bailout. Anti-inflation locks are active so it will never recur.
              </p>
            </div>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <span className="text-[9px] tracking-widest text-emerald-300 font-bold block uppercase">ONE-TIME SETTLEMENT</span>
            <span className="font-display text-lg font-black text-[#fde047]">+75,000,000 chips</span>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* LIVE CASINO VENUE REVENUE VAULT                                   */}
      {/* ================================================================= */}
      <div className="mb-8 rounded-2xl border-2 border-[#f6e27a]/60 bg-gradient-to-r from-[#2a1d04] via-black to-[#071829] p-5 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-[#f6e27a]/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-[#38bdf8]/10 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 rounded bg-[#f6e27a]/20 border border-[#f6e27a]/50 px-2.5 py-0.5 text-[9.5px] font-black tracking-widest text-[#f6e27a]">
                <Zap size={11} className="text-[#f6e27a] animate-pulse" />
                PASSIVE REVENUE ENGINE ACTIVE
              </span>
              <span className="text-[11px] text-[#8a7a4d]">
                Accruing real-time cash flow
              </span>
            </div>
            <h2 className="font-display gold-text-bright text-xl sm:text-2xl font-black tracking-wider flex items-center gap-2">
              <Coins size={22} className="text-[#f6e27a]" />
              CASINO VENUE REVENUE VAULT
            </h2>
            <p className="text-[12px] text-[#a89872] mt-0.5">
              Active cash flow generated by your {myOwnedCasinos.length} owned casino {myOwnedCasinos.length === 1 ? 'venue' : 'venues'}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Live generation rate */}
            <div className="rounded-xl border border-white/10 bg-black/60 px-4 py-2 text-left sm:text-right">
              <div className="text-[9px] tracking-widest text-[#8a7a4d] uppercase font-bold">GENERATION RATE</div>
              <div className="text-sm font-black text-[#f6e27a] flex items-center gap-1.5 sm:justify-end">
                <span>+{fmt(totalRates.chipsPerSec)} chips/s</span>
                {totalRates.tokensPerHour > 0 && (
                  <span className="text-[#7dd3fc]">· +{totalRates.tokensPerHour} tokens/h</span>
                )}
              </div>
            </div>

            {/* Uncollected Amount */}
            <div className="rounded-xl border border-[#f6e27a]/40 bg-[#2a2105]/60 px-4 py-2 text-left sm:text-right">
              <div className="text-[9px] tracking-widest text-[#86efac] uppercase font-bold">UNCOLLECTED ACCRUED</div>
              <div className="font-display text-xl sm:text-2xl font-black text-[#fde047] tabular-nums flex items-center gap-2 sm:justify-end">
                <span>+{fmt(totalPending.chips)}</span>
                <span className="text-xs text-[#f6e27a]">chips</span>
                {totalPending.tokens > 0 && (
                  <span className="text-sm text-[#7dd3fc]">+{totalPending.tokens} tokens</span>
                )}
              </div>
            </div>

            {/* Collect Button */}
            <button
              onClick={handleCollectAll}
              disabled={totalPending.chips <= 0 && totalPending.tokens <= 0}
              className={`rounded-xl px-5 py-3 font-black text-xs tracking-widest transition-all shadow-xl flex items-center gap-2 ${
                totalPending.chips > 0 || totalPending.tokens > 0
                  ? 'bg-gradient-to-r from-[#eab308] via-[#facc15] to-[#ca8a04] text-black hover:scale-105 active:scale-95 shadow-[0_0_25px_rgba(250,204,21,0.5)] cursor-pointer'
                  : 'bg-white/10 text-gray-500 cursor-not-allowed border border-white/10'
              }`}
            >
              <Coins size={16} />
              COLLECT ALL REVENUE
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation Buttons */}
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => {
            sfx.click()
            setActiveTab('pool')
          }}
          className={`flex items-center justify-between rounded-xl p-4 text-xs font-black tracking-wider transition-all shadow-md ${
            activeTab === 'pool'
              ? 'border-2 border-[#38bdf8] bg-gradient-to-r from-[#0369a1] to-[#0284c7] text-white shadow-[0_0_20px_rgba(56,189,248,0.35)]'
              : 'border border-[#38bdf8]/30 bg-black/60 text-[#7dd3fc] hover:border-[#38bdf8]/60 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Coins size={18} className={activeTab === 'pool' ? 'text-white' : 'text-[#38bdf8]'} />
            <div className="text-left">
              <div className="text-sm">🪙 CASINO TOKEN STAKE POOL</div>
              <div className="text-[10px] text-gray-300 font-normal">Central house liquidity &amp; equity</div>
            </div>
          </div>
          {myStake.percent > 0 && (
            <span className="rounded-full bg-[#f6e27a] px-2.5 py-1 text-[10px] font-black text-black">
              {myStake.percent.toFixed(1)}% OWNED
            </span>
          )}
        </button>

        <button
          onClick={() => {
            sfx.click()
            setActiveTab('venues')
          }}
          className={`flex items-center justify-between rounded-xl p-4 text-xs font-black tracking-wider transition-all shadow-md ${
            activeTab === 'venues'
              ? 'border-2 border-[#f6e27a] bg-gradient-to-r from-[#b45309] to-[#d97706] text-white shadow-[0_0_20px_rgba(246,226,122,0.35)]'
              : 'border border-[#c9a227]/30 bg-black/60 text-[#f2e6c9] hover:border-[#f6e27a]/60 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Building2 size={18} className={activeTab === 'venues' ? 'text-white' : 'text-[#f6e27a]'} />
            <div className="text-left">
              <div className="text-sm">🏛️ 8 CASINO VENUES (DEEDS)</div>
              <div className="text-[10px] text-gray-300 font-normal">Slots 1–4 Chips · 5–8 Tokens</div>
            </div>
          </div>
          <span className="rounded-full bg-black/60 border border-white/10 px-2.5 py-1 text-[10px] text-[#8a7a4d]">
            {myOwnedCasinos.length}/8 Owned
          </span>
        </button>
      </div>

      {/* Global Status Messages */}
      {message && (
        <div role="status" className="mb-6 rounded-xl border border-[#10b981]/60 bg-[#064e3b]/80 p-3.5 text-center text-[12px] font-semibold text-[#a7f3d0] shadow-lg animate-fadeIn">
          {message}
        </div>
      )}
      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-[#ef4444]/60 bg-[#450a0a]/80 p-3.5 text-center text-[12px] font-semibold text-[#fca5a5] shadow-lg animate-fadeIn">
          {error}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 1: CASINO TOKEN STAKE POOL (EQUITY SHARE)                      */}
      {/* ================================================================= */}
      {activeTab === 'pool' && (
        <div className="space-y-7 animate-fadeIn">
          {/* Stake Pool Stat Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="panel-noir rounded-2xl p-5 border border-[#38bdf8]/40 shadow-xl bg-gradient-to-b from-[#082f49]/40 to-black">
              <div className="flex items-center justify-between">
                <span className="text-[9px] tracking-[0.25em] text-[#7dd3fc]">TOTAL POOL TOKENS</span>
                <Coins size={14} className="text-[#38bdf8]" />
              </div>
              <div className="font-display mt-2 text-2xl font-black text-[#7dd3fc] tabular-nums">
                {fmt(stakeData.totalPool)}
              </div>
              <div className="mt-1 text-[10.5px] text-[#38bdf8]/80">
                Total tokens locked in vault
              </div>
            </div>

            <div className="panel-noir rounded-2xl p-5 border border-[#f6e27a]/40 shadow-xl bg-gradient-to-b from-[#2a2105]/40 to-black">
              <div className="flex items-center justify-between">
                <span className="text-[9px] tracking-[0.25em] text-[#f6e27a]">YOUR STAKED TOKENS</span>
                <ShieldCheck size={14} className="text-[#f6e27a]" />
              </div>
              <div className="font-display mt-2 text-2xl font-black text-[#fde047] tabular-nums">
                {fmt(myStake.contribution)}
              </div>
              <div className="mt-1 text-[10.5px] text-[#8a7a4d]">
                Wallet balance: {fmt(tokens)} tokens
              </div>
            </div>

            <div className="panel-noir rounded-2xl p-5 border border-[#86efac]/40 shadow-xl bg-gradient-to-b from-[#064e3b]/40 to-black">
              <div className="flex items-center justify-between">
                <span className="text-[9px] tracking-[0.25em] text-[#86efac]">YOUR CASINO OWNERSHIP</span>
                <Crown size={14} className="text-[#86efac]" />
              </div>
              <div className="font-display mt-2 text-2xl font-black text-[#86efac] tabular-nums">
                {myStake.percent.toFixed(2)}%
              </div>
              <div className="mt-1 text-[10.5px] text-[#86efac]/80">
                {myInvestorTier.title}
              </div>
            </div>
          </div>

          {/* Visual Stake Pool Ownership Breakdown Bar */}
          <div className="rounded-2xl border border-[#38bdf8]/30 bg-black/70 p-5 shadow-2xl backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-[#0284c7]/20 border border-[#38bdf8]/40 px-2.5 py-0.5 text-[9px] font-black text-[#7dd3fc]">
                  MACRO CAP TABLE
                </span>
                <span className="text-[11.5px] font-bold tracking-wider text-[#f2e6c9]">
                  CENTRAL STAKE POOL OWNERSHIP DISTRIBUTION
                </span>
              </div>
              <div className="text-[11.5px] text-[#8a7a4d]">
                Your Equity: <span className="font-bold text-[#fde047]">{myStake.percent.toFixed(2)}%</span>
              </div>
            </div>

            {/* Segmented bar */}
            <div className="h-5 w-full overflow-hidden rounded-full bg-black/90 ring-1 ring-[#38bdf8]/30 flex p-0.5 items-center">
              {stakeData.totalPool <= 0 ? (
                <div className="flex h-full w-full items-center justify-center text-[10px] tracking-wider text-gray-500 font-bold">
                  VAULT EMPTY · 0 TOKENS STAKED · STAKE TOKENS TO FUND POOL
                </div>
              ) : (
                investorsList.map((inv, idx) => (
                  <div
                    key={inv.name}
                    style={{ width: `${Math.max(2, inv.percent)}%` }}
                    title={`${inv.name}: ${fmt(inv.tokens)} tokens (${inv.percent.toFixed(1)}%)`}
                    className={`h-full ${
                      inv.isMe
                        ? 'bg-gradient-to-r from-[#d97706] via-[#fde047] to-[#fbbf24] shadow-[0_0_15px_rgba(251,191,36,0.7)]'
                        : idx % 2 === 0
                        ? 'bg-gradient-to-r from-[#0284c7] to-[#38bdf8]'
                        : 'bg-gradient-to-r from-[#7c3aed] to-[#a855f7]'
                    }`}
                  />
                ))
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-6 text-[10.5px] text-[#8a7a4d]">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-[#d97706] to-[#fde047]" />
                <span className="font-bold text-[#fde047]">
                  {myStake.contribution > 0
                    ? `✦ ${myStake.percent.toFixed(1)}% Casino Equity (${fmt(myStake.contribution)} tokens staked by you) · Total Pool: ${fmt(stakeData.totalPool)} tokens ✦`
                    : 'No tokens in pool yet'}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Staking Panel */}
          <div className="rounded-2xl border-2 border-[#38bdf8]/40 bg-gradient-to-b from-[#091e30] via-[#040d16] to-black p-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5 border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] tracking-[0.25em] text-[#38bdf8] font-black uppercase">
                  INVESTMENT TERMINAL
                </span>
                <h2 className="font-display gold-text-bright text-xl sm:text-2xl font-black tracking-wider">
                  DEPOSIT SCARCE TOKENS INTO CASINO LIQUIDITY
                </h2>
                <p className="text-[12px] text-[#8a7a4d] mt-0.5">
                  Deposit scarce tokens to increase your ownership % and climb the casino cap table.
                </p>
              </div>

              <div className="rounded-xl border border-[#38bdf8]/40 bg-[#0284c7]/20 px-3.5 py-2 text-right">
                <div className="text-[9px] tracking-widest text-[#7dd3fc]">AVAILABLE TO STAKE</div>
                <div className="font-display text-lg font-black text-white flex items-center gap-1 justify-end">
                  <Sparkles size={14} className="text-[#38bdf8]" />
                  <span>{fmt(tokens)}</span> <span className="text-xs font-normal text-gray-300">tokens</span>
                </div>
              </div>
            </div>

            {/* Input & Staking Form */}
            <div className="grid gap-6 md:grid-cols-12 items-center">
              <div className="md:col-span-7 space-y-3">
                <label className="text-[11px] font-bold tracking-wider text-[#f2e6c9] block">
                  AMOUNT OF TOKENS TO DEPOSIT:
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="1"
                      max={tokens}
                      value={stakeAmountInput}
                      onChange={(e) => setStakeAmountInput(e.target.value)}
                      placeholder="Enter token amount..."
                      className="w-full rounded-xl border border-[#38bdf8]/40 bg-black/80 px-4 py-3 font-display text-lg font-bold text-[#7dd3fc] placeholder-gray-600 focus:border-[#38bdf8] focus:outline-none"
                    />
                    <span className="absolute right-3.5 top-3.5 text-xs font-black text-[#38bdf8]/70">
                      TOKENS
                    </span>
                  </div>

                  <button
                    onClick={handleStakeTokens}
                    disabled={isStaking || tokens <= 0}
                    className="btn-gold rounded-xl px-6 py-3 text-xs font-black tracking-wider shadow-lg flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {isStaking ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <>
                        <Coins size={14} />
                        STAKE {parsedStakeInput > 0 ? fmt(parsedStakeInput) : ''} TOKENS
                      </>
                    )}
                  </button>
                </div>

                {/* Quick Add Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[10px] font-bold text-[#8a7a4d]">QUICK SELECT:</span>
                  {[25, 100, 500, 1000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        sfx.tick()
                        setStakeAmountInput(amt.toString())
                      }}
                      className="rounded-lg border border-[#38bdf8]/30 bg-black/50 px-2.5 py-1 text-[11px] font-bold text-[#7dd3fc] hover:border-[#38bdf8] hover:bg-[#38bdf8]/20 transition-all"
                    >
                      +{amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      sfx.tick()
                      setStakeAmountInput(tokens.toString())
                    }}
                    className="rounded-lg border border-[#f6e27a]/40 bg-[#2a2105]/60 px-3 py-1 text-[11px] font-black text-[#f6e27a] hover:border-[#f6e27a] transition-all"
                  >
                    MAX ({fmt(tokens)})
                  </button>
                </div>
              </div>

              {/* Dynamic Live Preview Card */}
              <div className="md:col-span-5 rounded-xl border border-[#38bdf8]/30 bg-black/60 p-4">
                <span className="text-[9px] tracking-[0.2em] text-[#8a7a4d] block mb-2">
                  STAKING IMPACT PREVIEW
                </span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-[#8a7a4d]">
                    <span>Current Ownership:</span>
                    <span className="font-bold text-[#f2e6c9]">{myStake.percent.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between text-[#38bdf8]">
                    <span>Projected Ownership:</span>
                    <span className="font-black text-[#7dd3fc] text-sm">
                      {parsedStakeInput > 0 ? projectedPercent.toFixed(2) : myStake.percent.toFixed(2)}%
                    </span>
                  </div>
                  {parsedStakeInput > 0 && equityGain > 0 && (
                    <div className="flex justify-between text-[#86efac] font-bold text-[11px] pt-1 border-t border-white/5">
                      <span>Equity Gain:</span>
                      <span>+{equityGain.toFixed(2)}% of Golden Felt</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Central Stakeholders Cap Table */}
          <div className="rounded-2xl border border-white/10 bg-black/60 p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display gold-text text-base font-bold tracking-wider flex items-center gap-2">
                  <Trophy size={16} className="text-[#f6e27a]" />
                  CENTRAL STAKEHOLDERS CAP TABLE &amp; LEADERBOARD
                </h3>
                <p className="text-[11.5px] text-[#8a7a4d]">
                  Official investor cap table ranked by scarce tokens staked into the liquidity pool
                </p>
              </div>
              <button
                onClick={() => refreshStakePool(true)}
                disabled={isRefreshingPool}
                className="btn-ghost-gold rounded-lg px-2.5 py-1 text-[11px] flex items-center gap-1.5"
              >
                <RefreshCw size={11} className={isRefreshingPool ? 'animate-spin' : ''} /> Refresh Cap Table
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[9.5px] font-black tracking-widest text-[#8a7a4d]">
                    <th className="py-2.5 pl-3">RANK</th>
                    <th className="py-2.5">INVESTOR IDENTITY</th>
                    <th className="py-2.5 text-right">TOKENS STAKED</th>
                    <th className="py-2.5 text-right pr-3">EQUITY SHARE (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {investorsList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-xs text-gray-400 font-semibold">
                        🪙 The central stake pool is completely empty (0 tokens). Deposit tokens below to fund the pool and become owner of Golden Felt Casino!
                      </td>
                    </tr>
                  ) : (
                    investorsList.map((inv, idx) => (
                      <tr
                        key={inv.name}
                        className={inv.isMe ? 'bg-[#2a2105]/70 font-bold border-l-2 border-[#f6e27a]' : 'hover:bg-white/[0.02]'}
                      >
                        <td className="py-3 pl-3">
                          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                            idx === 0
                              ? 'bg-[#f6e27a] text-black shadow-sm'
                              : idx === 1
                              ? 'bg-gray-300 text-black'
                              : idx === 2
                              ? 'bg-amber-700 text-white'
                              : 'bg-white/10 text-gray-300'
                          }`}>
                            #{idx + 1}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <Nametag name={inv.name} compact />
                            {inv.isMe && (
                              <span className="rounded bg-[#f6e27a]/20 border border-[#f6e27a]/40 px-1.5 py-0.5 text-[9px] font-black text-[#f6e27a]">
                                {inv.percent >= 99.9 ? 'SOLE OWNER (YOU)' : 'YOU'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-right tabular-nums font-bold text-[#7dd3fc]">
                          {fmt(inv.tokens)} <span className="text-[10px] font-normal text-[#38bdf8]/70">tokens</span>
                        </td>
                        <td className="py-3 text-right pr-3 tabular-nums font-black text-[#fde047]">
                          {inv.percent.toFixed(2)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: 8 CASINO VENUES (DEEDS)                                     */}
      {/* Slots 1-4 = Chips, Slots 5-8 = Tokens                             */}
      {/* ================================================================= */}
      {activeTab === 'venues' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Portfolio Overview Cards */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="panel-noir rounded-xl p-4 border border-[#c9a227]/30 shadow-lg">
              <div className="text-[9px] tracking-[0.25em] text-[#8a7a4d]">YOUR CHIP VENUE HOLDINGS</div>
              <div className="font-display mt-1 text-xl font-black text-[#fde047] tabular-nums">
                {fmt(myChipPortfolioValue)} chips
              </div>
              <div className="mt-1 text-[10px] text-[#8a7a4d]">
                {myOwnedCasinos.filter((c) => isChipCasino(c.id)).length} chip venue{myOwnedCasinos.filter((c) => isChipCasino(c.id)).length !== 1 ? 's' : ''} owned
              </div>
            </div>

            <div className="panel-noir rounded-xl p-4 border border-[#38bdf8]/30 shadow-lg">
              <div className="text-[9px] tracking-[0.25em] text-[#38bdf8]">YOUR TOKEN VENUE HOLDINGS</div>
              <div className="font-display mt-1 text-xl font-black text-[#7dd3fc] tabular-nums">
                {fmt(myTokenPortfolioValue)} tokens
              </div>
              <div className="mt-1 text-[10px] text-[#38bdf8]/70">
                {myOwnedCasinos.filter((c) => !isChipCasino(c.id)).length} token venue{myOwnedCasinos.filter((c) => !isChipCasino(c.id)).length !== 1 ? 's' : ''} owned
              </div>
            </div>

            <div className="panel-noir rounded-xl p-4 border border-white/10 shadow-lg">
              <div className="text-[9px] tracking-[0.25em] text-[#8a7a4d]">TOTAL MARKET STATUS</div>
              <div className="font-display mt-1 text-xl font-bold text-white">
                {casinos.filter((c) => c.owner_id !== null).length} / {casinos.length} CLAIMED
              </div>
              <div className="mt-1 text-[10px] text-[#8a7a4d]">
                {casinos.length - casinos.filter((c) => c.owner_id !== null).length} unowned deed{casinos.length - casinos.filter((c) => c.owner_id !== null).length !== 1 ? 's' : ''} available
              </div>
            </div>

            <div className="panel-noir rounded-xl p-4 border border-white/10 shadow-lg">
              <div className="text-[9px] tracking-[0.25em] text-[#8a7a4d]">YOUR WALLET BALANCES</div>
              <div className="mt-1 flex items-baseline justify-between text-xs font-bold">
                <span className="text-[#fde047]">{fmt(balance)} chips</span>
                <span className="text-[#7dd3fc]">{fmt(tokens)} tokens</span>
              </div>
              <div className="mt-1 text-[10px] text-[#6b5f42]">
                Slots 1–4 take chips · 5–8 take tokens
              </div>
            </div>
          </div>

          {/* Filter Pills & Refresh */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display gold-text text-xl font-bold tracking-[0.12em]">
                  THE 8 CASINO VENUES &amp; DEEDS
                </h2>
                <button
                  onClick={() => loadCasinos(true)}
                  disabled={isRefreshingCasinos}
                  title="Refresh Venues"
                  className="text-[#f6e27a] hover:text-white transition-opacity disabled:opacity-50"
                >
                  <RefreshCw size={12} className={isRefreshingCasinos ? 'animate-spin' : ''} />
                </button>
              </div>
              <p className="text-[11.5px] text-[#8a7a4d]">
                Slots 1–4 priced in Chips · Slots 5–8 priced in Scarce Tokens
              </p>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/60 p-1">
              {[
                { id: 'all', label: 'All 8 Venues' },
                { id: 'chips', label: 'Slots 1–4 (Chips)' },
                { id: 'tokens', label: 'Slots 5–8 (Tokens)' },
                { id: 'owned', label: `My Owned (${myOwnedCasinos.length})` },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => {
                    sfx.tick()
                    setVenueFilter(pill.id as any)
                  }}
                  className={`rounded-lg px-2.5 py-1 text-[10.5px] font-bold transition-all ${
                    venueFilter === pill.id
                      ? 'bg-[#c9a227] text-black shadow-sm'
                      : 'text-[#8a7a4d] hover:text-white'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Venues Grid */}
          {isLoadingCasinos ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
              <RefreshCw size={28} className="animate-spin text-[#f6e27a]" />
              <p className="font-display text-sm tracking-widest text-[#b3a06b]">SYNCHRONIZING WITH SUPABASE...</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {displayedCasinos.map((c) => {
                const slotNum = c.slot_num ?? getCasinoSlotNum(c.id)
                const isChip = isChipCasino(c.id)
                const isMe =
                  (currentUid && c.owner_id === currentUid) ||
                  (c.owner_name && c.owner_name.toLowerCase() === playerName.toLowerCase())
                const isOwned = c.owner_id !== null
                const canAfford = isChip ? balance >= c.price : tokens >= c.price
                const isProcessing = purchasingId === c.id
                const venuePending = getVenuePending(c.id, now)
                const revDef = CASINO_REVENUE[c.id]
                const currentLevel = isMe ? (venueLevels[c.id] ?? 1) : 1
                const nextCost = getVenueUpgradeCost(c.price, currentLevel)
                const canAffordUpgrade = isChip ? balance >= nextCost : tokens >= nextCost

                return (
                  <div
                    key={c.id}
                    className={`panel-noir relative flex flex-col justify-between rounded-2xl p-5 transition-all duration-300 transform-gpu hover:-translate-y-1.5 ${
                      isMe
                        ? 'border-2 border-[#f6e27a] shadow-[0_0_25px_rgba(246,226,122,0.25)] bg-gradient-to-b from-[#2a2105] via-[#141208] to-black'
                        : isOwned
                        ? 'border border-[#38bdf8]/40 bg-gradient-to-b from-[#091b2c] via-[#040c14] to-black'
                        : isChip
                        ? 'border border-[#c9a227]/30 bg-gradient-to-b from-[#181308] to-[#0a080c]'
                        : 'border border-[#38bdf8]/30 bg-gradient-to-b from-[#081824] to-[#04080e]'
                    }`}
                  >
                    <div>
                      {/* Top Header: Slot Number & Currency Badge */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="rounded-full border border-white/10 bg-black/60 px-2.5 py-0.5 text-[9px] font-black tracking-widest text-[#8a7a4d]">
                          SLOT #{slotNum}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {isChip ? (
                            <span className="rounded-full border border-[#f6e27a]/40 bg-[#2a2105] px-2 py-0.5 text-[9px] font-bold text-[#f6e27a]">
                              CHIP VENUE
                            </span>
                          ) : (
                            <span className="rounded-full border border-[#38bdf8]/40 bg-[#0369a1]/30 px-2 py-0.5 text-[9px] font-bold text-[#7dd3fc]">
                              TOKEN VENUE
                            </span>
                          )}

                          {isMe ? (
                            <span className="rounded-full border border-[#f6e27a]/60 bg-[#2a2105] px-2 py-0.5 text-[9px] font-black text-[#f6e27a] flex items-center gap-1 shadow">
                              <Trophy size={10} /> LVL {currentLevel}
                            </span>
                          ) : isOwned ? (
                            <span className="rounded-full border border-gray-600 bg-gray-900/60 px-2 py-0.5 text-[9px] font-bold text-gray-400">
                              CLAIMED
                            </span>
                          ) : (
                            <span className="rounded-full border border-emerald-500/40 bg-emerald-950/40 px-2 py-0.5 text-[9px] font-black text-emerald-300">
                              FOR SALE
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Icon & Title */}
                      <div className="my-3 text-center">
                        <span className="text-5xl drop-shadow-md select-none">{c.icon}</span>
                        <h3 className="font-display gold-text text-base font-bold tracking-wider mt-3">
                          {c.name}
                        </h3>
                        <p className="mt-1 text-[11px] text-[#a89872] leading-relaxed line-clamp-2">
                          {c.tagline}
                        </p>
                      </div>

                      {/* Passive Revenue Rate Badge */}
                      {revDef && (
                        <div className="my-2 rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-2 text-center">
                          <span className="text-[8.5px] tracking-[0.2em] text-emerald-400 font-bold block mb-0.5">
                            PASSIVE REVENUE RATE {isMe && `(LVL ${currentLevel})`}
                          </span>
                          <div className="text-xs font-black text-emerald-300 flex items-center justify-center gap-1">
                            <Zap size={12} className="text-emerald-400" />
                            <span>+{fmt(revDef.chipsPerSec * (isMe ? currentLevel : 1))} chips/s</span>
                            {revDef.tokensPerHour > 0 && (
                              <span className="text-[#7dd3fc]">· +{revDef.tokensPerHour * (isMe ? currentLevel : 1)} tokens/h</span>
                            )}
                          </div>
                          {isMe && currentLevel > 1 && (
                            <div className="text-[8.5px] text-[#f6e27a] font-bold mt-0.5">
                              ✦ ×{currentLevel} Level Multiplier Active ✦
                            </div>
                          )}
                        </div>
                      )}

                      {/* If owned by player, show live uncollected amount */}
                      {isMe && (
                        <div className="my-2 rounded-xl border border-[#f6e27a]/40 bg-[#2a2105]/70 p-2 text-center">
                          <span className="text-[8.5px] tracking-[0.2em] text-[#86efac] font-bold block mb-0.5">
                            YOUR UNCOLLECTED REVENUE
                          </span>
                          <div className="text-sm font-black text-[#fde047] tabular-nums">
                            +{fmt(venuePending.chips)} chips
                            {venuePending.tokens > 0 && (
                              <span className="text-[#7dd3fc] ml-1.5">+{venuePending.tokens} tokens</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Price Plate */}
                      <div className={`my-3 rounded-xl p-3 text-center border ${
                        isChip
                          ? 'border-[#c9a227]/40 bg-black/60'
                          : 'border-[#38bdf8]/40 bg-black/60'
                      }`}>
                        <span className="text-[9px] tracking-[0.25em] text-[#8a7a4d]">
                          {isChip ? 'PURCHASE PRICE (CHIPS)' : 'PURCHASE PRICE (TOKENS)'}
                        </span>
                        <div className={`font-display text-xl font-black mt-0.5 flex items-center justify-center gap-1.5 ${
                          isChip ? 'text-[#fde047]' : 'text-[#7dd3fc]'
                        }`}>
                          {isChip ? <Coins size={15} /> : <Sparkles size={15} />}
                          <span>{fmt(c.price)}</span>
                          <span className="text-[11px] font-normal text-gray-400">
                            {isChip ? 'chips' : 'tokens'}
                          </span>
                        </div>
                      </div>

                      {/* Owner Status Section */}
                      <div className="rounded-xl border border-white/5 bg-black/40 p-2.5 text-center">
                        <span className="text-[8.5px] tracking-[0.2em] text-[#8a7a4d] block mb-1">
                          LEGAL DEED HOLDER
                        </span>
                        {isOwned ? (
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <Nametag
                              compact
                              name={c.owner_name || 'Anonymous Owner'}
                              tagId={c.owner_nametag || 'tag-guest'}
                              badge={c.owner_badge}
                            />
                            {isMe && (
                              <span className="text-[9.5px] font-black text-[#f6e27a] mt-0.5">
                                ✦ YOU HOLD THIS DEED ✦
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-[11px] font-bold text-emerald-400">
                            Unclaimed · The House
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button: Upgrade, Collect, or Buy */}
                    <div className="mt-4 pt-3 border-t border-white/5">
                      {isMe ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex min-h-[32px] items-center justify-between rounded-xl border border-[#f6e27a]/50 bg-[#2a2105]/70 px-3 text-[11px] font-black text-[#f6e27a]">
                            <span className="flex items-center gap-1.5"><Check size={14} /> PROUD OWNER</span>
                            <span className="rounded bg-[#f6e27a]/20 border border-[#f6e27a]/40 px-2 py-0.5 text-[9.5px] text-[#f6e27a]">
                              LEVEL {currentLevel}
                            </span>
                          </div>

                          {/* Upgrade Button */}
                          <button
                            onClick={() => handleUpgradeVenue(c)}
                            disabled={!canAffordUpgrade}
                            className={`min-h-[40px] w-full rounded-xl text-[10.5px] font-black tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 ${
                              canAffordUpgrade
                                ? isChip
                                  ? 'bg-gradient-to-r from-[#ca8a04] via-[#facc15] to-[#eab308] text-black hover:scale-[1.02] active:scale-98 shadow-[0_0_15px_rgba(250,204,21,0.3)]'
                                  : 'bg-gradient-to-r from-[#0284c7] to-[#38bdf8] text-white hover:brightness-110 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                                : 'border border-white/10 bg-black/40 text-gray-500 cursor-not-allowed opacity-60'
                            }`}
                          >
                            <Sparkles size={12} />
                            UPGRADE TO LVL {currentLevel + 1} ({fmt(nextCost)} {isChip ? 'CHIPS' : 'TOKENS'})
                          </button>

                          {/* Collect Button */}
                          <button
                            onClick={() => handleCollectSingleVenue(c.id)}
                            disabled={venuePending.chips <= 0 && venuePending.tokens <= 0}
                            className={`min-h-[36px] w-full rounded-xl text-[10px] font-black tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 ${
                              venuePending.chips > 0 || venuePending.tokens > 0
                                ? 'btn-ghost-gold border border-[#f6e27a]/40 text-[#f6e27a] hover:bg-[#f6e27a]/10'
                                : 'border border-white/10 bg-black/40 text-gray-500 cursor-not-allowed opacity-50'
                            }`}
                          >
                            <Coins size={12} />
                            COLLECT {venuePending.chips > 0 ? `+${fmt(venuePending.chips)} CHIPS` : 'REVENUE'}
                            {venuePending.tokens > 0 ? ` (+${venuePending.tokens} TOKENS)` : ''}
                          </button>
                        </div>
                      ) : isOwned ? (
                        <button
                          disabled
                          className="min-h-[42px] w-full rounded-xl border border-white/10 bg-black/40 text-[10px] font-bold text-gray-500 cursor-not-allowed"
                        >
                          DEED ALREADY OWNED
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBuyVenue(c)}
                          disabled={isProcessing || !canAfford}
                          className={`min-h-[42px] w-full rounded-xl text-[11px] font-black tracking-wider transition-all shadow-lg flex items-center justify-center gap-1.5 ${
                            canAfford
                              ? isChip
                                ? 'btn-gold shadow-md'
                                : 'bg-gradient-to-r from-[#0284c7] to-[#38bdf8] text-white hover:brightness-110 shadow-md'
                              : 'border border-white/10 bg-black/40 text-gray-500 opacity-50 cursor-not-allowed'
                          }`}
                        >
                          {isProcessing ? (
                            <span className="flex items-center gap-1.5">
                              <RefreshCw size={12} className="animate-spin" /> LOCKING DEED...
                            </span>
                          ) : (
                            <>
                              {isChip ? <Coins size={13} /> : <Sparkles size={13} />}
                              BUY DEED · LVL 1 · {fmt(c.price)} {isChip ? 'CHIPS' : 'TOKENS'}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Footer note */}
          <div className="mt-8 text-center text-[10.5px] tracking-[0.25em] text-[#6b5f42]">
            VENUES 1–4 REQUIRE REGULAR CHIPS · VENUES 5–8 REQUIRE SCARCE TOKENS
          </div>
        </div>
      )}
    </div>
  )
}
