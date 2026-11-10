/* Fixed-limit Seven-Card Stud: one human (seat 0) vs three bots.
 *
 * Each player gets 2 cards face down and 1 face up ("third street"), then one more card per round:
 * three face up (fourth, fifth, sixth street) and a last one face down (seventh street, "the river").
 * Your hand is the best five of your seven cards. There are no shared cards.
 */
import { newDeck, type Card } from './cards'
import { RV, bestFive, describeHand, type Evaluated } from './pokerEval'
import { BOT_STYLES, MAX_BETS, SEAT_COUNT, type Action, type BotStyle, type Rng, type Winner } from './holdemEngine'

export type StudStreet = 'third' | 'fourth' | 'fifth' | 'sixth' | 'seventh' | 'showdown'
const ORDER: StudStreet[] = ['third', 'fourth', 'fifth', 'sixth', 'seventh']
export const STREET_NAME: Record<string, string> = { third: '3RD STREET', fourth: '4TH STREET', fifth: '5TH STREET', sixth: '6TH STREET', seventh: '7TH STREET · LAST CARD', showdown: 'SHOWDOWN' }

export interface StudStakes { id: string; name: string; ante: number; bringIn: number; small: number; big: number }

export const STUD_STAKES: StudStakes[] = [
  { id: 'beginner', name: 'Beginner', ante: 2, bringIn: 5, small: 10, big: 20 },
  { id: 'classic', name: 'Classic', ante: 10, bringIn: 25, small: 50, big: 100 },
  { id: 'high', name: 'High Stakes', ante: 40, bringIn: 100, small: 200, big: 400 },
]

/** Most one player can put in during one hand: ante + 4 bets on 3rd and 4th (small) + 4 bets on 5th, 6th, 7th (big). */
export function studMaxExposure(s: StudStakes): number {
  return s.ante + MAX_BETS * s.small * 2 + MAX_BETS * s.big * 3
}

export interface StudSeat {
  id: number
  name: string
  tag: string
  human: boolean
  style: BotStyle | null
  down: Card[]
  up: Card[]
  folded: boolean
  paid: number
  street: number
  acted: boolean
  last: string | null
}

export interface StudResult { showdown: boolean; winners: Winner[]; evs: Record<number, Evaluated>; potTotal: number }

export interface StudHand {
  stakes: StudStakes
  seats: StudSeat[]
  button: number
  deck: Card[]
  street: StudStreet
  pot: number
  level: number
  bets: number
  toAct: number | null
  result: StudResult | null
}

const SUIT_ORDER: Record<string, number> = { '♣': 0, '♦': 1, '♥': 2, '♠': 3 }
const keyOf = (c: Card) => c.rank + c.suit

function shuffleWith<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function clone(h: StudHand): StudHand {
  return { ...h, seats: h.seats.map((s) => ({ ...s, down: [...s.down], up: [...s.up] })), deck: [...h.deck] }
}

/** Compare two face-up hands (pairs, trips... beat high cards). Returns a sortable key. */
export function upKey(up: Card[]): number[] {
  const cnt = new Map<number, number>()
  for (const c of up) cnt.set(RV[c.rank], (cnt.get(RV[c.rank]) ?? 0) + 1)
  const groups = [...cnt.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])
  const top = groups[0][1]
  const second = groups[1]?.[1] ?? 0
  const cat = top === 4 ? 7 : top === 3 ? 3 : top === 2 && second === 2 ? 2 : top === 2 ? 1 : 0
  return [cat, ...groups.map((g) => g[0])]
}
const cmpKey = (a: number[], b: number[]) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] ?? 0) - (b[i] ?? 0); if (d) return Math.sign(d) }
  return 0
}

/** Seat that has the lowest door card (Ace is high; ties go by suit: clubs < diamonds < hearts < spades). */
function lowestDoor(h: StudHand): number {
  let best = -1
  for (const s of h.seats) {
    if (s.folded) continue
    if (best < 0) { best = s.id; continue }
    const a = s.up[0], b = h.seats[best].up[0]
    const d = RV[a.rank] - RV[b.rank] || SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit]
    if (d < 0) best = s.id
  }
  return best
}

/** Seat with the best face-up hand acts first; a tie goes to whoever sits closest to the left of the button. */
function highestBoard(h: StudHand): number {
  let best = -1
  for (let i = 1; i <= SEAT_COUNT; i++) {
    const idx = (h.button + i) % SEAT_COUNT
    const s = h.seats[idx]
    if (s.folded) continue
    if (best < 0 || cmpKey(upKey(s.up), upKey(h.seats[best].up)) > 0) best = idx
  }
  return best
}

function nextActor(h: StudHand, from: number): number | null {
  for (let i = 1; i <= SEAT_COUNT; i++) {
    const idx = (from + i) % SEAT_COUNT
    const s = h.seats[idx]
    if (!s.folded && (!s.acted || s.street < h.level)) return idx
  }
  return null
}

function put(h: StudHand, seat: StudSeat, amount: number) {
  seat.street += amount
  seat.paid += amount
  h.pot += amount
}

export function newStudHand(stakes: StudStakes, button: number, rng: Rng = Math.random): StudHand {
  const deck = shuffleWith(newDeck(1), rng)
  const seats: StudSeat[] = [
    { id: 0, name: 'You', tag: 'You', human: true, style: null, down: [], up: [], folded: false, paid: 0, street: 0, acted: false, last: null },
    ...BOT_STYLES.map((st, i): StudSeat => ({ id: i + 1, name: st.name, tag: st.tag, human: false, style: st, down: [], up: [], folded: false, paid: 0, street: 0, acted: false, last: null })),
  ]
  for (let r = 0; r < 2; r++) for (let i = 0; i < SEAT_COUNT; i++) seats[(button + 1 + i) % SEAT_COUNT].down.push(deck.pop() as Card)
  for (let i = 0; i < SEAT_COUNT; i++) seats[(button + 1 + i) % SEAT_COUNT].up.push(deck.pop() as Card)
  const h: StudHand = { stakes, seats, button, deck, street: 'third', pot: 0, level: 0, bets: 0, toAct: null, result: null }
  for (const s of seats) { s.paid = stakes.ante; h.pot += stakes.ante }
  const bi = lowestDoor(h)
  put(h, seats[bi], stakes.bringIn)
  h.level = stakes.bringIn
  seats[bi].acted = true // the bring-in is a bet, so there is no "big blind option" for this player
  seats[bi].last = 'Bring-in'
  h.toAct = nextActor(h, bi)
  return h
}

export const studBetSize = (h: StudHand): number => (h.street === 'third' || h.street === 'fourth' ? h.stakes.small : h.stakes.big)

export interface StudLegal { toCall: number; canCheck: boolean; canRaise: boolean; raiseTo: number; raiseCost: number; completes: boolean }

export function studLegal(h: StudHand): StudLegal | null {
  if (h.toAct === null || h.result) return null
  const s = h.seats[h.toAct]
  const size = studBetSize(h)
  const toCall = h.level - s.street
  const raiseTo = h.level < size ? size : h.level + size // from the bring-in, the first raise "completes" to a full bet
  return { toCall, canCheck: toCall === 0, canRaise: h.bets < MAX_BETS, raiseTo, raiseCost: raiseTo - s.street, completes: h.street === 'third' && h.bets === 0 }
}

function finish(h: StudHand, showdown: boolean) {
  const live = h.seats.filter((s) => !s.folded)
  const evs: Record<number, Evaluated> = {}
  let winnersIdx: number[]
  if (showdown) {
    for (const s of live) evs[s.id] = bestFive([...s.down, ...s.up])
    const top = Math.max(...live.map((s) => evs[s.id].score))
    winnersIdx = live.filter((s) => evs[s.id].score === top).map((s) => s.id)
  } else winnersIdx = [live[0].id]
  const ordered = [...winnersIdx].sort((a, b) => ((a - h.button - 1 + SEAT_COUNT) % SEAT_COUNT) - ((b - h.button - 1 + SEAT_COUNT) % SEAT_COUNT))
  const base = Math.floor(h.pot / ordered.length)
  let rem = h.pot - base * ordered.length
  const winners: Winner[] = ordered.map((id) => { const extra = rem > 0 ? 1 : 0; rem -= extra; return { seat: id, amount: base + extra } })
  h.result = { showdown, winners, evs, potTotal: h.pot }
  h.street = 'showdown'
  h.toAct = null
}

function closeStreet(h: StudHand) {
  if (h.street === 'seventh') { finish(h, true); return }
  const nxt = ORDER[ORDER.indexOf(h.street as StudStreet) + 1]
  for (let i = 1; i <= SEAT_COUNT; i++) {
    const s = h.seats[(h.button + i) % SEAT_COUNT]
    if (s.folded) continue
    const card = h.deck.pop() as Card
    if (nxt === 'seventh') s.down.push(card); else s.up.push(card)
  }
  h.street = nxt
  h.level = 0
  h.bets = 0
  for (const s of h.seats) { s.street = 0; s.acted = false; if (!s.folded) s.last = null }
  h.toAct = highestBoard(h)
}

export function studAct(prev: StudHand, action: Action): StudHand {
  const legal = studLegal(prev)
  if (!legal || prev.toAct === null) throw new Error('No one to act')
  const h = clone(prev)
  const seat = h.seats[prev.toAct]
  if (action === 'fold') {
    seat.folded = true; seat.acted = true; seat.last = 'Fold'
    if (h.seats.filter((s) => !s.folded).length === 1) { finish(h, false); return h }
  } else if (action === 'check') {
    if (!legal.canCheck) throw new Error('Cannot check when facing a bet')
    seat.acted = true; seat.last = 'Check'
  } else if (action === 'call') {
    if (legal.toCall === 0) throw new Error('Nothing to call')
    put(h, seat, legal.toCall); seat.acted = true; seat.last = 'Call'
  } else {
    if (!legal.canRaise) throw new Error('Betting is capped')
    const opening = h.level === 0
    put(h, seat, legal.raiseCost)
    h.level = legal.raiseTo
    h.bets += 1
    for (const s of h.seats) if (s.id !== seat.id && !s.folded) s.acted = false
    seat.acted = true
    seat.last = legal.completes ? 'Complete' : opening ? 'Bet' : 'Raise'
  }
  const nxt = nextActor(h, seat.id)
  if (nxt === null) closeStreet(h); else h.toAct = nxt
  return h
}

/* ---------- Win chance and bot brain ---------- */

/** Chance this seat wins, with every unseen card dealt randomly (opponents' hidden cards are unknown to you). */
export function studEquity(h: StudHand, idx: number, sims: number, rng: Rng = Math.random): number {
  const me = h.seats[idx]
  const opps = h.seats.filter((s) => s.id !== idx && !s.folded)
  if (opps.length === 0) return 1
  const known = new Set<string>([...me.down, ...me.up, ...h.seats.flatMap((s) => s.up)].map(keyOf))
  const pool = newDeck(1).filter((c) => !known.has(keyOf(c)))
  const needMe = 7 - me.down.length - me.up.length
  const needOpp = opps.map((o) => 7 - o.up.length)
  const draws = needMe + needOpp.reduce((a, b) => a + b, 0)
  let total = 0
  for (let n = 0; n < sims; n++) {
    for (let i = 0; i < draws; i++) { const j = i + Math.floor(rng() * (pool.length - i)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t }
    let p = needMe
    const mine = bestFive([...me.down, ...me.up, ...pool.slice(0, needMe)]).score
    let beaten = true, ties = 0
    for (let o = 0; o < opps.length; o++) {
      const sc = bestFive([...opps[o].up, ...pool.slice(p, p + needOpp[o])]).score
      p += needOpp[o]
      if (sc > mine) { beaten = false; break }
      if (sc === mine) ties++
    }
    if (beaten) total += 1 / (ties + 1)
  }
  return total / sims
}

export const STUD_SIMS = 90

function priceToCall(h: StudHand, toCall: number): number {
  const odds = toCall / (h.pot + toCall)
  return h.street === 'seventh' ? odds : odds * 0.8
}

export interface StudAdvice { action: Action; equity: number; why: string }

export function studSuggest(h: StudHand, idx: number, eq: number): StudAdvice {
  const legal = studLegal(h) as StudLegal
  const live = h.seats.filter((s) => !s.folded && s.id !== idx).length
  const strong = 1 / (live + 1) + 0.22
  const pct = Math.round(eq * 100)
  if (legal.toCall === 0) {
    if (legal.canRaise && eq >= strong) return { action: 'raise', equity: eq, why: `Strong hand (about ${pct}% to win) — bet to build the pot.` }
    return { action: 'check', equity: eq, why: `Nothing to pay — check and see the next card (about ${pct}% to win).` }
  }
  const potOdds = priceToCall(h, legal.toCall)
  if (legal.canRaise && eq >= strong + 0.06) return { action: 'raise', equity: eq, why: `Very strong (about ${pct}% to win) — raise.` }
  if (eq >= potOdds + 0.03) return { action: 'call', equity: eq, why: `Worth calling: about ${pct}% to win versus ${Math.round(potOdds * 100)}% needed.` }
  return { action: 'fold', equity: eq, why: `Weak spot: about ${pct}% to win but you need ${Math.round(potOdds * 100)}%. Folding saves chips.` }
}

export function studBotDecide(h: StudHand, rng: Rng = Math.random, sims = 180): Action {
  const idx = h.toAct as number
  const style = h.seats[idx].style as BotStyle
  const legal = studLegal(h) as StudLegal
  const eq = studEquity(h, idx, sims, rng)
  const live = h.seats.filter((s) => !s.folded && s.id !== idx).length
  const raiseAt = 1 / (live + 1) + 0.20 + style.tight * 0.025
  if (legal.toCall === 0) {
    if (legal.canRaise && eq >= raiseAt && rng() < style.aggro) return 'raise'
    if (legal.canRaise && h.street !== 'third' && rng() < style.bluff * 0.4) return 'raise'
    return 'check'
  }
  const need = Math.max(0.18, priceToCall(h, legal.toCall) + 0.025 + style.tight * 0.025 + 0.015 * Math.max(0, h.bets - 1))
  if (eq >= 0.70 && legal.canRaise && rng() < style.aggro) return 'raise'
  if (eq >= 0.56) return 'call'
  if (legal.canRaise && eq >= raiseAt + 0.06 && rng() < style.aggro) return 'raise'
  if (eq >= need) return 'call'
  if (eq >= need - 0.06 && rng() < style.loose) return 'call'
  if (style.tag === 'Calling Station' && legal.toCall <= h.pot * 0.75 && eq >= 0.28) return 'call'
  return 'fold'
}

/** Short description of what a set of cards is showing, e.g. "Pair of Kings" (used before five cards are out). */
export function describePartial(cards: Card[]): string {
  if (cards.length >= 5) return describeHand(bestFive(cards))
  const key = upKey(cards)
  const names: Record<number, string> = { 14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack', 10: 'Ten', 9: 'Nine', 8: 'Eight', 7: 'Seven', 6: 'Six', 5: 'Five', 4: 'Four', 3: 'Three', 2: 'Two' }
  const plural: Record<number, string> = { 14: 'Aces', 13: 'Kings', 12: 'Queens', 11: 'Jacks', 10: 'Tens', 9: 'Nines', 8: 'Eights', 7: 'Sevens', 6: 'Sixes', 5: 'Fives', 4: 'Fours', 3: 'Threes', 2: 'Twos' }
  switch (key[0]) {
    case 7: return `Four ${plural[key[1]]}`
    case 3: return `Three ${plural[key[1]]}`
    case 2: return `Two Pair, ${plural[key[1]]} and ${plural[key[2]]}`
    case 1: return `Pair of ${plural[key[1]]}`
    default: return `${names[key[1]]} high`
  }
}
