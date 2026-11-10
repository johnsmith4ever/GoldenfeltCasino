import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { playerStorageKey, usePlayer } from './profile'
import { credit as walletCredit, debit as walletDebit, refund as walletRefund, setBalance as walletSetBalance, tokenAdd, tokenRemove } from './wallet.js'
import { syncPlayerToSupabase } from '../lib/supabase'

export const STARTING_CHIPS = 5000
export const MIN_BET = 25
const DAY_MS = 24 * 60 * 60 * 1000

type TokenId = 'secondChance' | 'streakShield' | 'rebuy' | 'hint' | 'doubleDown' | 'freeSpin' | 'mysteryCrate'
export const TOKEN_DEFS: { id: TokenId; name: string; description: string; price: number; dailyLimit: number }[] = [
  { id: 'secondChance', name: 'Second Chance', description: 'Refund 50% of your most recent lost bet.', price: 900, dailyLimit: 1 },
  { id: 'streakShield', name: 'Streak Shield', description: 'Protects one missed daily visit in your streak.', price: 1200, dailyLimit: 1 },
  { id: 'rebuy', name: 'Rebuy Token', description: 'A small poker-room bailout when your chips are nearly gone.', price: 1600, dailyLimit: 1 },
  { id: 'hint', name: 'Hint Token', description: 'Unlock a poker hand-strength and odds hint.', price: 700, dailyLimit: 2 },
  { id: 'doubleDown', name: 'Double Down Token', description: 'Your next winning round earns 1.5× profit, capped at 10,000 bonus chips.', price: 1800, dailyLimit: 1 },
  { id: 'freeSpin', name: 'Free Spin', description: 'One free slot spin at a fixed 25-chip bet.', price: 1000, dailyLimit: 2 },
  { id: 'mysteryCrate', name: 'Mystery Crate', description: 'Open for a random cosmetic or chip prize.', price: 2200, dailyLimit: 1 },
]
export const PROPERTY_DEFS = [
  { id: 'apartment', name: 'Studio Apartment', description: 'Cozy downtown studio apartment with steady rental returns.', price: 50000, perSec: 15, hourly: 54000, icon: '🏢' },
  { id: 'lounge', name: 'High Roller Penthouse', description: 'Top-floor luxury penthouse with panoramic city views.', price: 150000, perSec: 50, hourly: 180000, icon: '🏙️' },
  { id: 'bar', name: 'Strip Casino Bar & Grill', description: 'Bustling casino strip venue with non-stop foot traffic.', price: 400000, perSec: 150, hourly: 540000, icon: '🍸' },
  { id: 'mall', name: 'Galleria Shopping Mall', description: 'Multi-level luxury shopping mall with high-end designer boutiques.', price: 1000000, perSec: 450, hourly: 1620000, icon: '🛍️' },
  { id: 'hotel', name: '5-Star Casino Resort Hotel', description: 'World-class 500-room luxury resort with suites and fine dining.', price: 2500000, perSec: 1200, hourly: 4320000, icon: '🏨' },
  { id: 'marina', name: 'Superyacht Harbor & Marina', description: 'Private Mediterranean deep-water dock for billionaire yachts.', price: 6000000, perSec: 3200, hourly: 11520000, icon: '🛥️' },
  { id: 'island', name: 'Private Caribbean Island', description: 'Exclusive secluded tropical paradise with private white sand beaches.', price: 15000000, perSec: 9000, hourly: 32400000, icon: '🏝️' },
  { id: 'airport', name: 'Goldenfelt International Airport', description: 'Global private aviation hub handling chartered high-roller flights.', price: 35000000, perSec: 25000, hourly: 90000000, icon: '✈️' },
] as const
export type PropertyId = typeof PROPERTY_DEFS[number]['id']

type PropertyState = { level: number; lastCollectedAt: number }
type LoanState = { principal: number; balance: number; rate: number; lastAccruedAt: number; interestAccrued: number }
type DailyState = { day: string; games: string[]; hands: number; wins: number; claimed: string[]; questChips: number; questTokens: number; tokenUses: number; tokenUseById: Partial<Record<TokenId, number>>; tokenEarned: number }
type WeeklyState = { week: string; hands: number; claimed: boolean }
export interface ChipsSave {
  balance: number; totalWon: number; totalLost: number; handsPlayed: number; totalBet: number
  inventory: Record<TokenId, number>; properties: Record<PropertyId, PropertyState>; loan: LoanState | null
  totalRepaid: number; bankruptcyUntil: number; lastWheelAt: number; lastBailoutAt: number
  daily: DailyState; weekly: WeeklyState; pendingWager: number; lastDebtService: number
  doubleDownArmed: boolean; secondChanceArmed: boolean; streakShieldArmed: boolean; hintActive: boolean; freeSpinArmed: boolean; dailyWinCounted: boolean; lastLostWager: number
  lastFreePackageAt: number
  loanLimit: number
}

const todayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10)
function weekKey(now = Date.now()) {
  const d = new Date(now); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3)
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); const week = 1 + Math.round(((d.getTime() - first.getTime()) / DAY_MS - 3 + ((first.getUTCDay() + 6) % 7)) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}
const emptyDaily = (): DailyState => ({ day: todayKey(), games: [], hands: 0, wins: 0, claimed: [], questChips: 0, questTokens: 0, tokenUses: 0, tokenUseById: {}, tokenEarned: 0 })
const emptyWeekly = (): WeeklyState => ({ week: weekKey(), hands: 0, claimed: false })
const emptyProperties = (): Record<PropertyId, PropertyState> => Object.fromEntries(PROPERTY_DEFS.map((p) => [p.id, { level: 0, lastCollectedAt: Date.now() }])) as Record<PropertyId, PropertyState>
function initialState(): ChipsSave {
  return { balance: STARTING_CHIPS, totalWon: 0, totalLost: 0, handsPlayed: 0, totalBet: 0, inventory: {} as Record<TokenId, number>, properties: emptyProperties(), loan: null, totalRepaid: 0, bankruptcyUntil: 0, lastWheelAt: 0, lastBailoutAt: 0, daily: emptyDaily(), weekly: emptyWeekly(), pendingWager: 0, lastDebtService: 0, doubleDownArmed: false, secondChanceArmed: false, streakShieldArmed: false, hintActive: false, freeSpinArmed: false, dailyWinCounted: false, lastLostWager: 0, lastFreePackageAt: 0, loanLimit: 250000 }
}
function safeObject<T>(value: unknown, fallback: T): T { return value && typeof value === 'object' ? value as T : fallback }
function normaliseState(raw: Partial<ChipsSave>, now = Date.now()): ChipsSave {
  const base = initialState()
  let next: ChipsSave = {
    ...base, ...raw,
    balance: Number.isFinite(raw.balance) ? Math.max(0, Number(raw.balance)) : base.balance,
    inventory: safeObject(raw.inventory, base.inventory),
    properties: { ...base.properties, ...safeObject(raw.properties, base.properties) },
    daily: { ...base.daily, ...safeObject(raw.daily, base.daily), games: Array.isArray(raw.daily?.games) ? raw.daily.games : [], claimed: Array.isArray(raw.daily?.claimed) ? raw.daily.claimed : [], tokenUseById: safeObject(raw.daily?.tokenUseById, {}) },
    weekly: { ...base.weekly, ...safeObject(raw.weekly, base.weekly) },
    loanLimit: Number.isFinite(raw.loanLimit) ? Number(raw.loanLimit) : 250000,
  }
  // Never roll a period backwards when a device clock is moved back.
  if (todayKey(now) > String(next.daily.day ?? '')) next.daily = emptyDaily()
  if (weekKey(now) > String(next.weekly.week ?? '')) next.weekly = emptyWeekly()
  if (!Number.isFinite(next.lastWheelAt)) next.lastWheelAt = 0
  // Migrate the previous date-only wheel flag into a conservative 24-hour timestamp.
  const legacy = (raw as Partial<ChipsSave> & { lastWheelDay?: string }).lastWheelDay
  if (!next.lastWheelAt && legacy) { const t = Date.parse(`${legacy}T00:00:00Z`); if (Number.isFinite(t)) next.lastWheelAt = t + DAY_MS }
  if (!Number.isFinite(next.lastBailoutAt)) next.lastBailoutAt = 0
  if (next.loan) {
    next.loan = { ...next.loan, rate: 0, interestAccrued: 0 }
  }
  return next
}
function load(playerName: string): ChipsSave {
  const fresh = initialState()
  try {
    const raw = localStorage.getItem(playerStorageKey('chips', playerName))
    if (!raw) return fresh
    return normaliseState(JSON.parse(raw) as Partial<ChipsSave>)
  } catch { return fresh }
}
function roundTo(n: number) { return Math.max(0, Math.floor(n)) }

export const DAILY_QUESTS = [
  { id: 'different-games', title: 'Play 3 different games', goal: 3, reward: 1000, token: 'hint' as TokenId },
  { id: 'win-three', title: 'Win 3 rounds', goal: 3, reward: 1500, token: 'doubleDown' as TokenId },
  { id: 'play-five', title: 'Play 5 hands', goal: 5, reward: 1000, token: 'freeSpin' as TokenId },
]
export const WEEKLY_QUEST = { id: 'weekly-play', title: 'Play 20 hands this week', goal: 20, reward: 5000, token: 'mysteryCrate' as TokenId }

interface ChipsState extends ChipsSave {
  storageError: string
  bankLimit: number
  bet: (amount: number, countHand?: boolean, gameId?: string) => boolean
  markHand: (gameId?: string, stake?: number) => void
  recordLoss: () => void
  payout: (amount: number, profit?: number) => number
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
  claimWheel: () => { ok: boolean; reward: number; token?: TokenId }
  claimQuest: (id: string) => boolean
  buyOrUpgradeProperty: (id: PropertyId) => boolean
  collectProperty: (id: PropertyId) => number
  borrow: (amount: number) => boolean
  repay: (amount: number) => number
  declareBankruptcy: () => boolean
  propertyPending: (id: PropertyId, now?: number) => number
}
const ChipsContext = createContext<ChipsState | null>(null)

export function ChipsProvider({ children }: { children: ReactNode }) {
  const { activeName } = usePlayer()
  const playerName = activeName ?? 'Guest'
  const [state, setState] = useState(() => load(playerName))
  const [storageError, setStorageError] = useState('')
  const stateRef = useRef(state)
  const apply = useCallback((fn: (s: ChipsSave) => ChipsSave) => {
    const next = fn(stateRef.current)
    stateRef.current = next
    setState(next)
    try { localStorage.setItem(playerStorageKey('chips', playerName), JSON.stringify(next)); setStorageError('') }
    catch { setStorageError('Progress could not be saved. Browser storage may be full or disabled; export a backup and free some site storage.') }
  }, [playerName])

  useEffect(() => {
    stateRef.current = state
    try {
      localStorage.setItem(playerStorageKey('chips', playerName), JSON.stringify(state))
      setStorageError('')
      syncPlayerToSupabase(playerName, state)
    } catch {
      setStorageError('Progress could not be saved. Browser storage may be full or disabled; export a backup and free some site storage.')
    }
  }, [state, playerName])

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
      const daily = countHand ? { ...s.daily, hands: s.daily.hands + 1, games: gameId && !s.daily.games.includes(gameId) ? [...s.daily.games, gameId] : s.daily.games } : s.daily
      const weekly = countHand ? { ...s.weekly, hands: s.weekly.hands + 1 } : s.weekly
      return { ...s, balance: walletDebit(s.balance, amount) ?? s.balance, totalLost: s.totalLost + amount, totalBet: s.totalBet + amount, handsPlayed: s.handsPlayed + (countHand ? 1 : 0), daily, weekly, pendingWager: countHand ? amount : s.pendingWager, lastDebtService: countHand ? 0 : s.lastDebtService, dailyWinCounted: countHand ? false : s.dailyWinCounted }
    })
    return true
  }, [apply])
  const markHand = useCallback((gameId?: string, stake = 0) => apply((s) => ({
    ...s, pendingWager: Math.max(0, stake), lastDebtService: 0, dailyWinCounted: false,
    handsPlayed: s.handsPlayed + 1,
    daily: { ...s.daily, hands: s.daily.hands + 1, games: gameId && !s.daily.games.includes(gameId) ? [...s.daily.games, gameId] : s.daily.games },
    weekly: { ...s.weekly, hands: s.weekly.hands + 1 },
  })), [apply])

  const recordLoss = useCallback(() => apply((s) => {
    const lost = Math.max(0, roundTo(s.pendingWager))
    if (lost <= 0) return s
    if (s.secondChanceArmed) {
      return { ...s, balance: walletRefund(s.balance, Math.floor(lost * 0.5)), pendingWager: 0, secondChanceArmed: false, lastLostWager: 0 }
    }
    return { ...s, pendingWager: 0, lastLostWager: lost }
  }), [apply])

  const payout = useCallback((amount: number, profit = amount) => {
    if (!Number.isFinite(amount) || amount <= 0) return 0
    let service = 0
    apply((s) => {
      const won = Math.max(0, roundTo(profit))
      const lost = Math.max(0, roundTo(-profit))
      const doubleBonus = s.doubleDownArmed && won > 0 ? Math.min(10000, Math.floor(won * 0.5)) : 0
      const effectiveProfit = won + doubleBonus
      const gross = amount + doubleBonus
      const debtCut = s.loan && effectiveProfit > 0 ? Math.min(s.loan.balance, Math.floor(effectiveProfit * 0.3)) : 0
      service = debtCut
      const loan = s.loan && debtCut > 0 ? { ...s.loan, balance: Math.max(0, s.loan.balance - debtCut) } : s.loan
      const secondChanceRefund = lost > 0 && s.secondChanceArmed ? Math.floor(lost * 0.5) : 0
      let nextLimit = s.loanLimit ?? 250000
      const remainingLoan = loan && loan.balance > 0 ? loan : null
      if (s.loan && !remainingLoan) {
        if (nextLimit < 500000) nextLimit = 500000
        else if (nextLimit < 1000000) nextLimit = 1000000
      }
      return {
        ...s,
        balance: walletCredit(walletCredit(s.balance, gross - debtCut), secondChanceRefund),
        totalWon: s.totalWon + Math.max(0, amount),
        totalRepaid: s.totalRepaid + debtCut,
        loan: remainingLoan,
        loanLimit: nextLimit,
        daily: won > 0 ? { ...s.daily, wins: s.daily.wins + (s.dailyWinCounted ? 0 : 1) } : s.daily,
        dailyWinCounted: won > 0 ? true : s.dailyWinCounted,
        lastDebtService: s.lastDebtService + debtCut,
        doubleDownArmed: won > 0 ? false : s.doubleDownArmed,
        secondChanceArmed: lost > 0 && s.secondChanceArmed ? false : s.secondChanceArmed,
        lastLostWager: lost > 0 ? (secondChanceRefund > 0 ? 0 : lost) : s.lastLostWager,
        pendingWager: 0,
      } as ChipsSave
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
    apply((cur) => ({ ...cur, balance: walletCredit(cur.balance, 500), lastBailoutAt: now }))
    return true
  }, [apply])
  const claimFreePackage = useCallback(() => {
    const s = stateRef.current
    const now = Date.now()
    // Available only when balance is 0 (completely broke), once per 24h
    if (s.balance > 0) return false
    if (now - s.lastFreePackageAt < DAY_MS) return false
    apply((cur) => ({ ...cur, balance: walletCredit(cur.balance, 6000), lastFreePackageAt: now }))
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
    if (!def || (s.inventory[id] ?? 0) <= 0) return { ok: false, message: 'You do not have that token.' }
    if (s.daily.tokenUses >= 5 || (s.daily.tokenUseById[id] ?? 0) >= def.dailyLimit) return { ok: false, message: 'Your daily token-use limit has been reached.' }
    if (id === 'rebuy' && (s.balance >= 100 || s.loan || Date.now() - s.lastBailoutAt < 48 * 60 * 60 * 1000)) return { ok: false, message: 'Rebuy needs fewer than 100 chips, no active loan and an available cooldown.' }
    let message = `${def.name} used.`
    apply((cur) => {
      const inventory = tokenRemove(cur.inventory, id)
      if (!inventory) return cur
      let next: ChipsSave = { ...cur, inventory, daily: { ...cur.daily, tokenUses: cur.daily.tokenUses + 1, tokenUseById: { ...cur.daily.tokenUseById, [id]: (cur.daily.tokenUseById[id] ?? 0) + 1 } } }
      if (id === 'secondChance') {
        if (next.lastLostWager > 0) { next.balance = walletRefund(next.balance, Math.floor(next.lastLostWager * 0.5)); next.lastLostWager = 0; message = '50% of your last lost bet has been refunded.' }
        else { next.secondChanceArmed = true; message = 'Second Chance is armed for your next lost bet.' }
      } else if (id === 'streakShield') { next.streakShieldArmed = true; message = 'Streak Shield is armed for your next missed day.' }
      else if (id === 'rebuy') { next.balance = walletCredit(next.balance, 1000); next.lastBailoutAt = Date.now(); message = 'Poker rebuy granted: 1,000 chips.' }
      else if (id === 'hint') { next.hintActive = true; message = 'Hint unlocked. The poker coach will show hand strength and odds.' }
      else if (id === 'doubleDown') { next.doubleDownArmed = true; message = 'Your next winning round earns 1.5× profit (up to 10,000 bonus chips).' }
      else if (id === 'freeSpin') { next.freeSpinArmed = true; message = 'Free Spin armed: your next slot spin is free at 25 chips.' }
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
    const reward = [250, 500, 750, 1000, 1500][Math.floor(Math.random() * 5)]
    apply((s) => ({ ...s, balance: walletCredit(s.balance, reward), lastWheelAt: now }))
    return { ok: true, reward }
  }, [apply])

  const claimQuest = useCallback((id: string) => {
    const s = stateRef.current
    const dailyQuest = DAILY_QUESTS.find((q) => q.id === id)
    if (dailyQuest) {
      const progress = id === 'different-games' ? s.daily.games.length : id === 'win-three' ? s.daily.wins : s.daily.hands
      if (progress < dailyQuest.goal || s.daily.claimed.includes(id) || s.daily.questChips + dailyQuest.reward > 3500 || s.daily.questTokens >= 3) return false
      apply((cur) => {
        const add = tokenAdd(cur.inventory, dailyQuest.token, 1, 5)
        return { ...cur, balance: walletCredit(cur.balance, dailyQuest.reward), inventory: add.inventory, daily: { ...cur.daily, claimed: [...cur.daily.claimed, id], questChips: cur.daily.questChips + dailyQuest.reward, questTokens: cur.daily.questTokens + add.added, tokenEarned: cur.daily.tokenEarned + add.added } }
      })
      return true
    }
    if (id === WEEKLY_QUEST.id && s.weekly.hands >= WEEKLY_QUEST.goal && !s.weekly.claimed) {
      apply((cur) => {
        const add = tokenAdd(cur.inventory, WEEKLY_QUEST.token, 1, 5)
        return { ...cur, balance: walletCredit(cur.balance, WEEKLY_QUEST.reward), inventory: add.inventory, weekly: { ...cur.weekly, claimed: true } }
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
    const prop = stateRef.current.properties[id]
    if (!def || !prop || prop.level <= 0 || now < prop.lastCollectedAt) return 0
    const elapsedSec = Math.min(12 * 3600, Math.floor((now - prop.lastCollectedAt) / 1000))
    return elapsedSec * def.perSec * prop.level
  }, [])
  const collectProperty = useCallback((id: PropertyId) => {
    const now = Date.now()
    const def = PROPERTY_DEFS.find((p) => p.id === id)
    if (!def) return 0
    let collected = 0
    apply((s) => {
      const prop = s.properties[id]
      if (!prop || prop.level <= 0 || now < prop.lastCollectedAt) return s
      const elapsedSec = Math.min(12 * 3600, Math.floor((now - prop.lastCollectedAt) / 1000))
      collected = elapsedSec * def.perSec * prop.level
      return { ...s, balance: walletCredit(s.balance, collected), properties: { ...s.properties, [id]: { ...prop, lastCollectedAt: now } } }
    })
    return collected
  }, [apply])

  const bankLimit = useMemo(() => {
    return state.loanLimit ?? 250000
  }, [state.loanLimit])
  const borrow = useCallback((amount: number) => {
    const s = stateRef.current
    const limit = s.loanLimit ?? 250000
    const currentDebt = s.loan?.balance ?? 0
    const available = limit - currentDebt
    if (s.bankruptcyUntil > Date.now() || !Number.isFinite(amount) || amount <= 0 || amount > available) return false
    apply((cur) => {
      const curDebt = cur.loan?.balance ?? 0
      const curPrincipal = cur.loan?.principal ?? 0
      return {
        ...cur,
        balance: walletCredit(cur.balance, amount),
        loan: {
          principal: curPrincipal + amount,
          balance: curDebt + amount,
          rate: 0,
          lastAccruedAt: Date.now(),
          interestAccrued: 0,
        },
      }
    })
    return true
  }, [apply])
  const repay = useCallback((amount: number) => {
    const s = stateRef.current
    if (!s.loan || !Number.isFinite(amount) || amount <= 0) return 0
    // Minimum repayment is 50,000 chips (unless paying off full remaining balance which is < 50k)
    const MIN_REPAY = 50000
    const roundedAmount = roundTo(amount)
    // Allow paying off remaining balance if it's less than the minimum
    const effectiveMin = s.loan.balance < MIN_REPAY ? s.loan.balance : MIN_REPAY
    if (roundedAmount < effectiveMin) return -1 // signal "too small"
    const paid = Math.min(roundedAmount, s.loan.balance, s.balance)
    if (paid <= 0) return 0
    apply((cur) => {
      const loan = cur.loan
      if (!loan) return cur
      const remaining = Math.max(0, loan.balance - paid)
      let nextLimit = cur.loanLimit ?? 250000
      if (remaining === 0) {
        if (nextLimit < 500000) nextLimit = 500000
        else if (nextLimit < 1000000) nextLimit = 1000000
      }
      return {
        ...cur,
        balance: walletDebit(cur.balance, paid) ?? cur.balance,
        loan: remaining > 0 ? { ...loan, balance: remaining } : null,
        loanLimit: nextLimit,
        totalRepaid: cur.totalRepaid + paid,
      }
    })
    return paid
  }, [apply])
  const declareBankruptcy = useCallback(() => {
    const s = stateRef.current
    if (!s.loan || s.bankruptcyUntil > Date.now()) return false
    apply((cur) => ({ ...cur, balance: walletSetBalance(cur.balance, 1000), loan: null, bankruptcyUntil: Date.now() + 7 * DAY_MS, pendingWager: 0 }))
    return true
  }, [apply])

  const value = useMemo<ChipsState>(() => ({ ...state, storageError, bankLimit, bet, markHand, recordLoss, payout, refund, refill, claimFreePackage, spend, credit, buyToken, useToken, useFreeSpin, consumeStreakShield, consumeHint, claimWheel, claimQuest, buyOrUpgradeProperty, collectProperty, borrow, repay, declareBankruptcy, propertyPending }), [state, storageError, bankLimit, bet, markHand, recordLoss, payout, refund, refill, claimFreePackage, spend, credit, buyToken, useToken, useFreeSpin, consumeStreakShield, consumeHint, claimWheel, claimQuest, buyOrUpgradeProperty, collectProperty, borrow, repay, declareBankruptcy, propertyPending])
  return <ChipsContext.Provider value={value}>{children}</ChipsContext.Provider>
}

export function useChips(): ChipsState {
  const ctx = useContext(ChipsContext)
  if (!ctx) throw new Error('useChips must be used inside ChipsProvider')
  return ctx
}

export function fmt(n: number): string { return Math.round(n).toLocaleString('en-US') }
