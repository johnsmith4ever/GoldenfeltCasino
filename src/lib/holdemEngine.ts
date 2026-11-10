/* Fixed-limit Texas Hold'em / Omaha engine: one human (seat 0) vs three bots.
 *
 * Why fixed-limit? Bet sizes are set (a "small bet" before the turn and a "big bet" from the turn on) and
 * there are at most 4 bets per round, so the most you can ever put in is known up front. That means nobody
 * is ever all-in and there are no side pots, which keeps the rules simple and easy to learn.
 */
import { newDeck, type Card } from './cards'
import { bestHoldem, bestOmaha, describeHand, type Evaluated } from './pokerEval'

export type Variant = 'holdem' | 'omaha'
export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
export type Rng = () => number
export type Action = 'fold' | 'check' | 'call' | 'raise'

export const MAX_BETS = 4 // the opening bet + 3 raises per betting round
export const SEAT_COUNT = 4

export interface Stakes {
  id: string
  name: string
  sb: number
  bb: number
  /** Bet size before the turn (equals the big blind). */
  small: number
  /** Bet size on the turn and river. */
  big: number
}

export const STAKES: Stakes[] = [
  { id: 'beginner', name: 'Beginner', sb: 5, bb: 10, small: 10, big: 20 },
  { id: 'classic', name: 'Classic', sb: 25, bb: 50, small: 50, big: 100 },
  { id: 'high', name: 'High Stakes', sb: 100, bb: 200, small: 200, big: 400 },
]

/** The most chips one player can possibly put in during a single hand at these stakes. */
export function maxExposure(st: Stakes): number {
  return MAX_BETS * st.small * 2 + MAX_BETS * st.big * 2
}

export interface BotStyle {
  name: string
  tag: string
  /** Higher = needs a better hand to continue. */
  tight: number
  /** Chance of raising when the hand is strong. */
  aggro: number
  /** Chance of calling slightly too light. */
  loose: number
  /** Chance of betting with a weak hand. */
  bluff: number
}

export const BOT_STYLES: BotStyle[] = [
  { name: 'Victor', tag: 'Tight-Aggressive', tight: 0.75, aggro: 0.82, loose: 0.08, bluff: 0.04 },
  { name: 'Maya', tag: 'Loose-Aggressive', tight: -0.65, aggro: 0.95, loose: 0.55, bluff: 0.23 },
  { name: 'Dex', tag: 'Calling Station', tight: -0.3, aggro: 0.18, loose: 0.78, bluff: 0.02 },
]

export interface Seat {
  id: number
  name: string
  tag: string
  human: boolean
  style: BotStyle | null
  holes: Card[]
  folded: boolean
  /** Total put in the pot this hand. */
  paid: number
  /** Put in during the current betting round. */
  street: number
  acted: boolean
  last: string | null
}

export interface Winner { seat: number; amount: number }

export interface HandResult {
  showdown: boolean
  winners: Winner[]
  evs: Record<number, Evaluated>
  potTotal: number
}

export interface Hand {
  variant: Variant
  stakes: Stakes
  seats: Seat[]
  button: number
  deck: Card[]
  board: Card[]
  street: Street
  pot: number
  /** The amount each player must have put in this round to stay in. */
  level: number
  /** Number of bets/raises so far this round (the big blind counts as the first bet before the flop). */
  bets: number
  toAct: number | null
  result: HandResult | null
}

const keyOf = (c: Card) => c.rank + c.suit

function shuffleWith<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function clone(h: Hand): Hand {
  return {
    ...h,
    stakes: h.stakes,
    seats: h.seats.map((s) => ({ ...s, holes: [...s.holes] })),
    deck: [...h.deck],
    board: [...h.board],
  }
}

export function betSize(h: Hand): number {
  return h.street === 'preflop' || h.street === 'flop' ? h.stakes.small : h.stakes.big
}

function nextActor(h: Hand, from: number): number | null {
  for (let i = 1; i <= SEAT_COUNT; i++) {
    const idx = (from + i) % SEAT_COUNT
    const s = h.seats[idx]
    if (!s.folded && (!s.acted || s.street < h.level)) return idx
  }
  return null
}

function put(h: Hand, seat: Seat, amount: number) {
  seat.street += amount
  seat.paid += amount
  h.pot += amount
}

export function newHand(variant: Variant, stakes: Stakes, button: number, rng: Rng = Math.random): Hand {
  const deck = shuffleWith(newDeck(1), rng)
  const seats: Seat[] = [
    { id: 0, name: 'You', tag: 'You', human: true, style: null, holes: [], folded: false, paid: 0, street: 0, acted: false, last: null },
    ...BOT_STYLES.map((st, i): Seat => ({
      id: i + 1, name: st.name, tag: st.tag, human: false, style: st, holes: [], folded: false, paid: 0, street: 0, acted: false, last: null,
    })),
  ]
  const holeN = variant === 'omaha' ? 4 : 2
  for (let r = 0; r < holeN; r++) {
    for (let i = 0; i < SEAT_COUNT; i++) seats[(button + 1 + i) % SEAT_COUNT].holes.push(deck.pop() as Card)
  }
  const h: Hand = { variant, stakes, seats, button, deck, board: [], street: 'preflop', pot: 0, level: stakes.bb, bets: 1, toAct: null, result: null }
  const sbIdx = (button + 1) % SEAT_COUNT
  const bbIdx = (button + 2) % SEAT_COUNT
  put(h, seats[sbIdx], stakes.sb)
  seats[sbIdx].last = 'Small blind'
  put(h, seats[bbIdx], stakes.bb)
  seats[bbIdx].last = 'Big blind'
  h.toAct = nextActor(h, bbIdx)
  return h
}

export interface Legal {
  toCall: number
  canCheck: boolean
  canRaise: boolean
  /** The level you would raise to. */
  raiseTo: number
  /** What it costs you to raise (call amount + one bet). */
  raiseCost: number
}

export function legalActions(h: Hand): Legal | null {
  if (h.toAct === null || h.result) return null
  const s = h.seats[h.toAct]
  const toCall = h.level - s.street
  const canRaise = h.bets < MAX_BETS
  const raiseTo = h.level + betSize(h)
  return { toCall, canCheck: toCall === 0, canRaise, raiseTo, raiseCost: raiseTo - s.street }
}

function best(variant: Variant, holes: Card[], board: Card[]): Evaluated {
  return variant === 'omaha' ? bestOmaha(holes, board) : bestHoldem(holes, board)
}

function finish(h: Hand, showdown: boolean) {
  const live = h.seats.filter((s) => !s.folded)
  const evs: Record<number, Evaluated> = {}
  let winnersIdx: number[]
  if (showdown) {
    for (const s of live) evs[s.id] = best(h.variant, s.holes, h.board)
    const top = Math.max(...live.map((s) => evs[s.id].score))
    winnersIdx = live.filter((s) => evs[s.id].score === top).map((s) => s.id)
  } else {
    winnersIdx = [live[0].id]
  }
  // Split the pot; any odd chips go to the winners closest to the left of the dealer button.
  const ordered = [...winnersIdx].sort(
    (a, b) => ((a - h.button - 1 + SEAT_COUNT) % SEAT_COUNT) - ((b - h.button - 1 + SEAT_COUNT) % SEAT_COUNT),
  )
  const base = Math.floor(h.pot / ordered.length)
  let rem = h.pot - base * ordered.length
  const winners: Winner[] = ordered.map((id) => {
    const extra = rem > 0 ? 1 : 0
    rem -= extra
    return { seat: id, amount: base + extra }
  })
  h.result = { showdown, winners, evs, potTotal: h.pot }
  h.street = 'showdown'
  h.toAct = null
}

function closeStreet(h: Hand) {
  if (h.street === 'river') { finish(h, true); return }
  const order: Street[] = ['preflop', 'flop', 'turn', 'river']
  const nxt = order[order.indexOf(h.street) + 1]
  h.deck.pop() // burn card
  const n = nxt === 'flop' ? 3 : 1
  for (let i = 0; i < n; i++) h.board.push(h.deck.pop() as Card)
  h.street = nxt
  h.level = 0
  h.bets = 0
  for (const s of h.seats) { s.street = 0; s.acted = false; if (!s.folded) s.last = null }
  h.toAct = nextActor(h, h.button)
}

/** Apply the current player's action and return the new hand. Throws if the action is illegal. */
export function act(prev: Hand, action: Action): Hand {
  const legal = legalActions(prev)
  if (!legal || prev.toAct === null) throw new Error('No one to act')
  const h = clone(prev)
  const seat = h.seats[prev.toAct]

  if (action === 'fold') {
    seat.folded = true
    seat.acted = true
    seat.last = 'Fold'
    if (h.seats.filter((s) => !s.folded).length === 1) { finish(h, false); return h }
  } else if (action === 'check') {
    if (!legal.canCheck) throw new Error('Cannot check when facing a bet')
    seat.acted = true
    seat.last = 'Check'
  } else if (action === 'call') {
    if (legal.toCall === 0) throw new Error('Nothing to call')
    put(h, seat, legal.toCall)
    seat.acted = true
    seat.last = 'Call'
  } else {
    if (!legal.canRaise) throw new Error('Betting is capped')
    const opening = h.level === 0
    put(h, seat, legal.raiseCost)
    h.level = legal.raiseTo
    h.bets += 1
    for (const s of h.seats) if (s.id !== seat.id && !s.folded) s.acted = false
    seat.acted = true
    seat.last = opening ? 'Bet' : 'Raise'
  }

  const nxt = nextActor(h, seat.id)
  if (nxt === null) closeStreet(h)
  else h.toAct = nxt
  return h
}

/* ---------- Win-chance estimate (Monte Carlo) ---------- */

/** Chance (0..1) that this seat wins from here, against random hands for everyone still in. */
export function equity(h: Hand, seatIdx: number, sims: number, rng: Rng = Math.random): number {
  const me = h.seats[seatIdx]
  const opp = h.seats.filter((s) => s.id !== seatIdx && !s.folded).length
  if (opp === 0) return 1
  const known = new Set([...me.holes, ...h.board].map(keyOf))
  const pool = newDeck(1).filter((c) => !known.has(keyOf(c)))
  const holeN = h.variant === 'omaha' ? 4 : 2
  const need = 5 - h.board.length
  const draws = need + opp * holeN
  let total = 0
  for (let n = 0; n < sims; n++) {
    for (let i = 0; i < draws; i++) {
      const j = i + Math.floor(rng() * (pool.length - i))
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t
    }
    const board = need > 0 ? [...h.board, ...pool.slice(0, need)] : h.board
    const mine = best(h.variant, me.holes, board).score
    let beaten = true
    let ties = 0
    for (let o = 0; o < opp; o++) {
      const hole = pool.slice(need + o * holeN, need + (o + 1) * holeN)
      const sc = best(h.variant, hole, board).score
      if (sc > mine) { beaten = false; break }
      if (sc === mine) ties++
    }
    if (beaten) total += 1 / (ties + 1)
  }
  return total / sims
}

export function simsFor(variant: Variant): number {
  return variant === 'omaha' ? 90 : 160
}

/* ---------- Bot brain ---------- */

export interface Advice { action: Action; equity: number; why: string }

/** The pot grows on later streets, so before the river a call is worth a bit more than today's pot suggests. */
function priceToCall(h: Hand, toCall: number): number {
  const odds = toCall / (h.pot + toCall)
  return h.street === 'river' ? odds : odds * 0.8
}

/** What a sensible player would do, based on win chance versus the price of continuing. */
export function suggest(h: Hand, seatIdx: number, eq: number): Advice {
  const legal = legalActions(h) as Legal
  const live = h.seats.filter((s) => !s.folded && s.id !== seatIdx).length
  const fair = 1 / (live + 1)
  const pct = Math.round(eq * 100)
  const strong = fair + 0.22
  if (legal.toCall === 0) {
    if (legal.canRaise && eq >= strong) return { action: 'raise', equity: eq, why: `Strong hand (about ${pct}% to win) — bet to build the pot.` }
    return { action: 'check', equity: eq, why: `Nothing to pay — check and see the next card (about ${pct}% to win).` }
  }
  const potOdds = priceToCall(h, legal.toCall)
  if (legal.canRaise && eq >= strong + 0.06) return { action: 'raise', equity: eq, why: `Very strong (about ${pct}% to win) — raise.` }
  if (eq >= potOdds + 0.03) return { action: 'call', equity: eq, why: `Worth calling: about ${pct}% to win versus ${Math.round(potOdds * 100)}% needed.` }
  return { action: 'fold', equity: eq, why: `Weak spot: about ${pct}% to win but you need ${Math.round(potOdds * 100)}%. Folding saves chips.` }
}

/** Approximate pre-flop strength for a two-card Hold'em start (0..1). */
function holdemStartingStrength(holes: Card[]): number {
  if (holes.length < 2) return 0.35
  const rank = (c: Card) => c.rank === 'A' ? 14 : c.rank === 'K' ? 13 : c.rank === 'Q' ? 12 : c.rank === 'J' ? 11 : c.rank === 'T' ? 10 : Number(c.rank)
  const a = rank(holes[0]); const b = rank(holes[1]); const hi = Math.max(a, b); const lo = Math.min(a, b)
  if (a === b) return Math.min(0.9, 0.52 + (hi - 2) * 0.027)
  const suited = holes[0].suit === holes[1].suit ? 0.045 : 0
  const gap = hi - lo - 1
  const connected = gap === 0 ? 0.04 : gap === 1 ? 0.025 : gap === 2 ? 0.005 : -Math.min(0.12, gap * 0.018)
  const highCards = ((hi - 2) / 12) * 0.23 + ((lo - 2) / 12) * 0.14
  const aceBonus = hi === 14 ? 0.035 : 0
  return Math.max(0.22, Math.min(0.78, 0.28 + highCards + suited + connected + aceBonus))
}

export function botDecide(h: Hand, rng: Rng = Math.random, sims = Math.max(260, simsFor(h.variant))): Action {
  const idx = h.toAct as number
  const seat = h.seats[idx]
  const style = seat.style as BotStyle
  const legal = legalActions(h) as Legal
  const simulated = equity(h, idx, sims, rng)
  // The Monte Carlo evaluator covers all future board cards. Blend in a hand-specific
  // pre-flop prior so premium pairs and connected/suited starts are not misread.
  const start = h.street === 'preflop' && h.variant === 'holdem' ? holdemStartingStrength(seat.holes) : simulated
  const eq = h.street === 'preflop' && h.variant === 'holdem' ? simulated * 0.48 + start * 0.52 : simulated
  const live = h.seats.filter((s) => !s.folded && s.id !== idx).length
  const fair = 1 / (live + 1)
  const strong = Math.max(0.55, fair + 0.20 + style.tight * 0.025)

  // Checking is always preferable to folding when no chips are required.
  if (legal.toCall === 0) {
    if (legal.canRaise && eq >= strong && rng() < style.aggro) return 'raise'
    if (legal.canRaise && h.street !== 'preflop' && eq >= 0.40 && rng() < style.bluff * 0.45) return 'raise'
    return 'check'
  }

  const potOdds = priceToCall(h, legal.toCall)
  const pressure = Math.max(0, h.bets - 1) * 0.012
  const need = Math.max(0.18, potOdds + 0.025 + style.tight * 0.025 + pressure)

  // These safety floors prevent the previous behaviour where playable pairs and
  // made hands disappeared to ordinary bets. The station is deliberately sticky.
  if (eq >= 0.72 && legal.canRaise && rng() < style.aggro) return 'raise'
  if (eq >= 0.56) return eq >= strong + 0.06 && legal.canRaise && rng() < style.aggro ? 'raise' : 'call'
  if (eq >= need) {
    if (legal.canRaise && eq >= strong + 0.08 && rng() < style.aggro) return 'raise'
    return 'call'
  }
  if (eq >= need - 0.06 && rng() < style.loose) return 'call'
  if (style.tag === 'Calling Station' && legal.toCall <= h.pot * 0.75 && eq >= 0.28) return 'call'
  if (eq >= 0.44 && rng() < style.bluff) return 'call'
  return 'fold'
}

/** The human's best hand so far, if enough cards are out. */
export function currentBest(h: Hand, seatIdx: number): Evaluated | null {
  const holes = h.seats[seatIdx].holes
  if (h.variant === 'omaha') return h.board.length >= 3 ? bestOmaha(holes, h.board) : null
  return h.board.length >= 3 ? bestHoldem(holes, h.board) : null
}

export function describeSeatHand(ev: Evaluated | undefined): string {
  return ev ? describeHand(ev) : ''
}
