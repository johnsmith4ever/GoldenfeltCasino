import { useEffect, useState, type ReactNode } from 'react'
import { fmt, useChips } from '../../state/chips'

export type ResultKind = 'win' | 'lose' | 'push'
export interface ResultInfo { kind: ResultKind; title: string; detail?: string; amount?: number }

/** True on phone-sized screens, so card sizes can adapt. */
export function useNarrow(breakpoint = 640): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < breakpoint)
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < breakpoint)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [breakpoint])
  return narrow
}

/** Result shown in the flow of the page (the overlay banner would cover the cards). */
export function ResultStrip({ result }: { result: ResultInfo | null }) {
  const { lastDebtService, recordLoss } = useChips()
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!result) { setVisible(false); return }
    setVisible(true)
    if (result.kind === 'lose') recordLoss()
    const timer = setTimeout(() => setVisible(false), 3000)
    return () => clearTimeout(timer)
  }, [result, recordLoss])
  if (!result || !visible) return null
  const tone = {
    win: 'border-[#f6e27a] bg-[#2a2105]/90 text-[#f6e27a] win-glow-anim',
    lose: 'border-[#d4002a]/70 bg-[#2a050a]/90 text-[#ff97a3]',
    push: 'border-[#b3a06b] bg-[#1c1a14]/90 text-[#e8dcb8]',
  }[result.kind]
  return (
    <button type="button" onClick={() => setVisible(false)} aria-label="Dismiss result" className={`banner-pop-anim mx-auto flex max-w-xl flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-xl border-2 px-5 py-3 text-center ${tone}`}>
      <span className="font-display text-lg font-bold tracking-[0.15em] sm:text-xl">{result.title}</span>
      {result.detail && <span className="text-[13px] tracking-wide opacity-90">{result.detail}</span>}
      {result.amount !== undefined && result.amount > 0 && <span className="font-display text-lg font-bold tabular-nums">+{fmt(result.amount)}</span>}
      {lastDebtService > 0 && result.kind === 'win' && <span className="basis-full text-[11px] font-semibold">30% of your winnings went to your debt · {fmt(lastDebtService)} paid</span>}
      <span className="basis-full text-[9px] tracking-[0.2em] opacity-50">TAP TO DISMISS</span>
    </button>
  )
}

/* ---------- Tiny card glyphs for the guides ---------- */

function MiniCard({ t }: { t: string }) {
  const suit = t.slice(-1)
  const rank = t.slice(0, -1).replace('T', '10')
  const glyph = ({ s: '♠', h: '♥', d: '♦', c: '♣' } as Record<string, string>)[suit]
  const red = suit === 'h' || suit === 'd'
  return (
    <span
      className="inline-flex h-7 min-w-[30px] items-center justify-center rounded-[4px] bg-[#f7f3ea] px-1 text-[12px] font-bold leading-none shadow"
      style={{ color: red ? '#b3001b' : '#17151c' }}
    >
      {rank}{glyph}
    </span>
  )
}

export function MiniCards({ cards }: { cards: string }) {
  return <span className="inline-flex gap-1">{cards.split(' ').map((c, i) => <MiniCard key={i} t={c} />)}</span>
}

const RANKINGS: { name: string; cards: string; note: string }[] = [
  { name: 'Royal Flush', cards: 'As Ks Qs Js Ts', note: 'A-K-Q-J-10, all the same suit. The best hand there is.' },
  { name: 'Straight Flush', cards: '9h 8h 7h 6h 5h', note: 'Five in a row, all the same suit.' },
  { name: 'Four of a Kind', cards: '8s 8h 8d 8c Kd', note: 'Four cards of the same rank.' },
  { name: 'Full House', cards: 'Qs Qh Qd 4c 4s', note: 'Three of one rank plus a pair.' },
  { name: 'Flush', cards: 'Ad 9d 7d 4d 2d', note: 'Any five cards of the same suit.' },
  { name: 'Straight', cards: '10c 9h 8d 7s 6c', note: 'Five in a row, mixed suits. Ace can be high or low (A-2-3-4-5).' },
  { name: 'Three of a Kind', cards: '7s 7h 7d Kc 2s', note: 'Three cards of the same rank.' },
  { name: 'Two Pair', cards: 'Js Jh 5d 5c 9s', note: 'Two different pairs.' },
  { name: 'Pair', cards: 'As Ah 9d 6c 3s', note: 'Two cards of the same rank.' },
  { name: 'High Card', cards: 'As Jh 8d 5c 2s', note: 'Nothing above. Highest card plays.' },
]

export function HandRankings() {
  return (
    <div className="panel-noir rounded-xl p-4">
      <h4 className="font-display gold-text mb-3 text-sm font-bold tracking-[0.25em]">POKER HANDS, BEST TO WORST</h4>
      <ol className="grid gap-2 sm:grid-cols-2">
        {RANKINGS.map((r, i) => (
          <li key={r.name} className="flex items-center gap-3 rounded-lg bg-black/25 px-3 py-2">
            <span className="font-display w-5 text-center text-[13px] font-bold text-[#8a7a4d]">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-[#f2e6c9]">{r.name}</div>
              <div className="mt-1"><MiniCards cards={r.cards} /></div>
              <div className="mt-1 text-[11px] leading-snug text-[#a89872]">{r.note}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

/* ---------- Rules text ---------- */

export type VariantId = 'video' | 'holdem' | 'omaha' | 'stud' | 'three'

export const VARIANTS: { id: VariantId; name: string; blurb: string; how: string }[] = [
  { id: 'video', name: 'Video Poker', blurb: 'Just you · draw', how: 'Jacks or Better' },
  { id: 'holdem', name: "Texas Hold'em", blurb: 'vs 3 players', how: 'The famous one' },
  { id: 'omaha', name: 'Omaha', blurb: 'vs 3 players', how: '4 private cards' },
  { id: 'stud', name: 'Seven-Card Stud', blurb: 'vs 3 players', how: 'No shared cards' },
  { id: 'three', name: 'Three Card', blurb: 'vs the dealer', how: 'Quick rounds' },
]

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="font-display flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#c9a227]/50 text-[12px] font-bold text-[#f6e27a]">{n}</span>
      <span className="text-[13px] leading-relaxed text-[#cbb98a]">{children}</span>
    </li>
  )
}

export function Rules({ variant }: { variant: VariantId }) {
  const steps: ReactNode[] =
    variant === 'video'
      ? [
          <>Pick your bet and press <b>DEAL</b>. You get 5 cards, all face up at once.</>,
          <>Tap the cards you want to <b>HOLD</b> (keep). Keep pairs and anything that is close to a flush or straight.</>,
          <>Press <b>DRAW</b>. Every card you did not hold is replaced, one time only.</>,
          <>You are paid if your final 5 cards make <b>a pair of Jacks or better</b>. There are no opponents: it is you against the paytable below.</>,
        ]
      : variant === 'holdem'
        ? [
            <>Everyone gets <b>2 private cards</b> (your "hole cards"). Only you can see yours.</>,
            <>Five <b>shared cards</b> go face up in the middle, but not all at once: <b>3 (the flop)</b>, then <b>1 (the turn)</b>, then <b>1 (the river)</b>, with a round of betting after each reveal.</>,
            <>Your hand is the <b>best 5 cards from your 2 plus the 5 shared</b>, in any combination.</>,
            <>On your turn: <b>Fold</b> (give up this hand), <b>Check</b> (pass, only when nobody has bet), <b>Call</b> (match the bet) or <b>Raise</b> (bet more).</>,
            <>The best hand at the end wins the pot. If everyone else folds, you win it without showing your cards.</>,
            <>Two players post forced bets ("blinds") before the cards are dealt, and the dealer button moves round the table each hand. This game is <b>fixed-limit</b>: bet sizes are set and there are at most 4 bets per round, so the most you can lose in a hand is capped.</>,
          ]
        : variant === 'omaha'
          ? [
              <>Same as Hold'em, with one big difference: you get <b>4 private cards</b> instead of 2.</>,
              <>The 5 shared cards are revealed in the same way: flop (3), turn (1), river (1), with betting in between.</>,
              <>You <b>must use exactly 2 of your 4 cards and exactly 3 of the 5 shared cards</b>. Not 1, not 3. This is the rule people forget: four hearts on the table is not a flush unless you also hold two hearts.</>,
              <>Betting works exactly like Hold'em (fixed-limit, up to 4 bets a round). Strong hands are more common in Omaha, so pots get bigger.</>,
            ]
          : variant === 'stud'
            ? [
                <>There are <b>no shared cards</b> in Stud. Everyone is dealt their own seven cards, a few at a time, and your hand is the <b>best five of your seven</b>.</>,
                <>Everyone pays a small <b>ante</b>. You are dealt <b>2 cards face down and 1 face up</b> (your "door card"). Everyone can see the face-up cards, so you can watch what your opponents are building.</>,
                <>The player showing the <b>lowest door card</b> must start the betting with a small forced bet called the <b>bring-in</b>. Others can fold, call it, or <b>complete</b> it to a full bet. (Ace counts as high; ties go by suit: clubs, then diamonds, hearts, spades.)</>,
                <>Then everyone gets one more card: <b>4th, 5th and 6th street are dealt face up</b>, and the <b>7th card is dealt face down</b>. There is a round of betting after each. From 4th street on, <b>the best face-up hand bets first</b> (a pair beats ace-high).</>,
                <>Bets are <b>fixed-limit</b>: a small bet on 3rd and 4th street, a big (double) bet from 5th street, and at most 4 bets a round. The most you can lose in a hand is capped and shown before you sit down.</>,
                <>After the last round, whoever is left shows their cards and the <b>best five-card hand wins the pot</b>. If everyone else folds, you win without showing.</>,
              ]
          : [
              <>Place an <b>Ante</b>. You can also add the optional <b>Pair Plus</b> side bet.</>,
              <>You and the dealer each get 3 cards. You see yours, the dealer's stay face down.</>,
              <>Press <b>PLAY</b> to bet again (the same size as your Ante), or <b>FOLD</b> and lose your Ante.</>,
              <>The dealer needs <b>Queen-high or better</b> to qualify. If not, your Ante is paid 1 to 1 and your Play bet is returned. If the dealer qualifies, the higher hand wins both bets 1 to 1.</>,
              <><b>Hands rank differently with 3 cards</b>: Straight Flush, Three of a Kind, Straight, Flush, Pair, High Card. A straight beats a flush here, because it is harder to make.</>,
              <><b>Ante Bonus</b> (if you play): Straight 1 to 1, Three of a Kind 4 to 1, Straight Flush 5 to 1, even if the dealer beats you. <b>Pair Plus</b> pays on your hand alone: Pair 1, Flush 4, Straight 6, Three of a Kind 30, Straight Flush 40.</>,
            ]
  return (
    <div className="panel-noir rounded-xl p-4 sm:p-5">
      <h4 className="font-display gold-text mb-3 text-sm font-bold tracking-[0.25em]">HOW TO PLAY</h4>
      <ol className="space-y-2.5">{steps.map((s, i) => <Step key={i} n={i + 1}>{s}</Step>)}</ol>
    </div>
  )
}

/** The "cards at once vs one by one" explainer for newcomers. */
export function Primer() {
  return (
    <div className="panel-noir rounded-xl p-4 sm:p-5">
      <h4 className="font-display gold-text mb-2 text-sm font-bold tracking-[0.25em]">NEW TO POKER?</h4>
      <p className="text-[13px] leading-relaxed text-[#cbb98a]">
        In every version of poker the goal is the same: make the best five-card hand. The versions differ in <b>how the cards are dealt</b>:
      </p>
      <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-[#cbb98a]">
        <li><b className="text-[#f6e27a]">Video Poker</b>: all 5 cards arrive at once, you swap some once, and the machine pays you. This is the game that was here before.</li>
        <li><b className="text-[#f6e27a]">Texas Hold'em and Omaha</b>: this is the "cards revealed one by one" kind. Shared cards come out in stages (3, then 1, then 1) and you bet against other players between each reveal.</li>
        <li><b className="text-[#f6e27a]">Seven-Card Stud</b>: also "one at a time", but with no shared cards. You are dealt your own seven cards over several rounds, some face up so everyone can see them.</li>
        <li><b className="text-[#f6e27a]">Three Card Poker</b>: a quick one against the dealer with only 3 cards.</li>
      </ul>
      <p className="mt-2 text-[12px] text-[#8a7a4d]">Tip: in Hold'em, Omaha and Seven-Card Stud, turn the Coach on and it will tell you what a sensible player would do and why.</p>
    </div>
  )
}
