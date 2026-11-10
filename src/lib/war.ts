/* Casino War, 6 decks. */
import { RV } from './pokerEval'
import type { Card } from './cards'

export const warValue = (c: Card): number => RV[c.rank] // Ace high
export type Cmp = 'win' | 'lose' | 'tie'
export const compare = (player: Card, dealer: Card): Cmp => (warValue(player) > warValue(dealer) ? 'win' : warValue(player) < warValue(dealer) ? 'lose' : 'tie')

export const TIE_BET_PAYS = 10

export interface WarSettle { returned: number; staked: number; net: number }

/**
 * first:  the first card against the dealer's.
 * choice: after a tie, SURRENDER (lose half your ante) or go to WAR (match your ante).
 * second: the war cards. Win OR tie: your ante pays 1:1 and the war bet is returned. Lose: both are lost.
 */
export function settleWar(p: { ante: number; tieBet: number; first: Cmp; choice?: 'surrender' | 'war'; second?: Cmp }): WarSettle {
  const { ante, tieBet, first, choice, second } = p
  let returned = 0
  let staked = ante + tieBet
  if (first === 'tie') returned += tieBet * (TIE_BET_PAYS + 1)
  if (first === 'win') returned += ante * 2
  if (first === 'tie') {
    if (choice === 'surrender') returned += Math.floor(ante / 2)
    if (choice === 'war') {
      staked += ante
      if (second === 'win' || second === 'tie') returned += ante * 2 + ante
    }
  }
  return { returned, staked, net: returned - staked }
}
