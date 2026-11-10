/* Card deck utilities + blackjack + video-poker hand evaluation */

export type Suit = '♠' | '♥' | '♦' | '♣'
export interface Card {
  rank: string // 'A','2'..'10','J','Q','K'
  suit: Suit
}

export const SUITS: Suit[] = ['♠', '♥', '♦', '♣']
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

export function newDeck(decks = 1): Card[] {
  const d: Card[] = []
  for (let n = 0; n < decks; n++)
    for (const s of SUITS) for (const r of RANKS) d.push({ rank: r, suit: s })
  return d
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function freshShoe(decks = 4): Card[] {
  return shuffle(newDeck(decks))
}

export function isRedSuit(s: Suit): boolean {
  return s === '♥' || s === '♦'
}

/* ---------- Blackjack ---------- */

export function bjValue(hand: Card[]): { total: number; soft: boolean } {
  let total = 0
  let aces = 0
  for (const c of hand) {
    if (c.rank === 'A') { aces++; total += 11 }
    else if (['K', 'Q', 'J'].includes(c.rank)) total += 10
    else total += parseInt(c.rank)
  }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return { total, soft: aces > 0 }
}

export function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && bjValue(hand).total === 21
}

/* ---------- Video poker (Jacks or Better) ---------- */

const RANK_ORDER: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  J: 11, Q: 12, K: 13, A: 14,
}

export type PokerHand =
  | 'ROYAL_FLUSH' | 'STRAIGHT_FLUSH' | 'FOUR_KIND' | 'FULL_HOUSE' | 'FLUSH'
  | 'STRAIGHT' | 'THREE_KIND' | 'TWO_PAIR' | 'JACKS_OR_BETTER' | 'NOTHING'

export const POKER_PAYS: Record<Exclude<PokerHand, 'NOTHING'>, number> = {
  ROYAL_FLUSH: 250, // per coin; the famous 800 is the 5-coin figure (5 x 160)
  STRAIGHT_FLUSH: 50,
  FOUR_KIND: 25,
  FULL_HOUSE: 9,
  FLUSH: 6,
  STRAIGHT: 4,
  THREE_KIND: 3,
  TWO_PAIR: 2,
  JACKS_OR_BETTER: 1,
}

export const POKER_LABELS: Record<PokerHand, string> = {
  ROYAL_FLUSH: 'Royal Flush',
  STRAIGHT_FLUSH: 'Straight Flush',
  FOUR_KIND: 'Four of a Kind',
  FULL_HOUSE: 'Full House',
  FLUSH: 'Flush',
  STRAIGHT: 'Straight',
  THREE_KIND: 'Three of a Kind',
  TWO_PAIR: 'Two Pair',
  JACKS_OR_BETTER: 'Jacks or Better',
  NOTHING: 'No Win',
}

export function evaluatePoker(hand: Card[]): PokerHand {
  const vals = hand.map((c) => RANK_ORDER[c.rank]).sort((a, b) => a - b)
  const suits = hand.map((c) => c.suit)
  const flush = suits.every((s) => s === suits[0])

  // straight detection (incl. wheel A-2-3-4-5)
  const unique = [...new Set(vals)]
  let straight = false
  if (unique.length === 5) {
    straight = unique[4] - unique[0] === 4 || (unique.join(',') === '2,3,4,5,14')
  }

  const counts = new Map<number, number>()
  for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1)
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])
  const topCount = groups[0][1]

  if (flush && straight) {
    if (unique[0] === 10 && unique[4] === 14) return 'ROYAL_FLUSH'
    return 'STRAIGHT_FLUSH'
  }
  if (topCount === 4) return 'FOUR_KIND'
  if (topCount === 3 && groups[1][1] === 2) return 'FULL_HOUSE'
  if (flush) return 'FLUSH'
  if (straight) return 'STRAIGHT'
  if (topCount === 3) return 'THREE_KIND'
  if (topCount === 2 && groups[1][1] === 2) return 'TWO_PAIR'
  if (topCount === 2 && groups[0][0] >= 11) return 'JACKS_OR_BETTER'
  return 'NOTHING'
}
