import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { playerStorageKey, usePlayer } from './profile'
import { credit as walletCredit, debit as walletDebit, refund as walletRefund, tokenAdd, tokenRemove } from './wallet.js'
import { syncPlayerToSupabase, recordGameHand } from '../lib/supabase'

export const STARTING_CHIPS = 5000
export const MIN_BET = 25
const DAY_MS = 24 * 60 * 60 * 1000

type TokenId = 'secondChance' | 'streakShield' | 'rebuy' | 'hint' | 'doubleDown' | 'freeSpin' | 'mysteryCrate'
export const TOKEN_DEFS: { id: TokenId; name: string; description: string; price: number; dailyLimit: number }[] = [
  { id: 'secondChance', name: 'Second Chance', description: 'Refund 50% of your most recent lost bet.', price: 25000, dailyLimit: 1 },
  { id: 'streakShield', name: 'Streak Shield', description: 'Protects one missed daily visit in your streak.', price: 50000, dailyLimit: 1 },
  { id: 'rebuy', name: 'Rebuy Voucher', description: 'A small poker-room bailout when your chips are nearly gone.', price: 10000, dailyLimit: 1 },
  { id: 'hint', name: 'Poker Coach Hint', description: 'Unlock a poker hand-strength and odds hint.', price: 15000, dailyLimit: 2 },
  { id: 'doubleDown', name: 'Double Down Booster', description: 'Your next winning round earns 1.5× profit, capped at 100,000 bonus chips.', price: 50000, dailyLimit: 1 },
  { id: 'freeSpin', name: 'Free Slot Spin', description: 'One free slot spin at a fixed 500-chip bet.', price: 25000, dailyLimit: 2 },
  { id: 'mysteryCrate', name: 'Mystery Crate', description: 'Open for a random cosmetic or high-tier chip prize.', price: 100000, dailyLimit: 1 },
]

export const PROPERTY_DEFS = [
  { id: 'apartment', name: 'Studio Apartment', description: 'Cozy downtown studio apartment with steady rental returns.', price: 150000, perSec: 50, hourly: 180000, icon: '🏢' },
  { id: 'lounge', name: 'High Roller Penthouse', description: 'Top-floor luxury penthouse with panoramic city views.', price: 500000, perSec: 150, hourly: 540000, icon: '🏙️' },
  { id: 'bar', name: 'Strip Casino Bar & Grill', description: 'Bustling casino strip venue with non-stop foot traffic.', price: 1200000, perSec: 400, hourly: 1440000, icon: '🍸' },
  { id: 'mall', name: 'Galleria Shopping Mall', description: 'Multi-level luxury shopping mall with high-end designer boutiques.', price: 3000000, perSec: 1000, hourly: 3600000, icon: '🛍️' },
  { id: 'hotel', name: '5-Star Casino Resort Hotel', description: 'World-class 500-room luxury resort with suites and fine dining.', price: 10000000, perSec: 3500, hourly: 12600000, icon: '🏨' },
  { id: 'marina', name: 'Superyacht Harbor & Marina', description: 'Private Mediterranean deep-water dock for billionaire yachts.', price: 25000000, perSec: 9000, hourly: 32400000, icon: '🛥️' },
  { id: 'island', name: 'Private Caribbean Island', description: 'Exclusive secluded tropical paradise with private white sand beaches.', price: 75000000, perSec: 25000, hourly: 90000000, icon: '🏝️' },
  { id: 'airport', name: 'Goldenfelt International Airport', description: 'Global private aviation hub handling chartered high-roller flights.', price: 200000000, perSec: 75000, hourly: 270000000, icon: '✈️' },
] as const
export type PropertyId = typeof PROPERTY_DEFS[number]['id']

type PropertyState = { level: number; lastCollectedAt: number }
type LoanState = { principal: number; balance: number; rate: number; lastAccruedAt: number; interestAccrued: number }
type DailyState = { day: string; games: string[]; hands: number; wins: number; claimed: string[]; questChips: number; tokenUses: number; tokenUseById: Partial<Record<TokenId, number>> }
type WeeklyState = { week: string; hands: number; claimed: boolean }

export const BET_TIERS = [
  { tier: 0, label: 'Standard (25K)', maxBet: 25000, cost: 0, desc: 'Base table limit: 25,000 chips max bet' },
  { tier: 1, label: 'High Roller (100K)', maxBet: 100000, cost: 500000, desc: 'Unlocks 100,000 chips max bet' },
  { tier: 2, label: 'VIP Whale (1M)', maxBet: 1000000, cost: 5000000, desc: 'Unlocks 1,000,000 chips max bet' },
  { tier: 3, label: 'The Sovereign (10M)', maxBet: 10000000, cost: 50000000, desc: 'Unlocks 10,000,000 chips max bet' },
] as const

export function maxBetForTier(tier: number): number {
  const found = BET_TIERS.find((t) => t.tier === tier)
  return found ? found.maxBet : 25000
}

export interface ChipsSave {
  balance: number
  totalWon: number
  totalLost: number
  handsPlayed: number
  totalBet: number
  betTier: number
  inventory: Record<TokenId, number>
  properties: Record<PropertyId, PropertyState>
  loan: LoanState | null
  totalRepaid: number
  bankruptcyUntil: number
  lastWheelAt: number
  lastBailoutAt: number
  daily: DailyState
  weekly: WeeklyState
  pendingWager: number
  lastDebtService: number
  doubleDownArmed: boolean
  secondChanceArmed: boolean
  streakShieldArmed: boolean
  hintActive: boolean
  freeSpinArmed: boolean
  dailyWinCounted: boolean
  lastLostWager: number
  lastFreePackageAt: number
  loanLimit: number
  propertyResetVersion: number
  wealthReducedV1?: boolean
  propertyCompensationGranted?: boolean
}

const todayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10)
function weekKey(now = Date.now()) {
  const d = new Date(now)
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day + 3)
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(((d.getTime() - first.getTime()) / DAY_MS - 3 + ((first.getUTCDay() + 6) % 7)) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}
const emptyDaily = (): DailyState => ({ day: todayKey(), games: [], hands: 0, wins: 0, claimed: [], questChips: 0, tokenUses: 0, tokenUseById: {} })
const emptyWeekly = (): WeeklyState => ({ week: weekKey(), hands: 0, claimed: false })
const emptyProperties = (): Record<PropertyId, PropertyState> => Object.fromEntries(PROPERTY_DEFS.map((p) => [p.id, { level: 0, lastCollectedAt: Date.now() }])) as Record<PropertyId, PropertyState>
export const CURRENT_PROPERTY_RESET_VERSION = 10
export const PROPERTY_SEIZURE_COMPENSATION = 75_000_000

function initialState(): ChipsSave {
  return {
    balance: STARTING_CHIPS,
    totalWon: 0,
    totalLost: 0,
    handsPlayed: 0,
    totalBet: 0,
    betTier: 0,
    inventory: {} as Record<TokenId, number>,
    properties: emptyProperties(),
    loan: null,
    totalRepaid: 0,
    bankruptcyUntil: 0,
    lastWheelAt: 0,
    lastBailoutAt: 0,
    daily: emptyDaily(),
    weekly: emptyWeekly(),
    pendingWager: 0,
    lastDebtService: 0,
    doubleDownArmed: false,
    secondChanceArmed: false,
    streakShieldArmed: false,
    hintActive: false,
    freeSpinArmed: false,
    dailyWinCounted: false,
    lastLostWager: 0,
    lastFreePackageAt: 0,
    loanLimit: 250000,
    propertyResetVersion: CURRENT_PROPERTY_RESET_VERSION,
    wealthReducedV1: true,
    propertyCompensationGranted: true,
  }
}

function safeObject<T>(value: unknown, fallback: T): T {
  return value && typeof value === 'object' ? (value as T) : fallback
}

function normaliseState(raw: Partial<ChipsSave>, now = Date.now()): ChipsSave {
  const base = initialState()
  const rawBal = Number.isFinite(raw.balance) ? Math.max(0, Number(raw.balance)) : base.balance
  const balance = rawBal

  // Preserve all player properties, venue deed upgrades, and investments
  const properties = { ...base.properties, ...safeObject(raw.properties, base.properties) }

  const next: ChipsSave = {
    ...base,
    ...raw,
    balance,
    betTier: Number.isFinite(raw.betTier) ? Math.min(3, Math.max(0, Number(raw.betTier))) : 0,
    wealthReducedV1: true,
    propertyResetVersion: CURRENT_PROPERTY_RESET_VERSION,
    propertyCompensationGranted: true,
    properties,
    inventory: safeObject(raw.inventory, base.inventory),
    daily: {
      ...base.daily,
      ...safeObject(raw.daily, base.daily),
      games: Array.isArray(raw.daily?.games) ? raw.daily.games : [],
      claimed: Array.isArray(raw.daily?.claimed) ? raw.daily.claimed : [],
      tokenUseById: safeObject(raw.daily?.tokenUseById, {}),
    },
    weekly: { ...base.weekly, ...safeObject(raw.weekly, base.weekly) },
    loanLimit: Number.isFinite(raw.loanLimit) ? Number(raw.loanLimit) : 250000,
  }

  if (todayKey(now) > String(next.daily.day ?? '')) next.daily = emptyDaily()
  if (weekKey(now) > String(next.weekly.week ?? '')) next.weekly = emptyWeekly()
  if (!Number.isFinite(next.lastWheelAt)) next.lastWheelAt = 0
  if (!Number.isFinite(next.lastBailoutAt)) next.lastBailoutAt = 0
  if (next.loan) {
    next.loan = { ...next.loan, interestAccrued: next.loan.interestAccrued ?? 0 }
  }
  return next
}

function load(playerName: string): ChipsSave {
  const fresh = initialState()
  try {
    const key = playerStorageKey('chips', playerName)
    const candidates: Partial<ChipsSave>[] = []

    const primaryRaw = localStorage.getItem(key)
    if (primaryRaw) {
      try { candidates.push(JSON.parse(primaryRaw)) } catch {}
    }

    // Check alias saves across player renames to safeguard player balances
    if (playerName.toLowerCase().startsWith('miguel')) {
      const alias1 = localStorage.getItem('golden-felt-player-save-v1:miguel:chips')
      if (alias1) try { candidates.push(JSON.parse(alias1)) } catch {}
      const alias2 = localStorage.getItem('golden-felt-player-save-v1:miguel%20miguel:chips')
      if (alias2) try { candidates.push(JSON.parse(alias2)) } catch {}
      const legacyKey = localStorage.getItem('golden-felt-chips-v1')
      if (legacyKey) try { candidates.push(JSON.parse(legacyKey)) } catch {}
    }

    if (candidates.length === 0) return fresh

    // Sort by highest balance to ensure no progress is ever lost
    candidates.sort((a, b) => (Number(b.balance) || 0) - (Number(a.balance) || 0))
    const best = candidates[0]
    return normaliseState(best)
  } catch {
    return fresh
  }
}

function roundTo(n: number) {
  return Math.max(0, Math.floor(n))
}

export const DAILY_QUESTS = [
  { id: 'different-games', title: 'Play 3 different games', goal: 3, reward: 25000, token: 'hint' as TokenId },
  { id: 'win-three', title: 'Win 3 rounds', goal: 3, reward: 50000, token: 'doubleDown' as TokenId },
  { id: 'play-five', title: 'Play 5 hands', goal: 5, reward: 25000, token: 'freeSpin' as TokenId },
]
export const WEEKLY_QUEST = { id: 'weekly-play', title: 'Play 20 hands this week', goal: 20, reward: 150000, token: 'mysteryCrate' as TokenId }

export interface ChipsState extends ChipsSave {
  storageError: string
  bankLimit: number
  maxBet: number
  propertyCompensationGranted?: boolean
  setBetTier: (tier: number) => void
  bet: (amount: number, countHand?: boolean, gameId?: string) => boolean
  markHand: (gameId?: string, stake?: number) => void
  recordLoss: (gameId?: string) => void
  payout: (amount: number, profit?: number, gameId?: string) => number
  refund: (amount: number) => void
  refill: () => boolean
  claimFreePackage: () => boolean
  spend: (amount: number) => boolean
  credit: (amount: number) => void
  buyToken: (id: TokenId) => boolean
  useToken: (id: TokenId) => { ok: boolean; message: string }
  useFreeSpin: () => boolean
  consumeStreakShield: () => boolean
  consumeHint: () => boolean
  claimWheel: () => { ok: boolean; reward: number }
  claimQuest: (id: string) => boolean
  buyOrUpgradeProperty: (id: PropertyId) => boolean
  collectProperty: (id: PropertyId) => number
  borrow: (amount: number) => boolean
  repay: (amount: number) => number
  declareBankruptcy: () => boolean
  propertyPending: (id: PropertyId, now?: number) => number
  seizeAllProperties: () => void
}

const ChipsContext = createContext<ChipsState | null>(null)

export function ChipsProvider({ children }: { children: ReactNode }) {
  const { activeName } = usePlayer()
  const playerName = activeName ?? 'Player'
  const [state, setState] = useState(() => load(playerName))
  const [storageError, setStorageError] = useState('')
  const stateRef = useRef(state)

  const apply = useCallback((fn: (s: ChipsSave) => ChipsSave) => {
    const next = fn(stateRef.current)
    stateRef.current = next
    setState(next)
    try {
      localStorage.setItem(playerStorageKey('chips', playerName), JSON.stringify(next))
      setStorageError('')
    } catch {
      setStorageError('Progress could not be saved. Browser storage may be full or disabled.')
    }
  }, [playerName])

  useEffect(() => {
    stateRef.current = state
    try {
      localStorage.setItem(playerStorageKey('chips', playerName), JSON.stringify(state))
      setStorageError('')
      syncPlayerToSupabase(playerName, state)
    } catch {
      setStorageError('Progress could not be saved. Browser storage may be full or disabled.')
    }
  }, [state, playerName])

  const maxBet = useMemo(() => maxBetForTier(state.betTier ?? 0), [state.betTier])

  const setBetTier = useCallback((tier: number) => {
    apply((s) => ({ ...s, betTier: Math.min(3, Math.max(0, tier)) }))
  }, [apply])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = stateRef.current
      const accrued = normaliseState(current)
      const loanChanged = accrued.loan?.balance !== current.loan?.balance || accrued.loan?.lastAccruedAt !== current.loan?.lastAccruedAt
      const questPeriodChanged = accrued.daily.day !== current.daily.day || accrued.weekly.week !== current.weekly.week
      if (loanChanged || questPeriodChanged) apply(() => accrued)
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [apply])

  const credit = useCallback((amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return
    apply((s) => ({ ...s, balance: walletCredit(s.balance, amount) }))
  }, [apply])

  const spend = useCallback((amount: number) => {
    const next = walletDebit(stateRef.current.balance, amount)
    if (next === null) return false
    apply((s) => ({ ...s, balance: walletDebit(s.balance, amount) ?? s.balance, totalLost: s.totalLost + amount }))
    return true
  }, [apply])

  const bet = useCallback((amount: number, countHand = true, gameId?: string) => {
    const nextBalance = walletDebit(stateRef.current.balance, amount)
    if (nextBalance === null) return false
    apply((s) => {
      const daily = countHand
        ? { ...s.daily, hands: s.daily.hands + 1, games: gameId && !s.daily.games.includes(gameId) ? [...s.daily.games, gameId] : s.daily.games }
        : s.daily
      const weekly = countHand ? { ...s.weekly, hands: s.weekly.hands + 1 } : s.weekly
      return {
        ...s,
        balance: walletDebit(s.balance, amount) ?? s.balance,
        totalLost: s.totalLost + amount,
        totalBet: s.totalBet + amount,
        handsPlayed: s.handsPlayed + (countHand ? 1 : 0),
        daily,
        weekly,
        pendingWager: countHand ? amount : s.pendingWager,
        lastDebtService: countHand ? 0 : s.lastDebtService,
        dailyWinCounted: countHand ? false : s.dailyWinCounted,
      }
    })
    return true
  }, [apply])

  const markHand = useCallback((gameId?: string, stake = 0) => apply((s) => ({
    ...s,
    pendingWager: Math.max(0, stake),
    lastDebtService: 0,
    dailyWinCounted: false,
    handsPlayed: s.handsPlayed + 1,
    daily: { ...s.daily, hands: s.daily.hands + 1, games: gameId && !s.daily.games.includes(gameId) ? [...s.daily.games, gameId] : s.daily.games },
    weekly: { ...s.weekly, hands: s.weekly.hands + 1 },
  })), [apply])

  const recordLoss = useCallback((gameId?: string) => {
    if (gameId) {
      recordGameHand(false, gameId).catch(() => {})
    }
    apply((s) => {
      const lost = Math.max(0, roundTo(s.pendingWager))
      if (lost <= 0) return s
      if (s.secondChanceArmed) {
        return { ...s, balance: walletRefund(s.balance, Math.floor(lost * 0.5)), pendingWager: 0, secondChanceArmed: false, lastLostWager: 0 }
      }
      return { ...s, pendingWager: 0, lastLostWager: lost }
    })
  }, [apply])

  const payout = useCallback((amount: number, profit = amount, gameId?: string) => {
    if (!Number.isFinite(amount) || amount <= 0) return 0
    if (gameId) {
      recordGameHand(true, gameId).catch(() => {})
    }
    let service = 0
    apply((s) => {
      const won = Math.max(0, roundTo(profit))
      const lost = Math.max(0, roundTo(-profit))
      const doubleBonus = s.doubleDownArmed && won > 0 ? Math.min(100000, Math.floor(won * 0.5)) : 0
      const gross = amount + doubleBonus
      const debtCut = s.loan && won > 0 ? Math.min(s.loan.balance, Math.floor(won * 0.3)) : 0
      service = debtCut
      const loan = s.loan && debtCut > 0 ? { ...s.loan, balance: Math.max(0, s.loan.balance - debtCut) } : s.loan
      const secondChanceRefund = lost > 0 && s.secondChanceArmed ? Math.floor(lost * 0.5) : 0
      return {
        ...s,
        balance: walletCredit(walletCredit(s.balance, gross - debtCut), secondChanceRefund),
        totalWon: s.totalWon + Math.max(0, amount),
        pendingWager: 0,
        doubleDownArmed: false,
        secondChanceArmed: false,
        loan,
        lastDebtService: service,
        daily: { ...s.daily, wins: s.daily.wins + (won > 0 ? 1 : 0) },
      }
    })
    return service
  }, [apply])

  const refund = useCallback((amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return
    apply((s) => ({ ...s, balance: walletRefund(s.balance, amount), pendingWager: 0 }))
  }, [apply])

  const refill = useCallback(() => {
    const s = stateRef.current
    const now = Date.now()
    if (s.balance >= 100 || s.loan || now - s.lastBailoutAt < 48 * 60 * 60 * 1000) return false
    apply((cur) => ({ ...cur, balance: walletCredit(cur.balance, 5000), lastBailoutAt: now }))
    return true
  }, [apply])

  const claimFreePackage = useCallback(() => {
    const s = stateRef.current
    const now = Date.now()
    if (s.balance > 0) return false
    if (now - s.lastFreePackageAt < DAY_MS) return false
    apply((cur) => ({ ...cur, balance: walletCredit(cur.balance, 25000), lastFreePackageAt: now }))
    return true
  }, [apply])

  const buyToken = useCallback((id: TokenId) => {
    const def = TOKEN_DEFS.find((t) => t.id === id)
    if (!def || (stateRef.current.inventory[id] ?? 0) >= 5) return false
    const nextBalance = walletDebit(stateRef.current.balance, def.price)
    if (nextBalance === null) return false
    apply((s) => {
      const added = tokenAdd(s.inventory, id, 1, 5)
      if (!added.added) return s
      return { ...s, balance: walletDebit(s.balance, def.price) ?? s.balance, inventory: added.inventory, totalLost: s.totalLost + def.price }
    })
    return true
  }, [apply])

  const useToken = useCallback((id: TokenId) => {
    const s = stateRef.current
    const def = TOKEN_DEFS.find((t) => t.id === id)
    if (!def || (s.inventory[id] ?? 0) <= 0) return { ok: false, message: 'You do not have that perk.' }
    if (s.daily.tokenUses >= 5 || (s.daily.tokenUseById[id] ?? 0) >= def.dailyLimit) return { ok: false, message: 'Your daily perk-use limit has been reached.' }
    if (id === 'rebuy' && (s.balance >= 100 || s.loan || Date.now() - s.lastBailoutAt < 48 * 60 * 60 * 1000)) return { ok: false, message: 'Rebuy needs fewer than 100 chips, no active loan and an available cooldown.' }
    let message = `${def.name} used.`
    apply((cur) => {
      const inventory = tokenRemove(cur.inventory, id)
      if (!inventory) return cur
      const next: ChipsSave = { ...cur, inventory, daily: { ...cur.daily, tokenUses: cur.daily.tokenUses + 1, tokenUseById: { ...cur.daily.tokenUseById, [id]: (cur.daily.tokenUseById[id] ?? 0) + 1 } } }
      if (id === 'secondChance') {
        if (next.lastLostWager > 0) { next.balance = walletRefund(next.balance, Math.floor(next.lastLostWager * 0.5)); next.lastLostWager = 0; message = '50% of your last lost bet has been refunded.' }
        else { next.secondChanceArmed = true; message = 'Second Chance is armed for your next lost bet.' }
      } else if (id === 'streakShield') { next.streakShieldArmed = true; message = 'Streak Shield is armed for your next missed day.' }
      else if (id === 'rebuy') { next.balance = walletCredit(next.balance, 10000); next.lastBailoutAt = Date.now(); message = 'Poker rebuy granted: 10,000 chips.' }
      else if (id === 'hint') { next.hintActive = true; message = 'Hint unlocked. The poker coach will show hand strength and odds.' }
      else if (id === 'doubleDown') { next.doubleDownArmed = true; message = 'Your next winning round earns 1.5× profit (up to 100,000 bonus chips).' }
      else if (id === 'freeSpin') { next.freeSpinArmed = true; message = 'Free Spin armed: your next slot spin is free at 500 chips.' }
      else if (id === 'mysteryCrate') { message = 'Mystery Crate opened. Your reward is ready.' }
      return next
    })
    return { ok: true, message }
  }, [apply])

  const useFreeSpin = useCallback(() => {
    if (!stateRef.current.freeSpinArmed) return false
    apply((s) => ({ ...s, freeSpinArmed: false }))
    return true
  }, [apply])

  const consumeStreakShield = useCallback(() => {
    if (!stateRef.current.streakShieldArmed) return false
    apply((s) => ({ ...s, streakShieldArmed: false }))
    return true
  }, [apply])

  const consumeHint = useCallback(() => {
    if (!stateRef.current.hintActive) return false
    apply((s) => ({ ...s, hintActive: false }))
    return true
  }, [apply])

  const claimWheel = useCallback(() => {
    const now = Date.now()
    if (now - stateRef.current.lastWheelAt < DAY_MS) return { ok: false, reward: 0 }
    const reward = [10000, 25000, 50000, 100000, 250000][Math.floor(Math.random() * 5)]
    apply((s) => ({ ...s, balance: walletCredit(s.balance, reward), lastWheelAt: now }))
    return { ok: true, reward }
  }, [apply])

  const claimQuest = useCallback((id: string) => {
    const s = stateRef.current
    const dailyQuest = DAILY_QUESTS.find((q) => q.id === id)
    if (dailyQuest) {
      const progress = id === 'different-games' ? s.daily.games.length : id === 'win-three' ? s.daily.wins : s.daily.hands
      if (progress < dailyQuest.goal || s.daily.claimed.includes(id)) return false
      apply((cur) => {
        const add = tokenAdd(cur.inventory, dailyQuest.token, 1, 5)
        return {
          ...cur,
          balance: walletCredit(cur.balance, dailyQuest.reward),
          inventory: add.inventory,
          daily: {
            ...cur.daily,
            claimed: [...cur.daily.claimed, id],
            questChips: cur.daily.questChips + dailyQuest.reward,
          },
        }
      })
      return true
    }
    if (id === WEEKLY_QUEST.id && s.weekly.hands >= WEEKLY_QUEST.goal && !s.weekly.claimed) {
      apply((cur) => {
        const add = tokenAdd(cur.inventory, WEEKLY_QUEST.token, 1, 5)
        return {
          ...cur,
          balance: walletCredit(cur.balance, WEEKLY_QUEST.reward),
          inventory: add.inventory,
          weekly: { ...cur.weekly, claimed: true },
        }
      })
      return true
    }
    return false
  }, [apply])

  const buyOrUpgradeProperty = useCallback((id: PropertyId) => {
    const def = PROPERTY_DEFS.find((p) => p.id === id)
    if (!def) return false
    const property = stateRef.current.properties[id] ?? { level: 0, lastCollectedAt: Date.now() }
    const now = Date.now()
    const elapsedSec = property.level > 0 && now >= property.lastCollectedAt
      ? Math.min(12 * 3600, Math.floor((now - property.lastCollectedAt) / 1000))
      : 0
    const accrued = elapsedSec * def.perSec * property.level
    const cost = Math.round(def.price * Math.pow(1.7, property.level))
    const totalAvail = stateRef.current.balance + accrued
    if (totalAvail < cost) return false

    apply((s) => ({
      ...s,
      balance: (s.balance + accrued) - cost,
      totalLost: s.totalLost + cost,
      properties: { ...s.properties, [id]: { level: property.level + 1, lastCollectedAt: now } },
    }))
    return true
  }, [apply])

  const propertyPending = useCallback((id: PropertyId, now = Date.now()) => {
    const def = PROPERTY_DEFS.find((p) => p.id === id)
    if (!def) return 0
    const property = stateRef.current.properties[id]
    if (!property || property.level <= 0) return 0
    const elapsedSec = now >= property.lastCollectedAt
      ? Math.min(12 * 3600, Math.floor((now - property.lastCollectedAt) / 1000))
      : 0
    return elapsedSec * def.perSec * property.level
  }, [])

  const collectProperty = useCallback((id: PropertyId) => {
    const def = PROPERTY_DEFS.find((p) => p.id === id)
    if (!def) return 0
    const property = stateRef.current.properties[id]
    if (!property || property.level <= 0) return 0
    const now = Date.now()
    const elapsedSec = now >= property.lastCollectedAt
      ? Math.min(12 * 3600, Math.floor((now - property.lastCollectedAt) / 1000))
      : 0
    const accrued = elapsedSec * def.perSec * property.level
    if (accrued <= 0) return 0
    apply((s) => ({
      ...s,
      balance: walletCredit(s.balance, accrued),
      properties: { ...s.properties, [id]: { ...property, lastCollectedAt: now } },
    }))
    return accrued
  }, [apply])

  const seizeAllProperties = useCallback(() => {
    apply((s) => ({
      ...s,
      properties: emptyProperties(),
      propertyResetVersion: CURRENT_PROPERTY_RESET_VERSION,
    }))
  }, [apply])

  const borrow = useCallback((amount: number) => {
    const s = stateRef.current
    if (s.loan || amount <= 0 || amount > (s.loanLimit ?? 250000)) return false
    const now = Date.now()
    apply((cur) => ({
      ...cur,
      balance: walletCredit(cur.balance, amount),
      loan: { principal: amount, balance: amount, rate: 0.05, lastAccruedAt: now, interestAccrued: 0 },
    }))
    return true
  }, [apply])

  const repay = useCallback((amount: number) => {
    const s = stateRef.current
    if (!s.loan || amount <= 0) return 0
    const toPay = Math.min(amount, s.loan.balance, s.balance)
    if (toPay <= 0) return 0
    apply((cur) => {
      if (!cur.loan) return cur
      const remaining = cur.loan.balance - toPay
      return {
        ...cur,
        balance: walletDebit(cur.balance, toPay) ?? cur.balance,
        totalRepaid: cur.totalRepaid + toPay,
        loan: remaining > 0 ? { ...cur.loan, balance: remaining } : null,
      }
    })
    return toPay
  }, [apply])

  const declareBankruptcy = useCallback(() => {
    const s = stateRef.current
    if (!s.loan && s.balance >= 100) return false
    const now = Date.now()
    apply((cur) => ({
      ...cur,
      balance: 1000,
      loan: null,
      bankruptcyUntil: now + 7 * DAY_MS,
      loanLimit: 100000,
    }))
    return true
  }, [apply])

  const bankLimit = state.loanLimit ?? 250000

  const value = useMemo<ChipsState>(() => ({
    ...state,
    storageError,
    bankLimit,
    maxBet,
    setBetTier,
    bet,
    markHand,
    recordLoss,
    payout,
    refund,
    refill,
    claimFreePackage,
    spend,
    credit,
    buyToken,
    useToken,
    useFreeSpin,
    consumeStreakShield,
    consumeHint,
    claimWheel,
    claimQuest,
    buyOrUpgradeProperty,
    collectProperty,
    borrow,
    repay,
    declareBankruptcy,
    propertyPending,
    seizeAllProperties,
  }), [
    state,
    storageError,
    bankLimit,
    maxBet,
    setBetTier,
    bet,
    markHand,
    recordLoss,
    payout,
    refund,
    refill,
    claimFreePackage,
    spend,
    credit,
    buyToken,
    useToken,
    useFreeSpin,
    consumeStreakShield,
    consumeHint,
    claimWheel,
    claimQuest,
    buyOrUpgradeProperty,
    collectProperty,
    borrow,
    repay,
    declareBankruptcy,
    propertyPending,
    seizeAllProperties,
  ])

  return <ChipsContext.Provider value={value}>{children}</ChipsContext.Provider>
}

export function useChips(): ChipsState {
  const ctx = useContext(ChipsContext)
  if (!ctx) throw new Error('useChips must be used within a ChipsProvider')
  return ctx
}

export function fmt(n: number | undefined | null): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '0'
  return Math.floor(n).toLocaleString('en-US')
}
