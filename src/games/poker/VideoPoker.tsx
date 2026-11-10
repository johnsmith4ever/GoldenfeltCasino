import { useState, type ReactNode } from 'react'
import { freshShoe, evaluatePoker, POKER_PAYS, POKER_LABELS, type Card, type PokerHand } from '../../lib/cards'
import { evaluate5, describeHand } from '../../lib/pokerEval'
import { useChips } from '../../state/chips'
import { sfx } from '../../lib/audio'
import { GameShell, GoldBurst } from '../../components/GameShell'
import { PlayingCard } from '../../components/PlayingCard'
import { ChipSelector } from '../../components/Chip'
import { ResultStrip, useNarrow, type ResultInfo } from './shared'

type Phase = 'betting' | 'hold' | 'done'

const PAY_ORDER: (keyof typeof POKER_PAYS)[] = [
  'ROYAL_FLUSH', 'STRAIGHT_FLUSH', 'FOUR_KIND', 'FULL_HOUSE', 'FLUSH', 'STRAIGHT', 'THREE_KIND', 'TWO_PAIR', 'JACKS_OR_BETTER',
]

export default function VideoPoker({ nav, rules }: { nav: ReactNode; rules: ReactNode }) {
  const { balance, bet, payout } = useChips()
  const narrow = useNarrow()
  const [chipVal, setChipVal] = useState(25)
  const [phase, setPhase] = useState<Phase>('betting')
  const [hand, setHand] = useState<Card[]>([])
  const [deck, setDeck] = useState<Card[]>([])
  const [held, setHeld] = useState<boolean[]>([false, false, false, false, false])
  const [wonHand, setWonHand] = useState<PokerHand | null>(null)
  const [result, setResult] = useState<ResultInfo | null>(null)
  const [burst, setBurst] = useState(0)
  const [wager, setWager] = useState(0)

  const deal = () => {
    if (chipVal > balance || phase !== 'betting') return
    if (!bet(chipVal, true, 'poker')) return
    setWager(chipVal)
    const d = freshShoe(1)
    setHand(d.slice(0, 5))
    setDeck(d.slice(5))
    setHeld([false, false, false, false, false])
    setWonHand(null)
    setResult(null)
    setPhase('hold')
    sfx.deal()
  }

  const toggleHold = (i: number) => {
    if (phase !== 'hold') return
    sfx.click()
    setHeld((h) => h.map((v, j) => (j === i ? !v : v)))
  }

  const draw = () => {
    if (phase !== 'hold') return
    const d = [...deck]
    const newHand = hand.map((c, i) => (held[i] ? c : (d.pop() as Card)))
    setHand(newHand)
    setDeck(d)
    sfx.deal()

    const evald = evaluatePoker(newHand)
    setWonHand(evald)
    setPhase('done')

    setTimeout(() => {
      if (evald !== 'NOTHING') {
        const mult = POKER_PAYS[evald as keyof typeof POKER_PAYS]
        const winAmt = wager * mult
        payout(winAmt, winAmt - wager)
        setBurst((b) => b + 1)
        if (mult >= 25) sfx.bigWin()
        else sfx.win()
        setResult({
          kind: mult === 1 ? 'push' : 'win',
          title: POKER_LABELS[evald].toUpperCase(),
          detail: mult === 1 ? 'Bet returned' : `Pays ${mult} to 1`,
          amount: mult === 1 ? 0 : winAmt - wager,
        })
      } else {
        sfx.lose()
        setResult({ kind: 'lose', title: 'NO WIN', detail: 'You need a pair of Jacks or better' })
      }
    }, 600)
  }

  const newHand = () => {
    setPhase('betting')
    setHand([])
    setHeld([false, false, false, false, false])
    setWonHand(null)
    setResult(null)
    sfx.click()
  }

  // "You have: ..." line so a beginner always knows what they are holding.
  const live = hand.length === 5 ? evaluatePoker(hand) : null
  const liveName = hand.length === 5 ? describeHand(evaluate5(hand)) : ''
  const livePays = live && live !== 'NOTHING' ? POKER_PAYS[live as keyof typeof POKER_PAYS] : 0

  return (
    <GameShell
      screen="poker"
      title="Video Poker"
      tagline="Jacks or Better · hold and draw"
      top={nav}
      side={
        <div className="mx-auto max-w-3xl space-y-4">
          <div>
            <h3 className="font-display text-center text-xs font-bold tracking-[0.3em] text-[#b3a06b]">PAYTABLE</h3>
            <div className="panel-noir mt-3 grid grid-cols-2 gap-x-8 gap-y-1 rounded-lg px-5 py-3 sm:grid-cols-3">
              {PAY_ORDER.map((k) => (
                <div
                  key={k}
                  className={`flex items-center justify-between text-[12px] ${
                    wonHand === k ? 'font-bold text-[#f6e27a] win-glow-anim' : 'text-[#a89872]'
                  }`}
                >
                  <span>{POKER_LABELS[k]}</span>
                  <span className="font-display font-bold tabular-nums">{POKER_PAYS[k]}×</span>
                </div>
              ))}
            </div>
          </div>
          {rules}
        </div>
      }
    >
      <div className="relative">
        <GoldBurst trigger={burst} />

        <div className="flex min-h-[150px] flex-wrap items-center justify-center gap-2 py-4 sm:gap-3">
          {hand.length === 0 && (
            <div className="text-xs tracking-[0.35em] text-white/25">FIVE CARDS · HOLD THE KEEPERS · DRAW</div>
          )}
          {hand.map((c, i) => (
            <div key={`${i}-${c.rank}${c.suit}`} className="flex min-h-[140px] flex-col items-center">
              <PlayingCard
                card={c}
                size={narrow ? 'sm' : 'lg'}
                dealDelay={i * 90}
                held={phase === 'hold' && held[i]}
                onClick={() => toggleHold(i)}
              />
            </div>
          ))}
        </div>

        {hand.length === 5 && (
          <p className="text-center text-[13px] text-[#e8dcb8]">
            You have: <b className="text-[#f6e27a]">{liveName}</b>
            {phase === 'hold' && (
              <span className="text-[#a89872]"> — {livePays ? `pays ${livePays} to 1 as it stands` : 'pays nothing yet (needs Jacks or better)'}</span>
            )}
          </p>
        )}
        {phase === 'hold' && (
          <p className="mt-1 text-center text-[11px] tracking-[0.3em] text-[#b3a06b]">TAP THE CARDS YOU WANT TO KEEP, THEN DRAW</p>
        )}

        <div className="mt-4"><ResultStrip result={result} /></div>

        <div className="mt-5 flex min-h-[90px] flex-col items-center justify-center gap-3">
          {phase === 'betting' && (
            <>
              <ChipSelector selected={chipVal} onSelect={setChipVal} max={balance} />
              <button onClick={() => setChipVal(balance)} disabled={balance < 25} className="btn-ghost-gold min-h-[38px] rounded-lg px-4 text-[10px]">BET ALL</button>
              <button onClick={deal} disabled={chipVal > balance} className="btn-gold min-h-[44px] rounded-lg px-14 py-3 text-sm">
                DEAL — {chipVal}
              </button>
            </>
          )}
          {phase === 'hold' && (
            <button onClick={draw} className="btn-crimson min-h-[44px] rounded-lg px-14 py-3 text-sm">DRAW</button>
          )}
          {phase === 'done' && (
            <button onClick={newHand} className="btn-gold min-h-[44px] rounded-lg px-14 py-3 text-sm">NEW HAND</button>
          )}
        </div>
      </div>
    </GameShell>
  )
}
