/* Three Card Poker: payouts and settlement. */
import { CAT3, dealerQualifies, type Evaluated3 } from './pokerEval'

/** Pair Plus pays on your hand alone, whatever the dealer has. */
export const PAIR_PLUS_PAYS: Record<number, number> = {
  [CAT3.STRAIGHT_FLUSH]: 40,
  [CAT3.TRIPS]: 30,
  [CAT3.STRAIGHT]: 6,
  [CAT3.FLUSH]: 4,
  [CAT3.PAIR]: 1,
}

/** Ante Bonus is paid if you play, even when the dealer beats you. */
export const ANTE_BONUS: Record<number, number> = {
  [CAT3.STRAIGHT_FLUSH]: 5,
  [CAT3.TRIPS]: 4,
  [CAT3.STRAIGHT]: 1,
}

export type Outcome3 = 'fold' | 'win' | 'lose' | 'push' | 'noqual'

export interface Settlement3 {
  outcome: Outcome3
  /** Total chips handed back to the player (stakes returned + winnings). */
  returned: number
  /** Total chips the player put in (ante + pair plus + play). */
  staked: number
  net: number
  pairPlusWin: number
  anteBonus: number
}

export function settleThreeCard(p: {
  ante: number
  pairPlus: number
  folded: boolean
  player: Evaluated3
  dealer: Evaluated3
}): Settlement3 {
  const { ante, pairPlus, folded, player, dealer } = p
  const ppMult = PAIR_PLUS_PAYS[player.cat]
  const pairPlusWin = pairPlus > 0 && ppMult ? pairPlus * ppMult : 0
  let returned = pairPlus > 0 && ppMult ? pairPlus * (1 + ppMult) : 0
  const staked = ante + pairPlus + (folded ? 0 : ante)

  if (folded) {
    return { outcome: 'fold', returned, staked, net: returned - staked, pairPlusWin, anteBonus: 0 }
  }

  const anteBonus = ANTE_BONUS[player.cat] ? ante * ANTE_BONUS[player.cat] : 0
  returned += anteBonus
  let outcome: Outcome3
  if (!dealerQualifies(dealer)) {
    returned += ante * 2 + ante // ante pays 1:1, the play bet is returned
    outcome = 'noqual'
  } else if (player.score > dealer.score) {
    returned += (ante + ante) * 2 // ante and play both pay 1:1
    outcome = 'win'
  } else if (player.score === dealer.score) {
    returned += ante + ante // everything returned
    outcome = 'push'
  } else {
    outcome = 'lose'
  }
  return { outcome, returned, staked, net: returned - staked, pairPlusWin, anteBonus }
}
