/* Baccarat (Punto Banco), 8 decks. */
import { freshShoe, type Card } from './cards'

export type Outcome = 'player' | 'banker' | 'tie'

export function pointValue(c: Card): number {
  if (c.rank === 'A') return 1
  if (c.rank === '10' || c.rank === 'J' || c.rank === 'Q' || c.rank === 'K') return 0
  return Number(c.rank)
}

export const handTotal = (cards: Card[]): number => cards.reduce((a, c) => a + pointValue(c), 0) % 10

/** Player draws a third card on 0-5 and stands on 6-7. */
export const playerDraws = (total: number): boolean => total <= 5

/** The banker's third-card rule. `p3` is the point value of the player's third card, or null if the player stood. */
export function bankerDraws(total: number, p3: number | null): boolean {
  if (p3 === null) return total <= 5
  switch (total) {
    case 0: case 1: case 2: return true
    case 3: return p3 !== 8
    case 4: return p3 >= 2 && p3 <= 7
    case 5: return p3 >= 4 && p3 <= 7
    case 6: return p3 === 6 || p3 === 7
    default: return false
  }
}

export interface Round {
  player: Card[]
  banker: Card[]
  pTotal: number
  bTotal: number
  outcome: Outcome
  natural: boolean
}

/** Deal one round. Order: Player, Banker, Player, Banker, then any third cards. */
export function playRound(draw: () => Card): Round {
  const player = [draw()]
  const banker = [draw()]
  player.push(draw())
  banker.push(draw())
  let pTotal = handTotal(player)
  let bTotal = handTotal(banker)
  const natural = pTotal >= 8 || bTotal >= 8
  if (!natural) {
    let p3: number | null = null
    if (playerDraws(pTotal)) {
      const c = draw()
      player.push(c)
      p3 = pointValue(c)
      pTotal = handTotal(player)
    }
    if (bankerDraws(bTotal, p3)) {
      banker.push(draw())
      bTotal = handTotal(banker)
    }
  }
  const outcome: Outcome = pTotal > bTotal ? 'player' : bTotal > pTotal ? 'banker' : 'tie'
  return { player, banker, pTotal, bTotal, outcome, natural }
}

export const newShoe = (): Card[] => freshShoe(8)

export const COMMISSION = 0.05
export const TIE_PAYS = 8

/** Chips handed back (stake included) for each bet, given the result. */
export function settleBaccarat(bets: { player: number; banker: number; tie: number }, outcome: Outcome) {
  let returned = 0
  if (outcome === 'player') returned += bets.player * 2 + bets.banker * 0
  if (outcome === 'banker') {
    // 1:1 minus a 5% commission, rounded to the nearest chip.
    const commission = Math.round(bets.banker * COMMISSION)
    returned += bets.banker * 2 - commission
  }
  if (outcome === 'tie') {
    returned += bets.player + bets.banker // those bets push
    returned += bets.tie * (TIE_PAYS + 1)
  }
  const staked = bets.player + bets.banker + bets.tie
  return { returned, staked, net: returned - staked }
}
