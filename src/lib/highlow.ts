/* High-Low: guess whether the next card is higher or lower. Prices come from the cards still in the deck. */
import { freshShoe, type Card } from './cards'
import { RV } from './pokerEval'

/** The house keeps 3%: every step pays 97% of the fair price. */
export const EDGE = 0.97

export interface Side { chance: number; mult: number; count: number }
export interface Odds { higher: Side; lower: Side }

const rank = (c: Card) => RV[c.rank]

function price(count: number, total: number): Side {
  const chance = total > 0 ? count / total : 0
  // Round the multiplier DOWN to 3 decimals, so rounding never favours the player (and barely costs them).
  const mult = chance > 0 ? Math.floor((EDGE / chance) * 1000 + 1e-6) / 1000 : 0
  return { chance, mult, count }
}

/** Ties lose, so only strictly higher / strictly lower cards count. */
export function oddsFor(deck: Card[], current: Card): Odds {
  const higher = deck.filter((c) => rank(c) > rank(current)).length
  const lower = deck.filter((c) => rank(c) < rank(current)).length
  return { higher: price(higher, deck.length), lower: price(lower, deck.length) }
}

export function newRound(): { deck: Card[]; current: Card } {
  const deck = freshShoe(1)
  const current = deck.pop() as Card
  return { deck, current }
}

export function judge(current: Card, next: Card, dir: 'higher' | 'lower'): boolean {
  return dir === 'higher' ? rank(next) > rank(current) : rank(next) < rank(current)
}

/** What a cash-out pays: stake times the streak multiplier, rounded down to whole chips. */
export function cashOutValue(stake: number, streakMult: number): number {
  return Math.floor(stake * streakMult + 1e-9)
}
