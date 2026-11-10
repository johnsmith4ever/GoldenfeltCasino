/* Poker hand evaluation shared by Texas Hold'em, Omaha and Three Card Poker. */
import type { Card } from './cards'

export const RV: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14,
}

/* ---------- 5-card hands ---------- */

export const CAT = {
  HIGH: 0, PAIR: 1, TWO_PAIR: 2, TRIPS: 3, STRAIGHT: 4, FLUSH: 5, FULL_HOUSE: 6, QUADS: 7, STRAIGHT_FLUSH: 8,
} as const

export interface Evaluated {
  /** Higher is better. Equal scores are a tie. */
  score: number
  cat: number
  /** Tie-break ranks in order of importance (e.g. full house = [trips, pair]). */
  ranks: number[]
  /** The five cards that make the hand. */
  cards: Card[]
}

const BASE = 15

function pack(cat: number, ranks: number[], len: number): number {
  let s = cat
  for (let i = 0; i < len; i++) s = s * BASE + (ranks[i] ?? 0)
  return s
}

export function evaluate5(cards: Card[]): Evaluated {
  if (cards.length !== 5) throw new Error(`evaluate5 needs exactly 5 cards, got ${cards.length}`)
  const vals = cards.map((c) => RV[c.rank]).sort((a, b) => b - a)
  const flush = cards.every((c) => c.suit === cards[0].suit)

  const counts = new Map<number, number>()
  for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1)
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])

  let straightHigh = 0
  if (groups.length === 5) {
    if (vals[0] - vals[4] === 4) straightHigh = vals[0]
    else if (vals[0] === 14 && vals[1] === 5 && vals[4] === 2) straightHigh = 5 // A-2-3-4-5 "wheel"
  }

  let cat: number
  let ranks: number[]
  if (straightHigh && flush) { cat = CAT.STRAIGHT_FLUSH; ranks = [straightHigh] }
  else if (groups[0][1] === 4) { cat = CAT.QUADS; ranks = [groups[0][0], groups[1][0]] }
  else if (groups[0][1] === 3 && groups[1][1] === 2) { cat = CAT.FULL_HOUSE; ranks = [groups[0][0], groups[1][0]] }
  else if (flush) { cat = CAT.FLUSH; ranks = vals }
  else if (straightHigh) { cat = CAT.STRAIGHT; ranks = [straightHigh] }
  else if (groups[0][1] === 3) { cat = CAT.TRIPS; ranks = groups.map((g) => g[0]) }
  else if (groups[0][1] === 2 && groups[1][1] === 2) { cat = CAT.TWO_PAIR; ranks = groups.map((g) => g[0]) }
  else if (groups[0][1] === 2) { cat = CAT.PAIR; ranks = groups.map((g) => g[0]) }
  else { cat = CAT.HIGH; ranks = vals }

  return { score: pack(cat, ranks, 5), cat, ranks, cards }
}

/** All index combinations of size k from n items (cached). */
const comboCache = new Map<string, number[][]>()
function combos(n: number, k: number): number[][] {
  const key = `${n}/${k}`
  const hit = comboCache.get(key)
  if (hit) return hit
  const out: number[][] = []
  const cur: number[] = []
  const rec = (start: number) => {
    if (cur.length === k) { out.push([...cur]); return }
    for (let i = start; i < n; i++) { cur.push(i); rec(i + 1); cur.pop() }
  }
  rec(0)
  comboCache.set(key, out)
  return out
}

/** Best 5-card hand from any number (>= 5) of cards. */
export function bestFive(cards: Card[]): Evaluated {
  let best: Evaluated | null = null
  for (const idx of combos(cards.length, 5)) {
    const ev = evaluate5(idx.map((i) => cards[i]))
    if (!best || ev.score > best.score) best = ev
  }
  if (!best) throw new Error('bestFive needs at least 5 cards')
  return best
}

/** Texas Hold'em: best five of your 2 hole cards plus the board, in any combination. */
export function bestHoldem(hole: Card[], board: Card[]): Evaluated {
  return bestFive([...hole, ...board])
}

/** Omaha: you MUST use exactly 2 of your 4 hole cards and exactly 3 board cards. */
export function bestOmaha(hole: Card[], board: Card[]): Evaluated {
  if (board.length < 3) throw new Error('Omaha needs at least 3 board cards')
  let best: Evaluated | null = null
  for (const h of combos(hole.length, 2)) {
    for (const b of combos(board.length, 3)) {
      const ev = evaluate5([hole[h[0]], hole[h[1]], board[b[0]], board[b[1]], board[b[2]]])
      if (!best || ev.score > best.score) best = ev
    }
  }
  return best as Evaluated
}

/* ---------- Names ---------- */

const RANK_NAME: Record<number, string> = {
  14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack', 10: 'Ten', 9: 'Nine', 8: 'Eight', 7: 'Seven', 6: 'Six', 5: 'Five', 4: 'Four', 3: 'Three', 2: 'Two',
}
const RANK_PLURAL: Record<number, string> = {
  14: 'Aces', 13: 'Kings', 12: 'Queens', 11: 'Jacks', 10: 'Tens', 9: 'Nines', 8: 'Eights', 7: 'Sevens', 6: 'Sixes', 5: 'Fives', 4: 'Fours', 3: 'Threes', 2: 'Twos',
}

export const CAT_LABEL: Record<number, string> = {
  [CAT.HIGH]: 'High Card',
  [CAT.PAIR]: 'Pair',
  [CAT.TWO_PAIR]: 'Two Pair',
  [CAT.TRIPS]: 'Three of a Kind',
  [CAT.STRAIGHT]: 'Straight',
  [CAT.FLUSH]: 'Flush',
  [CAT.FULL_HOUSE]: 'Full House',
  [CAT.QUADS]: 'Four of a Kind',
  [CAT.STRAIGHT_FLUSH]: 'Straight Flush',
}

export function describeHand(ev: Evaluated): string {
  const r = ev.ranks
  switch (ev.cat) {
    case CAT.STRAIGHT_FLUSH: return r[0] === 14 ? 'Royal Flush' : `Straight Flush, ${RANK_NAME[r[0]]} high`
    case CAT.QUADS: return `Four ${RANK_PLURAL[r[0]]}`
    case CAT.FULL_HOUSE: return `Full House, ${RANK_PLURAL[r[0]]} over ${RANK_PLURAL[r[1]]}`
    case CAT.FLUSH: return `Flush, ${RANK_NAME[r[0]]} high`
    case CAT.STRAIGHT: return `Straight, ${RANK_NAME[r[0]]} high`
    case CAT.TRIPS: return `Three ${RANK_PLURAL[r[0]]}`
    case CAT.TWO_PAIR: return `Two Pair, ${RANK_PLURAL[r[0]]} and ${RANK_PLURAL[r[1]]}`
    case CAT.PAIR: return `Pair of ${RANK_PLURAL[r[0]]}`
    default: return `${RANK_NAME[r[0]]} high`
  }
}

/** Two hole cards before the flop, e.g. "Pocket Kings" or "Ace-King suited". */
export function preflopLabel(hole: Card[]): string {
  if (hole.length !== 2) return ''
  const [a, b] = [...hole].sort((x, y) => RV[y.rank] - RV[x.rank])
  if (RV[a.rank] === RV[b.rank]) return `Pocket ${RANK_PLURAL[RV[a.rank]]}`
  return `${RANK_NAME[RV[a.rank]]}-${RANK_NAME[RV[b.rank]]} ${a.suit === b.suit ? 'suited' : 'offsuit'}`
}

/* ---------- 3-card hands (Three Card Poker) ---------- */

export const CAT3 = { HIGH: 0, PAIR: 1, FLUSH: 2, STRAIGHT: 3, TRIPS: 4, STRAIGHT_FLUSH: 5 } as const

export interface Evaluated3 {
  score: number
  cat: number
  ranks: number[]
  label: string
}

export function evaluate3(cards: Card[]): Evaluated3 {
  if (cards.length !== 3) throw new Error(`evaluate3 needs exactly 3 cards, got ${cards.length}`)
  const vals = cards.map((c) => RV[c.rank]).sort((a, b) => b - a)
  const flush = cards.every((c) => c.suit === cards[0].suit)
  const distinct = new Set(vals).size === 3
  let straightHigh = 0
  if (distinct) {
    if (vals[0] - vals[2] === 2) straightHigh = vals[0]
    else if (vals[0] === 14 && vals[1] === 3 && vals[2] === 2) straightHigh = 3 // A-2-3 is the lowest straight
  }

  let cat: number
  let ranks: number[]
  if (straightHigh && flush) { cat = CAT3.STRAIGHT_FLUSH; ranks = [straightHigh] }
  else if (vals[0] === vals[1] && vals[1] === vals[2]) { cat = CAT3.TRIPS; ranks = [vals[0]] }
  else if (straightHigh) { cat = CAT3.STRAIGHT; ranks = [straightHigh] }
  else if (flush) { cat = CAT3.FLUSH; ranks = vals }
  else if (vals[0] === vals[1]) { cat = CAT3.PAIR; ranks = [vals[0], vals[2]] }
  else if (vals[1] === vals[2]) { cat = CAT3.PAIR; ranks = [vals[1], vals[0]] }
  else { cat = CAT3.HIGH; ranks = vals }

  let label: string
  switch (cat) {
    case CAT3.STRAIGHT_FLUSH: label = `Straight Flush, ${RANK_NAME[ranks[0]]} high`; break
    case CAT3.TRIPS: label = `Three ${RANK_PLURAL[ranks[0]]}`; break
    case CAT3.STRAIGHT: label = `Straight, ${RANK_NAME[ranks[0]]} high`; break
    case CAT3.FLUSH: label = `Flush, ${RANK_NAME[ranks[0]]} high`; break
    case CAT3.PAIR: label = `Pair of ${RANK_PLURAL[ranks[0]]}`; break
    default: label = `${RANK_NAME[ranks[0]]} high`
  }
  return { score: pack(cat, ranks, 3), cat, ranks, label }
}

/** Dealer qualifies in Three Card Poker with Queen-high or better. */
export function dealerQualifies(ev: Evaluated3): boolean {
  return ev.cat >= CAT3.PAIR || ev.ranks[0] >= 12
}
